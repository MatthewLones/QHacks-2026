import { useCallback } from 'react';
import Globe from './components/Globe';
import LocationCard from './components/LocationCard';
import GlobeControls from './components/GlobeControls';
import VersionBadge from './components/VersionBadge';
import TimeWheelSelector from './components/TimeWheelSelector';
import Starfield from './components/Starfield';
import LandingWarp from './components/landing/LandingWarp';
import { useAppStore } from './store';
import { useSelectionStore } from './selectionStore';

function App() {
  const phase = useAppStore((s) => s.phase);
  const setPhase = useAppStore((s) => s.setPhase);
  const setSelectedYear = useSelectionStore((s) => s.setSelectedYear);

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
              <LocationCard />
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
