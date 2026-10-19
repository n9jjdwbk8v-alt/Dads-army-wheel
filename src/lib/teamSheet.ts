import { camoTile, mulberry32 } from './camo';
import { fit, loadFonts, loadLogo, newCanvas } from './canvasKit';
import type { Lineup } from './lines';
import type { Player } from './teams';

export type SheetKind = 'game' | 'scrimmage';

export type GameDetails = {
  kind: SheetKind;
  /** The opponent for a game, or the event's name for a scrimmage (e.g. "Scrimmage Two"). */
  opponent: string;
  /** YYYY-MM-DD from a date input, or empty. */
  date: string;
  /** HH:MM from a time input, or empty. */
  time: string;
  venue: string;
};

/** The two title words, e.g. SCRIMMAGE / SQUAD. */
export const sheetTitle = (kind: SheetKind): [string, string] =>
  kind === 'game' ? ['TEAM', 'SHEET'] : ['SCRIMMAGE', 'SQUAD'];

/** Military-style date and time, e.g. "22/03/25 @ 2215HRS". */
const when = ({ date, time }: GameDetails) => {
  const parts: string[] = [];
  if (date) {
    const [y, m, d] = date.split('-');
    parts.push(`${d}/${m}/${y.slice(2)}`);
  }
  if (time) parts.push(`${time.replace(':', '')}HRS`);
  return parts.join(' @ ');
};

/** The details shown at the top right: event or opponent, rink, then date and time. */
export const sheetInfo = (details: GameDetails) =>
  [
    details.opponent.trim() && (details.kind === 'game' ? `VS ${details.opponent.trim()}` : details.opponent.trim()),
    details.venue.trim(),
    when(details)
  ].filter(Boolean);

// Ranks that may lead a name ("Corporal Ayley"), skipped when sorting by surname.
const RANKS = [
  'lance corporal', 'staff sergeant', 'sergeant major', 'private', 'corporal', 'sergeant', 'sergent', 'lieutenant',
  'captain', 'major', 'colonel', 'brigadier', 'general', 'legionnaire', 'commander', 'admiral', 'marshal',
  'trooper', 'gunner', 'sapper', 'cadet', 'recruit'
];

/** Sort key: the name with any leading rank removed. */
const surname = (name: string) => {
  const lower = name.toLowerCase().trim();
  const rank = RANKS.find(r => lower.startsWith(`${r} `));
  return rank ? lower.slice(rank.length).trim() : lower;
};

export const bySurname = (a: Player, b: Player) => surname(a.name).localeCompare(surname(b.name));

const W = 1080;
const H = 1350;
const PANEL = { x: 58, y: 66, w: W - 116, h: 1244 };
const LIST_X = 362;
const LIST_TOP = 318;
const SIDE_X = 798;

const GREEN = '#5c8f3c';
const TITLE = '"Black Ops One", "Barlow Condensed", sans-serif';
const SERIF_STENCIL = '"Stardos Stencil", Georgia, serif';
const BLOCK = 'Anton, Impact, "Arial Narrow", sans-serif';

const SCRIMMAGE_NOTE = [
  'NOTE: THIS IS A SCRIMMAGE. IT CANNOT AND SHOULD NOT BE REFERRED TO AS A GAME UNDER ANY',
  'CIRCUMSTANCES BECAUSE FOR ALL INTENTS AND PURPOSES IT IS NOT AND NEVER WILL BE A GAME.',
  'IT IS VERY SPECIFICALLY A SCRIMMAGE AND NOTHING ELSE.'
];

// ---------- Decorations ----------

const chevrons = (ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1) => {
  ctx.strokeStyle = '#f4f4f0';
  ctx.lineWidth = 16;
  ctx.lineJoin = 'miter';
  for (let i = 0; i < 4; i++) {
    const cy = y + i * 46 * dir;
    ctx.beginPath();
    ctx.moveTo(x - 44, cy - 22 * dir);
    ctx.lineTo(x, cy + 18 * dir);
    ctx.lineTo(x + 44, cy - 22 * dir);
    ctx.stroke();
  }
};

const slashes = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, count: number) => {
  ctx.strokeStyle = '#0c0d0a';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.moveTo(x1, y1 + i * 30);
    ctx.lineTo(x2, y2 + i * 30);
    ctx.stroke();
  }
};

const bulletHole = (ctx: CanvasRenderingContext2D, rand: () => number, x: number, y: number, r: number) => {
  ctx.fillStyle = '#0c0d0a';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.3;
    const len = r * (1.5 + rand() * 1.4);
    const w = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a + Math.PI / 2) * w, y + Math.sin(a + Math.PI / 2) * w);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.lineTo(x + Math.cos(a - Math.PI / 2) * w, y + Math.sin(a - Math.PI / 2) * w);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  const ring = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, r * 0.2, x, y, r * 0.8);
  ring.addColorStop(0, '#6b6d66');
  ring.addColorStop(1, '#23251f');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#16180f';
  ctx.beginPath();
  ctx.arc(x + r * 0.05, y + r * 0.05, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
};

const puck = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.25);
  ctx.fillStyle = '#0b0c09';
  ctx.beginPath();
  ctx.ellipse(0, 28, 175, 78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b1d17';
  ctx.beginPath();
  ctx.ellipse(0, 0, 175, 78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 150, 62, 0, Math.PI * 1.05, Math.PI * 1.7);
  ctx.stroke();
  ctx.restore();
};

/** A strip of white tape with ragged top and bottom edges, slightly askew. */
const tornLabel = (ctx: CanvasRenderingContext2D, rand: () => number, cx: number, cy: number, text: string) => {
  const w = 360;
  const h = 76;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.03);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  for (let x = -w / 2; x <= w / 2; x += 12) ctx.lineTo(x, -h / 2 + (rand() - 0.5) * 9);
  ctx.lineTo(w / 2 + 14, -h / 2 + 6);
  ctx.lineTo(w / 2, h / 2);
  for (let x = w / 2; x >= -w / 2; x -= 12) ctx.lineTo(x, h / 2 + (rand() - 0.5) * 9);
  ctx.lineTo(-w / 2 - 10, h / 2 - 8);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#f1f1ec';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = GREEN;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '2px';
  ctx.font = `40px ${TITLE}`;
  ctx.fillText(text, 0, 3);
  ctx.restore();
};

const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
};

// ---------- The sheet ----------

/** A line of the main list: a green heading, or a name with an optional green position tag. */
export type ListEntry = { heading: string } | { name: string; tag?: string };

/** Draws one list entry centred on `x`, as a green heading or a name with an optional green tag before it. */
const drawEntry = (ctx: CanvasRenderingContext2D, entry: ListEntry, x: number, y: number, size: number, max: number) => {
  ctx.textAlign = 'center';
  if ('heading' in entry) {
    ctx.fillStyle = GREEN;
    ctx.letterSpacing = '3px';
    ctx.font = `${Math.round(size * 0.85)}px ${TITLE}`;
    ctx.fillText(entry.heading, x, y);
    return;
  }
  ctx.letterSpacing = '1px';
  // Long names shrink to fit (down to 60%) before being cut short.
  const room = entry.tag ? max - 70 : max;
  const upper = entry.name.toUpperCase();
  for (let px = size; px >= Math.round(size * 0.6); px--) {
    ctx.font = `${px}px ${BLOCK}`;
    if (ctx.measureText(upper).width <= room) break;
  }
  const name = fit(ctx, upper, room);
  if (!entry.tag) {
    ctx.fillStyle = '#f4f4f0';
    ctx.fillText(name, x, y);
    return;
  }
  const tag = `${entry.tag}  `;
  const tagW = ctx.measureText(tag).width;
  const left = x - (tagW + ctx.measureText(name).width) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = GREEN;
  ctx.fillText(tag, left, y);
  ctx.fillStyle = '#f4f4f0';
  ctx.fillText(name, left + tagW, y);
};

/** Optional second section in the right-hand column, under its own torn label (used for defence pairs). */
type SideSection = { label: string; entries: ListEntry[] };

const drawSheet = async (details: GameDetails, entries: ListEntry[], goalies: Player[], side?: SideSection) => {
  const [logo] = await Promise.all([
    loadLogo(),
    loadFonts(),
    document.fonts.load(`40px ${BLOCK}`),
    document.fonts.load(`700 60px ${SERIF_STENCIL}`)
  ]).catch(() => [null]);
  const canvas = newCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(2215);

  // Grey-green camo all round, with the dark olive panel on top.
  const tile = camoTile('stone');
  for (let y = 0; y < H; y += 240) for (let x = 0; x < W; x += 240) ctx.drawImage(tile, x, y, 240, 240);
  ctx.fillStyle = '#27311e';
  ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  // Grunge: dark and light flecks across the panel.
  for (let i = 0; i < 2600; i++) {
    const x = PANEL.x + rand() * PANEL.w;
    const y = PANEL.y + rand() * PANEL.h;
    ctx.fillStyle = rand() < 0.6 ? 'rgba(10, 12, 8, 0.35)' : 'rgba(120, 135, 100, 0.12)';
    ctx.fillRect(x, y, 1 + rand() * 3, 1 + rand() * 3);
  }

  chevrons(ctx, 14, 96, 1);
  chevrons(ctx, W - 22, H - 70, -1);
  slashes(ctx, 0, 520, 190, 250, 3);
  slashes(ctx, 0, 300, 120, 140, 2);
  slashes(ctx, W, 1150, W - 220, 1340, 3);
  bulletHole(ctx, rand, W - 54, 88, 40);
  bulletHole(ctx, rand, 952, 332, 34);
  bulletHole(ctx, rand, 26, 604, 32);
  bulletHole(ctx, rand, 118, 806, 30);
  puck(ctx, 60, 1260);

  // Title: big stencil word with a smaller serif stencil word under it.
  const [big, small] = sheetTitle(details.kind);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GREEN;
  ctx.letterSpacing = '2px';
  ctx.textAlign = 'center';
  ctx.font = `150px ${TITLE}`;
  const titleSize = Math.min(150, Math.floor((150 * 520) / ctx.measureText(big).width));
  ctx.font = `${titleSize}px ${TITLE}`;
  ctx.fillText(big, LIST_X, 188);
  ctx.letterSpacing = '6px';
  ctx.font = `700 74px ${SERIF_STENCIL}`;
  ctx.fillText(small, LIST_X, 258);

  // Event details, top right.
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  sheetInfo(details).forEach((text, i) => {
    ctx.fillStyle = i === 0 ? '#c9ccbd' : GREEN;
    ctx.font = `${i === 0 ? 34 : 30}px ${BLOCK}`;
    ctx.fillText(fit(ctx, text.toUpperCase(), 330), SIDE_X, 212 + i * 36);
  });

  // Netminders.
  tornLabel(ctx, rand, SIDE_X, 444, goalies.length > 1 ? 'NETMINDERS' : 'NETMINDER');
  ctx.fillStyle = '#f4f4f0';
  ctx.letterSpacing = '1px';
  ctx.font = `34px ${BLOCK}`;
  const goalieNames = goalies.length ? goalies.map(g => g.name.toUpperCase()) : ['TO BE CONFIRMED'];
  const shownGoalies = goalieNames.slice(0, 3);
  shownGoalies.forEach((name, i) => ctx.fillText(fit(ctx, name, 340), SIDE_X, 514 + i * 42));

  // Right column below the netminders: an optional section, then the logo in whatever room is left.
  let logoTop = 660;
  if (side?.entries.length) {
    const labelY = 514 + shownGoalies.length * 42 + 52;
    tornLabel(ctx, rand, SIDE_X, labelY, side.label);
    const start = labelY + 70;
    const sideGap = Math.min(38, (1060 - start) / side.entries.length);
    side.entries.forEach((entry, i) =>
      drawEntry(ctx, entry, SIDE_X, start + i * sideGap, Math.round(Math.min(32, sideGap * 0.88)), 400)
    );
    logoTop = start + side.entries.length * sideGap + 20;
  }
  const logoH = Math.min(360, 1110 - logoTop);
  if (logo && logoH >= 120) {
    const w = (logo.width * logoH) / logo.height;
    ctx.drawImage(logo, SIDE_X + 10 - w / 2, logoTop, w, logoH);
  }

  // The squad list, centred in the left column and sized to fit.
  const note = details.kind === 'scrimmage';
  const starsY = note ? 1110 : 1200;
  const bottom = starsY - 54;
  const gap = entries.length > 1 ? Math.min(40, (bottom - LIST_TOP) / (entries.length - 1)) : 40;
  const size = Math.round(Math.min(36, gap * 0.92));
  entries.forEach((entry, i) => drawEntry(ctx, entry, LIST_X, LIST_TOP + i * gap, size, 560));

  ctx.fillStyle = '#f4f4f0';
  for (let i = 0; i < 5; i++) star(ctx, LIST_X - 96 + i * 48, starsY, 22);

  if (note) {
    ctx.textAlign = 'center';
    ctx.letterSpacing = '0.5px';
    ctx.fillStyle = '#e6e8df';
    ctx.font = `22px ${BLOCK}`;
    SCRIMMAGE_NOTE.forEach((line, i) => {
      const y = 1186 + i * 27;
      ctx.fillText(line, W / 2, y);
      // Underline the word SCRIMMAGE, as on the original.
      const start = W / 2 - ctx.measureText(line).width / 2;
      const word = ctx.measureText('SCRIMMAGE').width;
      for (let at = line.indexOf('SCRIMMAGE'); at >= 0; at = line.indexOf('SCRIMMAGE', at + 1)) {
        ctx.fillRect(start + ctx.measureText(line.slice(0, at)).width, y + 9, word, 2);
      }
    });
    ctx.fillStyle = GREEN;
    ctx.font = `22px ${BLOCK}`;
    ctx.fillText('FAILURE WILL RESULT TO COURT MARSHALLING!', W / 2, 1280);
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not draw the sheet'))), 'image/png')
  );
};

/** The whole squad as one list (skaters by surname), with the goalies as netminders. */
export const drawSquadSheet = (details: GameDetails, skaters: Player[], goalies: Player[]) =>
  drawSheet(
    details,
    [...skaters].sort(bySurname).map(p => ({ name: p.name })),
    goalies
  );

const ORDINALS = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];

/**
 * The same sheet split into lines: forward lines and reserves down the left, defence pairs on the right under
 * the netminders.
 */
export const drawLinesSheet = (details: GameDetails, lineup: Lineup) => {
  const entries: ListEntry[] = [];
  lineup.forwards.forEach((line, i) => {
    entries.push({ heading: `${ORDINALS[i] ?? `${i + 1}TH`} LINE` });
    line.forEach((p, j) => p && entries.push({ name: p.name, tag: ['LW', 'C', 'RW'][j] }));
  });
  if (lineup.spares.length) {
    entries.push({ heading: 'RESERVES' });
    lineup.spares.forEach(p => entries.push({ name: p.name }));
  }
  const defence: ListEntry[] = [];
  lineup.defence.forEach((pair, i) => {
    defence.push({ heading: `${ORDINALS[i] ?? `${i + 1}TH`} PAIR` });
    pair.forEach((p, j) => p && defence.push({ name: p.name, tag: ['LD', 'RD'][j] }));
  });
  return drawSheet(details, entries, lineup.goalies.filter((p): p is Player => !!p), {
    label: 'DEFENCE',
    entries: defence
  });
};
