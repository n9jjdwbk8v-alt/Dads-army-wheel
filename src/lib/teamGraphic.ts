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
/** Progress of a step that runs from `start` for `length` of the animation. */
const phase = (t: number, start: number, length: number) => clamp01((t - start) / length);
/** The first part of `text`, as if typed out over that step. */
const typed = (text: string, progress: number) => text.slice(0, Math.ceil(text.length * progress));

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

const drawSlash = (ctx: CanvasRenderingContext2D, theme: Theme) => {
  const { kind, color, width } = theme.slash;
  ctx.save();
  if (kind === 'chalk') {
    // A few rough passes, each slightly off the line, like a stick of chalk.
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (const [dx, w] of [[-3, 0.5], [2, 0.7], [0, 0.4], [4, 0.3]]) {
      ctx.lineWidth = width * w;
      ctx.beginPath();
      ctx.moveTo(SLASH_TOP + dx, HEADER);
      ctx.lineTo(SLASH_BOTTOM + dx, H);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (kind === 'glow') {
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(SLASH_TOP, HEADER);
  ctx.lineTo(SLASH_BOTTOM, H);
  ctx.stroke();
  ctx.restore();
};

/**
 * Draws the line-up. For animated designs `t` runs 0 → 1 as the titles and names type themselves in;
 * 1 is the finished picture.
 */
const drawPicture = (ctx: CanvasRenderingContext2D, teams: Teams, a: Assets, date: Date, t: number) => {
  const { theme } = a;
  const at = (start: number, length: number) => (theme.animated ? phase(t, start, length) : 1);
  ctx.save();
  ctx.drawImage(a.background, 0, 0);
  ctx.textBaseline = 'middle';

  // Header: logo, title and date.
  ctx.fillStyle = theme.rule[0];
  ctx.fillRect(0, HEADER - 14, W, 8);
  ctx.fillStyle = theme.rule[1];
  ctx.fillRect(0, HEADER - 6, W, 6);
  if (a.logo) {
    const h = HEADER - 52;
    ctx.drawImage(a.logo, PAD - 16, 20, h * a.logoAspect, h);
  }
  const dateText = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  // Header text sits right of the logo, shrunk if a long title or wide font would reach it.
  const headerRoom = W - PAD - (PAD - 16 + (HEADER - 52) * a.logoAspect + 30);
  ctx.textAlign = 'right';
  ctx.fillStyle = theme.headerText ?? '#ffffff';
  ctx.letterSpacing = '3px';
  ctx.font = theme.headerFont(62);
  const titleWidth = ctx.measureText(theme.headerTitle).width;
  if (titleWidth > headerRoom) ctx.font = theme.headerFont(Math.floor((62 * headerRoom) / titleWidth));
  ctx.fillText(theme.headerTitle, W - PAD, 92);
  ctx.letterSpacing = '4px';
  ctx.font = theme.subFont(34);
  ctx.fillStyle = theme.headerSub ?? 'rgba(255, 255, 255, 0.7)';
  ctx.fillText([theme.headerDate, dateText].filter(Boolean).join(' · '), W - PAD, 160);

  drawSlash(ctx, theme);

  // Team titles, shrunk if a wide font would run under the VS badge.
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
  const titles = at(0.08, 0.2);
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.lights.title;
  ctx.fillText(typed('LIGHTS', titles), PAD, titleY);
  ctx.textAlign = 'right';
  ctx.fillStyle = theme.darks.title;
  ctx.fillText(typed('DARKS', titles), W - PAD, titleY);
  ctx.letterSpacing = '2px';
  ctx.font = theme.subFont(30);
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.lights.sub;
  ctx.fillText(typed(`${teams.light.length} PLAYERS`, titles), PAD + 4, titleY + 70);
  ctx.textAlign = 'right';
  ctx.fillStyle = theme.darks.sub;
  ctx.fillText(typed(`${teams.dark.length} PLAYERS`, titles), W - PAD - 4, titleY + 70);

  // VS badge on the slash.
  if (at(0.3, 0.01) >= 1) drawVs(ctx, theme, vsX, vsY);

  // Names, sized so the longer team fits.
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

  const rowTyping = (i: number) => at(0.34 + (i / rows) * 0.46, 0.18);

  teams.light.forEach((p, i) => {
    const shown = rowTyping(i);
    if (shown <= 0) return;
    const y = top + lh * i + lh / 2;
    const edge = Math.min(slashX(y - lh / 2), slashX(y + lh / 2)) - GAP;
    pill(PAD - 18, y, edge - PAD + 18, theme.lights);
    const indent = isGoalie(p) ? goalieBadge(PAD + badgeR, y) : 0;
    ctx.font = theme.nameFont(size);
    ctx.fillStyle = theme.lights.pillText;
    ctx.textAlign = 'left';
    ctx.fillText(typed(fit(ctx, p.name, edge - PAD - 12 - indent), shown), PAD + indent, y + 1);
  });

  teams.dark.forEach((p, i) => {
    const shown = rowTyping(i);
    if (shown <= 0) return;
    const y = top + lh * i + lh / 2;
    const edge = Math.max(slashX(y - lh / 2), slashX(y + lh / 2)) + GAP;
    pill(edge, y, W - PAD + 18 - edge, theme.darks);
    const indent = isGoalie(p) ? goalieBadge(W - PAD - badgeR, y) : 0;
    ctx.font = theme.nameFont(size);
    ctx.fillStyle = theme.darks.pillText;
    ctx.textAlign = 'right';
    ctx.fillText(typed(fit(ctx, p.name, W - PAD - edge - 12 - indent), shown), W - PAD - indent, y + 1);
  });
  ctx.restore();
};

const drawVs = (ctx: CanvasRenderingContext2D, theme: Theme, x: number, y: number) => {
  ctx.fillStyle = theme.vs.fill;
  ctx.beginPath();
  ctx.arc(x, y, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = theme.vs.ring;
  ctx.stroke();
  ctx.fillStyle = theme.vs.text;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '1px';
  ctx.font = theme.titleFont(54);
  ctx.fillText('VS', x, y + 3);
};

const newCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * Re-draws `source` as a board of LEDs, one per `cell` source pixels, onto `ctx` (whose canvas may be smaller).
 * During the first moments of an animation the board powers on from the top down.
 */
const ledBoard = (ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, cell: number, t: number) => {
  const cols = W / cell;
  const rows = H / cell;
  const sample = newCanvas(cols, rows);
  const sctx = sample.getContext('2d', { willReadFrequently: true })!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(source, 0, 0, cols, rows);
  const px = sctx.getImageData(0, 0, cols, rows).data;

  // Paint the LEDs straight into pixels: each is a square one pixel smaller than its pitch.
  const { width, height } = ctx.canvas;
  const pitch = Math.floor(width / cols);
  const dot = Math.max(1, pitch - 1);
  const dots = new ImageData(width, height);
  const out = dots.data;
  for (let i = 0; i < out.length; i += 4) out.set([2, 3, 2, 255], i);
  const poweredRows = rows * phase(t, 0, 0.1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 4;
      const peak = Math.max(px[i], px[i + 1], px[i + 2]);
      let rgb = [17, 22, 17];
      // Faint edge pixels stay off so letters come out crisp rather than smudged.
      if (peak >= 80 && r <= poweredRows) {
        // Push lit LEDs towards full brightness so the board glows.
        const boost = Math.min(255 / peak, 1.7);
        rgb = [px[i] * boost, px[i + 1] * boost, px[i + 2] * boost];
      }
      for (let y = 0; y < dot; y++) {
        let o = ((r * pitch + y) * width + c * pitch) * 4;
        for (let x = 0; x < dot; x++, o += 4) {
          out[o] = rgb[0];
          out[o + 1] = rgb[1];
          out[o + 2] = rgb[2];
        }
      }
    }
  }
  const board = newCanvas(width, height);
  board.getContext('2d')!.putImageData(dots, 0, 0);
  ctx.drawImage(board, 0, 0);
  // Soft bloom around lit LEDs.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.4;
  ctx.filter = `blur(${pitch}px)`;
  ctx.drawImage(board, 0, 0);
  ctx.restore();
};

/** Draws one frame at time `t` onto `ctx`, whose canvas is the picture scaled by `scale`. */
const renderFrame = (ctx: CanvasRenderingContext2D, teams: Teams, a: Assets, date: Date, t: number, scale: number) => {
  const { theme } = a;
  if (theme.led) {
    const full = newCanvas(W, H);
    drawPicture(full.getContext('2d')!, teams, a, date, t);
    ledBoard(ctx, full, theme.led.cell, t);
  }
  ctx.save();
  ctx.scale(scale, scale);
  if (!theme.led) drawPicture(ctx, teams, a, date, t);
  theme.overlay?.(ctx, t);
  ctx.restore();
};

/** The finished Lights vs Darks line-up as a WhatsApp-friendly 4:5 PNG. */
export const drawTeamsGraphic = async (teams: Teams, design: GraphicDesign, date = new Date()): Promise<Blob> => {
  const assets = await prepare(design);
  const canvas = newCanvas(W, H);
  renderFrame(canvas.getContext('2d')!, teams, assets, date, 1, 1);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render image'))), 'image/png')
  );
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
    ctx.clearRect(0, 0, gw, gh);
    renderFrame(ctx, teams, assets, date, t, GIF_SCALE);
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
