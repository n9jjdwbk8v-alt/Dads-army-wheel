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

const random = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
};

/**
 * Splits players into two teams of equal size (or one apart) whose skill totals are as close as possible.
 * When several splits are equally balanced, one is chosen uniformly at random, so splitting again reshuffles.
 */
export const splitTeams = (players: Player[]): Teams => {
  const n = players.length;
  if (!n) return NO_TEAMS;
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

  const a = players.filter(p => chosen.has(p.id));
  const b = players.filter(p => !chosen.has(p.id));
  const byName = (x: Player, y: Player) => x.name.localeCompare(y.name);
  a.sort(byName);
  b.sort(byName);
  return random() < 0.5 ? { light: a, dark: b } : { light: b, dark: a };
};
