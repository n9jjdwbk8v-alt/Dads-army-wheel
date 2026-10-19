import { readHistory, readPlayers } from './backup';
import { NEW_FEES, readFees, type FeesState } from './fees';
import { NEW_GAME_DAY, type GameDayState } from './gameDay';
import { LINE_STYLES } from './lines';
import type { GameRecord, Player, Teams } from './teams';

/** Everything that is saved online for a team. */
export type TeamData = {
  players: Player[];
  history: GameRecord[];
  teams: Teams;
  gameDay: GameDayState;
  fees: FeesState;
};

export type Section = keyof TeamData;

export const SECTIONS: Section[] = ['players', 'history', 'teams', 'gameDay', 'fees'];

/** This phone's link to a team: its code, the revision it last saw, and each section as it was then. */
export type SyncState = {
  code: string;
  rev: number;
  /** JSON of each section as last saved or loaded; a section that differs now has changes to send. */
  synced: Partial<Record<Section, string>>;
  /** When this phone last heard from the server. */
  at?: string;
};

export const NO_SYNC: SyncState = { code: '', rev: 0, synced: {} };

/** Team codes are upper-case letters, digits and dashes, 6 to 32 long, matching the server. */
export const cleanCode = (raw: string) => raw.toUpperCase().replace(/\s+/g, '');
export const validCode = (code: string) => /^[A-Z0-9-]{6,32}$/.test(code);

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.slice(0, 80) : fallback);

/** Each section checked and filled out, so a bad or older copy from the server can't break the app. */
const READERS: { [S in Section]: (raw: unknown) => TeamData[S] } = {
  players: readPlayers,
  history: readHistory,
  teams: raw => {
    const t = (raw ?? {}) as { light?: unknown; dark?: unknown };
    return { light: readPlayers(t.light), dark: readPlayers(t.dark) };
  },
  gameDay: raw => {
    const g = (raw ?? {}) as Record<string, unknown>;
    const manual = g.manual as GameDayState['manual'];
    return {
      ...NEW_GAME_DAY,
      kind: g.kind === 'scrimmage' ? 'scrimmage' : 'game',
      opponent: str(g.opponent),
      date: str(g.date),
      time: str(g.time),
      venue: str(g.venue),
      available: Array.isArray(g.available) ? g.available.filter((x): x is string => typeof x === 'string') : [],
      style: LINE_STYLES.find(s => s.value === g.style)?.value ?? NEW_GAME_DAY.style,
      ...(manual && typeof manual === 'object' && typeof manual.key === 'string' ? { manual } : {})
    };
  },
  fees: raw => readFees(raw) ?? NEW_FEES
};

export const readSection = <S extends Section>(section: S, raw: unknown): TeamData[S] => READERS[section](raw);

export type Remote = { rev: number; data: Partial<Record<Section, unknown>>; updatedAt: string | null };

export type LoadResult =
  | { status: 'found'; team: Remote }
  | { status: 'missing' }
  | { status: 'unavailable' }
  | { status: 'error' };

export type SaveResult =
  | { status: 'saved'; rev: number; updatedAt: string }
  | { status: 'conflict'; team: Remote }
  | { status: 'unavailable' }
  | { status: 'error' };

const url = (code: string) => `./api/team?code=${encodeURIComponent(code)}`;

// Anything but a JSON answer means there's no team server here at all (e.g. a preview of the site).
const isJson = (res: Response) => !!res.headers.get('content-type')?.includes('json');

/** Fetches the team. Throws only when the phone can't reach the server at all (offline). */
export const loadTeam = async (code: string): Promise<LoadResult> => {
  const res = await fetch(url(code), { cache: 'no-store' });
  if (!isJson(res) || res.status === 503) return { status: 'unavailable' };
  if (res.status === 404) return { status: 'missing' };
  if (!res.ok) return { status: 'error' };
  return { status: 'found', team: (await res.json()) as Remote };
};

/** Saves the team over revision `baseRev`. Throws only when the phone can't reach the server at all. */
export const saveTeam = async (code: string, baseRev: number, data: TeamData): Promise<SaveResult> => {
  const res = await fetch(url(code), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ baseRev, data })
  });
  if (!isJson(res) || res.status === 503) return { status: 'unavailable' };
  if (res.status === 409) return { status: 'conflict', team: (await res.json()) as Remote };
  if (!res.ok) return { status: 'error' };
  return { status: 'saved', ...((await res.json()) as { rev: number; updatedAt: string }) };
};
