import { isGoalie, type Teams } from './teams';
import { camoTile, mulberry32, periodicNoise } from './camo';

export type GraphicBackground = 'woodland' | 'digital' | 'radar' | 'topo';

export const GRAPHIC_BACKGROUNDS: { value: GraphicBackground; label: string }[] = [
  { value: 'woodland', label: 'Woodland' },
  { value: 'digital', label: 'Digital' },
  { value: 'radar', label: 'Radar' },
  { value: 'topo', label: 'Topo' }
];

const W = 1080;
const H = 1350;
const HEADER = 230;
const PAD = 70;
const GAP = 44;

const C = {
  green: '#0f5132',
  mid: '#1f8a4c',
  lime: '#a3e635',
  white: '#ffffff'
};

const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const STENCIL = '"Black Ops One", "Barlow Condensed", sans-serif';
const BODY = 'Inter, system-ui, sans-serif';

// The slash runs from upper-right to lower-left of the body area.
const slashTop = W * 0.63;
const slashBottom = W * 0.37;
const slashX = (y: number) => slashTop + ((y - HEADER) / (H - HEADER)) * (slashBottom - slashTop);

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

const drawCamo = (ctx: CanvasRenderingContext2D, kind: 'woodland' | 'digital') => {
  const tile = camoTile(kind);
  const size = kind === 'digital' ? 480 : 420;
  ctx.imageSmoothingEnabled = kind === 'woodland';
  for (let y = 0; y < H; y += size) for (let x = 0; x < W; x += size) ctx.drawImage(tile, x, y, size, size);
  ctx.imageSmoothingEnabled = true;
};

const drawRadar = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = '#0c120a';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = HEADER + (H - HEADER) * 0.55;
  const green = (a: number) => `rgba(123, 214, 74, ${a})`;

  // Sweep: a fading wedge trailing behind a bright leading edge.
  const lead = -Math.PI * 0.3;
  const sweep = ctx.createConicGradient(lead - Math.PI * 0.55, cx, cy);
  sweep.addColorStop(0, green(0));
  sweep.addColorStop(0.275, green(0.38));
  sweep.addColorStop(0.2751, green(0));
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = green(0.3);
  ctx.lineWidth = 2;
  for (let r = 110; r < 1000; r += 110) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = green(0.16);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 1400, cy + Math.sin(a) * 1400);
    ctx.stroke();
  }
  ctx.strokeStyle = green(0.85);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(lead) * 1400, cy + Math.sin(lead) * 1400);
  ctx.stroke();

  // Contacts.
  const rand = mulberry32(7);
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const r = 150 + rand() * 650;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
    glow.addColorStop(0, green(0.95));
    glow.addColorStop(1, green(0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - 26, y - 26, 52, 52);
  }
};

const drawTopo = (ctx: CanvasRenderingContext2D) => {
  const bg = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, H);
  bg.addColorStop(0, '#1f2a17');
  bg.addColorStop(1, '#0c120a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Contour lines: quantise a noise "height map" and mark where the level changes.
  const step = 3;
  const gw = W / step;
  const gh = H / step;
  const rand = mulberry32(1066);
  const f = [periodicNoise(rand, 3), periodicNoise(rand, 7)];
  const levels = new Int16Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const n = f[0](x / gw, y / gh) * 0.75 + f[1](x / gw, y / gh) * 0.25;
      levels[y * gw + x] = Math.floor(n * 30);
    }
  }
  const small = document.createElement('canvas');
  small.width = gw;
  small.height = gh;
  const sctx = small.getContext('2d')!;
  const img = sctx.createImageData(gw, gh);
  for (let y = 0; y < gh - 1; y++) {
    for (let x = 0; x < gw - 1; x++) {
      const l = levels[y * gw + x];
      if (l !== levels[y * gw + x + 1] || l !== levels[(y + 1) * gw + x]) {
        const major = Math.max(l, levels[y * gw + x + 1], levels[(y + 1) * gw + x]) % 5 === 0;
        const i = (y * gw + x) * 4;
        img.data.set([143, 174, 79, major ? 210 : 110], i);
      }
    }
  }
  sctx.putImageData(img, 0, 0);
  ctx.drawImage(small, 0, 0, W, H);

  // Grid reference markers.
  ctx.strokeStyle = 'rgba(143, 174, 79, 0.35)';
  ctx.lineWidth = 2;
  for (let y = HEADER + 90; y < H; y += 180) {
    for (let x = 90; x < W; x += 180) {
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    }
  }
};

const lightsShape = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(0, HEADER);
  ctx.lineTo(slashTop, HEADER);
  ctx.lineTo(slashBottom, H);
  ctx.lineTo(0, H);
  ctx.closePath();
};

const darksShape = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(slashTop, HEADER);
  ctx.lineTo(W, HEADER);
  ctx.lineTo(W, H);
  ctx.lineTo(slashBottom, H);
  ctx.closePath();
};

/** Renders the Lights vs Darks line-up as a WhatsApp-friendly 4:5 PNG on an army-style background. */
export const drawTeamsGraphic = async (
  teams: Teams,
  background: GraphicBackground = 'woodland',
  date = new Date()
): Promise<Blob> => {
  const [logo] = await Promise.all([
    loadLogo(),
    document.fonts.load(`800 100px ${DISPLAY}`),
    document.fonts.load(`600 40px ${DISPLAY}`),
    document.fonts.load(`60px ${STENCIL}`),
    document.fonts.load(`500 40px ${BODY}`)
  ]).catch(() => [null]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  if (background === 'radar') drawRadar(ctx);
  else if (background === 'topo') drawTopo(ctx);
  else drawCamo(ctx, background);

  // Lights stay light and Darks stay dark green, with the background showing through both.
  ctx.fillStyle = 'rgba(244, 247, 238, 0.86)';
  lightsShape(ctx);
  ctx.fill();
  ctx.fillStyle = 'rgba(12, 58, 34, 0.5)';
  darksShape(ctx);
  ctx.fill();

  // The slash itself.
  ctx.lineCap = 'butt';
  ctx.strokeStyle = C.lime;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(slashTop, HEADER);
  ctx.lineTo(slashBottom, H);
  ctx.stroke();

  // Header band: darkened background with the club logo.
  ctx.fillStyle = 'rgba(6, 10, 5, 0.72)';
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillStyle = C.white;
  ctx.fillRect(0, HEADER - 14, W, 8);
  ctx.fillStyle = C.mid;
  ctx.fillRect(0, HEADER - 6, W, 6);

  ctx.textBaseline = 'middle';
  if (logo) {
    const h = HEADER - 52;
    ctx.drawImage(logo, PAD - 16, 20, (logo.width * h) / logo.height, h);
  } else {
    ctx.textAlign = 'left';
    ctx.fillStyle = C.white;
    ctx.font = `800 110px ${DISPLAY}`;
    ctx.fillText('DADS ARMY', PAD, 100);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = C.white;
  ctx.letterSpacing = '3px';
  ctx.font = `62px ${STENCIL}`;
  ctx.fillText('LIGHTS VS DARKS', W - PAD, 92);
  ctx.letterSpacing = '4px';
  ctx.font = `600 36px ${DISPLAY}`;
  ctx.fillStyle = '#c8dcae';
  ctx.fillText(
    date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase(),
    W - PAD,
    160
  );

  // Team titles.
  const titleY = HEADER + 95;
  ctx.letterSpacing = '4px';
  ctx.font = `800 104px ${DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.green;
  ctx.fillText('LIGHTS', PAD, titleY);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.white;
  ctx.fillText('DARKS', W - PAD, titleY);

  ctx.letterSpacing = '2px';
  ctx.font = `600 30px ${DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.mid;
  ctx.fillText(`${teams.light.length} PLAYERS`, PAD + 4, titleY + 70);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#b9e2c8';
  ctx.fillText(`${teams.dark.length} PLAYERS`, W - PAD - 4, titleY + 70);

  // VS badge sitting on the slash between the titles.
  const vsY = titleY + 20;
  const vsX = slashX(vsY);
  ctx.fillStyle = C.lime;
  ctx.beginPath();
  ctx.arc(vsX, vsY, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.white;
  ctx.stroke();
  ctx.fillStyle = C.green;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '1px';
  ctx.font = `800 54px ${DISPLAY}`;
  ctx.fillText('VS', vsX, vsY + 2);

  // Names, sized so the longer team fits.
  const top = titleY + 140;
  const bottom = H - 60;
  const rows = Math.max(teams.light.length, teams.dark.length, 1);
  const lh = Math.min(100, (bottom - top) / rows);
  const size = Math.round(lh * 0.62);
  ctx.letterSpacing = '0px';
  ctx.font = `500 ${size}px ${BODY}`;

  // Lime "G" disc marking a goalie; returns the horizontal space it takes up.
  const badgeR = lh * 0.27;
  const goalieBadge = (cx: number, y: number) => {
    ctx.fillStyle = C.lime;
    ctx.beginPath();
    ctx.arc(cx, y, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.green;
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(badgeR * 1.3)}px ${DISPLAY}`;
    ctx.fillText('G', cx, y + 1);
    ctx.font = `500 ${size}px ${BODY}`;
    return badgeR * 2 + 14;
  };

  teams.light.forEach((p, i) => {
    const y = top + lh * i + lh / 2;
    const edge = Math.min(slashX(y - lh / 2), slashX(y + lh / 2)) - GAP;
    ctx.fillStyle = 'rgba(227, 243, 233, 0.92)';
    ctx.beginPath();
    ctx.roundRect(PAD - 18, y - lh * 0.42, edge - PAD + 18, lh * 0.84, 12);
    ctx.fill();
    const indent = isGoalie(p) ? goalieBadge(PAD + badgeR, y) : 0;
    ctx.fillStyle = C.green;
    ctx.textAlign = 'left';
    ctx.fillText(fit(ctx, p.name, edge - PAD - 12 - indent), PAD + indent, y + 1);
  });

  teams.dark.forEach((p, i) => {
    const y = top + lh * i + lh / 2;
    const edge = Math.max(slashX(y - lh / 2), slashX(y + lh / 2)) + GAP;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.roundRect(edge, y - lh * 0.42, W - PAD + 18 - edge, lh * 0.84, 12);
    ctx.fill();
    const indent = isGoalie(p) ? goalieBadge(W - PAD - badgeR, y) : 0;
    ctx.fillStyle = C.white;
    ctx.textAlign = 'right';
    ctx.fillText(fit(ctx, p.name, W - PAD - edge - 12 - indent), W - PAD - indent, y + 1);
  });

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render image'))), 'image/png')
  );
};
