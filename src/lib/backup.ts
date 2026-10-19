import { readFees, type FeesState } from './fees';
import type { GameRecord, Player } from './teams';

export type Backup = { players: Player[]; history: GameRecord[]; fees?: FeesState; saved: string };

const APP = 'dads-army-team-picker';

export const makeBackupFile = (players: Player[], history: GameRecord[], fees: FeesState) => {
  const body = { app: APP, version: 1, saved: new Date().toISOString(), players, history, fees };
  return new File([JSON.stringify(body, null, 2)], `dads-army-roster-${new Date().toISOString().slice(0, 10)}.json`, {
    type: 'application/json'
  });
};

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');

/** Reads a backup file, keeping only well-formed players and games. Throws if it isn't a Dads Army backup. */
export const readBackupFile = async (file: File): Promise<Backup> => {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a Dads Army backup.");
  }
  const d = data as { app?: unknown; players?: unknown; history?: unknown; fees?: unknown; saved?: unknown };
  if (d?.app !== APP || !Array.isArray(d.players)) throw new Error("That file isn't a Dads Army backup.");

  const seen = new Set<string>();
  const players: Player[] = [];
  for (const raw of d.players as Record<string, unknown>[]) {
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 40) : '';
    if (!name) continue;
    let id = typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID();
    if (seen.has(id)) id = crypto.randomUUID();
    seen.add(id);
    // A missing or garbled rating falls back to a middling 5 rather than 0, which would mean goalie.
    const rating = Number(raw.skill);
    const skill = Number.isFinite(rating) ? Math.min(10, Math.max(0, Math.round(rating))) : 5;
    const position = raw.position === 'F' || raw.position === 'D' || raw.position === 'G' ? raw.position : undefined;
    players.push({ id, name, skill, here: raw.here !== false, ...(position ? { position } : {}) });
  }

  const history = Array.isArray(d.history)
    ? (d.history as Record<string, unknown>[])
        .filter(g => typeof g?.date === 'string' && isStringArray(g.light) && isStringArray(g.dark))
        .map(g => ({ date: g.date as string, light: g.light as string[], dark: g.dark as string[] }))
    : [];

  // Backups from before the Fees tab have no fees; restoring one leaves the fees on this phone alone.
  return { players, history, fees: readFees(d.fees), saved: typeof d.saved === 'string' ? d.saved : '' };
};
