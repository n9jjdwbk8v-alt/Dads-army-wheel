import { fit, loadFonts, loadLogo, newCanvas } from './canvasKit';
import {
  BLOCK,
  GREEN,
  H,
  LIST_X,
  SERIF_STENCIL,
  SIDE_X,
  TITLE,
  W,
  drawFrame,
  sheetInfo,
  star,
  tornLabel,
  type GameDetails
} from './teamSheet';

/** 1, 2 and 3 are the periods; 4 is overtime. */
export type Period = 1 | 2 | 3 | 4;

export type Goal = {
  period: Period;
  /** Ours (Dads Army) or theirs. */
  side: 'us' | 'them';
  /** Our scorer and assists; for their goals, optionally the scorer's shirt number. */
  scorer?: string;
  assists?: string[];
  number?: string;
};

export type Penalty = { period: Period; side: 'us' | 'them'; who: string; minutes: number; reason?: string };

export type ScoreSheet = {
  details: GameDetails;
  /** The sheet after this period, or the final score. */
  stage: Period | 'final';
  goals: Goal[];
  penalties: Penalty[];
  shots: { us: number; them: number };
  /** Our netminders and the saves each made. */
  netminders: { name: string; saves: number }[];
  /** Picked at full time. */
  playerOfMatch?: string;
};

const PERIOD_NAMES = ['1ST', '2ND', '3RD', 'OT'];
const OFF_WHITE = '#f4f4f0';
const STONE = '#c9ccbd';
const DIM = '#98a389';

/** A line made of differently styled pieces, centred on `x`. */
const pieces = (
  ctx: CanvasRenderingContext2D,
  parts: { text: string; color: string; font: string }[],
  x: number,
  y: number
) => {
  const widths = parts.map(p => {
    ctx.font = p.font;
    return ctx.measureText(p.text).width;
  });
  let left = x - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = 'left';
  parts.forEach((p, i) => {
    ctx.font = p.font;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, left, y);
    left += widths[i];
  });
  ctx.textAlign = 'center';
};

const surnameOf = (name: string) => name.trim().split(/\s+/).pop()!.toUpperCase();

/** A red rubber stamp, slightly askew: VICTORY, DEFEAT or DRAW. */
const stamp = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.14);
  ctx.globalAlpha = 0.88;
  ctx.font = `64px ${TITLE}`;
  ctx.letterSpacing = '6px';
  const w = ctx.measureText(text).width + 56;
  ctx.strokeStyle = '#d23b26';
  ctx.lineWidth = 8;
  ctx.strokeRect(-w / 2, -50, w, 100);
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2 + 10, -40, w - 20, 80);
  ctx.fillStyle = '#d23b26';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 3, 4);
  // Worn ink: knock small specks out of the stamp.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    const sx = -w / 2 + ((i * 97) % w);
    const sy = -50 + ((i * 53) % 100);
    ctx.fillRect(sx, sy, 2 + (i % 3), 2 + (i % 2));
  }
  ctx.restore();
};

export const drawScoreSheet = async (sheet: ScoreSheet): Promise<Blob> => {
  const [logo] = await Promise.all([
    loadLogo(),
    loadFonts(),
    document.fonts.load(`40px ${BLOCK}`),
    document.fonts.load(`700 60px ${SERIF_STENCIL}`)
  ]).catch(() => [null]);
  const canvas = newCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  const rand = drawFrame(ctx);
  const { details, stage, goals, penalties } = sheet;
  const last: Period = stage === 'final' ? (Math.max(3, ...goals.map(g => g.period)) as Period) : stage;
  const shown = goals.filter(g => g.period <= last);
  const us = shown.filter(g => g.side === 'us').length;
  const them = shown.length - us;
  // A scrimmage's "opponent" field holds the event's name, so the other side is just the opposition.
  const opponent = (details.kind === 'game' && details.opponent.trim().toUpperCase()) || 'OPPOSITION';

  // Title, as on the team sheet: FINAL SCORE, or e.g. 1ST PERIOD.
  const [big, small] = stage === 'final' ? ['FINAL', 'SCORE'] : [PERIOD_NAMES[stage - 1], 'PERIOD'];
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GREEN;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.font = `150px ${TITLE}`;
  ctx.font = `${Math.min(150, Math.floor((150 * 520) / ctx.measureText(big).width))}px ${TITLE}`;
  ctx.fillText(big, LIST_X, 188);
  ctx.letterSpacing = '6px';
  ctx.font = `700 74px ${SERIF_STENCIL}`;
  ctx.fillText(small, LIST_X, 258);

  // Opponent, rink, date and time, top right.
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  sheetInfo(details).forEach((text, i) => {
    ctx.fillStyle = i === 0 ? STONE : GREEN;
    ctx.font = `${i === 0 ? 34 : 30}px ${BLOCK}`;
    ctx.fillText(fit(ctx, text.toUpperCase(), 330), SIDE_X, 212 + i * 36);
  });

  // The score: us on the left, them on the right.
  ctx.letterSpacing = '1px';
  ctx.font = `30px ${BLOCK}`;
  ctx.fillStyle = GREEN;
  ctx.fillText('DADS ARMY', LIST_X - 140, 350);
  ctx.fillStyle = STONE;
  ctx.fillText(fit(ctx, opponent, 250), LIST_X + 140, 350);
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '0px';
  ctx.font = `176px ${TITLE}`;
  ctx.fillStyle = OFF_WHITE;
  ctx.fillText(String(us), LIST_X - 140, 538);
  ctx.fillStyle = STONE;
  ctx.fillText(String(them), LIST_X + 140, 538);
  ctx.fillStyle = GREEN;
  ctx.font = `90px ${TITLE}`;
  ctx.fillText('-', LIST_X, 505);

  // Every goal so far, in order, down the left. The sheet is the same all game; only its title changes.
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  const lines: ({ heading: string } | Goal)[] = [{ heading: 'GOALS' }, ...shown];
  const listTop = 610;
  const listBottom = stage === 'final' && sheet.playerOfMatch ? 1080 : 1150;
  const gap = lines.length > 1 ? Math.min(44, (listBottom - listTop) / (lines.length - 1)) : 44;
  const size = Math.round(Math.min(34, gap * 0.82));
  if (!shown.length) {
    ctx.fillStyle = DIM;
    ctx.font = `${size}px ${BLOCK}`;
    ctx.fillText('NO GOALS YET', LIST_X, listTop + gap);
  }
  lines.forEach((line, i) => {
    const y = listTop + i * gap;
    if ('heading' in line) {
      ctx.fillStyle = GREEN;
      ctx.letterSpacing = '3px';
      ctx.font = `${Math.round(size * 0.82)}px ${TITLE}`;
      ctx.fillText(line.heading, LIST_X, y);
      ctx.letterSpacing = '1px';
      return;
    }
    if (line.side === 'us') {
      const helpers = line.assists?.length ? `  (${line.assists.map(surnameOf).join(', ')})` : '  (UNASSISTED)';
      pieces(
        ctx,
        [
          { text: (line.scorer ?? 'DADS ARMY').toUpperCase(), color: OFF_WHITE, font: `${size}px ${BLOCK}` },
          { text: helpers, color: DIM, font: `${Math.round(size * 0.7)}px ${BLOCK}` }
        ],
        LIST_X,
        y
      );
    } else {
      pieces(
        ctx,
        [
          { text: opponent, color: DIM, font: `${size}px ${BLOCK}` },
          { text: line.number ? `  #${line.number}` : '', color: DIM, font: `${Math.round(size * 0.7)}px ${BLOCK}` }
        ],
        LIST_X,
        y
      );
    }
  });

  // Right column: netminders and saves, shots, then penalties.
  tornLabel(ctx, rand, SIDE_X, 444, sheet.netminders.length > 1 ? 'NETMINDERS' : 'NETMINDER');
  let y = 514;
  ctx.letterSpacing = '1px';
  (sheet.netminders.length ? sheet.netminders : [{ name: 'TO BE CONFIRMED', saves: -1 }]).slice(0, 2).forEach(n => {
    ctx.fillStyle = OFF_WHITE;
    ctx.font = `34px ${BLOCK}`;
    ctx.fillText(fit(ctx, n.name.toUpperCase(), 340), SIDE_X, y);
    if (n.saves >= 0) {
      ctx.fillStyle = GREEN;
      ctx.font = `28px ${BLOCK}`;
      ctx.fillText(`${n.saves} SAVES`, SIDE_X, y + 36);
    }
    y += 84;
  });

  tornLabel(ctx, rand, SIDE_X, y + 28, 'SHOTS');
  ctx.font = `44px ${BLOCK}`;
  pieces(
    ctx,
    [
      { text: String(sheet.shots.us), color: OFF_WHITE, font: `44px ${BLOCK}` },
      { text: '  -  ', color: GREEN, font: `44px ${BLOCK}` },
      { text: String(sheet.shots.them), color: STONE, font: `44px ${BLOCK}` }
    ],
    SIDE_X,
    y + 104
  );
  y += 170;

  const pens = penalties.filter(p => p.period <= last);
  if (pens.length) {
    tornLabel(ctx, rand, SIDE_X, y + 28, 'PENALTIES');
    y += 96;
    pens.slice(0, 6).forEach(p => {
      const who = p.side === 'us' ? surnameOf(p.who) : `${opponent.split(' ')[0]} #${p.who}`;
      pieces(
        ctx,
        [
          { text: `${who}  `, color: p.side === 'us' ? OFF_WHITE : DIM, font: `30px ${BLOCK}` },
          { text: `${p.minutes}'${p.reason ? ` ${p.reason.toUpperCase()}` : ''}`, color: GREEN, font: `24px ${BLOCK}` }
        ],
        SIDE_X,
        y
      );
      y += 38;
    });
    y += 10;
  }

  // At full time, the result stamped on, then the logo in whatever room is left.
  if (stage === 'final') {
    stamp(ctx, us > them ? 'VICTORY' : us < them ? 'DEFEAT' : 'DRAW', SIDE_X + 6, y + 70);
    y += 150;
  }
  // The logo in whatever room is left.
  const logoH = Math.min(300, 1130 - y);
  if (logo && logoH >= 140) {
    const w = (logo.width * logoH) / logo.height;
    ctx.drawImage(logo, SIDE_X + 10 - w / 2, y + 10, w, logoH);
  }

  // Player of the match at full time, then the five stars as on the team sheet.
  if (stage === 'final' && sheet.playerOfMatch) {
    ctx.fillStyle = GREEN;
    ctx.letterSpacing = '3px';
    ctx.font = `26px ${TITLE}`;
    ctx.fillText('PLAYER OF THE MATCH', LIST_X, 1118);
    ctx.letterSpacing = '1px';
    ctx.fillStyle = OFF_WHITE;
    ctx.font = `38px ${BLOCK}`;
    ctx.fillText(fit(ctx, sheet.playerOfMatch.toUpperCase(), 520), LIST_X, 1160);
  }
  ctx.fillStyle = OFF_WHITE;
  for (let i = 0; i < 5; i++) star(ctx, LIST_X - 96 + i * 48, 1220, 22);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not draw the sheet'))), 'image/png')
  );
};
