import { useMemo } from 'react';
import Radar from './reactbits/Radar';
import Topography from './reactbits/Topography';
import Noise from './reactbits/Noise';
import type { BackdropKind } from '../lib/backdrops';
import './Backdrop.css';

const PALETTES: Record<'woodland' | 'digital', string[]> = {
  woodland: ['#12170d', '#25311a', '#3c4d25', '#5a6b33'],
  digital: ['#1b2215', '#2f3c24', '#4d5c35', '#7c8460']
};

// Small seeded PRNG so the camo looks the same on every visit.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Tileable value noise: lattice values wrap at `period`, so the tile repeats seamlessly. */
const periodicNoise = (rand: () => number, period: number) => {
  const lattice = Array.from({ length: period * period }, rand);
  const at = (x: number, y: number) => lattice[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    const x = u * period;
    const y = v * period;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const sx = smooth(x - x0);
    const sy = smooth(y - y0);
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return top + (bottom - top) * sy;
  };
};

const camoTile = (kind: 'woodland' | 'digital') => {
  const size = 480;
  const cell = kind === 'digital' ? 8 : 2;
  const grid = size / cell;
  const rand = mulberry32(kind === 'digital' ? 1944 : 1918);
  const octaves = [periodicNoise(rand, 3), periodicNoise(rand, 6), periodicNoise(rand, 12)];
  // Woodland's black "branches": thin bands where a second noise field crosses its midpoint.
  const branches = periodicNoise(rand, 4);
  const weights = kind === 'digital' ? [0.5, 0.3, 0.2] : [0.6, 0.3, 0.1];
  const palette = PALETTES[kind];
  // Thresholds split the noise into four roughly even bands of colour.
  const cuts = [0.4, 0.5, 0.6];

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const u = gx / grid;
      const v = gy / grid;
      const n = octaves.reduce((sum, f, i) => sum + f(u, v) * weights[i], 0);
      const band = cuts.findIndex(c => n < c);
      const branch = kind === 'woodland' && Math.abs(branches(u, v) - 0.5) < 0.03;
      ctx.fillStyle = branch ? '#090c07' : palette[band === -1 ? 3 : band];
      ctx.fillRect(gx * cell, gy * cell, cell, cell);
    }
  }
  return canvas.toDataURL('image/png');
};

function Camo({ kind }: { kind: 'woodland' | 'digital' }) {
  const tile = useMemo(() => camoTile(kind), [kind]);
  return (
    <div
      className={`backdrop__camo backdrop__camo--${kind}`}
      style={{ backgroundImage: `url(${tile})`, backgroundColor: PALETTES[kind][1] }}
    />
  );
}

export default function Backdrop({ kind }: { kind: BackdropKind }) {
  return (
    <div className={`backdrop backdrop--${kind}`} aria-hidden>
      {(kind === 'woodland' || kind === 'digital') && <Camo kind={kind} />}
      {kind === 'radar' && (
        <Radar color="#7bd64a" backgroundColor="#0c120a" targets={5} clutter={0.25} glow={0.8} mouseInteraction={false} />
      )}
      {kind === 'topo' && (
        <div className="backdrop__topo">
          <Topography
            color="#8fae4f"
            lineCount={26}
            markers="plus"
            speed={0.12}
            glow={0.4}
            brightness={0.9}
            mouseInteraction={false}
          />
        </div>
      )}
      <Noise opacity={0.07} blendMode="overlay" fps={0} />
      <div className="backdrop__shade" />
    </div>
  );
}
