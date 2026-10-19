import { isGoalie, type Player, type Position } from './teams';

export const positionOf = (p: Player): Position => p.position ?? (isGoalie(p) ? 'G' : 'F');

export type LineStyle = 'stacked' | 'balanced' | 'mixed';

export const LINE_STYLES: { value: LineStyle; label: string; hint: string }[] = [
  { value: 'stacked', label: 'Stacked', hint: 'Best players together on line 1, then line 2, and so on.' },
  { value: 'balanced', label: 'Balanced', hint: 'Skill spread so every line is about as strong as the others.' },
  { value: 'mixed', label: 'Mixed pairs', hint: 'Each line has one stronger player with less experienced ones.' }
];

/** A spot in the line-up, which may be empty. */
type Spot = Player | undefined;

export type Lineup = {
  /** Forward lines as [LW, C, RW]. */
  forwards: Spot[][];
  /** Defence pairs as [LD, RD]. */
  defence: Spot[][];
  /** [starter, backup]. */
  goalies: Spot[];
  /** Available players who aren't in a line; they rotate in. */
  spares: Player[];
};

const bySkill = (a: Player, b: Player) => b.skill - a.skill || a.name.localeCompare(b.name);

const total = (g: Player[]) => g.reduce((sum, p) => sum + p.skill, 0);

/** Swaps players between groups while any swap makes the group totals more even. */
const evenOut = (groups: Player[][]) => {
  const spread = () => groups.reduce((sum, g) => sum + total(g) ** 2, 0);
  for (let improved = true; improved; ) {
    improved = false;
    for (let a = 0; a < groups.length; a++) {
      for (let b = a + 1; b < groups.length; b++) {
        for (let i = 0; i < groups[a].length; i++) {
          for (let j = 0; j < groups[b].length; j++) {
            const before = spread();
            [groups[a][i], groups[b][j]] = [groups[b][j], groups[a][i]];
            if (spread() < before) improved = true;
            else [groups[a][i], groups[b][j]] = [groups[b][j], groups[a][i]];
          }
        }
      }
    }
  }
};

/**
 * Splits players into groups of `size` in the given style. Only full groups are made (unless there are too few
 * for one); the weakest leftovers become spares.
 */
const group = (players: Player[], size: number, style: LineStyle) => {
  const sorted = [...players].sort(bySkill);
  if (sorted.length < size) return { groups: sorted.length ? [sorted] : [], spares: [] };
  const count = Math.floor(sorted.length / size);
  const used = sorted.slice(0, count * size);
  const spares = sorted.slice(count * size);
  const groups: Player[][] = Array.from({ length: count }, () => []);

  if (style === 'stacked') {
    used.forEach((p, i) => groups[Math.floor(i / size)].push(p));
  } else if (style === 'balanced') {
    // Snake order (1, 2, 3, 3, 2, 1, …) gets close, then swaps between groups even out the totals further.
    used.forEach((p, i) => {
      const round = Math.floor(i / count);
      const slot = i % count;
      groups[round % 2 ? count - 1 - slot : slot].push(p);
    });
    evenOut(groups);
  } else {
    // One of the strongest anchors each group, then the rest are dealt out weakest-first, so the strongest
    // anchor plays with the least experienced.
    used.slice(0, count).forEach((p, i) => groups[i].push(p));
    used
      .slice(count)
      .reverse()
      .forEach((p, i) => groups[i % count].push(p));
  }
  return { groups, spares };
};

/** Suggested lines from the available players. */
export const buildLineup = (players: Player[], style: LineStyle): Lineup => {
  const forwards = group(players.filter(p => positionOf(p) === 'F'), 3, style);
  const defence = group(players.filter(p => positionOf(p) === 'D'), 2, style);
  const goalies = players.filter(p => positionOf(p) === 'G').sort(bySkill);
  return {
    // The strongest forward in each line takes centre, with the next on the left wing.
    forwards: forwards.groups.map(line => {
      const [best, ...rest] = [...line].sort(bySkill);
      return [rest[0], best, rest[1]];
    }),
    defence: defence.groups.map(pair => {
      const [ld, rd] = [...pair].sort(bySkill);
      return [ld, rd];
    }),
    goalies: [goalies[0], goalies[1]],
    spares: [...forwards.spares, ...defence.spares, ...goalies.slice(2)]
  };
};

// ---------- Editing lines by hand ----------

/** A line-up as player ids, so hand edits can be saved. Empty spots are null. */
export type LineSlots = {
  forwards: (string | null)[][];
  defence: (string | null)[][];
  goalies: (string | null)[];
  spares: string[];
};

/** Where a spot is: a group, and its row and column (spares use only the column). */
export type SlotRef = { group: 'forwards' | 'defence' | 'goalies' | 'spares'; row: number; col: number };

const ids = (spots: Spot[]) => spots.map(p => p?.id ?? null);

export const toSlots = (l: Lineup): LineSlots => ({
  forwards: l.forwards.map(ids),
  defence: l.defence.map(ids),
  goalies: ids(l.goalies),
  spares: l.spares.map(p => p.id)
});

/**
 * Turns saved slots back into players. Anyone no longer in `squad` drops out, and anyone in the squad who isn't
 * placed anywhere joins the spares.
 */
export const fromSlots = (slots: LineSlots, squad: Player[]): Lineup => {
  const byId = new Map(squad.map(p => [p.id, p]));
  const placed = new Set<string>();
  const take = (id: string | null) => {
    const p = id ? byId.get(id) : undefined;
    if (p) placed.add(p.id);
    return p;
  };
  const lineup: Lineup = {
    forwards: slots.forwards.map(row => row.map(take)),
    defence: slots.defence.map(row => row.map(take)),
    goalies: slots.goalies.map(take),
    spares: slots.spares.map(take).filter((p): p is Player => !!p)
  };
  lineup.spares.push(...squad.filter(p => !placed.has(p.id)));
  return lineup;
};

const read = (s: LineSlots, r: SlotRef) =>
  r.group === 'spares' ? (s.spares[r.col] ?? null) : r.group === 'goalies' ? s.goalies[r.col] : s[r.group][r.row][r.col];

const write = (s: LineSlots, r: SlotRef, id: string | null) => {
  if (r.group === 'spares') {
    // Writing past the end adds to the spares; null leaves a gap that's tidied away below.
    (s.spares as (string | null)[])[r.col] = id;
  } else if (r.group === 'goalies') {
    s.goalies[r.col] = id;
  } else {
    s[r.group][r.row][r.col] = id;
  }
};

/** Swaps whoever is in two spots (either may be empty). */
export const swapSlots = (slots: LineSlots, a: SlotRef, b: SlotRef): LineSlots => {
  const next: LineSlots = structuredClone(slots);
  const [va, vb] = [read(slots, a), read(slots, b)];
  write(next, a, vb);
  write(next, b, va);
  next.spares = next.spares.filter(Boolean);
  return next;
};

/** Identifies a squad and line style, so hand edits are only reused while both stay the same. */
export const squadKey = (squad: Player[], style: LineStyle) =>
  [style, ...squad.map(p => `${p.id}:${positionOf(p)}`).sort()].join('|');
