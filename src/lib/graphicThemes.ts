import { mulberry32 } from './camo';

export const W = 1080;
export const H = 1350;
export const HEADER = 230;

// The slash runs from upper-right to lower-left of the body area.
export const SLASH_TOP = W * 0.63;
export const SLASH_BOTTOM = W * 0.37;
export const slashX = (y: number) => SLASH_TOP + ((y - HEADER) / (H - HEADER)) * (SLASH_BOTTOM - SLASH_TOP);

export const lightsShape = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(0, HEADER);
  ctx.lineTo(SLASH_TOP, HEADER);
  ctx.lineTo(SLASH_BOTTOM, H);
  ctx.lineTo(0, H);
  ctx.closePath();
};

export const darksShape = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(SLASH_TOP, HEADER);
  ctx.lineTo(W, HEADER);
  ctx.lineTo(W, H);
  ctx.lineTo(SLASH_BOTTOM, H);
  ctx.closePath();
};

const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const STENCIL = '"Black Ops One", "Barlow Condensed", sans-serif';
const TYPEWRITER = '"Special Elite", "Courier New", monospace';
const MONO = '"Share Tech Mono", "Courier New", monospace';
const BODY = 'Inter, system-ui, sans-serif';
const MARKER = '"Permanent Marker", "Comic Sans MS", cursive';
const HAND = '"Gochi Hand", "Comic Sans MS", cursive';
const MASTHEAD = '"Playfair Display", Georgia, serif';
const SERIF = '"Libre Baskerville", Georgia, serif';

export const FONT_LOADS = [
  `800 100px ${DISPLAY}`,
  `700 40px ${DISPLAY}`,
  `600 40px ${DISPLAY}`,
  `60px ${STENCIL}`,
  `40px ${TYPEWRITER}`,
  `40px ${MONO}`,
  `500 40px ${BODY}`,
  `600 40px ${BODY}`,
  `60px ${MARKER}`,
  `40px ${HAND}`,
  `italic 900 60px ${MASTHEAD}`,
  `40px ${SERIF}`,
  `700 40px ${SERIF}`
];

type Side = {
  title: string;
  sub: string;
  pill: string;
  pillText: string;
  pillStroke?: string;
};

export type Theme = {
  label: string;
  /** Paints everything static: both halves and the header band. */
  background: (ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) => void;
  /** Drawn on top of everything else (stamps, scanlines, HUD). `t` is the animation time; 1 for a still. */
  overlay?: (ctx: CanvasRenderingContext2D, t: number) => void;
  headerTitle: string;
  headerDate: string;
  headerFont: (px: number) => string;
  /** Header text colours; white by default. */
  headerText?: string;
  headerSub?: string;
  rule: [string, string];
  lights: Side;
  darks: Side;
  slash: { kind: 'line' | 'glow' | 'chalk'; color: string; width: number };
  vs: { fill: string; ring: string; text: string };
  goalie: { fill: string; text: string };
  titleFont: (px: number) => string;
  subFont: (px: number) => string;
  nameFont: (px: number) => string;
  pillRadius: number;
  tintLogo?: string;
  /** Re-draws the picture as a dot-matrix board, one LED per `cell` pixels. */
  led?: { cell: number };
  /** Shared as a looping GIF rather than a still. */
  animated?: boolean;
};

/** A tile of fine random grain, used to give flat colour some texture. */
const grain = (alpha: number, seed: number) => {
  const c = document.createElement('canvas');
  c.width = c.height = 200;
  const g = c.getContext('2d')!;
  const img = g.createImageData(200, 200);
  const rand = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rand() < 0.5 ? 0 : 255;
    img.data.set([v, v, v, Math.round(rand() * alpha)], i);
  }
  g.putImageData(img, 0, 0);
  return c;
};

const fillPattern = (ctx: CanvasRenderingContext2D, tile: HTMLCanvasElement) => {
  ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
  ctx.fillRect(0, 0, W, H);
};

const clipped = (ctx: CanvasRenderingContext2D, shape: (c: CanvasRenderingContext2D) => void, draw: () => void) => {
  ctx.save();
  shape(ctx);
  ctx.clip();
  draw();
  ctx.restore();
};

const PAD_RULE = 50;

const headerBand = (ctx: CanvasRenderingContext2D, fill: string) => {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, W, HEADER);
};

// ---------- Rink: overhead ice markings ----------

const rinkLines = (ctx: CanvasRenderingContext2D, red: string, blue: string, border: string) => {
  const mid = HEADER + (H - HEADER) / 2;
  ctx.lineWidth = 6;
  ctx.strokeStyle = border;
  ctx.beginPath();
  ctx.roundRect(36, HEADER + 36, W - 72, H - HEADER - 72, 170);
  ctx.stroke();

  ctx.fillStyle = red;
  ctx.fillRect(36, mid - 7, W - 72, 14);
  ctx.fillRect(36, HEADER + 150, W - 72, 4);
  ctx.fillRect(36, H - 154, W - 72, 4);
  ctx.fillStyle = blue;
  ctx.fillRect(36, mid - 250, W - 72, 16);
  ctx.fillRect(36, mid + 234, W - 72, 16);

  ctx.strokeStyle = blue;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(W / 2, mid, 150, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = red;
  ctx.fillStyle = red;
  for (const [x, y] of [
    [W * 0.27, HEADER + 300],
    [W * 0.73, HEADER + 300],
    [W * 0.27, H - 300],
    [W * 0.73, H - 300]
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 115, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.fillRect(x + s * 115 - (s > 0 ? 0 : 24), y - 30, 24, 4);
      ctx.fillRect(x + s * 115 - (s > 0 ? 0 : 24), y + 26, 24, 4);
    }
  }
};

const rink: Theme = {
  label: 'Rink',
  background: ctx => {
    const ice = ctx.createLinearGradient(0, HEADER, 0, H);
    ice.addColorStop(0, '#f7fafc');
    ice.addColorStop(1, '#e6eef2');
    ctx.fillStyle = ice;
    ctx.fillRect(0, 0, W, H);
    clipped(ctx, lightsShape, () =>
      rinkLines(ctx, 'rgba(200, 16, 46, 0.3)', 'rgba(0, 51, 160, 0.24)', 'rgba(15, 81, 50, 0.3)')
    );
    clipped(ctx, darksShape, () => {
      const g = ctx.createLinearGradient(0, HEADER, 0, H);
      g.addColorStop(0, '#11472d');
      g.addColorStop(1, '#0a3220');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      rinkLines(ctx, 'rgba(185, 226, 200, 0.2)', 'rgba(185, 226, 200, 0.16)', 'rgba(185, 226, 200, 0.22)');
    });
    headerBand(ctx, '#0b1a11');
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: '',
  headerFont: px => `${px}px ${STENCIL}`,
  rule: ['#ffffff', '#c8102e'],
  lights: { title: '#0f5132', sub: '#1f8a4c', pill: 'rgba(255, 255, 255, 0.92)', pillText: '#0f3d26', pillStroke: 'rgba(15, 81, 50, 0.18)' },
  darks: { title: '#ffffff', sub: '#b9e2c8', pill: 'rgba(255, 255, 255, 0.1)', pillText: '#ffffff' },
  slash: { kind: 'line', color: '#c8102e', width: 18 },
  vs: { fill: '#ffffff', ring: '#c8102e', text: '#0f5132' },
  goalie: { fill: '#c8102e', text: '#ffffff' },
  titleFont: px => `800 ${px}px ${DISPLAY}`,
  subFont: px => `600 ${px}px ${DISPLAY}`,
  nameFont: px => `500 ${px}px ${BODY}`,
  pillRadius: 12
};

// ---------- Matchday: dark poster with glow ----------

const matchday: Theme = {
  label: 'Matchday',
  background: (ctx, logo) => {
    ctx.fillStyle = '#060a05';
    ctx.fillRect(0, 0, W, H);
    const glow = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    glow(W * 0.8, H * 0.62, 760, 'rgba(46, 158, 91, 0.5)');
    glow(W * 0.15, H * 0.55, 640, 'rgba(255, 255, 255, 0.12)');
    // Floodlight beams from the top.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (const [x, spread] of [
      [W * 0.2, 0.35],
      [W * 0.5, 0.22],
      [W * 0.8, 0.32]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x - 20, HEADER);
      ctx.lineTo(x + 20, HEADER);
      ctx.lineTo(x + W * spread, H);
      ctx.lineTo(x - W * spread, H);
      ctx.closePath();
      ctx.fill();
    }
    if (logo) {
      ctx.globalAlpha = 0.07;
      const h = 820;
      ctx.drawImage(logo, W / 2 - (logo.width * h) / logo.height / 2, HEADER + 160, (logo.width * h) / logo.height, h);
      ctx.globalAlpha = 1;
    }
    fillPattern(ctx, grain(26, 3));
    headerBand(ctx, 'rgba(0, 0, 0, 0.55)');
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: '',
  headerFont: px => `${px}px ${STENCIL}`,
  rule: ['#ffffff', '#a3e635'],
  lights: { title: '#ffffff', sub: '#cfd8c4', pill: 'rgba(255, 255, 255, 0.94)', pillText: '#0c140a' },
  darks: { title: '#a3e635', sub: '#a3e635', pill: '#1f8a4c', pillText: '#ffffff' },
  slash: { kind: 'glow', color: '#a3e635', width: 12 },
  vs: { fill: '#a3e635', ring: '#ffffff', text: '#0c120a' },
  goalie: { fill: '#a3e635', text: '#0c120a' },
  titleFont: px => `${Math.round(px * 0.92)}px ${STENCIL}`,
  subFont: px => `600 ${px}px ${DISPLAY}`,
  nameFont: px => `600 ${px}px ${DISPLAY}`,
  pillRadius: 6
};

// ---------- Dossier: top-secret briefing sheet ----------

const dossier: Theme = {
  label: 'Dossier',
  background: ctx => {
    ctx.fillStyle = '#e8dab2';
    ctx.fillRect(0, 0, W, H);
    // Ruled lines and a red margin, like a form.
    ctx.fillStyle = 'rgba(90, 70, 30, 0.13)';
    for (let y = HEADER + 60; y < H; y += 64) ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = 'rgba(179, 38, 30, 0.35)';
    ctx.fillRect(44, HEADER, 3, H - HEADER);
    clipped(ctx, darksShape, () => {
      ctx.fillStyle = '#3c4622';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = HEADER + 60; y < H; y += 64) ctx.fillRect(0, y, W, 2);
    });
    fillPattern(ctx, grain(40, 11));
    // Darkened, worn edges.
    const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
    edge.addColorStop(0, 'rgba(60, 40, 10, 0)');
    edge.addColorStop(1, 'rgba(60, 40, 10, 0.35)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
    headerBand(ctx, '#262c15');
  },
  overlay: ctx => {
    const stamp = (text: string, x: number, y: number, angle: number, color: string, px: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.font = `${px}px ${STENCIL}`;
      ctx.letterSpacing = '6px';
      const w = ctx.measureText(text).width + 50;
      ctx.strokeStyle = color;
      ctx.lineWidth = 7;
      ctx.strokeRect(-w / 2, -px * 0.75, w, px * 1.5);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 4);
      ctx.restore();
    };
    stamp('TOP SECRET', 300, H - 150, -0.16, 'rgba(179, 38, 30, 0.55)', 74);
    stamp('CLASSIFIED', W - 250, H - 90, 0.08, 'rgba(232, 218, 178, 0.22)', 46);
  },
  headerTitle: 'TEAM SHEET',
  headerDate: 'LIGHTS VS DARKS',
  headerFont: px => `${px}px ${TYPEWRITER}`,
  rule: ['#e8dab2', '#b3261e'],
  lights: { title: '#2a2a22', sub: '#7a5c2e', pill: 'rgba(255, 252, 240, 0.55)', pillText: '#23231d', pillStroke: 'rgba(60, 50, 30, 0.25)' },
  darks: { title: '#e8dab2', sub: '#c9bb8a', pill: 'rgba(0, 0, 0, 0.2)', pillText: '#f1e9d0' },
  slash: { kind: 'line', color: '#1d1d18', width: 14 },
  vs: { fill: '#e8dab2', ring: '#b3261e', text: '#b3261e' },
  goalie: { fill: '#b3261e', text: '#ffffff' },
  titleFont: px => `${Math.round(px * 0.9)}px ${STENCIL}`,
  subFont: px => `${px}px ${TYPEWRITER}`,
  nameFont: px => `${Math.round(px * 0.95)}px ${TYPEWRITER}`,
  pillRadius: 3
};

// ---------- Night vision: green phosphor with a HUD ----------

const NV = '#7dff7d';

const nightVision: Theme = {
  label: 'Night vision',
  background: ctx => {
    ctx.fillStyle = '#020702';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, H * 0.75);
    g.addColorStop(0, '#16441a');
    g.addColorStop(1, '#020702');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    clipped(ctx, lightsShape, () => {
      ctx.fillStyle = 'rgba(125, 255, 125, 0.09)';
      ctx.fillRect(0, 0, W, H);
    });
    // Faint reticle in the middle.
    ctx.strokeStyle = 'rgba(125, 255, 125, 0.12)';
    ctx.lineWidth = 3;
    const cy = HEADER + (H - HEADER) * 0.55;
    ctx.beginPath();
    ctx.arc(W / 2, cy, 260, 0, Math.PI * 2);
    ctx.moveTo(W / 2 - 340, cy);
    ctx.lineTo(W / 2 + 340, cy);
    ctx.moveTo(W / 2, cy - 340);
    ctx.lineTo(W / 2, cy + 340);
    ctx.stroke();
    fillPattern(ctx, grain(34, 9));
    headerBand(ctx, 'rgba(0, 0, 0, 0.6)');
  },
  overlay: ctx => {
    // Scanlines, a bright scan band, vignette and HUD markings.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    const bandY = H * 0.6;
    const band = ctx.createLinearGradient(0, bandY - 80, 0, bandY + 80);
    band.addColorStop(0, 'rgba(125, 255, 125, 0)');
    band.addColorStop(0.5, 'rgba(125, 255, 125, 0.06)');
    band.addColorStop(1, 'rgba(125, 255, 125, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, bandY - 80, W, 160);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(125, 255, 125, 0.7)';
    ctx.lineWidth = 4;
    const m = 34;
    const l = 60;
    for (const [x, y, dx, dy] of [
      [m, HEADER + m, 1, 1],
      [W - m, HEADER + m, -1, 1],
      [m, H - m, 1, -1],
      [W - m, H - m, -1, -1]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * l, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * l);
      ctx.stroke();
    }
    ctx.font = `30px ${MONO}`;
    ctx.letterSpacing = '2px';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(125, 255, 125, 0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('CAM 01 · RINK', m + 20, H - m - 26);
    ctx.textAlign = 'right';
    ctx.fillText('IR ON', W - m - 20, H - m - 26);
    ctx.textAlign = 'center';
    ctx.fillText('REC', W / 2 + 16, H - m - 26);
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(W / 2 - 42, H - m - 27, 9, 0, Math.PI * 2);
    ctx.fill();
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: '',
  headerFont: px => `${px}px ${STENCIL}`,
  rule: [NV, '#0b2a0d'],
  lights: { title: '#c9ffc4', sub: NV, pill: 'rgba(125, 255, 125, 0.13)', pillText: '#dcffd8', pillStroke: 'rgba(125, 255, 125, 0.35)' },
  darks: { title: NV, sub: '#4fcf4f', pill: 'rgba(125, 255, 125, 0.06)', pillText: '#9cf59a', pillStroke: 'rgba(125, 255, 125, 0.2)' },
  slash: { kind: 'glow', color: NV, width: 8 },
  vs: { fill: '#041204', ring: NV, text: NV },
  goalie: { fill: NV, text: '#041204' },
  titleFont: px => `${Math.round(px * 0.92)}px ${STENCIL}`,
  subFont: px => `${px}px ${MONO}`,
  nameFont: px => `${Math.round(px * 0.92)}px ${MONO}`,
  pillRadius: 2,
  tintLogo: NV
};

// ---------- Chalkboard: the coach's tactics board ----------

/** A slightly wobbly chalk stroke: the same path drawn a few times with jitter. */
const chalkPath = (ctx: CanvasRenderingContext2D, rand: () => number, points: [number, number][], width: number, color: string) => {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 3; pass++) {
    ctx.lineWidth = width * (0.5 + rand() * 0.5);
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const jx = x + (rand() - 0.5) * 4;
      const jy = y + (rand() - 0.5) * 4;
      if (i === 0) ctx.moveTo(jx, jy);
      else ctx.lineTo(jx, jy);
    });
    ctx.stroke();
  }
};

const circlePoints = (cx: number, cy: number, r: number, steps = 40): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

const chalkboard: Theme = {
  label: 'Chalkboard',
  background: ctx => {
    ctx.fillStyle = '#1f3a2a';
    ctx.fillRect(0, 0, W, H);
    const rand = mulberry32(21);
    // Half-rubbed-out chalk smudges.
    for (let i = 0; i < 18; i++) {
      const x = rand() * W;
      const y = HEADER + rand() * (H - HEADER);
      const r = 150 + rand() * 260;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    clipped(ctx, darksShape, () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.fillRect(0, 0, W, H);
    });
    // Faint old tactics: a rink outline, X's and O's and arrows.
    const faint = 'rgba(255, 255, 255, 0.13)';
    const mid = HEADER + (H - HEADER) / 2;
    const rink: [number, number][] = [
      [120, HEADER + 40], [W - 120, HEADER + 40], [W - 50, HEADER + 120], [W - 50, H - 120], [W - 120, H - 40],
      [120, H - 40], [50, H - 120], [50, HEADER + 120], [120, HEADER + 40]
    ];
    chalkPath(ctx, rand, rink, 5, faint);
    chalkPath(ctx, rand, [[50, mid], [W - 50, mid]], 4, faint);
    chalkPath(ctx, rand, circlePoints(W / 2, mid, 120), 4, faint);
    for (const [x, y] of [[180, H - 330], [320, H - 230], [230, H - 140]]) {
      chalkPath(ctx, rand, [[x - 22, y - 22], [x + 22, y + 22]], 6, faint);
      chalkPath(ctx, rand, [[x + 22, y - 22], [x - 22, y + 22]], 6, faint);
    }
    for (const [x, y] of [[W - 200, H - 320], [W - 330, H - 210], [W - 180, H - 150]]) {
      chalkPath(ctx, rand, circlePoints(x, y, 24, 16), 6, faint);
    }
    chalkPath(ctx, rand, [[360, H - 260], [460, H - 330], [580, H - 340], [660, H - 300]], 4, faint);
    chalkPath(ctx, rand, [[640, H - 322], [662, H - 300], [634, H - 286]], 4, faint);
    fillPattern(ctx, grain(30, 13));
    // Wooden frame along the top.
    headerBand(ctx, '#3a2716');
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 2;
    for (let y = 12; y < HEADER; y += 17) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.3, y + 6, W * 0.6, y - 6, W, y + 3);
      ctx.stroke();
    }
  },
  // A light dusting of grain over the writing so it reads as chalk.
  overlay: ctx => {
    ctx.globalAlpha = 0.45;
    fillPattern(ctx, grain(70, 17));
    ctx.globalAlpha = 1;
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: "TONIGHT'S LINE-UP",
  headerFont: px => `${px}px ${MARKER}`,
  headerSub: '#e9d7b4',
  rule: ['#c9a26b', '#2a1b0e'],
  lights: { title: '#ffffff', sub: 'rgba(255, 255, 255, 0.75)', pill: 'rgba(255, 255, 255, 0.06)', pillText: '#f6f6ef', pillStroke: 'rgba(255, 255, 255, 0.3)' },
  darks: { title: '#f4e285', sub: 'rgba(244, 226, 133, 0.8)', pill: 'rgba(244, 226, 133, 0.06)', pillText: '#f4e285', pillStroke: 'rgba(244, 226, 133, 0.32)' },
  slash: { kind: 'chalk', color: 'rgba(255, 255, 255, 0.9)', width: 12 },
  vs: { fill: '#1f3a2a', ring: '#ffffff', text: '#ffffff' },
  goalie: { fill: '#f4e285', text: '#1f3a2a' },
  titleFont: px => `${Math.round(px * 0.92)}px ${MARKER}`,
  subFont: px => `${px}px ${HAND}`,
  nameFont: px => `${Math.round(px * 1.08)}px ${HAND}`,
  pillRadius: 8
};

// ---------- Back page: the newspaper sports pages ----------

const halftone = (color: string) => {
  const c = document.createElement('canvas');
  c.width = c.height = 10;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.beginPath();
  g.arc(5, 5, 1.6, 0, Math.PI * 2);
  g.fill();
  return c;
};

const PAPER = '#efe9da';
const INK = '#1b2420';

const backPage: Theme = {
  label: 'Back page',
  background: ctx => {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    fillPattern(ctx, halftone('rgba(0, 0, 0, 0.05)'));
    clipped(ctx, darksShape, () => {
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, W, H);
      fillPattern(ctx, halftone('rgba(255, 255, 255, 0.05)'));
    });
    fillPattern(ctx, grain(26, 31));
    // Thin rule under the masthead's top edge, like a printed page.
    ctx.fillStyle = INK;
    ctx.fillRect(PAD_RULE, 14, W - PAD_RULE * 2, 3);
  },
  overlay: ctx => {
    ctx.font = `700 22px ${SERIF}`;
    ctx.letterSpacing = '3px';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b6153';
    ctx.fillText('LATE EDITION', 52, H - 26);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9d9583';
    ctx.fillText('PRICE: ONE PINT', W - 52, H - 26);
  },
  headerTitle: 'DADS ARMY GAZETTE',
  headerDate: 'TEAMS ANNOUNCED',
  headerFont: px => `italic 900 ${px}px ${MASTHEAD}`,
  headerText: '#111111',
  headerSub: '#6b6153',
  rule: ['#111111', PAPER],
  lights: { title: '#111111', sub: '#6b6153', pill: 'rgba(0, 0, 0, 0.035)', pillText: '#141414', pillStroke: 'rgba(0, 0, 0, 0.35)' },
  darks: { title: PAPER, sub: '#b8b09c', pill: 'rgba(255, 255, 255, 0.06)', pillText: PAPER, pillStroke: 'rgba(239, 233, 218, 0.35)' },
  slash: { kind: 'line', color: '#b3261e', width: 10 },
  vs: { fill: PAPER, ring: '#111111', text: '#111111' },
  goalie: { fill: '#b3261e', text: '#ffffff' },
  titleFont: px => `italic 900 ${Math.round(px * 0.95)}px ${MASTHEAD}`,
  subFont: px => `700 ${Math.round(px * 0.8)}px ${SERIF}`,
  nameFont: px => `${Math.round(px * 0.88)}px ${SERIF}`,
  pillRadius: 0
};

// ---------- Frozen: frosted ice and cracks ----------

/** A frost crystal: a line that splits into smaller branches. */
const frost = (ctx: CanvasRenderingContext2D, rand: () => number, x: number, y: number, angle: number, len: number, depth: number) => {
  const x2 = x + Math.cos(angle) * len;
  const y2 = y + Math.sin(angle) * len;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (depth <= 0) return;
  for (const turn of [-1, 1]) {
    const at = 0.35 + rand() * 0.45;
    frost(ctx, rand, x + (x2 - x) * at, y + (y2 - y) * at, angle + turn * (0.9 + rand() * 0.3), len * 0.45, depth - 1);
  }
  frost(ctx, rand, x2, y2, angle + (rand() - 0.5) * 0.6, len * 0.7, depth - 1);
};

const frozen: Theme = {
  label: 'Frozen',
  background: ctx => {
    const ice = ctx.createLinearGradient(0, HEADER, W * 0.6, H);
    ice.addColorStop(0, '#f6fcff');
    ice.addColorStop(1, '#cfe8f2');
    ctx.fillStyle = ice;
    ctx.fillRect(0, 0, W, H);
    const rand = mulberry32(41);
    clipped(ctx, lightsShape, () => {
      // Frost creeping in from the edges.
      ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const edge = rand();
        const [x, y, a] =
          edge < 0.45 ? [0, HEADER + rand() * (H - HEADER), (rand() - 0.5) * 1.2]
          : edge < 0.75 ? [rand() * W * 0.6, H, -Math.PI / 2 + (rand() - 0.5) * 1.2]
          : [rand() * W * 0.6, HEADER, Math.PI / 2 + (rand() - 0.5) * 1.2];
        ctx.strokeStyle = rand() < 0.5 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(120, 190, 215, 0.35)';
        frost(ctx, rand, x, y, a, 80 + rand() * 120, 3);
      }
    });
    clipped(ctx, darksShape, () => {
      const deep = ctx.createLinearGradient(W, HEADER, W * 0.4, H);
      deep.addColorStop(0, '#0d4740');
      deep.addColorStop(1, '#062521');
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, W, H);
      // Cracks through the ice.
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        let x = SLASH_BOTTOM + rand() * (W - SLASH_BOTTOM);
        let y = HEADER + rand() * (H - HEADER);
        ctx.strokeStyle = `rgba(190, 240, 255, ${0.12 + rand() * 0.15})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 12; s++) {
          x += (rand() - 0.5) * 90;
          y += (rand() - 0.3) * 70;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
    fillPattern(ctx, grain(16, 43));
    headerBand(ctx, '#05221f');
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: '',
  headerFont: px => `800 ${Math.round(px * 1.1)}px ${DISPLAY}`,
  headerSub: '#9fe2ef',
  rule: ['#e6fbff', '#7fd6e8'],
  lights: { title: '#0b4f5f', sub: '#3a8ca0', pill: 'rgba(255, 255, 255, 0.62)', pillText: '#0b3d4a', pillStroke: 'rgba(255, 255, 255, 0.95)' },
  darks: { title: '#e6fbff', sub: '#8fd9e8', pill: 'rgba(230, 251, 255, 0.08)', pillText: '#e6fbff', pillStroke: 'rgba(143, 217, 232, 0.32)' },
  slash: { kind: 'glow', color: '#bff3ff', width: 10 },
  vs: { fill: '#e6fbff', ring: '#7fd6e8', text: '#0b4f5f' },
  goalie: { fill: '#7fd6e8', text: '#05221f' },
  titleFont: px => `800 ${px}px ${DISPLAY}`,
  subFont: px => `600 ${px}px ${DISPLAY}`,
  nameFont: px => `600 ${Math.round(px * 0.95)}px ${BODY}`,
  pillRadius: 14
};

// ---------- Jumbotron: an animated arena scoreboard ----------

const AMBER = '#ffcf40';

const jumbotron: Theme = {
  label: 'Jumbotron',
  animated: true,
  led: { cell: 6 },
  background: ctx => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    clipped(ctx, lightsShape, () => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.fillRect(0, 0, W, H);
    });
    clipped(ctx, darksShape, () => {
      ctx.fillStyle = 'rgba(61, 255, 110, 0.07)';
      ctx.fillRect(0, 0, W, H);
    });
  },
  // Chasing bulbs around the edge of the board.
  overlay: (ctx, t) => {
    const step = Math.floor(t * 36);
    const inset = 14;
    const gap = 27;
    const points: [number, number][] = [];
    for (let x = inset; x <= W - inset; x += gap) points.push([x, inset]);
    for (let y = inset + gap; y <= H - inset; y += gap) points.push([W - inset, y]);
    for (let x = W - inset - gap; x >= inset; x -= gap) points.push([x, H - inset]);
    for (let y = H - inset - gap; y > inset; y -= gap) points.push([inset, y]);
    points.forEach(([x, y], i) => {
      const lit = (i + step) % 4 < 2;
      ctx.fillStyle = lit ? AMBER : '#3a2f0a';
      ctx.shadowColor = lit ? AMBER : 'transparent';
      ctx.shadowBlur = lit ? 12 : 0;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: 'FACE-OFF TONIGHT',
  headerFont: px => `800 ${Math.round(px * 1.05)}px ${DISPLAY}`,
  headerText: AMBER,
  headerSub: '#ff8a2a',
  rule: [AMBER, '#ff3b30'],
  lights: { title: '#ffffff', sub: AMBER, pill: 'rgba(255, 255, 255, 0.05)', pillText: '#ffffff' },
  darks: { title: '#3dff6e', sub: AMBER, pill: 'rgba(61, 255, 110, 0.05)', pillText: '#3dff6e' },
  slash: { kind: 'line', color: AMBER, width: 14 },
  vs: { fill: '#ff3b30', ring: AMBER, text: '#ffffff' },
  goalie: { fill: AMBER, text: '#000000' },
  titleFont: px => `800 ${px}px ${DISPLAY}`,
  subFont: px => `700 ${Math.round(px * 1.2)}px ${DISPLAY}`,
  nameFont: px => `700 ${Math.round(px * 1.25)}px ${DISPLAY}`,
  pillRadius: 0
};

export type GraphicDesign =
  | 'rink'
  | 'matchday'
  | 'dossier'
  | 'nightvision'
  | 'chalkboard'
  | 'backpage'
  | 'frozen'
  | 'jumbotron';

export const THEMES: Record<GraphicDesign, Theme> = {
  rink,
  matchday,
  dossier,
  nightvision: nightVision,
  chalkboard,
  backpage: backPage,
  frozen,
  jumbotron
};

export const GRAPHIC_DESIGNS = (Object.keys(THEMES) as GraphicDesign[]).map(value => ({
  value,
  label: THEMES[value].label,
  animated: !!THEMES[value].animated
}));
