/** Woodland greens for the website; stone is the grey-green camo around the team sheet. */
export type CamoKind = 'woodland' | 'stone';

export const CAMO_PALETTES: Record<CamoKind, string[]> = {
  woodland: ['#12170d', '#25311a', '#3c4d25', '#5a6b33'],
  stone: ['#2b3025', '#565d48', '#7f8670', '#adb19e']
};

/** Small seeded PRNG so patterns look the same every time. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Tileable value noise over [0,1)²: lattice values wrap at `period`, so the field repeats seamlessly. */
export const periodicNoise = (rand: () => number, period: number) => {
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

const tiles = new Map<CamoKind, HTMLCanvasElement>();

/** A seamless 480px camo tile, generated once per kind. */
export const camoTile = (kind: CamoKind): HTMLCanvasElement => {
  const cached = tiles.get(kind);
  if (cached) return cached;

  const size = 480;
  const cell = 2;
  const grid = size / cell;
  const rand = mulberry32(kind === 'stone' ? 1940 : 1918);
  const octaves = [periodicNoise(rand, 3), periodicNoise(rand, 6), periodicNoise(rand, 12)];
  // Woodland's black "branches": thin bands where a second noise field crosses its midpoint.
  const branches = periodicNoise(rand, 4);
  const weights = kind === 'stone' ? [0.55, 0.3, 0.15] : [0.6, 0.3, 0.1];
  const palette = CAMO_PALETTES[kind];
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
  tiles.set(kind, canvas);
  return canvas;
};
