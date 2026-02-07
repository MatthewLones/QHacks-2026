import { useCallback, useEffect, useRef } from 'react';
import Globe from './components/Globe';
import LocationCard from './components/LocationCard';
import GlobeControls from './components/GlobeControls';
import VersionBadge from './components/VersionBadge';
import TimeWheelSelector from './components/TimeWheelSelector';
import TravelTo from './components/TravelTo';
import Starfield from './components/Starfield';
import GuideSubtitle from './components/GuideSubtitle';
import LandingWarp from './components/landing/LandingWarp';
import { useAppStore } from './store';
import { useSelectionStore } from './selectionStore';
import { useVoiceConnection } from './hooks/useVoiceConnection';

function App() {
  const phase = useAppStore((s) => s.phase);
  const setPhase = useAppStore((s) => s.setPhase);
  const location = useAppStore((s) => s.location);
  const userProfile = useAppStore((s) => s.userProfile);
  const confirmRequested = useAppStore((s) => s.confirmExplorationRequested);
  const clearConfirm = useAppStore((s) => s.clearConfirmExploration);
  const setSelectedYear = useSelectionStore((s) => s.setSelectedYear);
  const selectedYear = useSelectionStore((s) => s.selectedYear);
  const selectedEra = useSelectionStore((s) => s.selectedEra);

  const voice = useVoiceConnection();

  // Guards to prevent double-firing in StrictMode
  const voiceStartedRef = useRef(false);
  const sessionStartSentRef = useRef(false);

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

  // --- Voice lifecycle ---

  // Auto-connect voice when entering globe phase
  useEffect(() => {
    if (phase === 'globe' && !voiceStartedRef.current) {
      voiceStartedRef.current = true;
      voice.connect();
    }
  }, [phase, voice.connect]);

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

  // Handle confirm exploration request from EnterLocation button
  useEffect(() => {
    if (confirmRequested && voice.status === 'connected') {
      voice.sendConfirmExploration();
      clearConfirm();
    }
  }, [confirmRequested, voice.status, voice.sendConfirmExploration, clearConfirm]);

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

  return (
    <div className="relative w-full h-full bg-[#000008] overflow-hidden">
      {/* Globe view — rendered during both 'landing' (hidden behind overlay,
          pre-loading tiles) and 'globe' (fully visible with UI controls) */}
      {(phase === 'globe' || phase === 'landing') && (
        <>
          <div className="globe-bg absolute inset-0 z-0">
            <Starfield />
          </div>
          <div className="relative z-[1]">
            <Globe />
          </div>
          {/* UI controls only visible after landing completes */}
          {phase === 'globe' && (
            <>
              <VersionBadge />
              <GlobeControls />
              <TimeWheelSelector />
              <TravelTo />
              <LocationCard />
              <GuideSubtitle />
            </>
          )}
        </>
      )}

      {/* Landing overlay — sits on top of globe (z-100), fades out to reveal it */}
      {phase === 'landing' && (
        <LandingWarp onComplete={handleLandingComplete} />
      )}

      {phase === 'loading' && (
        <div className="flex items-center justify-center w-full h-full">
          <p className="text-white/30 text-lg">Loading experience coming soon...</p>
        </div>
      )}

      {phase === 'exploring' && (
        <div className="flex items-center justify-center w-full h-full">
          <p className="text-white/30 text-lg">World explorer coming soon...</p>
        </div>
      )}
    </div>
  );
}

export default App;
