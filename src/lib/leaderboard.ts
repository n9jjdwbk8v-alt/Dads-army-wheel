import { fit, loadFonts, newCanvas } from './canvasKit';
import { matchTitle, score, type Match } from './matches';
import { BLOCK, GREEN, H, LIST_X, SERIF_STENCIL, SIDE_X, TITLE, W, drawFrame, star, tornLabel } from './teamSheet';
import type { Player } from './teams';

/** One player's goals and assists over the scrimmages being counted. */
export type Tally = { key: string; name: string; played: number; goals: number; assists: number; points: number };
export type SortKey = 'goals' | 'assists' | 'points';
/** 'all' for the running total, or a month as 'YYYY-MM'. */
export type BoardPeriod = 'all' | string;

/** Only scrimmages count, and only once they've reached full time. */
export const countedScrims = (matches: Match[]) => matches.filter(m => m.details.kind === 'scrimmage' && m.finished);

/** The month a scrimmage was played, as 'YYYY-MM' (the day it was saved if it had no date). */
export const monthOf = (m: Match) => (m.details.date || m.saved).slice(0, 7);

/** Months with at least one counted scrimmage, newest first. */
export const boardMonths = (scrims: Match[]) => [...new Set(scrims.map(monthOf).filter(Boolean))].sort().reverse();

const monthDate = (ym: string) => new Date(`${ym}-01T12:00:00`);

/** "Nov", or "Nov 25" for a month in another year. */
export const monthShort = (ym: string) => {
  const d = monthDate(ym);
  const short = d.toLocaleDateString(undefined, { month: 'short' });
  return d.getFullYear() === new Date().getFullYear() ? short : `${short} ${String(d.getFullYear()).slice(2)}`;
};

/** "November 2026". */
export const monthLong = (ym: string) =>
  monthDate(ym).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export const inPeriod = (scrims: Match[], period: BoardPeriod) =>
  period === 'all' ? scrims : scrims.filter(m => monthOf(m) === period);

/** A player's goals and assists in one scrimmage. Goals are recorded by name, so names are matched. */
export const statsIn = (m: Match, name: string) => {
  const ours = m.goals.filter(g => g.side === 'us');
  return {
    goals: ours.filter(g => g.scorer === name).length,
    assists: ours.filter(g => g.assists?.includes(name)).length
  };
};

/**
 * Adds up everyone's goals and assists. Players are matched by roster id, so a renamed player keeps their record and
 * shows their current name. Netminders appear only once they've a point.
 */
export const tally = (scrims: Match[], roster: Player[]): Tally[] => {
  const current = new Map(roster.map(p => [p.id, p.name]));
  const totals = new Map<string, Tally & { goalie: boolean }>();
  const add = (key: string, name: string, goalie: boolean, played: number, goals: number, assists: number) => {
    const t = totals.get(key) ?? { key, name, goalie, played: 0, goals: 0, assists: 0, points: 0 };
    t.played += played;
    t.goals += goals;
    t.assists += assists;
    t.points = t.goals + t.assists;
    t.goalie &&= goalie;
    totals.set(key, t);
  };
  // Newest first, so a player not on the roster any more shows the name they last played under.
  for (const m of scrims) {
    const names = new Set(m.squad.map(p => p.name));
    for (const p of m.squad) {
      const { goals, assists } = statsIn(m, p.name);
      add(p.id, current.get(p.id) ?? p.name, p.goalie, 1, goals, assists);
    }
    // Anyone credited who has since been taken out of that scrimmage's squad still keeps their goals.
    for (const g of m.goals) {
      if (g.side !== 'us') continue;
      for (const n of [g.scorer, ...(g.assists ?? [])]) {
        if (n && !names.has(n)) add(`name:${n}`, n, false, 0, n === g.scorer ? 1 : 0, n === g.scorer ? 0 : 1);
      }
    }
  }
  return [...totals.values()].filter(t => !t.goalie || t.points > 0).map(({ goalie: _goalie, ...t }) => t);
};

export const sortTallies = (list: Tally[], key: SortKey) =>
  [...list].sort((a, b) => b[key] - a[key] || b.goals - a.goals || b.points - a.points || a.name.localeCompare(b.name));

/** Whether a scrimmage was won, lost or drawn, with its score: "W 6–3". */
export const resultOf = (m: Match) => {
  const { us, them } = score(m);
  return `${us > them ? 'W' : us < them ? 'L' : 'D'} ${us}–${them}`;
};

export const periodLabel = (period: BoardPeriod) => (period === 'all' ? 'All time' : monthLong(period));

const count = (n: number) => `${n} scrimmage${n === 1 ? '' : 's'}`;

export const leaderboardText = (period: BoardPeriod, games: number, rows: Tally[]) =>
  [
    '🏒 Dads Army — Goals leaderboard',
    `${periodLabel(period)} · ${count(games)}`,
    '',
    ...rows.map((r, i) => `${i + 1}. ${r.name} — ${r.goals}G ${r.assists}A ${r.points}PTS`)
  ].join('\n');

/** The leaderboard as a picture in the team sheet's style: the top ten, most goals first (or however it's sorted). */
export const drawLeaderboardSheet = async (period: BoardPeriod, games: number, rows: Tally[]) => {
  await loadFonts();
  const canvas = newCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  const rand = drawFrame(ctx);
  const OFF = '#f4f4f0';
  const STONE = '#c9ccbd';
  const DIM = '#98a389';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GREEN;
  ctx.letterSpacing = '2px';
  ctx.font = `150px ${TITLE}`;
  ctx.fillText('GOALS', LIST_X, 188);
  ctx.letterSpacing = '6px';
  ctx.font = `700 64px ${SERIF_STENCIL}`;
  ctx.fillText('LEADERBOARD', LIST_X, 258);

  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const info: [string, string, number][] = [
    [periodLabel(period).toUpperCase(), STONE, 34],
    [count(games).toUpperCase(), GREEN, 30],
    [`UPDATED ${today}`, GREEN, 30]
  ];
  info.forEach(([text, colour, size], i) => {
    ctx.fillStyle = colour;
    ctx.font = `${size}px ${BLOCK}`;
    ctx.fillText(fit(ctx, text, 300), SIDE_X, 212 + i * 36);
  });

  const cols = { rank: 185, name: 235, g: 735, a: 835, p: 935 };
  const top = 380;
  tornLabel(ctx, rand, W / 2, top, 'TOP SCORERS');
  let y = top + 92;
  ctx.font = `26px ${TITLE}`;
  ctx.fillStyle = GREEN;
  ctx.letterSpacing = '2px';
  ctx.textAlign = 'left';
  ctx.fillText('PLAYER', cols.name, y);
  ctx.textAlign = 'center';
  ctx.fillText('G', cols.g, y);
  ctx.fillText('A', cols.a, y);
  ctx.fillText('PTS', cols.p, y);
  ctx.letterSpacing = '1px';
  y += 26;
  ctx.fillStyle = 'rgba(244,244,240,0.25)';
  ctx.fillRect(150, y, 830, 2);
  y += 40;

  rows.slice(0, 10).forEach((r, i) => {
    const big = i < 3;
    if (big) {
      ctx.fillStyle = 'rgba(92,143,60,0.22)';
      ctx.fillRect(150, y - 30, 830, 60);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = big ? '#e4d841' : DIM;
    ctx.font = `${big ? 40 : 32}px ${TITLE}`;
    ctx.fillText(String(i + 1), cols.rank, y + 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = OFF;
    ctx.font = `${big ? 40 : 34}px ${BLOCK}`;
    ctx.fillText(fit(ctx, r.name.toUpperCase(), 440), cols.name, y);
    ctx.textAlign = 'center';
    ctx.font = `${big ? 38 : 32}px ${BLOCK}`;
    ctx.fillStyle = OFF;
    ctx.fillText(String(r.goals), cols.g, y);
    ctx.fillStyle = STONE;
    ctx.fillText(String(r.assists), cols.a, y);
    ctx.fillStyle = GREEN;
    ctx.fillText(String(r.points), cols.p, y);
    y += 66;
  });

  ctx.fillStyle = OFF;
  for (let i = 0; i < 5; i++) star(ctx, W / 2 - 96 + i * 48, 1220, 22);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not draw the leaderboard'))), 'image/png')
  );
};

/** For the player screen: each counted scrimmage they played, grouped by month, newest first. */
export const playerGames = (scrims: Match[], t: Tally) => {
  const byName = t.key.startsWith('name:');
  const months = new Map<string, { match: Match; title: string; goals: number; assists: number }[]>();
  for (const m of scrims) {
    const name = byName ? t.key.slice(5) : m.squad.find(s => s.id === t.key)?.name;
    if (!name) continue;
    const { goals, assists } = statsIn(m, name);
    if (byName && !goals && !assists) continue;
    const list = months.get(monthOf(m)) ?? [];
    list.push({ match: m, title: matchTitle(m.details), goals, assists });
    months.set(monthOf(m), list);
  }
  return [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));
};
