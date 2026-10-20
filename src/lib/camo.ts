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

const tiles = new Map<string, HTMLCanvasElement>();

/**
 * A seamless camo tile, 480px across at `scale` 1 (pass the screen's pixel ratio for a sharp one), generated once
 * per kind and scale. The pattern is worked out on a 240-cell grid and blended smoothly between cells for every
 * pixel, so its edges are clean curves at any size rather than steps.
 */
export const camoTile = (kind: CamoKind, scale = 1): HTMLCanvasElement => {
  const id = `${kind}@${scale}`;
  const cached = tiles.get(id);
  if (cached) return cached;

  const grid = 240;
  const rand = mulberry32(kind === 'stone' ? 1940 : 1918);
  const octaves = [periodicNoise(rand, 3), periodicNoise(rand, 6), periodicNoise(rand, 12)];
  // Woodland's black "branches": thin bands where a second noise field crosses its midpoint.
  const branches = periodicNoise(rand, 4);
  const weights = kind === 'stone' ? [0.55, 0.3, 0.15] : [0.6, 0.3, 0.1];
  // Thresholds split the noise into four roughly even bands of colour.
  const cuts = [0.4, 0.5, 0.6];
  const colours = CAMO_PALETTES[kind].map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const branchColour = [9, 12, 7];

  // The noise fields on the grid, which wraps at its edges like the tile does.
  const field = new Float32Array(grid * grid);
  const branchField = new Float32Array(grid * grid);
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const u = gx / grid;
      const v = gy / grid;
      field[gy * grid + gx] = octaves.reduce((sum, f, i) => sum + f(u, v) * weights[i], 0);
      branchField[gy * grid + gx] = branches(u, v);
    }
  }
  const sample = (values: Float32Array, x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const at = (cx: number, cy: number) => values[(cy % grid) * grid + (cx % grid)];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return top + (bottom - top) * fy;
  };

  const size = Math.round(480 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const step = grid / size;
  for (let y = 0; y < size; y++) {
    const gy = y * step;
    for (let x = 0; x < size; x++) {
      const gx = x * step;
      const branch = kind === 'woodland' && Math.abs(sample(branchField, gx, gy) - 0.5) < 0.03;
      let colour = branchColour;
      if (!branch) {
        const band = cuts.findIndex(c => sample(field, gx, gy) < c);
        colour = colours[band === -1 ? 3 : band];
      }
      const i = (y * size + x) * 4;
      image.data[i] = colour[0];
      image.data[i + 1] = colour[1];
      image.data[i + 2] = colour[2];
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  tiles.set(id, canvas);
  return canvas;
};
