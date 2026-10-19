import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { isGoalie, type Teams } from './teams';
import {
  FONT_LOADS,
  H,
  HEADER,
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
/** Progress of a step that runs from `start` for `length` of the animation. */
const phase = (t: number, start: number, length: number) => clamp01((t - start) / length);

/** Whether a neon part is lit at time `t`: dark before `start`, flickering briefly, then steady. */
const neonLit = (t: number, start: number, seed: number) => {
  if (t >= start + 0.1) return true;
  if (t < start) return false;
  return (Math.floor((t - start) * 120) * 7 + seed * 5) % 4 < 2;
};

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

const newCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** The logo recoloured to a single tint (used for night vision). */
const tinted = (logo: HTMLImageElement, color: string) => {
  const c = newCanvas(logo.width, logo.height);
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

// Backgrounds take a moment to paint, so each style's is made once and reused.
const prepared = new Map<GraphicDesign, Promise<Assets>>();
const prepare = (design: GraphicDesign) => {
  let assets = prepared.get(design);
  if (!assets) {
    assets = makeAssets(design);
    prepared.set(design, assets);
  }
  return assets;
};

const makeAssets = async (design: GraphicDesign): Promise<Assets> => {
  const [logo] = await Promise.all([loadLogo(), loadFonts()]);
  const theme = THEMES[design];
  const background = newCanvas(W, H);
  theme.background(background.getContext('2d')!, logo);
  return {
    theme,
    background,
    logo: logo && theme.tintLogo ? tinted(logo, theme.tintLogo) : logo,
    logoAspect: logo ? logo.width / logo.height : 1
  };
};

/**
 * Sets up glow for a part of the picture and returns the colour to draw it in. Without a theme glow this is just
 * `color`; on a neon theme an unlit part is drawn as a dark tube.
 */
const lightUp = (ctx: CanvasRenderingContext2D, theme: Theme, color: string, on: boolean) => {
  if (!theme.glow) return color;
  ctx.shadowColor = on ? color : 'transparent';
  ctx.shadowBlur = on ? theme.glow : 0;
  return on ? color : (theme.unlit ?? color);
};

/** Draws the slash from the header down to `progress` of the way (1 = all of it). */
const drawSlash = (ctx: CanvasRenderingContext2D, theme: Theme, on: boolean, progress: number) => {
  if (progress <= 0) return;
  const endY = HEADER + (H - HEADER) * progress;
  const { kind, width } = theme.slash;
  const color = on ? theme.slash.color : (theme.unlit ?? theme.slash.color);
  ctx.save();
  ctx.strokeStyle = color;
  if (kind === 'chalk') {
    // A few rough passes, each slightly off the line, like a stick of chalk.
    ctx.lineCap = 'round';
    for (const [dx, w] of [[-3, 0.5], [2, 0.7], [0, 0.4], [4, 0.3]]) {
      ctx.lineWidth = width * w;
      ctx.beginPath();
      ctx.moveTo(SLASH_TOP + dx, HEADER);
      ctx.lineTo(slashX(endY) + dx, endY);
      ctx.stroke();
    }
  } else {
    if (kind === 'glow' && on) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 28;
    }
    ctx.lineWidth = width;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(SLASH_TOP, HEADER);
    ctx.lineTo(slashX(endY), endY);
    ctx.stroke();
  }
  ctx.restore();
};

/** Draws the VS badge centred on (x, y), scaled by `scale` so it can pop in. */
const drawVs = (ctx: CanvasRenderingContext2D, theme: Theme, x: number, y: number, on: boolean, scale: number) => {
  if (scale <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  if (theme.vs.shape === 'burst') {
    // A comic-book starburst.
    const spikes = 14;
    for (let i = 0; i <= spikes * 2; i++) {
      const r = i % 2 ? 58 : 84;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  } else {
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
  }
  ctx.fillStyle = theme.vs.fill;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = lightUp(ctx, theme, theme.vs.ring, on);
  ctx.stroke();
  ctx.fillStyle = lightUp(ctx, theme, theme.vs.text, on);
  ctx.textAlign = 'center';
  ctx.letterSpacing = '1px';
  ctx.font = theme.titleFont(54);
  ctx.fillText('VS', 0, 3);
  ctx.restore();
};

/**
 * Draws the line-up. On an animated design `t` runs 0 → 1 through the animation (each part flickering on for
 * 'neon', or sliding in for 'slide'); 1 is the finished picture.
 */
const drawPicture = (ctx: CanvasRenderingContext2D, teams: Teams, a: Assets, date: Date, t: number) => {
  const { theme } = a;
  const lit = (start: number, seed: number) => theme.animated !== 'neon' || neonLit(t, start, seed);
  const slide = (start: number, length: number) => (theme.animated === 'slide' ? easeOut(phase(t, start, length)) : 1);
  ctx.save();
  ctx.drawImage(a.background, 0, 0);
  ctx.textBaseline = 'middle';

  // Header: logo, title and date.
  const headerOn = lit(0.04, 1);
  ctx.globalAlpha = slide(0, 0.16);
  ctx.fillStyle = theme.rule[0];
  ctx.fillRect(0, HEADER - 14, W, 8);
  ctx.fillStyle = theme.rule[1];
  ctx.fillRect(0, HEADER - 6, W, 6);
  if (a.logo) {
    const h = HEADER - 52;
    ctx.globalAlpha = headerOn ? 1 : 0.35;
    ctx.drawImage(a.logo, PAD - 16, 20, h * a.logoAspect, h);
    ctx.globalAlpha = 1;
  }
  const dateText = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  // Header text sits right of the logo, shrunk if a long title or wide font would reach it.
  const headerRoom = W - PAD - (PAD - 16 + (HEADER - 52) * a.logoAspect + 30);
  ctx.textAlign = 'right';
  ctx.letterSpacing = '3px';
  ctx.font = theme.headerFont(62);
  const titleWidth = ctx.measureText(theme.headerTitle).width;
  if (titleWidth > headerRoom) ctx.font = theme.headerFont(Math.floor((62 * headerRoom) / titleWidth));
  ctx.fillStyle = lightUp(ctx, theme, theme.headerText ?? '#ffffff', headerOn);
  ctx.fillText(theme.headerTitle, W - PAD, 92);
  ctx.letterSpacing = '4px';
  ctx.font = theme.subFont(34);
  ctx.fillStyle = lightUp(ctx, theme, theme.headerSub ?? 'rgba(255, 255, 255, 0.7)', headerOn);
  ctx.fillText([theme.headerDate, dateText].filter(Boolean).join(' · '), W - PAD, 160);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  drawSlash(ctx, theme, lit(0.14, 2), slide(0.02, 0.24));

  // Team titles, shrunk if a wide font would run under the VS badge.
  const titleY = HEADER + 95;
  const vsY = titleY + 20;
  const vsX = slashX(vsY);
  const vsRadius = theme.vs.shape === 'burst' ? 84 : 56;
  ctx.letterSpacing = '4px';
  ctx.font = theme.titleFont(104);
  const room = Math.min(
    (vsX - vsRadius - 24 - PAD) / ctx.measureText('LIGHTS').width,
    (W - PAD - (vsX + vsRadius + 24)) / ctx.measureText('DARKS').width,
    1
  );
  ctx.font = theme.titleFont(Math.floor(104 * room));
  // Titles slide in from the outside edges on a 'slide' animation.
  const tp = slide(0.16, 0.22);
  const inset = (1 - tp) * 160;
  ctx.globalAlpha = tp;
  const title = (text: string, x: number, align: CanvasTextAlign, color: string, on: boolean) => {
    ctx.textAlign = align;
    if (theme.titleStroke) {
      ctx.lineWidth = theme.titleStroke.width;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = theme.titleStroke.color;
      ctx.strokeText(text, x, titleY);
    }
    ctx.fillStyle = lightUp(ctx, theme, color, on);
    ctx.fillText(text, x, titleY);
    ctx.shadowBlur = 0;
  };
  const lightsTitleOn = lit(0.24, 3);
  const darksTitleOn = lit(0.3, 4);
  title('LIGHTS', PAD - inset, 'left', theme.lights.title, lightsTitleOn);
  title('DARKS', W - PAD + inset, 'right', theme.darks.title, darksTitleOn);
  ctx.letterSpacing = '2px';
  ctx.font = theme.subFont(30);
  ctx.textAlign = 'left';
  ctx.fillStyle = lightUp(ctx, theme, theme.lights.sub, lightsTitleOn);
  ctx.fillText(`${teams.light.length} PLAYERS`, PAD + 4 - inset, titleY + 70);
  ctx.textAlign = 'right';
  ctx.fillStyle = lightUp(ctx, theme, theme.darks.sub, darksTitleOn);
  ctx.fillText(`${teams.dark.length} PLAYERS`, W - PAD - 4 + inset, titleY + 70);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // The VS badge pops onto the slash on a 'slide' animation.
  const vsPop = theme.animated === 'slide' ? backOut(phase(t, 0.34, 0.16)) : 1;
  drawVs(ctx, theme, vsX, vsY, lit(0.38, 5), vsPop);

  // Names, sized so the longer team fits.
  const top = titleY + 140;
  const bottom = H - 60;
  const rows = Math.max(teams.light.length, teams.dark.length, 1);
  const lh = Math.min(100, (bottom - top) / rows);
  const size = Math.round(lh * 0.62);
  const badgeR = lh * 0.27;
  ctx.letterSpacing = '0px';

  const goalieBadge = (cx: number, y: number, on: boolean) => {
    ctx.fillStyle = lightUp(ctx, theme, theme.goalie.fill, on);
    ctx.beginPath();
    ctx.arc(cx, y, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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
      ctx.lineWidth = theme.pillStrokeWidth ?? 2;
      ctx.stroke();
    }
  };

  // On a 'slide' animation the names slide in row by row.
  const rowIn = (i: number) => slide(0.44 + (i / rows) * 0.36, 0.2);

  teams.light.forEach((p, i) => {
    const on = lit(0.44 + (i / rows) * 0.4, 10 + i);
    const rp = rowIn(i);
    if (rp <= 0) return;
    ctx.save();
    ctx.globalAlpha = rp;
    ctx.translate(-(1 - rp) * 220, 0);
    const y = top + lh * i + lh / 2;
    const edge = Math.min(slashX(y - lh / 2), slashX(y + lh / 2)) - GAP;
    pill(PAD - 18, y, edge - PAD + 18, theme.lights);
    const indent = isGoalie(p) ? goalieBadge(PAD + badgeR, y, on) : 0;
    ctx.font = theme.nameFont(size);
    ctx.fillStyle = lightUp(ctx, theme, theme.lights.pillText, on);
    ctx.textAlign = 'left';
    ctx.fillText(fit(ctx, p.name, edge - PAD - 12 - indent), PAD + indent, y + 1);
    ctx.restore();
  });

  teams.dark.forEach((p, i) => {
    const on = lit(0.47 + (i / rows) * 0.4, 30 + i);
    const rp = rowIn(i);
    if (rp <= 0) return;
    ctx.save();
    ctx.globalAlpha = rp;
    ctx.translate((1 - rp) * 220, 0);
    const y = top + lh * i + lh / 2;
    const edge = Math.max(slashX(y - lh / 2), slashX(y + lh / 2)) + GAP;
    pill(edge, y, W - PAD + 18 - edge, theme.darks);
    const indent = isGoalie(p) ? goalieBadge(W - PAD - badgeR, y, on) : 0;
    ctx.font = theme.nameFont(size);
    ctx.fillStyle = lightUp(ctx, theme, theme.darks.pillText, on);
    ctx.textAlign = 'right';
    ctx.fillText(fit(ctx, p.name, W - PAD - edge - 12 - indent), W - PAD - indent, y + 1);
    ctx.restore();
  });

  theme.overlay?.(ctx, t);
  ctx.restore();
};

/** The finished Lights vs Darks line-up as a WhatsApp-friendly 4:5 PNG. */
export const drawTeamsGraphic = async (teams: Teams, design: GraphicDesign, date = new Date()): Promise<Blob> => {
  const assets = await prepare(design);
  const canvas = newCanvas(W, H);
  drawPicture(canvas.getContext('2d')!, teams, assets, date, 1);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render image'))), 'image/png')
  );
};

/** A small finished preview of a design, as a data URL. */
export const drawTeamsThumbnail = async (teams: Teams, design: GraphicDesign, width = 200): Promise<string> => {
  const assets = await prepare(design);
  const scale = width / W;
  const canvas = newCanvas(width, Math.round(H * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  drawPicture(ctx, teams, assets, new Date(), 1);
  return canvas.toDataURL('image/jpeg', 0.82);
};

const GIF_SCALE = 2 / 3;
const GIF_FRAMES = 36;
const FRAME_MS = 60;
const HOLD_MS = 3500;

/**
 * An animated design as a looping GIF. It opens on the finished picture (WhatsApp shows the first frame as the
 * preview), then replays the animation.
 */
export const makeTeamsGif = async (teams: Teams, design: GraphicDesign, date = new Date()): Promise<Blob> => {
  const assets = await prepare(design);
  const gw = Math.round(W * GIF_SCALE);
  const gh = Math.round(H * GIF_SCALE);
  const canvas = newCanvas(gw, gh);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const times = [1, ...Array.from({ length: GIF_FRAMES }, (_, i) => i / (GIF_FRAMES - 1))];
  const frames: Uint8ClampedArray[] = [];
  for (const [i, t] of times.entries()) {
    ctx.save();
    ctx.scale(GIF_SCALE, GIF_SCALE);
    drawPicture(ctx, teams, assets, date, t);
    ctx.restore();
    frames.push(ctx.getImageData(0, 0, gw, gh).data);
    // Yield now and then so the page stays responsive while frames render.
    if (i % 6 === 5) await new Promise(r => setTimeout(r));
  }

  // One shared palette, taken from the finished frame, keeps colours steady between frames. The last slot is
  // kept free to mark "unchanged" pixels, so each frame after the first only stores what changed.
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

/**
 * Plays an animated design on `canvas` in real time, then calls `onDone` once the finished picture has shown for
 * a moment. Returns a function that stops playback early.
 */
export const playTeamsAnimation = async (
  canvas: HTMLCanvasElement,
  teams: Teams,
  design: GraphicDesign,
  onDone: () => void,
  date = new Date()
): Promise<() => void> => {
  const assets = await prepare(design);
  canvas.width = Math.round(W * GIF_SCALE);
  canvas.height = Math.round(H * GIF_SCALE);
  const ctx = canvas.getContext('2d')!;
  const length = GIF_FRAMES * FRAME_MS;
  let raf = 0;
  let timer = 0;
  let start = 0;
  const frame = (now: number) => {
    start ||= now;
    const t = Math.min(1, (now - start) / length);
    ctx.save();
    ctx.scale(GIF_SCALE, GIF_SCALE);
    drawPicture(ctx, teams, assets, date, t);
    ctx.restore();
    if (t < 1) raf = requestAnimationFrame(frame);
    else timer = window.setTimeout(onDone, 900);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  };
};
