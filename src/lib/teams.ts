export type Player = {
  id: string;
  name: string;
  skill: number;
  here: boolean;
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
 * Splits players into two groups — the first of floor(n/2), the second the rest — whose skill totals are as
 * close as possible. When several splits are equally balanced, one is chosen uniformly at random.
 */
const balancedSplit = (players: Player[]): [Player[], Player[]] => {
  const n = players.length;
  if (!n) return [[], []];
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

  // Find the smallest achievable gap, then pick a target sum weighted by how many splits hit it.
  let bestGap = Infinity;
  for (let s = 0; s <= total; s++) {
    if (ways[n][k][s] > 0) bestGap = Math.min(bestGap, Math.abs(total - 2 * s));
  }
  const targets = [];
  for (let s = 0; s <= total; s++) {
    if (ways[n][k][s] > 0 && Math.abs(total - 2 * s) === bestGap) targets.push(s);
  }
  const weight = targets.reduce((sum, s) => sum + ways[n][k][s], 0);
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

/**
 * Splits players into two teams of equal size (or one apart). Goalies are shared out first, one per team where
 * possible, and skaters are then balanced on skill. Splitting again reshuffles among equally fair line-ups.
 */
export const splitTeams = (players: Player[]): Teams => {
  const goalies = players.filter(isGoalie);
  const [a, b] = balancedSplit(players.filter(p => !isGoalie(p)));
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
