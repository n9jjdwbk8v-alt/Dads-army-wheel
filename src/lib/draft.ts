export type Player = {
  id: string;
  name: string;
  skill: number;
  here: boolean;
};

export type Team = 'light' | 'dark';

export const TEAM_LABEL: Record<Team, string> = { light: 'Light', dark: 'Dark' };

/** Players per tier. Each tier splits two-and-two, so similar skill lands on both benches. */
export const TIER_SIZE = 4;

export const randomInt = (max: number) => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
};

export const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const totalSkill = (players: Player[]) => players.reduce((sum, p) => sum + p.skill, 0);

/** Strongest first; ties are shuffled so equal players don't always share a tier. */
export const buildTiers = (players: Player[]): Player[][] => {
  const sorted = shuffle(players).sort((a, b) => b.skill - a.skill);
  const tiers: Player[][] = [];
  for (let i = 0; i < sorted.length; i += TIER_SIZE) tiers.push(sorted.slice(i, i + TIER_SIZE));
  return tiers;
};

export type DraftState = {
  tiers: Player[][];
  tier: number;
  pool: Player[];
  /** Which team receives each pick in the current tier (snake: A B B A). */
  order: Team[];
  light: Player[];
  dark: Player[];
  log: { player: Player; team: Team; auto: boolean }[];
};

export const EMPTY_DRAFT: DraftState = { tiers: [], tier: 0, pool: [], order: [], light: [], dark: [], log: [] };

export const nextTeam = (s: DraftState): Team | null => {
  if (!s.pool.length) return null;
  const tierSize = s.tiers[s.tier]?.length ?? 0;
  return s.order[tierSize - s.pool.length] ?? null;
};

export const isComplete = (s: DraftState) => s.tiers.length > 0 && s.pool.length === 0;

const tierOrder = (s: DraftState, size: number): Team[] => {
  const lt = totalSkill(s.light);
  const dt = totalSkill(s.dark);
  // Whoever is behind picks first; on a tie alternate by tier so neither side always leads.
  const first: Team =
    lt < dt ? 'light' : dt < lt ? 'dark' : s.light.length !== s.dark.length
      ? (s.light.length < s.dark.length ? 'light' : 'dark')
      : s.tier % 2 === 0 ? 'light' : 'dark';
  const second: Team = first === 'light' ? 'dark' : 'light';
  return [first, second, second, first].slice(0, size);
};

const assign = (s: DraftState, player: Player, auto: boolean): DraftState => {
  const team = nextTeam(s);
  if (!team) return s;
  return {
    ...s,
    pool: s.pool.filter(p => p.id !== player.id),
    light: team === 'light' ? [...s.light, player] : s.light,
    dark: team === 'dark' ? [...s.dark, player] : s.dark,
    log: [...s.log, { player, team, auto }]
  };
};

/** Load the next tier when one empties, and hand out any lone remaining player — no point spinning a one-slice wheel. */
const settle = (state: DraftState): DraftState => {
  let s = state;
  for (;;) {
    if (s.pool.length === 1) {
      s = assign(s, s.pool[0], true);
    } else if (s.pool.length === 0 && s.tier + 1 < s.tiers.length) {
      const tier = s.tier + 1;
      const pool = s.tiers[tier];
      s = { ...s, tier, pool, order: tierOrder({ ...s, tier }, pool.length) };
    } else {
      return s;
    }
  }
};

export const startDraft = (players: Player[]): DraftState => {
  const tiers = buildTiers(players);
  if (!tiers.length) return EMPTY_DRAFT;
  const base = { ...EMPTY_DRAFT, tiers, pool: tiers[0] };
  return settle({ ...base, order: tierOrder(base, tiers[0].length) });
};

export const pickPlayer = (s: DraftState, playerId: string): DraftState => {
  const player = s.pool.find(p => p.id === playerId);
  return player ? settle(assign(s, player, false)) : s;
};

/** Run every remaining spin instantly. */
export const finishDraft = (state: DraftState): DraftState => {
  let s = state;
  while (s.pool.length) s = pickPlayer(s, s.pool[randomInt(s.pool.length)].id);
  return s;
};

export type Swap = { light: Player; dark: Player; gapBefore: number; gapAfter: number };

/** The single light/dark swap that most narrows the skill gap, if any helps. */
export const bestSwap = (light: Player[], dark: Player[]): Swap | null => {
  const lt = totalSkill(light);
  const dt = totalSkill(dark);
  const gapBefore = Math.abs(lt - dt);
  let best: Swap | null = null;
  for (const l of light) {
    for (const d of dark) {
      const gapAfter = Math.abs(lt - l.skill + d.skill - (dt - d.skill + l.skill));
      if (gapAfter < (best?.gapAfter ?? gapBefore)) best = { light: l, dark: d, gapBefore, gapAfter };
    }
  }
  return best;
};

export const applySwap = (s: DraftState, swap: Swap): DraftState => ({
  ...s,
  light: s.light.map(p => (p.id === swap.light.id ? swap.dark : p)),
  dark: s.dark.map(p => (p.id === swap.dark.id ? swap.light : p))
});
