import { isGoalie, type Player, type Position } from './teams';

export const positionOf = (p: Player): Position => p.position ?? (isGoalie(p) ? 'G' : 'F');

export type LineStyle = 'stacked' | 'balanced' | 'mixed';

export const LINE_STYLES: { value: LineStyle; label: string; hint: string }[] = [
  { value: 'stacked', label: 'Stacked', hint: 'Best players together on line 1, then line 2, and so on.' },
  { value: 'balanced', label: 'Balanced', hint: 'Skill spread so every line is about as strong as the others.' },
  { value: 'mixed', label: 'Mixed pairs', hint: 'Each line has one stronger player with less experienced ones.' }
];

export type Lineup = {
  /** Forward lines as [LW, C, RW]; a short line has fewer players. */
  forwards: Player[][];
  /** Defence pairs as [LD, RD]. */
  defence: Player[][];
  /** Starting goalie first, then backups. */
  goalies: Player[];
  /** Available skaters who didn't make a full line; they rotate in. */
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
  return {
    // The strongest forward in each line takes centre, with the next on the left wing.
    forwards: forwards.groups.map(line => {
      const [best, ...rest] = [...line].sort(bySkill);
      return rest.length ? [rest[0], best, ...rest.slice(1)] : [best];
    }),
    defence: defence.groups.map(pair => [...pair].sort(bySkill)),
    goalies: players.filter(p => positionOf(p) === 'G').sort(bySkill),
    spares: [...forwards.spares, ...defence.spares]
  };
};
