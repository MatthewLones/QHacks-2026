import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import GlobeGL from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import { useAppStore } from '../store';
import { reverseGeocode } from '../utils/reverseGeocode';

const CARTO_SUBDOMAINS = ['a', 'b', 'c', 'd'];

function buildVoyagerUrl(x: number, y: number, l: number, labels: boolean): string {
  const subdomain = CARTO_SUBDOMAINS[(x + y) % CARTO_SUBDOMAINS.length];
  const style = labels ? 'rastertiles/voyager_labels_under' : 'rastertiles/voyager_nolabels';
  return `https://${subdomain}.basemaps.cartocdn.com/${style}/${l}/${x}/${y}.png`;
}

const ringColorInterpolator = (t: number) =>
  `rgba(125, 184, 255, ${Math.sqrt(1 - t)})`;

export default function Globe() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const location = useAppStore((s) => s.location);
  const setLocation = useAppStore((s) => s.setLocation);
  const tileMode = useAppStore((s) => s.tileMode);
  const showLabels = useAppStore((s) => s.showLabels);

  const showLabelsRef = useRef(showLabels);
  const tileUrlFn = useCallback((x: number, y: number, l: number) => {
    return buildVoyagerUrl(x, y, l, showLabelsRef.current);
  }, []);

  useEffect(() => {
    showLabelsRef.current = showLabels;
    const globe = globeRef.current;
    if (globe) globe.globeTileEngineClearCache();
  }, [showLabels]);

  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const autoRotateDisabled = useRef(false);

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    setTimeout(() => {
      try {
        const controls = globe.controls();
        if (!autoRotateDisabled.current) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.8;
          const stop = () => {
            if (!autoRotateDisabled.current) {
              autoRotateDisabled.current = true;
              controls.autoRotate = false;
              controls.removeEventListener('start', stop);
            }
          };
          controls.addEventListener('start', stop);
        }
      } catch { /* controls not ready */ }
    }, 300);
  }, []);

  useEffect(() => {
    if (!location || !globeRef.current) return;
    if (!autoRotateDisabled.current) {
      try { globeRef.current.controls().autoRotate = false; autoRotateDisabled.current = true; } catch {}
    }
    globeRef.current.pointOfView({ lat: location.lat, lng: location.lng, altitude: 1.5 }, 1500);
  }, [location]);

  const handleGlobeClick = useCallback(
    async ({ lat, lng }: { lat: number; lng: number }) => {
      setLocation({ lat, lng, name: `${lat.toFixed(2)}, ${lng.toFixed(2)}` });
      const name = await reverseGeocode(lat, lng);
      setLocation({ lat, lng, name });
    },
    [setLocation],
  );

  const pointsData = useMemo(() => (location ? [{ lat: location.lat, lng: location.lng }] : []), [location]);
  const ringsData = useMemo(() => location ? [{ lat: location.lat, lng: location.lng, maxR: 5, propagationSpeed: 3, repeatPeriod: 1200 }] : [], [location]);

  useEffect(() => {
    return () => {
      try { const r = globeRef.current?.renderer(); if (r) { r.dispose(); r.forceContextLoss(); } } catch {}
    };
  }, []);

  const filterClass = tileMode === 'dark' ? 'globe-filter-dark' : 'globe-filter-color';

  return (
    <div className={`globe-wrapper ${filterClass}`}>
      <GlobeGL
        ref={globeRef as React.MutableRefObject<GlobeMethods | undefined>}
        width={dimensions.width}
        height={dimensions.height}
        globeTileEngineUrl={tileUrlFn}
        backgroundColor="rgba(0, 0, 0, 0)"
        showAtmosphere={true}
        atmosphereColor="#6db3f8"
        atmosphereAltitude={0.25}
        animateIn={true}
        onGlobeReady={handleGlobeReady}
        onGlobeClick={handleGlobeClick}
        pointsData={pointsData}
        pointColor={() => '#7db8ff'}
        pointAltitude={0.06}
        pointRadius={0.6}
        pointResolution={12}
        ringsData={ringsData}
        ringColor={() => ringColorInterpolator}
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
      />
    </div>
  );
}
