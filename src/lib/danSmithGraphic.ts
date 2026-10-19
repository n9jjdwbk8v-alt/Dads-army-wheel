import { isGoalie, type Player, type Teams } from './teams';
import { ANTON, DISPLAY, H, NEON, W } from './graphicThemes';

/** Goalies first, then by name, with goalies marked. */
const lineUp = (side: Player[]) =>
  [...side]
    .sort((a, b) => Number(isGoalie(b)) - Number(isGoalie(a)) || a.name.localeCompare(b.name))
    .map(p => (isGoalie(p) ? `${p.name} (G)` : p.name));

/** Sets the largest font up to `size` that fits `text` in `max` pixels. */
const fitFont = (ctx: CanvasRenderingContext2D, text: string, max: number, font: (px: number) => string, size: number) => {
  let px = size;
  ctx.font = font(px);
  while (ctx.measureText(text).width > max && px > 12) ctx.font = font(--px);
};

const GOLD = '#d9a514';

/** A marquee bulb, glowing. */
const bulb = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 210, 90, 0.95)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ffe9a0';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** A playing card holding one team: a king of black ink for the Lights, an ace in red for the Darks. */
const card = (ctx: CanvasRenderingContext2D, x: number, title: string, names: string[], red: boolean) => {
  const y = 340;
  const w = 450;
  const h = 820;
  const ink = red ? '#c4161c' : '#111111';
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(red ? 0.035 : -0.035);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#fbf7ee';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 28);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(16, 16, w - 32, h - 32, 18);
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '2px';
  ctx.font = `64px ${ANTON}`;
  ctx.textAlign = 'left';
  ctx.fillText(red ? 'A' : 'K', 34, 62);
  ctx.textAlign = 'right';
  ctx.save();
  ctx.translate(w - 34, h - 62);
  ctx.rotate(Math.PI);
  ctx.textAlign = 'left';
  ctx.fillText(red ? 'A' : 'K', 0, 0);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.letterSpacing = '4px';
  ctx.font = `72px ${ANTON}`;
  ctx.fillText(title, w / 2, 150);
  ctx.fillRect(70, 200, w - 140, 3);

  // Names spread down the card, centred in the space under the title.
  const top = 230;
  const bottom = h - 110;
  const lh = Math.min(72, (bottom - top) / Math.max(names.length, 1));
  const start = top + (bottom - top - lh * names.length) / 2 + lh / 2;
  ctx.letterSpacing = '0px';
  names.forEach((name, i) => {
    fitFont(ctx, name, w - 80, px => `800 ${px}px ${DISPLAY}`, Math.round(lh * 0.66));
    ctx.fillText(name, w / 2, start + i * lh);
  });
  ctx.restore();
};

/** A die showing `pips`, given as positions on a 3×3 grid (-1, 0 or 1 each way). */
const die = (ctx: CanvasRenderingContext2D, x: number, y: number, pips: [number, number][], turn: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-34, -34, 68, 68, 12);
  ctx.fill();
  ctx.fillStyle = '#111111';
  for (const [a, b] of pips) {
    ctx.beginPath();
    ctx.arc(a * 18, b * 18, 6.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/**
 * Dan Smith mode's picture, whatever style is picked: a rigged casino. Red velvet ringed with marquee bulbs, the
 * name in pink neon over THE HOUSE ALWAYS WINS, the teams on two playing cards, and the odds (rigged) with dice.
 */
export const drawDanSmithPicture = (ctx: CanvasRenderingContext2D, teams: Teams, dateText: string) => {
  ctx.save();
  const felt = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 900);
  felt.addColorStop(0, '#7a0f1c');
  felt.addColorStop(1, '#2a0408');
  ctx.fillStyle = felt;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(40, 40, W - 80, H - 80, 30);
  ctx.stroke();
  for (let x = 70; x <= W - 70; x += 54) {
    bulb(ctx, x, 22);
    bulb(ctx, x, H - 22);
  }
  for (let y = 76; y <= H - 76; y += 54) {
    bulb(ctx, 22, y);
    bulb(ctx, W - 22, y);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.shadowColor = '#ff4fd8';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffd6f6';
  ctx.letterSpacing = '4px';
  fitFont(ctx, 'DAN SMITH MODE', W - 160, px => `${px}px ${NEON}`, 112);
  ctx.fillText('DAN SMITH MODE', W / 2, 160);
  ctx.shadowColor = '#ffcc33';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffe28a';
  ctx.letterSpacing = '8px';
  ctx.font = `44px ${NEON}`;
  ctx.fillText('THE HOUSE ALWAYS WINS', W / 2, 262);
  ctx.restore();

  card(ctx, 70, 'LIGHTS', lineUp(teams.light), false);
  card(ctx, W - 70 - 450, 'DARKS', lineUp(teams.dark), true);

  die(ctx, W / 2 - 46, 1230, [[-1, -1], [0, 0], [1, 1]], -0.3);
  die(ctx, W / 2 + 46, 1236, [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 0.25);
  ctx.fillStyle = '#ffe28a';
  ctx.font = `800 30px ${DISPLAY}`;
  ctx.letterSpacing = '6px';
  ctx.textAlign = 'left';
  ctx.fillText('ODDS: RIGGED', 80, 1232);
  ctx.textAlign = 'right';
  ctx.fillText(dateText, W - 80, 1232);
  ctx.restore();
};
