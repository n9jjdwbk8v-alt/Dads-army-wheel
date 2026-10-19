import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { isGoalie, type Teams } from './teams';
import {
  FONT_LOADS,
  H,
  HEADER,
  SLASH_BOTTOM,
  SLASH_TOP,
  THEMES,
  W,
  slashX,
  type GraphicDesign,
  type Theme
} from './graphicThemes';

export { GRAPHIC_DESIGNS, type GraphicDesign } from './graphicThemes';

const PAD = 70;
const GAP = 44;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - (1 - v) ** 3;
const backOut = (v: number) => 1 + 2.4 * (v - 1) ** 3 + 1.4 * (v - 1) ** 2;
/** Progress of a step that runs from `start` for `length` of the timeline. */
const phase = (t: number, start: number, length: number) => clamp01((t - start) / length);

const fit = (ctx: CanvasRenderingContext2D, text: string, max: number) => {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
};

let logoPromise: Promise<HTMLImageElement | null> | null = null;
const loadLogo = () =>
  (logoPromise ??= new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = new URL('logo.png', document.baseURI).href;
  }));

const loadFonts = () => Promise.all(FONT_LOADS.map(f => document.fonts.load(f))).catch(() => undefined);

/** The logo recoloured to a single tint (used for night vision). */
const tinted = (logo: HTMLImageElement, color: string) => {
  const c = document.createElement('canvas');
  c.width = logo.width;
  c.height = logo.height;
  const g = c.getContext('2d')!;
  g.drawImage(logo, 0, 0);
  g.globalCompositeOperation = 'color';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(logo, 0, 0);
  return c;
};

type Assets = { theme: Theme; background: HTMLCanvasElement; logo: CanvasImageSource | null; logoAspect: number };

const prepare = async (design: GraphicDesign): Promise<Assets> => {
  const [logo] = await Promise.all([loadLogo(), loadFonts()]);
  const theme = THEMES[design];
  const background = document.createElement('canvas');
  background.width = W;
  background.height = H;
  theme.background(background.getContext('2d')!, logo);
  return {
    theme,
    background,
    logo: logo && theme.tintLogo ? tinted(logo, theme.tintLogo) : logo,
    logoAspect: logo ? logo.width / logo.height : 1
  };
};

const drawSlash = (ctx: CanvasRenderingContext2D, theme: Theme, progress: number) => {
  if (progress <= 0) return;
  const endY = HEADER + (H - HEADER) * progress;
  const { kind, color, width } = theme.slash;
  ctx.save();
  if (kind === 'hazard') {
    // A band of yellow and black tape, clipped to how far the slash has drawn.
    const half = width / 2;
    ctx.beginPath();
    ctx.moveTo(SLASH_TOP - half, HEADER);
    ctx.lineTo(SLASH_TOP + half, HEADER);
    ctx.lineTo(slashX(endY) + half, endY);
    ctx.lineTo(slashX(endY) - half, endY);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(SLASH_BOTTOM - width, HEADER, SLASH_TOP - SLASH_BOTTOM + width * 2, H - HEADER);
    ctx.fillStyle = '#0e120a';
    for (let y = HEADER - 400; y < H; y += 56) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y + 300);
      ctx.lineTo(W, y + 328);
      ctx.lineTo(0, y + 28);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    if (kind === 'glow') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 28;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(SLASH_TOP, HEADER);
    ctx.lineTo(slashX(endY), endY);
    ctx.stroke();
  }
  ctx.restore();
};

/** Draws one frame of the line-up. `t` runs 0 → 1 through the intro; 1 is the finished picture. */
const renderFrame = (ctx: CanvasRenderingContext2D, teams: Teams, a: Assets, t: number, date: Date) => {
  const { theme } = a;
  ctx.save();
  ctx.drawImage(a.background, 0, 0);
  ctx.textBaseline = 'middle';

  // Header: logo, title and date fade in.
  ctx.globalAlpha = easeOut(phase(t, 0, 0.18));
  ctx.fillStyle = theme.rule[0];
  ctx.fillRect(0, HEADER - 14, W, 8);
  ctx.fillStyle = theme.rule[1];
  ctx.fillRect(0, HEADER - 6, W, 6);
  if (a.logo) {
    const h = HEADER - 52;
    ctx.drawImage(a.logo, PAD - 16, 20, h * a.logoAspect, h);
  }
  const dateText = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '3px';
  ctx.font = theme.headerFont(62);
  ctx.fillText(theme.headerTitle, W - PAD, 92);
  ctx.letterSpacing = '4px';
  ctx.font = theme.subFont(34);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText([theme.headerDate, dateText].filter(Boolean).join(' · '), W - PAD, 160);
  ctx.globalAlpha = 1;

  drawSlash(ctx, theme, easeOut(phase(t, 0.02, 0.24)));

  // Team titles slide in from the outside edges, shrunk if a wide font would run under the VS badge.
  const titleY = HEADER + 95;
  const vsY = titleY + 20;
  const vsX = slashX(vsY);
  ctx.letterSpacing = '4px';
  ctx.font = theme.titleFont(104);
  const room = Math.min(
    (vsX - 56 - 24 - PAD) / ctx.measureText('LIGHTS').width,
    (W - PAD - (vsX + 56 + 24)) / ctx.measureText('DARKS').width,
    1
  );
  ctx.font = theme.titleFont(Math.floor(104 * room));
  const tp = easeOut(phase(t, 0.16, 0.22));
  ctx.globalAlpha = tp;
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.lights.title;
  ctx.fillText('LIGHTS', PAD - (1 - tp) * 160, titleY);
  ctx.textAlign = 'right';
  ctx.fillStyle = theme.darks.title;
  ctx.fillText('DARKS', W - PAD + (1 - tp) * 160, titleY);
  ctx.letterSpacing = '2px';
  ctx.font = theme.subFont(30);
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.lights.sub;
  ctx.fillText(`${teams.light.length} PLAYERS`, PAD + 4 - (1 - tp) * 160, titleY + 70);
  ctx.textAlign = 'right';
  ctx.fillStyle = theme.darks.sub;
  ctx.fillText(`${teams.dark.length} PLAYERS`, W - PAD - 4 + (1 - tp) * 160, titleY + 70);
  ctx.globalAlpha = 1;

  // VS badge pops onto the slash.
  const vp = phase(t, 0.34, 0.16);
  if (vp > 0) {
    ctx.save();
    ctx.translate(vsX, vsY);
    ctx.scale(backOut(vp), backOut(vp));
    ctx.fillStyle = theme.vs.fill;
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = theme.vs.ring;
    ctx.stroke();
    ctx.fillStyle = theme.vs.text;
    ctx.textAlign = 'center';
    ctx.letterSpacing = '1px';
    ctx.font = theme.titleFont(54);
    ctx.fillText('VS', 0, 3);
    ctx.restore();
  }

  // Names, sized so the longer team fits, slide in row by row.
  const top = titleY + 140;
  const bottom = H - 60;
  const rows = Math.max(teams.light.length, teams.dark.length, 1);
  const lh = Math.min(100, (bottom - top) / rows);
  const size = Math.round(lh * 0.62);
  const badgeR = lh * 0.27;
  ctx.letterSpacing = '0px';

  const goalieBadge = (cx: number, y: number) => {
    ctx.fillStyle = theme.goalie.fill;
    ctx.beginPath();
    ctx.arc(cx, y, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.goalie.text;
    ctx.textAlign = 'center';
    ctx.font = theme.titleFont(Math.round(badgeR * 1.3));
    ctx.fillText('G', cx, y + 1);
    return badgeR * 2 + 14;
  };

  const pill = (x: number, y: number, w: number, side: Theme['lights']) => {
    ctx.fillStyle = side.pill;
    ctx.beginPath();
    ctx.roundRect(x, y - lh * 0.42, w, lh * 0.84, theme.pillRadius);
    ctx.fill();
    if (side.pillStroke) {
      ctx.strokeStyle = side.pillStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const rowProgress = (i: number) => easeOut(phase(t, 0.44 + (i / rows) * 0.36, 0.2));

  teams.light.forEach((p, i) => {
    const rp = rowProgress(i);
    if (rp <= 0) return;
    ctx.save();
    ctx.globalAlpha = rp;
    ctx.translate(-(1 - rp) * 220, 0);
    const y = top + lh * i + lh / 2;
    const edge = Math.min(slashX(y - lh / 2), slashX(y + lh / 2)) - GAP;
    pill(PAD - 18, y, edge - PAD + 18, theme.lights);
    const indent = isGoalie(p) ? goalieBadge(PAD + badgeR, y) : 0;
    ctx.font = theme.nameFont(size);
    ctx.fillStyle = theme.lights.pillText;
    ctx.textAlign = 'left';
    ctx.fillText(fit(ctx, p.name, edge - PAD - 12 - indent), PAD + indent, y + 1);
    ctx.restore();
  });

  teams.dark.forEach((p, i) => {
    const rp = rowProgress(i);
    if (rp <= 0) return;
    ctx.save();
    ctx.globalAlpha = rp;
    ctx.translate((1 - rp) * 220, 0);
    const y = top + lh * i + lh / 2;
    const edge = Math.max(slashX(y - lh / 2), slashX(y + lh / 2)) + GAP;
    pill(edge, y, W - PAD + 18 - edge, theme.darks);
    const indent = isGoalie(p) ? goalieBadge(W - PAD - badgeR, y) : 0;
    ctx.font = theme.nameFont(size);
    ctx.fillStyle = theme.darks.pillText;
    ctx.textAlign = 'right';
    ctx.fillText(fit(ctx, p.name, W - PAD - edge - 12 - indent), W - PAD - indent, y + 1);
    ctx.restore();
  });

  theme.overlay?.(ctx, t);
  ctx.restore();
};

const newCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** The finished Lights vs Darks line-up as a WhatsApp-friendly 4:5 PNG. */
export const drawTeamsGraphic = async (teams: Teams, design: GraphicDesign, date = new Date()): Promise<Blob> => {
  const assets = await prepare(design);
  const canvas = newCanvas(W, H);
  renderFrame(canvas.getContext('2d')!, teams, assets, 1, date);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render image'))), 'image/png')
  );
};

const GIF_SCALE = 0.5;
const GIF_FRAMES = 28;
const FRAME_MS = 50;
const HOLD_MS = 4000;

/** The line-up as a looping GIF: the intro plays, then the finished picture holds before it repeats. */
export const makeTeamsGif = async (teams: Teams, design: GraphicDesign, date = new Date()): Promise<Blob> => {
  const assets = await prepare(design);
  const full = newCanvas(W, H);
  const fctx = full.getContext('2d')!;
  const gw = Math.round(W * GIF_SCALE);
  const gh = Math.round(H * GIF_SCALE);
  const small = newCanvas(gw, gh);
  const sctx = small.getContext('2d', { willReadFrequently: true })!;

  // Open on the finished picture (WhatsApp shows the first frame as the preview), then replay the intro.
  const times = [1, ...Array.from({ length: GIF_FRAMES }, (_, i) => i / (GIF_FRAMES - 1))];
  const frames: Uint8ClampedArray[] = [];
  for (const [i, t] of times.entries()) {
    renderFrame(fctx, teams, assets, t, date);
    sctx.drawImage(full, 0, 0, gw, gh);
    frames.push(sctx.getImageData(0, 0, gw, gh).data);
    // Yield now and then so the page stays responsive while frames render.
    if (i % 6 === 5) await new Promise(r => setTimeout(r));
  }

  // One shared palette, taken from the finished frame, keeps colours steady between frames. The last slot is
  // kept free to mark "unchanged" pixels, so each frame after the first only stores what moved.
  const palette = quantize(frames[0], 255);
  const unchanged = palette.length;
  palette.push([0, 0, 0]);
  const gif = GIFEncoder();
  let previous: Uint8Array | null = null;
  frames.forEach((data, i) => {
    const indexed = applyPalette(data, palette);
    let pixels = indexed;
    if (previous) {
      pixels = indexed.slice();
      for (let p = 0; p < pixels.length; p++) if (pixels[p] === previous[p]) pixels[p] = unchanged;
    }
    gif.writeFrame(pixels, gw, gh, {
      palette: i === 0 ? palette : undefined,
      delay: i === 0 ? HOLD_MS : FRAME_MS,
      repeat: 0,
      ...(previous ? { transparent: true, transparentIndex: unchanged, dispose: 1 } : {})
    });
    previous = indexed;
  });
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
};
