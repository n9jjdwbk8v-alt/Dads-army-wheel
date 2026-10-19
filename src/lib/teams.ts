/** Game day position: forward, defence or goalie. */
export type Position = 'F' | 'D' | 'G';

export type Player = {
  id: string;
  name: string;
  skill: number;
  here: boolean;
  /** Set on the Game day squad sheet; until then goalies (skill 0) count as G and everyone else as F. */
  position?: Position;
};

export type Team = 'light' | 'dark';

export type Teams = { light: Player[]; dark: Player[] };

export const TEAM_LABEL: Record<Team, string> = { light: 'Lights', dark: 'Darks' };

export const NO_TEAMS: Teams = { light: [], dark: [] };

/** A skill of 0 marks a goalie. */
export const isGoalie = (p: Player) => p.skill === 0;

const random = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
};

/**
 * Prepares to split players into two groups — the first of floor(n/2), the second the rest — whose skill totals
 * are as close as possible. Each call of the returned function picks one of the equally balanced splits
 * uniformly at random.
 */
const balancedSampler = (players: Player[]): (() => [Player[], Player[]]) => {
  const n = players.length;
  if (!n) return () => [[], []];
  const k = Math.floor(n / 2);
  const total = players.reduce((sum, p) => sum + p.skill, 0);

  // ways[i][c][s] = number of ways to choose c of the first i players with skill sum s.
  const ways: number[][][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: k + 1 }, () => new Array<number>(total + 1).fill(0))
  );
  ways[0][0][0] = 1;
  for (let i = 1; i <= n; i++) {
    const skill = players[i - 1].skill;
    for (let c = 0; c <= k; c++) {
      for (let s = 0; s <= total; s++) {
        let w = ways[i - 1][c][s];
        if (c > 0 && s >= skill) w += ways[i - 1][c - 1][s - skill];
        ways[i][c][s] = w;
      }
    }
  }

  // Find the smallest achievable gap and the skill sums that achieve it.
  let bestGap = Infinity;
  for (let s = 0; s <= total; s++) {
    if (ways[n][k][s] > 0) bestGap = Math.min(bestGap, Math.abs(total - 2 * s));
  }
  const targets: number[] = [];
  for (let s = 0; s <= total; s++) {
    if (ways[n][k][s] > 0 && Math.abs(total - 2 * s) === bestGap) targets.push(s);
  }
  const weight = targets.reduce((sum, s) => sum + ways[n][k][s], 0);

  return () => {
    // Pick a target sum weighted by how many splits hit it.
    let roll = random() * weight;
    let s = targets[targets.length - 1];
    for (const t of targets) {
      roll -= ways[n][k][t];
      if (roll < 0) {
        s = t;
        break;
      }
    }

    // Walk back through the table, including each player with the probability that keeps the choice uniform.
    const chosen = new Set<string>();
    let c = k;
    for (let i = n; i >= 1 && c > 0; i--) {
      const p = players[i - 1];
      const withP = s >= p.skill ? ways[i - 1][c - 1][s - p.skill] : 0;
      if (random() * ways[i][c][s] < withP) {
        chosen.add(p.id);
        c--;
        s -= p.skill;
      }
    }
    return [players.filter(p => chosen.has(p.id)), players.filter(p => !chosen.has(p.id))];
  };
};

/** The teams from one game night, as player ids on each side. */
export type GameRecord = { date: string; light: string[]; dark: string[] };

/** How many past game nights are remembered. */
const HISTORY_LENGTH = 4;

/** Today's date as YYYY-MM-DD in local time. */
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Remembers `teams` as the game for `date`, replacing an earlier split from the same day. Newest first. */
export const recordGame = (history: GameRecord[], teams: Teams, date = todayKey()): GameRecord[] =>
  [
    { date, light: teams.light.map(p => p.id), dark: teams.dark.map(p => p.id) },
    ...history.filter(g => g.date !== date)
  ].slice(0, HISTORY_LENGTH);

/**
 * How much a split repeats recent games: each pair of players who were teammates before and are teammates again
 * counts, with the most recent game weighted 1, the one before ½, and so on.
 */
export const repeatScore = (teams: Teams, games: GameRecord[]) => {
  let score = 0;
  games.forEach((game, age) => {
    const side = new Map<string, Team>();
    game.light.forEach(id => side.set(id, 'light'));
    game.dark.forEach(id => side.set(id, 'dark'));
    for (const team of [teams.light, teams.dark]) {
      for (let i = 0; i < team.length; i++) {
        const a = side.get(team[i].id);
        if (!a) continue;
        for (let j = i + 1; j < team.length; j++) if (side.get(team[j].id) === a) score += 0.5 ** age;
      }
    }
  });
  return score;
};

/** Balanced splits to compare when trying to avoid repeating recent games. */
const CANDIDATES = 300;

/**
 * Splits players into two teams of equal size (or one apart). Goalies are shared out first, one per team where
 * possible, and skaters are then balanced on skill. Among equally fair line-ups it prefers the one that keeps
 * the fewest teammates together from `recent` games (newest first); splitting again reshuffles.
 */
export const splitTeams = (players: Player[], recent: GameRecord[] = []): Teams => {
  const goalies = players.filter(isGoalie);
  const sample = balancedSampler(players.filter(p => !isGoalie(p)));
  const draw = () => withGoalies(sample(), goalies);
  if (!recent.length) return draw();

  let best = draw();
  let bestScore = repeatScore(best, recent);
  for (let i = 1; i < CANDIDATES && bestScore > 0; i++) {
    const candidate = draw();
    const score = repeatScore(candidate, recent);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
};

const withGoalies = ([skatersA, skatersB]: [Player[], Player[]], goalies: Player[]): Teams => {
  const a = [...skatersA];
  const b = [...skatersB];
  // Shuffle goalies and alternate them between sides. With an odd number, the extra goalie goes to the side
  // with fewer skaters (a, when skaters are odd) so head counts stay even; otherwise it's a coin flip.
  const shuffled = goalies.map(g => ({ g, r: random() })).sort((x, y) => x.r - y.r).map(x => x.g);
  const aFirst = a.length < b.length || (a.length === b.length && random() < 0.5);
  shuffled.forEach((g, i) => ((i % 2 === 0) === aFirst ? a : b).push(g));

  const order = (x: Player, y: Player) => Number(isGoalie(y)) - Number(isGoalie(x)) || x.name.localeCompare(y.name);
  a.sort(order);
  b.sort(order);
  return random() < 0.5 ? { light: a, dark: b } : { light: b, dark: a };
};
