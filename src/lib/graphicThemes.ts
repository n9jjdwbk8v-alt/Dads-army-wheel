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

export const FONT_LOADS = [
  `800 100px ${DISPLAY}`,
  `600 40px ${DISPLAY}`,
  `60px ${STENCIL}`,
  `40px ${TYPEWRITER}`,
  `40px ${MONO}`,
  `500 40px ${BODY}`
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
  /** Drawn on top of everything else, every frame (stamps, scanlines, HUD). */
  overlay?: (ctx: CanvasRenderingContext2D, t: number) => void;
  headerTitle: string;
  headerDate: string;
  headerFont: (px: number) => string;
  rule: [string, string];
  lights: Side;
  darks: Side;
  slash: { kind: 'line' | 'hazard' | 'glow'; color: string; width: number };
  vs: { fill: string; ring: string; text: string };
  goalie: { fill: string; text: string };
  titleFont: (px: number) => string;
  subFont: (px: number) => string;
  nameFont: (px: number) => string;
  pillRadius: number;
  tintLogo?: string;
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

// ---------- Chevrons: rank stripes and a hazard-tape slash ----------

const chevronTile = (stroke: string) => {
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 100;
  const g = c.getContext('2d')!;
  g.strokeStyle = stroke;
  g.lineWidth = 16;
  g.lineJoin = 'miter';
  for (const y of [10, 60]) {
    g.beginPath();
    g.moveTo(-10, y);
    g.lineTo(60, y + 34);
    g.lineTo(130, y);
    g.stroke();
  }
  return c;
};

const chevrons: Theme = {
  label: 'Chevrons',
  background: ctx => {
    ctx.fillStyle = '#e4ddc0';
    ctx.fillRect(0, 0, W, H);
    fillPattern(ctx, chevronTile('rgba(110, 96, 50, 0.1)'));
    clipped(ctx, darksShape, () => {
      ctx.fillStyle = '#1b2213';
      ctx.fillRect(0, 0, W, H);
      fillPattern(ctx, chevronTile('rgba(242, 194, 48, 0.06)'));
    });
    fillPattern(ctx, grain(18, 5));
    headerBand(ctx, '#0e120a');
  },
  headerTitle: 'LIGHTS VS DARKS',
  headerDate: '',
  headerFont: px => `${px}px ${STENCIL}`,
  rule: ['#f2c230', '#0e120a'],
  lights: { title: '#1b2213', sub: '#6b5f2a', pill: 'rgba(27, 34, 19, 0.09)', pillText: '#1b2213' },
  darks: { title: '#f2c230', sub: '#c9bd84', pill: 'rgba(255, 255, 255, 0.07)', pillText: '#f0ead2' },
  slash: { kind: 'hazard', color: '#f2c230', width: 44 },
  vs: { fill: '#0e120a', ring: '#f2c230', text: '#f2c230' },
  goalie: { fill: '#f2c230', text: '#0e120a' },
  titleFont: px => `${Math.round(px * 0.92)}px ${STENCIL}`,
  subFont: px => `600 ${px}px ${DISPLAY}`,
  nameFont: px => `600 ${Math.round(px * 1.05)}px ${DISPLAY}`,
  pillRadius: 4
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
  overlay: (ctx, t) => {
    // Scanlines, a rolling bright band, vignette and HUD markings.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    const bandY = ((t * 1.6) % 1) * (H + 200) - 100;
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
    if (t === 1 || Math.floor(t * 6) % 2 === 0) {
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(W / 2 - 42, H - m - 27, 9, 0, Math.PI * 2);
      ctx.fill();
    }
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

export type GraphicDesign = 'rink' | 'matchday' | 'dossier' | 'chevrons' | 'nightvision';

export const THEMES: Record<GraphicDesign, Theme> = {
  rink,
  matchday,
  dossier,
  chevrons,
  nightvision: nightVision
};

export const GRAPHIC_DESIGNS = (Object.keys(THEMES) as GraphicDesign[]).map(value => ({
  value,
  label: THEMES[value].label
}));
