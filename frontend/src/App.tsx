import { useCallback, useEffect, useRef, useState } from 'react';
import Globe from './components/Globe';
import LocationCard from './components/LocationCard';
import GlobeControls from './components/GlobeControls';
import VersionBadge from './components/VersionBadge';
import TimeWheelSelector from './components/TimeWheelSelector';
import TravelTo from './components/TravelTo';
import GlobeStarfield from './components/GlobeStarfield';
import LoadingOverlay from './components/LoadingOverlay';
import WorldExplorer from './components/WorldExplorer';
import HyperspaceCanvas, { DEFAULT_IDLE_VELOCITY } from './components/HyperspaceCanvas';
import type { HyperspaceHandle } from './components/HyperspaceCanvas';
import GuideSubtitle from './components/GuideSubtitle';
import UserSpeakingIndicator from './components/UserSpeakingIndicator';
import LandingWarp from './components/landing/LandingWarp';
import { useAppStore } from './store';
import { useSelectionStore } from './selectionStore';
import { useVoiceConnection } from './hooks/useVoiceConnection';
import { musicService } from './audio/MusicService';
import { generateWorldFromHardcodedPrompt } from './utils/worldGeneration';

type WarpState = 'idle' | 'initiating' | 'jumping';

function App() {
  const phase = useAppStore((s) => s.phase);
  const setPhase = useAppStore((s) => s.setPhase);
  const location = useAppStore((s) => s.location);
  const userProfile = useAppStore((s) => s.userProfile);
  const setWorldStatus = useAppStore((s) => s.setWorldStatus);
  const setRenderableWorldData = useAppStore((s) => s.setRenderableWorldData);
  const setSelectedYear = useSelectionStore((s) => s.setSelectedYear);
  const selectedYear = useSelectionStore((s) => s.selectedYear);
  const selectedEra = useSelectionStore((s) => s.selectedEra);

  // --- EJ: Hyperspace warp state ---
  const hyperspaceRef = useRef<HyperspaceHandle>(null);
  const [warpState, setWarpState] = useState<WarpState>('idle');
  const rootRef = useRef<HTMLDivElement>(null);
  const slowIdleVelocity = 1 + (DEFAULT_IDLE_VELOCITY - 1) * 0.5;
  const idleVelocity =
    (phase === 'globe' || phase === 'landing') && warpState === 'idle'
      ? slowIdleVelocity
      : DEFAULT_IDLE_VELOCITY;

  // --- Matt: Voice pipeline state ---
  const voice = useVoiceConnection();
  const voiceStartedRef = useRef(false);
  const sessionStartSentRef = useRef(false);
  const loadingGenerationStartedRef = useRef(false);

  /* When the landing warp finishes:
     1. Set the chosen year in the selection store (updates era + meta)
     2. Switch phase to 'globe' — reveals the globe + UI controls */
  const handleLandingComplete = useCallback(
    (year: number) => {
      setSelectedYear(year);
      setPhase('globe');
    },
    [setSelectedYear, setPhase]
  );

  /* When the hyperspace jump finishes → transition to loading phase */
  const handleJumpComplete = useCallback(() => {
    setWarpState('idle');
    setPhase('loading');
  }, [setPhase]);

  const handleEnterButtonPress = useCallback(() => {
    if (phase !== 'globe' || warpState !== 'idle') return;

    // Stop STT/TTS immediately on Enter press so loading/exploring stay transcript-free.
    if (voice.status !== 'disconnected') {
      voice.disconnect();
    }

    setWarpState('initiating');
    hyperspaceRef.current?.initiate();

    let released = false;
    const endPress = () => {
      if (released) return;
      released = true;
      setWarpState('jumping');
      hyperspaceRef.current?.release();
    };

    window.addEventListener('pointerup', endPress, { once: true });
    window.addEventListener('pointercancel', endPress, { once: true });
  }, [phase, warpState, voice.status, voice.disconnect]);

  // --- Voice lifecycle ---

  // Auto-connect voice when entering globe phase
  useEffect(() => {
    if (phase === 'globe' && !voiceStartedRef.current) {
      voiceStartedRef.current = true;
      voice.connect();
    } else if (phase !== 'globe') {
      voiceStartedRef.current = false;
      sessionStartSentRef.current = false;
    }
  }, [phase, voice.connect]);

  // Disable voice transcription outside globe phase to keep loading/exploring clean.
  useEffect(() => {
    if ((phase === 'loading' || phase === 'exploring') && voice.status === 'connected') {
      voice.disconnect();
    }
  }, [phase, voice.status, voice.disconnect]);

  // After voice connects, send session_start to trigger AI welcome
  useEffect(() => {
    if (
      voice.status === 'connected' &&
      phase === 'globe' &&
      !sessionStartSentRef.current
    ) {
      sessionStartSentRef.current = true;
      // Small delay to ensure STT stream is ready on backend
      const timer = setTimeout(() => {
        voice.sendSessionStart({
          label: selectedEra,
          year: selectedYear,
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [voice.status, phase, selectedEra, selectedYear, voice.sendSessionStart]);

  // Send context updates when location changes
  useEffect(() => {
    if (location && voice.status === 'connected') {
      voice.sendContext(location, {
        label: selectedEra,
        year: selectedYear,
      });
    }
  }, [location, voice.status, selectedEra, selectedYear, voice.sendContext]);

  // Keep backend phase context in sync with frontend lifecycle.
  useEffect(() => {
    if (voice.status !== 'connected') return;
    const backendPhase =
      phase === 'globe' ? 'globe_selection' : phase;
    voice.sendPhase(backendPhase);
  }, [phase, voice.status, voice.sendPhase]);

  // Start ambient music when globe phase begins
  useEffect(() => {
    if (phase === 'globe') {
      musicService.play('/music/ambient-globe.mp3', { loop: true, fadeInMs: 3000 });
    }
  }, [phase]);

  // Stop music when leaving globe/loading phases
  useEffect(() => {
    if (phase !== 'globe' && phase !== 'loading') {
      musicService.stop(2000);
    }
  }, [phase]);

  // When session summary arrives, wait for goodbye audio then transition
  useEffect(() => {
    if (userProfile && phase === 'globe') {
      const timer = setTimeout(() => {
        voice.disconnect();
        setPhase('loading');
      }, 4000); // 4s for goodbye TTS to finish playing
      return () => clearTimeout(timer);
    }
  }, [userProfile, phase, voice.disconnect, setPhase]);

  // Trigger hardcoded World Labs generation once loading starfield is visible.
  useEffect(() => {
    if (phase !== 'loading') {
      loadingGenerationStartedRef.current = false;
      return;
    }
    if (loadingGenerationStartedRef.current) return;
    loadingGenerationStartedRef.current = true;

    const abortController = new AbortController();
    setWorldStatus('generating');
    console.log('[WORLD] loading phase entered, requesting hardcoded generation...');

    void (async () => {
      try {
        const result = await generateWorldFromHardcodedPrompt(abortController.signal);
        if (abortController.signal.aborted) return;
        console.log('[WORLD] generation complete, switching to exploring:', {
          worldId: result.worldId,
          displayName: result.displayName,
          defaultSpzUrl: result.assets.defaultSpzUrl,
          marbleUrl: result.assets.worldMarbleUrl,
          spzVariants: Object.keys(result.assets.spzUrls),
        });

        setRenderableWorldData(result.worldId, {
          spzUrls: result.assets.spzUrls,
          defaultSpzUrl: result.assets.defaultSpzUrl,
          colliderMeshUrl: result.assets.colliderMeshUrl,
          panoUrl: result.assets.panoUrl,
          thumbnailUrl: result.assets.thumbnailUrl,
          caption: result.assets.caption,
          worldMarbleUrl: result.assets.worldMarbleUrl,
        });
        setPhase('exploring');
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error('[WORLD] hardcoded generation failed:', err);
        setWorldStatus('error');
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [phase, setPhase, setRenderableWorldData, setWorldStatus]);

  /* Determine if globe + UI should be visible */
  const showGlobe = phase === 'globe' || phase === 'landing';
  const showGlobeUI = phase === 'globe' && warpState === 'idle';
  const globeFading = warpState === 'jumping';
  const showIdleStarfield = phase === 'globe' && warpState === 'idle';
  const showGlobeStarfield = phase === 'globe';

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="relative w-full h-full bg-[#000008] overflow-hidden"
      style={{ outline: 'none' }}
    >
      {/* Hyperspace canvas — always behind everything, runs during globe + loading */}
      {(showGlobe || phase === 'loading') && (
        <div
          className="globe-bg absolute inset-0 z-0"
          style={{ opacity: showIdleStarfield ? 0 : 1, transition: 'opacity 200ms ease' }}
        >
          <HyperspaceCanvas
            ref={hyperspaceRef}
            onJumpComplete={handleJumpComplete}
            idleVelocity={idleVelocity}
          />
        </div>
      )}

      {showGlobeStarfield && <GlobeStarfield visible={showIdleStarfield} />}

      {/* Globe — visible during landing (preloading) and globe phase */}
      {showGlobe && (
        <div
          className={`relative z-[1] ${globeFading ? 'globe-fade-out' : ''}`}
        >
          <Globe />
        </div>
      )}

      {/* UI controls — only when globe is idle (not warping) */}
      {showGlobeUI && (
        <>
          <VersionBadge />
          <GlobeControls />
          <TimeWheelSelector onEnterPress={handleEnterButtonPress} />
          <TravelTo />
          <LocationCard />
          <GuideSubtitle />
          <UserSpeakingIndicator />
        </>
      )}

      {/* Landing overlay — sits on top (z-100), fades out to reveal globe */}
      {phase === 'landing' && (
        <LandingWarp onComplete={handleLandingComplete} />
      )}

      {/* Loading phase */}
      {phase === 'loading' && (
        <LoadingOverlay />
      )}

      {phase === 'exploring' && (
        <WorldExplorer />
      )}
    </div>
  );
}

export default App;
