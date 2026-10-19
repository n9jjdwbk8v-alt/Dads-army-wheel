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
export const COMIC = 'Bangers, Impact, sans-serif';
const ENGRAVED = 'Cinzel, Georgia, serif';
const NEON = '"Tilt Neon", "Arial Rounded MT Bold", sans-serif';

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
  `60px ${COMIC}`,
  `700 40px ${ENGRAVED}`,
  `900 60px ${ENGRAVED}`,
  `40px ${NEON}`,
  `italic 800 60px ${DISPLAY}`
];

type Side = {
  title: string;
  sub: string;
  pill: string;
  pillText: string;
  pillStroke?: string;
};

export type NeonPart = 'header' | 'slash' | 'titles' | 'vs' | 'names';

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
  vs: { fill: string; ring: string; text: string; shape?: 'circle' | 'burst' };
  goalie: { fill: string; text: string };
  titleFont: (px: number) => string;
  subFont: (px: number) => string;
  nameFont: (px: number) => string;
  pillRadius: number;
  pillStrokeWidth?: number;
  /** Outline drawn behind the team titles. */
  titleStroke?: { color: string; width: number };
  /** Text and lines glow in their own colour, like lit neon tubes. */
  glow?: number;
  /** Colour of an unlit neon tube while the animation flickers parts on. */
  unlit?: string;
  tintLogo?: string;
  /**
   * Shared as a looping GIF: 'neon' flickers each part on like a sign; 'slide' wipes the slash down, slides the
   * titles and names in and pops the VS badge.
   */
  animated?: 'neon' | 'slide';
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

// ---------- Comic: pop-art comic book page ----------

const halftone = (color: string, size: number, radius: number) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.beginPath();
  g.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  g.fill();
  return c;
};

const comic: Theme = {
  label: 'Comic',
  background: ctx => {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(0, 0, W, H);
    fillPattern(ctx, halftone('rgba(230, 120, 20, 0.35)', 16, 4));
    clipped(ctx, darksShape, () => {
      ctx.fillStyle = '#1fa34a';
      ctx.fillRect(0, 0, W, H);
      fillPattern(ctx, halftone('rgba(5, 60, 25, 0.4)', 16, 4.5));
    });
    // Speed lines bursting out from the VS badge.
    const cx = slashX(HEADER + 115);
    const cy = HEADER + 115;
    const rand = mulberry32(77);
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + rand() * 0.05;
      const spread = 0.012 + rand() * 0.02;
      ctx.fillStyle = i % 2 ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.1)';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 140, cy + Math.sin(a) * 140);
      ctx.lineTo(cx + Math.cos(a - spread) * 1800, cy + Math.sin(a - spread) * 1800);
      ctx.lineTo(cx + Math.cos(a + spread) * 1800, cy + Math.sin(a + spread) * 1800);
      ctx.closePath();
      ctx.fill();
    }
    // A white caption panel with a heavy black border.
    headerBand(ctx, '#ffffff');
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, W - 12, H - 12);
  },
  headerTitle: 'LIGHTS VS DARKS!',
  headerDate: 'TONIGHT',
  headerFont: px => `${Math.round(px * 1.15)}px ${COMIC}`,
  headerText: '#111111',
  headerSub: '#d7263d',
  rule: ['#111111', '#111111'],
  lights: { title: '#ffffff', sub: '#111111', pill: '#ffffff', pillText: '#111111', pillStroke: '#111111' },
  darks: { title: '#ffd23f', sub: '#ffffff', pill: '#111111', pillText: '#ffffff', pillStroke: '#111111' },
  slash: { kind: 'line', color: '#111111', width: 18 },
  vs: { fill: '#d7263d', ring: '#111111', text: '#ffffff', shape: 'burst' },
  goalie: { fill: '#d7263d', text: '#ffffff' },
  titleFont: px => `${Math.round(px * 1.1)}px ${COMIC}`,
  subFont: px => `${Math.round(px * 1.05)}px ${COMIC}`,
  nameFont: px => `${Math.round(px * 1.05)}px ${COMIC}`,
  titleStroke: { color: '#111111', width: 12 },
  pillRadius: 4,
  pillStrokeWidth: 4
};

// ---------- Honour board: clubhouse wood and gold leaf ----------

const woodGrain = (ctx: CanvasRenderingContext2D, rand: () => number, color: string) => {
  ctx.strokeStyle = color;
  for (let y = -40; y < H + 40; y += 9 + rand() * 10) {
    ctx.lineWidth = 1 + rand() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(W * 0.3, y + (rand() - 0.5) * 30, W * 0.7, y + (rand() - 0.5) * 30, W, y + (rand() - 0.5) * 20);
    ctx.stroke();
  }
};

const GOLD = '#e2b852';

const honourBoard: Theme = {
  label: 'Honour board',
  background: ctx => {
    const rand = mulberry32(55);
    const mahogany = ctx.createLinearGradient(0, 0, W, H);
    mahogany.addColorStop(0, '#4a2412');
    mahogany.addColorStop(1, '#2a130a');
    ctx.fillStyle = mahogany;
    ctx.fillRect(0, 0, W, H);
    woodGrain(ctx, rand, 'rgba(0, 0, 0, 0.18)');
    clipped(ctx, lightsShape, () => {
      // Lights are painted on a cream enamel panel.
      const cream = ctx.createLinearGradient(0, HEADER, 0, H);
      cream.addColorStop(0, '#f4ead2');
      cream.addColorStop(1, '#e6d6b0');
      ctx.fillStyle = cream;
      ctx.fillRect(0, 0, W, H);
      woodGrain(ctx, rand, 'rgba(120, 80, 30, 0.06)');
    });
    // Gold moulding around the board.
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 6;
    ctx.strokeRect(22, HEADER + 18, W - 44, H - HEADER - 40);
    ctx.lineWidth = 2;
    ctx.strokeRect(34, HEADER + 30, W - 68, H - HEADER - 64);
    fillPattern(ctx, grain(14, 61));
    headerBand(ctx, '#2a130a');
  },
  overlay: ctx => {
    ctx.font = `700 22px ${ENGRAVED}`;
    ctx.letterSpacing = '4px';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.fillText('DADS ARMY ICE HOCKEY CLUB', W / 2, H - 9);
  },
  headerTitle: 'LIGHTS V DARKS',
  headerDate: '',
  headerFont: px => `900 ${Math.round(px * 0.92)}px ${ENGRAVED}`,
  headerText: GOLD,
  headerSub: '#c9a25a',
  rule: [GOLD, '#2a130a'],
  lights: { title: '#3a2210', sub: '#8a6a2f', pill: 'rgba(160, 120, 50, 0.08)', pillText: '#2e1b0c', pillStroke: 'rgba(140, 100, 40, 0.45)' },
  darks: { title: GOLD, sub: '#c9a25a', pill: 'rgba(226, 184, 82, 0.06)', pillText: GOLD, pillStroke: 'rgba(226, 184, 82, 0.4)' },
  slash: { kind: 'line', color: GOLD, width: 12 },
  vs: { fill: GOLD, ring: '#7a5a1c', text: '#2a130a' },
  goalie: { fill: GOLD, text: '#2a130a' },
  titleFont: px => `900 ${Math.round(px * 0.82)}px ${ENGRAVED}`,
  subFont: px => `700 ${Math.round(px * 0.8)}px ${ENGRAVED}`,
  nameFont: px => `700 ${Math.round(px * 0.8)}px ${ENGRAVED}`,
  pillRadius: 2
};

// ---------- Neon: signs on a brick wall, flickering on as a GIF ----------

const neon: Theme = {
  label: 'Neon',
  animated: 'neon',
  background: ctx => {
    ctx.fillStyle = '#120a09';
    ctx.fillRect(0, 0, W, H);
    // Brick courses with staggered joints.
    const rand = mulberry32(88);
    const bh = 54;
    const bw = 140;
    for (let row = 0; row * bh < H; row++) {
      const offset = row % 2 ? bw / 2 : 0;
      for (let x = -offset; x < W; x += bw) {
        const shade = 30 + Math.floor(rand() * 18);
        ctx.fillStyle = `rgb(${shade + 22}, ${shade - 6}, ${shade - 10})`;
        ctx.fillRect(x + 3, row * bh + 3, bw - 6, bh - 6);
      }
    }
    fillPattern(ctx, grain(40, 71));
    // Darken towards the edges, with a hint of green spill on the Darks side.
    const v = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.2, W / 2, H * 0.5, H * 0.75);
    v.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    clipped(ctx, darksShape, () => {
      ctx.fillStyle = 'rgba(57, 255, 106, 0.05)';
      ctx.fillRect(0, 0, W, H);
    });
    headerBand(ctx, 'rgba(0, 0, 0, 0.55)');
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: 'OPEN TONIGHT',
  headerFont: px => `${px}px ${NEON}`,
  headerText: '#ff4fa3',
  headerSub: '#ffcf40',
  rule: ['#ff4fa3', '#1a0d0c'],
  lights: { title: '#eaf6ff', sub: '#9fd4ff', pill: 'rgba(0, 0, 0, 0)', pillText: '#eaf6ff' },
  darks: { title: '#39ff6a', sub: '#9dffb6', pill: 'rgba(0, 0, 0, 0)', pillText: '#39ff6a' },
  slash: { kind: 'glow', color: '#ffcf40', width: 9 },
  vs: { fill: '#1a0d0c', ring: '#ff3355', text: '#ff3355' },
  goalie: { fill: '#ffcf40', text: '#1a0d0c' },
  titleFont: px => `${Math.round(px * 1.02)}px ${NEON}`,
  subFont: px => `${Math.round(px * 0.95)}px ${NEON}`,
  nameFont: px => `${Math.round(px * 1.02)}px ${NEON}`,
  pillRadius: 0,
  glow: 22,
  unlit: 'rgba(210, 200, 200, 0.14)'
};

// ---------- Arena: spotlights over a packed rink, sliding in as a GIF ----------

const arena: Theme = {
  label: 'Arena',
  animated: 'slide',
  background: ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05080a');
    g.addColorStop(0.7, '#0a1a12');
    g.addColorStop(1, '#13301f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glow = (x: number, y: number, r: number, color: string) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    };
    glow(W * 0.2, H * 0.55, 620, 'rgba(200, 225, 255, 0.16)');
    glow(W * 0.82, H * 0.6, 640, 'rgba(93, 255, 138, 0.18)');
    // Crowd and camera flashes as soft out-of-focus lights along the bottom.
    const rand = mulberry32(99);
    for (let i = 0; i < 140; i++) {
      const x = rand() * W;
      const y = H - 330 + rand() * 330;
      const r = 4 + rand() * 14;
      const warm = rand() < 0.5;
      const dot = ctx.createRadialGradient(x, y, 0, x, y, r);
      dot.addColorStop(0, warm ? 'rgba(255, 220, 160, 0.35)' : 'rgba(180, 255, 200, 0.3)');
      dot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = dot;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Ice sheen at the very bottom.
    const ice = ctx.createLinearGradient(0, H - 120, 0, H);
    ice.addColorStop(0, 'rgba(220, 240, 255, 0)');
    ice.addColorStop(1, 'rgba(220, 240, 255, 0.12)');
    ctx.fillStyle = ice;
    ctx.fillRect(0, H - 120, W, 120);
    fillPattern(ctx, grain(20, 101));
    headerBand(ctx, 'rgba(0, 0, 0, 0.6)');
  },
  // Two spotlights sweep from the rafters, settling as the line-up lands.
  overlay: (ctx, t) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sway = Math.sin(t * Math.PI * 2.5) * (1 - t) * 0.5;
    for (const [x, base, tint] of [
      [W * 0.12, 0.42, '210, 230, 255'],
      [W * 0.88, -0.42, '150, 255, 180']
    ] as const) {
      const angle = base + (x < W / 2 ? sway : -sway);
      ctx.save();
      ctx.translate(x, HEADER - 20);
      ctx.rotate(-angle);
      const beam = ctx.createLinearGradient(0, 0, 0, H);
      beam.addColorStop(0, `rgba(${tint}, 0.22)`);
      beam.addColorStop(1, `rgba(${tint}, 0)`);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(14, 0);
      ctx.lineTo(230, H);
      ctx.lineTo(-230, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: 'GAME NIGHT',
  headerFont: px => `italic 800 ${Math.round(px * 1.1)}px ${DISPLAY}`,
  rule: ['#ffffff', '#5dff8a'],
  lights: { title: '#ffffff', sub: '#c9dcff', pill: 'rgba(255, 255, 255, 0.1)', pillText: '#ffffff', pillStroke: 'rgba(255, 255, 255, 0.4)' },
  darks: { title: '#5dff8a', sub: '#a8ffc0', pill: 'rgba(93, 255, 138, 0.1)', pillText: '#d9ffe4', pillStroke: 'rgba(93, 255, 138, 0.45)' },
  slash: { kind: 'glow', color: '#ffffff', width: 10 },
  vs: { fill: '#ffffff', ring: '#5dff8a', text: '#0b1a10' },
  goalie: { fill: '#5dff8a', text: '#0b1a10' },
  titleFont: px => `italic 800 ${Math.round(px * 1.05)}px ${DISPLAY}`,
  subFont: px => `600 ${px}px ${DISPLAY}`,
  nameFont: px => `italic 800 ${Math.round(px * 1.1)}px ${DISPLAY}`,
  pillRadius: 6
};

// ---------- Broadcast: a TV sports graphic, sliding in as a GIF ----------

const TICKER = 'DADS ARMY ICE HOCKEY  ·  LIGHTS VS DARKS  ·  TEAMS CONFIRMED  ·  FACE-OFF SOON  ·  ';

const broadcast: Theme = {
  label: 'Broadcast',
  animated: 'slide',
  background: ctx => {
    ctx.fillStyle = '#e9eef0';
    ctx.fillRect(0, 0, W, H);
    // Fine diagonal pinstripes, like studio graphics.
    ctx.strokeStyle = 'rgba(15, 81, 50, 0.05)';
    ctx.lineWidth = 2;
    for (let x = -H; x < W; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + H, 0);
      ctx.stroke();
    }
    clipped(ctx, darksShape, () => {
      const g = ctx.createLinearGradient(W, HEADER, SLASH_BOTTOM, H);
      g.addColorStop(0, '#16703f');
      g.addColorStop(1, '#0a3a22');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      for (let x = -H; x < W; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + H, 0);
        ctx.stroke();
      }
    });
    headerBand(ctx, '#0b0f0c');
  },
  // A blinking LIVE bug and a news ticker that scrolls while the graphic comes in.
  overlay: (ctx, t) => {
    const y = H - 54;
    ctx.fillStyle = '#0b0f0c';
    ctx.fillRect(0, y, W, 54);
    ctx.save();
    ctx.beginPath();
    ctx.rect(150, y, W - 150, 54);
    ctx.clip();
    ctx.font = `700 26px ${DISPLAY}`;
    ctx.letterSpacing = '3px';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    const run = ctx.measureText(TICKER).width;
    const offset = (t * 700) % run;
    for (let x = 170 - offset; x < W; x += run) ctx.fillText(TICKER, x, y + 28);
    ctx.restore();
    ctx.fillStyle = '#d7263d';
    ctx.fillRect(0, y, 150, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = `italic 800 30px ${DISPLAY}`;
    ctx.letterSpacing = '2px';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE', 54, y + 28);
    if (t === 1 || Math.floor(t * 8) % 2 === 0) {
      ctx.beginPath();
      ctx.arc(32, y + 27, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: 'TEAMS CONFIRMED',
  headerFont: px => `italic 800 ${Math.round(px * 1.1)}px ${DISPLAY}`,
  headerSub: '#ffcf00',
  rule: ['#ffcf00', '#0b0f0c'],
  lights: { title: '#0b1a10', sub: '#4d6358', pill: '#ffffff', pillText: '#0b1a10', pillStroke: 'rgba(11, 26, 16, 0.12)' },
  darks: { title: '#ffffff', sub: '#bfe8cf', pill: '#0b0f0c', pillText: '#ffffff' },
  slash: { kind: 'line', color: '#ffcf00', width: 16 },
  vs: { fill: '#ffcf00', ring: '#0b0f0c', text: '#0b0f0c' },
  goalie: { fill: '#ffcf00', text: '#0b0f0c' },
  titleFont: px => `italic 800 ${Math.round(px * 1.05)}px ${DISPLAY}`,
  subFont: px => `700 ${px}px ${DISPLAY}`,
  nameFont: px => `italic 800 ${Math.round(px * 1.08)}px ${DISPLAY}`,
  pillRadius: 0
};

export type GraphicDesign =
  | 'rink'
  | 'matchday'
  | 'dossier'
  | 'nightvision'
  | 'chalkboard'
  | 'comic'
  | 'honour'
  | 'neon'
  | 'arena'
  | 'broadcast';

export const THEMES: Record<GraphicDesign, Theme> = {
  rink,
  matchday,
  dossier,
  nightvision: nightVision,
  chalkboard,
  comic,
  honour: honourBoard,
  neon,
  arena,
  broadcast
};

export const GRAPHIC_DESIGNS = (Object.keys(THEMES) as GraphicDesign[]).map(value => ({
  value,
  label: THEMES[value].label,
  animated: !!THEMES[value].animated
}));
