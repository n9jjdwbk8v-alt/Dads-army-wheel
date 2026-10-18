import type { Teams } from './teams';

const W = 1080;
const H = 1350;
const HEADER = 230;
const PAD = 70;
const GAP = 44;

const C = {
  deep: '#0a3622',
  green: '#0f5132',
  mid: '#1f8a4c',
  tint: '#e3f3e9',
  lime: '#a3e635',
  white: '#ffffff'
};

const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
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

/** Renders the Lights vs Darks line-up as a WhatsApp-friendly 4:5 PNG. */
export const drawTeamsGraphic = async (teams: Teams, date = new Date()): Promise<Blob> => {
  await Promise.all([
    document.fonts.load(`800 100px ${DISPLAY}`),
    document.fonts.load(`600 40px ${DISPLAY}`),
    document.fonts.load(`500 40px ${BODY}`)
  ]).catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Body halves: Lights on the left, Darks on the right.
  ctx.fillStyle = C.white;
  ctx.fillRect(0, HEADER, W, H - HEADER);
  ctx.fillStyle = C.green;
  ctx.beginPath();
  ctx.moveTo(slashTop, HEADER);
  ctx.lineTo(W, HEADER);
  ctx.lineTo(W, H);
  ctx.lineTo(slashBottom, H);
  ctx.closePath();
  ctx.fill();

  // The slash itself: a lime stripe with a thin white edge.
  ctx.lineCap = 'butt';
  ctx.strokeStyle = C.lime;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(slashTop, HEADER);
  ctx.lineTo(slashBottom, H);
  ctx.stroke();

  // Header band.
  const grad = ctx.createLinearGradient(0, 0, W, HEADER);
  grad.addColorStop(0, C.green);
  grad.addColorStop(1, C.deep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillStyle = C.white;
  ctx.fillRect(0, HEADER - 14, W, 8);
  ctx.fillStyle = C.mid;
  ctx.fillRect(0, HEADER - 6, W, 6);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.white;
  ctx.font = `800 120px ${DISPLAY}`;
  ctx.letterSpacing = '6px';
  ctx.fillText('DADS ARMY', PAD, 100);
  ctx.letterSpacing = '4px';
  ctx.font = `600 34px ${DISPLAY}`;
  ctx.fillStyle = '#cfeedd';
  ctx.fillText('LIGHTS VS DARKS', PAD + 4, 180);
  ctx.textAlign = 'right';
  ctx.fillText(
    date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase(),
    W - PAD,
    180
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

  teams.light.forEach((p, i) => {
    const y = top + lh * i + lh / 2;
    const edge = Math.min(slashX(y - lh / 2), slashX(y + lh / 2)) - GAP;
    ctx.fillStyle = C.tint;
    ctx.beginPath();
    ctx.roundRect(PAD - 18, y - lh * 0.42, edge - PAD + 18, lh * 0.84, 12);
    ctx.fill();
    ctx.fillStyle = C.green;
    ctx.textAlign = 'left';
    ctx.fillText(fit(ctx, p.name, edge - PAD - 12), PAD, y + 1);
  });

  teams.dark.forEach((p, i) => {
    const y = top + lh * i + lh / 2;
    const edge = Math.max(slashX(y - lh / 2), slashX(y + lh / 2)) + GAP;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.roundRect(edge, y - lh * 0.42, W - PAD + 18 - edge, lh * 0.84, 12);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.textAlign = 'right';
    ctx.fillText(fit(ctx, p.name, W - PAD - edge - 12), W - PAD, y + 1);
  });

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render image'))), 'image/png')
  );
};
