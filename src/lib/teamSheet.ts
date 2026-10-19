import { camoTile } from './camo';
import { fit, loadFonts, loadLogo, newCanvas } from './canvasKit';
import type { Lineup } from './lines';
import type { Player } from './teams';

export type SheetKind = 'game' | 'scrimmage';

export type GameDetails = {
  kind: SheetKind;
  opponent: string;
  /** YYYY-MM-DD from a date input, or empty. */
  date: string;
  /** HH:MM from a time input, or empty. */
  time: string;
  venue: string;
};

export const sheetTitle = (kind: SheetKind) => (kind === 'game' ? 'TEAM SHEET' : 'SCRIMMAGE');

/** "SAT 25 OCT · 7:30PM · PLANET ICE", leaving out anything not filled in. */
export const detailsLine = ({ date, time, venue }: GameDetails) => {
  const parts: string[] = [];
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    parts.push(new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }));
  }
  if (time) {
    const [h, min] = time.split(':').map(Number);
    parts.push(new Date(2000, 0, 1, h, min).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
  }
  if (venue.trim()) parts.push(venue.trim());
  return parts.join(' · ');
};

const W = 1080;
const PAD = 60;
const HEADER = 330;
const SECTION = 78;
const ROW = 116;
const CHIP_ROW = 84;

const STENCIL = '"Black Ops One", "Barlow Condensed", sans-serif';
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const LIME = '#a3e635';

type Slot = { tag: string; player?: Player };

/** The squad for a game or scrimmage as a shareable PNG, laid out as lines, pairs, goalies and spares. */
export const drawTeamSheet = async (lineup: Lineup, details: GameDetails): Promise<Blob> => {
  const [logo] = await Promise.all([loadLogo(), loadFonts()]);

  const forwardRows = lineup.forwards.map((line, i) => ({
    label: `L${i + 1}`,
    slots: ['LW', 'C', 'RW'].map((tag, j) => ({ tag, player: line[j] }))
  }));
  const defenceRows = lineup.defence.map((pair, i) => ({
    label: `D${i + 1}`,
    slots: ['LD', 'RD'].map((tag, j) => ({ tag, player: pair[j] }))
  }));
  const goalieRow = {
    label: 'G',
    slots: [
      { tag: 'STARTER', player: lineup.goalies[0] },
      { tag: 'BACKUP', player: lineup.goalies[1] }
    ]
  };
  const spareRows = Math.ceil(lineup.spares.length / 3);
  const sections = [forwardRows.length, defenceRows.length, 1, spareRows].filter(Boolean).length;
  const height = Math.max(
    1350,
    HEADER + 30 + sections * SECTION + (forwardRows.length + defenceRows.length + 1) * ROW + spareRows * CHIP_ROW + 90
  );

  const canvas = newCanvas(W, height);
  const ctx = canvas.getContext('2d')!;

  // Woodland camo, darkened, like the website.
  const tile = camoTile('woodland');
  for (let y = 0; y < height; y += 420) for (let x = 0; x < W; x += 420) ctx.drawImage(tile, x, y, 420, 420);
  ctx.fillStyle = 'rgba(6, 10, 5, 0.62)';
  ctx.fillRect(0, 0, W, height);

  // Header: logo, title, opponent and details.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, HEADER - 14, W, 8);
  ctx.fillStyle = '#1f8a4c';
  ctx.fillRect(0, HEADER - 6, W, 6);
  const logoH = HEADER - 70;
  const logoW = logo ? (logo.width * logoH) / logo.height : 0;
  if (logo) ctx.drawImage(logo, PAD - 10, 26, logoW, logoH);
  const textX = W - PAD;
  const room = textX - (PAD + logoW + 30);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '4px';
  ctx.font = `86px ${STENCIL}`;
  ctx.fillText(fit(ctx, sheetTitle(details.kind), room), textX, 96);
  ctx.letterSpacing = '2px';
  if (details.opponent.trim()) {
    ctx.fillStyle = LIME;
    ctx.font = `800 58px ${DISPLAY}`;
    ctx.fillText(fit(ctx, `VS ${details.opponent.trim().toUpperCase()}`, room), textX, 176);
  }
  const info = detailsLine(details).toUpperCase();
  if (info) {
    ctx.fillStyle = '#c8dcae';
    ctx.font = `600 32px ${DISPLAY}`;
    ctx.fillText(fit(ctx, info, room), textX, details.opponent.trim() ? 242 : 186);
  }

  let y = HEADER + 30;

  const section = (title: string) => {
    ctx.fillStyle = LIME;
    ctx.fillRect(PAD, y + 22, 8, 36);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '4px';
    ctx.font = `40px ${STENCIL}`;
    ctx.fillText(title, PAD + 24, y + 42);
    y += SECTION;
  };

  const row = (label: string, slots: Slot[]) => {
    const h = ROW - 16;
    // Line label badge.
    ctx.fillStyle = LIME;
    ctx.beginPath();
    ctx.roundRect(PAD, y, 84, h, 12);
    ctx.fill();
    ctx.fillStyle = '#0b130d';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '1px';
    ctx.font = `800 40px ${DISPLAY}`;
    ctx.fillText(label, PAD + 42, y + h / 2 + 2);
    // Player boxes.
    const gap = 14;
    const left = PAD + 84 + gap;
    const boxW = (W - PAD - left - gap * (slots.length - 1)) / slots.length;
    slots.forEach((slot, i) => {
      const x = left + i * (boxW + gap);
      ctx.fillStyle = slot.player ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = LIME;
      ctx.letterSpacing = '2px';
      ctx.font = `700 22px ${DISPLAY}`;
      ctx.fillText(slot.tag, x + 16, y + 24);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = slot.player ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
      ctx.font = `700 ${slots.length === 3 ? 40 : 44}px ${DISPLAY}`;
      ctx.fillText(fit(ctx, slot.player?.name ?? '—', boxW - 32), x + 16, y + h / 2 + 16);
    });
    y += ROW;
  };

  if (forwardRows.length) {
    section('FORWARDS');
    forwardRows.forEach(r => row(r.label, r.slots));
  }
  if (defenceRows.length) {
    section('DEFENCE');
    defenceRows.forEach(r => row(r.label, r.slots));
  }
  section('GOALIES');
  if (lineup.goalies.length) {
    row(goalieRow.label, goalieRow.slots);
  } else {
    ctx.fillStyle = '#ffb347';
    ctx.textAlign = 'left';
    ctx.font = `700 40px ${DISPLAY}`;
    ctx.fillText('No goalie available yet', PAD + 24, y + 40);
    y += ROW;
  }
  if (lineup.spares.length) {
    section('SPARES');
    const chipW = (W - PAD * 2 - 28) / 3;
    lineup.spares.forEach((p, i) => {
      const x = PAD + (i % 3) * (chipW + 14);
      const cy = y + Math.floor(i / 3) * CHIP_ROW;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(x, cy, chipW, CHIP_ROW - 16, 34);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = `700 34px ${DISPLAY}`;
      ctx.fillText(fit(ctx, p.name, chipW - 30), x + chipW / 2, cy + (CHIP_ROW - 16) / 2 + 2);
    });
    y += spareRows * CHIP_ROW;
  }

  ctx.fillStyle = 'rgba(200, 220, 174, 0.7)';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '6px';
  ctx.font = `24px ${STENCIL}`;
  ctx.fillText('DADS ARMY ICE HOCKEY', W / 2, height - 34);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render team sheet'))), 'image/png')
  );
};
