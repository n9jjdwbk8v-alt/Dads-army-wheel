import { positionOf } from './lines';
import type { Goal, Penalty, Period, ScoreSheet } from './scoreSheet';
import type { GameDetails, SheetKind } from './teamSheet';
import type { Player } from './teams';

/** Someone in a game's squad. Names are kept here so the sheet stays right if the roster changes later. */
export type MatchPlayer = { id: string; name: string; goalie: boolean; guest?: boolean };

/** A goal or penalty, in the order it happened (`at`), so the newest can be undone. */
export type MatchGoal = Goal & { id: string; at: number; time?: string };
export type MatchPenalty = Penalty & { id: string; at: number };

/** One game or scrimmage being scored, made from the squad on its team sheet. */
export type Match = {
  id: string;
  details: GameDetails;
  squad: MatchPlayer[];
  goals: MatchGoal[];
  penalties: MatchPenalty[];
  /** The period being played now (4 is overtime). */
  period: Period;
  finished: boolean;
  playerOfMatch?: string;
  saved: string;
};

/** How many games are remembered. */
const KEEP = 20;

export const PERIODS: { value: Period; label: string; long: string }[] = [
  { value: 1, label: '1st', long: '1st period' },
  { value: 2, label: '2nd', long: '2nd period' },
  { value: 3, label: '3rd', long: '3rd period' },
  { value: 4, label: 'OT', long: 'Overtime' }
];

/** A game is the same game if it's the same kind, opponent (or scrimmage name) and date. */
export const sameGame = (a: GameDetails, b: GameDetails) =>
  a.kind === b.kind && a.opponent.trim().toLowerCase() === b.opponent.trim().toLowerCase() && a.date === b.date;

const newId = () => crypto.randomUUID();

const squadFrom = (players: Player[]): MatchPlayer[] =>
  players.map(p => ({ id: p.id, name: p.name, goalie: positionOf(p) === 'G' }));

/**
 * Saves the squad from a team sheet. Making the sheet again for the same game updates that game's squad and keeps
 * its score; a new game goes to the top of the list.
 */
export const saveSquad = (matches: Match[], details: GameDetails, players: Player[]): Match[] => {
  const squad = squadFrom(players);
  const saved = new Date().toISOString();
  const existing = matches.find(m => sameGame(m.details, details));
  if (existing) {
    // Guests added on the Score section aren't on the team sheet, so they stay.
    const guests = existing.squad.filter(p => p.guest && !squad.some(s => s.id === p.id));
    const updated = { ...existing, details: { ...details }, squad: [...squad, ...guests], saved };
    return [updated, ...matches.filter(m => m.id !== existing.id)];
  }
  const match: Match = {
    id: newId(),
    details: { ...details },
    squad,
    goals: [],
    penalties: [],
    period: 1,
    finished: false,
    saved
  };
  return [match, ...matches].slice(0, KEEP);
};

export const updateMatch = (matches: Match[], id: string, update: (m: Match) => Match) =>
  matches.map(m => (m.id === id ? update(m) : m));

export const addGoal = (m: Match, goal: Omit<MatchGoal, 'id' | 'at' | 'period'>): Match => ({
  ...m,
  goals: [...m.goals, { ...goal, id: newId(), at: Date.now(), period: m.period }]
});

export const addPenalty = (m: Match, penalty: Omit<MatchPenalty, 'id' | 'at' | 'period'>): Match => ({
  ...m,
  penalties: [...m.penalties, { ...penalty, id: newId(), at: Date.now(), period: m.period }]
});

/** Takes back whatever was added last, goal or penalty. */
export const undoLast = (m: Match): Match => {
  const lastGoal = m.goals.at(-1);
  const lastPenalty = m.penalties.at(-1);
  if (!lastGoal && !lastPenalty) return m;
  if (lastGoal && (!lastPenalty || lastGoal.at >= lastPenalty.at)) return { ...m, goals: m.goals.slice(0, -1) };
  return { ...m, penalties: m.penalties.slice(0, -1) };
};

export const score = (m: Match) => {
  const us = m.goals.filter(g => g.side === 'us').length;
  return { us, them: m.goals.length - us };
};

/** What the other side is called: the opponent for a game, just "Opposition" for a scrimmage. */
export const theirName = (details: GameDetails) => (details.kind === 'game' && details.opponent.trim()) || 'Opposition';

export const matchTitle = (details: GameDetails) =>
  details.kind === 'game' ? `vs ${details.opponent.trim() || 'opposition'}` : details.opponent.trim() || 'Scrimmage';

/** Goals and assists for each of our players, most points first. */
export const points = (m: Match) =>
  m.squad
    .map(p => ({
      player: p,
      goals: m.goals.filter(g => g.side === 'us' && g.scorer === p.name).length,
      assists: m.goals.filter(g => g.side === 'us' && g.assists?.includes(p.name)).length
    }))
    .sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals);

export const toScoreSheet = (m: Match, stage: Period | 'final'): ScoreSheet => ({
  details: m.details,
  stage,
  goals: m.goals,
  penalties: m.penalties,
  netminders: m.squad.filter(p => p.goalie).map(p => p.name),
  playerOfMatch: stage === 'final' ? m.playerOfMatch : undefined
});

/** Opposition shirt numbers already used tonight, newest first, so they're one tap away. */
export const seenNumbers = (m: Match) => {
  const numbers = [
    ...m.goals.filter(g => g.side === 'them').map(g => ({ at: g.at, n: g.number })),
    ...m.penalties.filter(p => p.side === 'them').map(p => ({ at: p.at, n: p.who }))
  ]
    .sort((a, b) => b.at - a.at)
    .map(x => x.n?.trim())
    .filter((n): n is string => !!n);
  return [...new Set(numbers)].slice(0, 8);
};

// ---------- Reading what was saved ----------

const str = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '');
const isPeriod = (v: unknown): v is Period => v === 1 || v === 2 || v === 3 || v === 4;
const side = (v: unknown) => (v === 'them' ? 'them' : 'us') as 'us' | 'them';

const readDetails = (raw: unknown): GameDetails => {
  const d = (raw ?? {}) as Record<string, unknown>;
  const kind: SheetKind = d.kind === 'scrimmage' ? 'scrimmage' : 'game';
  return { kind, opponent: str(d.opponent, 40), date: str(d.date, 10), time: str(d.time, 5), venue: str(d.venue, 40) };
};

/** Checks the games saved on this phone, dropping anything malformed. */
export const readMatches = (raw: unknown): Match[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  return (raw as Record<string, unknown>[])
    .filter(m => m && typeof m.id === 'string' && Array.isArray(m.squad))
    .map(m => ({
      id: m.id as string,
      details: readDetails(m.details),
      squad: (m.squad as Record<string, unknown>[])
        .filter(p => p && typeof p.id === 'string' && typeof p.name === 'string')
        .map(p => ({
          id: p.id as string,
          name: str(p.name, 40),
          goalie: p.goalie === true,
          ...(p.guest ? { guest: true } : {})
        })),
      goals: (Array.isArray(m.goals) ? (m.goals as Record<string, unknown>[]) : [])
        .filter(g => g && isPeriod(g.period))
        .map(g => ({
          id: str(g.id) || newId(),
          at: Number(g.at) || 0,
          period: g.period as Period,
          side: side(g.side),
          ...(g.scorer ? { scorer: str(g.scorer, 40) } : {}),
          assists: Array.isArray(g.assists)
            ? (g.assists as unknown[])
                .map(a => str(a, 40))
                .filter(Boolean)
                .slice(0, 2)
            : [],
          ...(g.number ? { number: str(g.number, 4) } : {}),
          ...(g.time ? { time: str(g.time, 5) } : {})
        })),
      penalties: (Array.isArray(m.penalties) ? (m.penalties as Record<string, unknown>[]) : [])
        .filter(p => p && isPeriod(p.period))
        .map(p => ({
          id: str(p.id) || newId(),
          at: Number(p.at) || 0,
          period: p.period as Period,
          side: side(p.side),
          who: str(p.who, 40),
          minutes: Number(p.minutes) || 2,
          ...(p.reason ? { reason: str(p.reason, 30) } : {})
        })),
      period: isPeriod(m.period) ? m.period : 1,
      finished: m.finished === true,
      ...(m.playerOfMatch ? { playerOfMatch: str(m.playerOfMatch, 40) } : {}),
      saved: str(m.saved, 30)
    }));
};
