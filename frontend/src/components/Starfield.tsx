/* ================================================================
   Starfield.tsx — Reusable animated star background

   Renders a tsParticles starfield canvas that fills its parent.
   Uses multiple particle groups for visual variety:
     • Bulk small stars — gentle drift, twinkle
     • Rare bright stars — larger, brighter, slow
     • Shooting stars — fast streaks across the field
   ================================================================ */

import { useRef, useState, useEffect, useMemo } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';

const initDone = { current: false }; // module-level guard (survives unmount)

export default function Starfield() {
  const [ready, setReady] = useState(false);
  const guard = useRef(false);

  useEffect(() => {
    if (guard.current || initDone.current) {
      setReady(true);
      return;
    }
    guard.current = true;
    initDone.current = true;
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  const options: ISourceOptions = useMemo(
    () => ({
      fullScreen: false,
      fpsLimit: 120,
      detectRetina: true,
      background: { color: { value: 'transparent' } },
      interactivity: {
        events: { onHover: { enable: false }, onClick: { enable: false } },
      },
      /* Multiple emitter groups via the particles array syntax isn't
         available in slim, so we use a single config with wide ranges
         plus a second Particles instance for shooters below. */
      particles: {
        color: { value: ['#ffffff', '#e8eaff', '#cdd4ff', '#ffffff', '#ffffff'] },
        number: { value: 300, density: { enable: true } },
        opacity: {
          value: { min: 0.08, max: 0.85 },
          animation: { enable: true, speed: 0.5, sync: false },
        },
        size: { value: { min: 0.3, max: 2.0 } },
        move: {
          enable: true,
          speed: { min: 0.15, max: 0.5 },
          direction: 'none' as const,
          random: true,
          straight: false,
          outModes: { default: 'out' as const },
        },
        links: { enable: false },
        shape: { type: 'circle' },
      },
    }),
    []
  );

  /* Separate config for rare fast "shooting star" streaks */
  const shooterOptions: ISourceOptions = useMemo(
    () => ({
      fullScreen: false,
      fpsLimit: 120,
      detectRetina: true,
      background: { color: { value: 'transparent' } },
      interactivity: {
        events: { onHover: { enable: false }, onClick: { enable: false } },
      },
      particles: {
        color: { value: '#ffffff' },
        number: { value: 3 },
        opacity: {
          value: { min: 0.2, max: 0.6 },
          animation: { enable: true, speed: 1.5, sync: false },
        },
        size: { value: { min: 0.6, max: 1.2 } },
        move: {
          enable: true,
          speed: { min: 3, max: 8 },
          direction: 'none' as const,
          random: true,
          straight: true,
          outModes: { default: 'out' as const },
        },
        links: { enable: false },
        shape: { type: 'circle' },
        life: {
          count: 0,
          duration: { value: 2, sync: false },
          delay: { value: 5, sync: false },
        },
      },
    }),
    []
  );

  if (!ready) return null;

  return (
    <div className="starfield-bg">
      <Particles id="globe-starfield" options={options} />
      <Particles id="globe-shooters" options={shooterOptions} />
    </div>
  );
}
