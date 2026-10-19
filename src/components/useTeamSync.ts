import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePersistentState } from '../lib/storage';
import {
  loadTeam,
  NO_SYNC,
  readSection,
  saveTeam,
  SECTIONS,
  type Remote,
  type Section,
  type SyncState,
  type TeamData
} from '../lib/sync';

/** Each saved section's current value and setter. */
export type Store = { [S in Section]: { value: TeamData[S]; set: (value: TeamData[S]) => void } };

/** How the link to the server is going, apart from whether there are changes waiting. */
type Net = 'ok' | 'offline' | 'unavailable' | 'error';

export type SyncStatus = 'off' | 'saving' | 'saved' | Exclude<Net, 'ok'>;

const RETRY_MS = 15_000;
const POLL_MS = 30_000;
const SAVE_DELAY_MS = 800;

/**
 * Keeps this phone's data and the team's online copy in step. Changes save shortly after they're made; other
 * phones' changes arrive when the app is opened or brought back, and every 30 seconds while it's open. If two
 * phones change things at once, each section (roster, history, teams, game day, fees) keeps whichever phone
 * changed it, and the last save wins only when both changed the same section.
 */
export const useTeamSync = (store: Store) => {
  const [sync, setSync] = usePersistentState<SyncState>('dads-army:sync', NO_SYNC);
  const [net, setNet] = useState<Net>('ok');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const current = Object.fromEntries(SECTIONS.map(s => [s, store[s].value])) as TeamData;
  const json = Object.fromEntries(SECTIONS.map(s => [s, JSON.stringify(current[s])])) as Record<Section, string>;
  const dirty = sync.code ? SECTIONS.filter(s => json[s] !== sync.synced[s]) : [];

  // The latest values, for the async saves and loads that finish after later renders.
  const latest = useRef({ store, sync, current, json, dirty });
  useLayoutEffect(() => {
    latest.current = { store, sync, current, json, dirty };
  });
  const running = useRef(false);

  /** Takes the server's copy of every section except `keep`, and returns what each section was on the server. */
  const adopt = useCallback((team: Remote, keep: Section[]) => {
    const synced: SyncState['synced'] = {};
    for (const s of SECTIONS) {
      // A section the server hasn't got yet (saved by an older version) stays as it is here and gets sent.
      if (!(s in team.data)) continue;
      const value = readSection(s, team.data[s]);
      synced[s] = JSON.stringify(value);
      if (!keep.includes(s)) (latest.current.store[s].set as (v: typeof value) => void)(value);
    }
    return synced;
  }, []);

  const run = useCallback(async (job: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await job();
    } catch {
      setNet('offline');
    } finally {
      running.current = false;
      setBusy(false);
      setTick(t => t + 1);
    }
  }, []);

  const pull = useCallback(
    () =>
      run(async () => {
        const { sync } = latest.current;
        if (!sync.code) return;
        const result = await loadTeam(sync.code);
        const at = new Date().toISOString();
        if (result.status === 'found') {
          setNet('ok');
          if (result.team.rev === sync.rev) return setSync(s => ({ ...s, at }));
          const synced = adopt(result.team, latest.current.dirty);
          setSync({ code: sync.code, rev: result.team.rev, synced, at });
        } else if (result.status === 'missing') {
          // Nothing saved under this code any more; send everything again.
          setNet('ok');
          setSync({ code: sync.code, rev: 0, synced: {}, at });
        } else setNet(result.status);
      }),
    [run, adopt, setSync]
  );

  const push = useCallback(
    () =>
      run(async () => {
        const { sync, current, json } = latest.current;
        if (!sync.code) return;
        const result = await saveTeam(sync.code, sync.rev, current);
        const at = new Date().toISOString();
        if (result.status === 'saved') {
          setNet('ok');
          setSync({ code: sync.code, rev: result.rev, synced: { ...json }, at });
        } else if (result.status === 'conflict') {
          // Another phone saved first: take its changes, keep ours where we changed something, then send again.
          setNet('ok');
          const synced = adopt(result.team, latest.current.dirty);
          setSync({ code: sync.code, rev: result.team.rev, synced, at });
        } else setNet(result.status);
      }),
    [run, adopt, setSync]
  );

  // Send changes a moment after they're made, and retry while a save is waiting.
  const dirtyKey = dirty.join(',');
  useEffect(() => {
    if (!sync.code || !dirtyKey || busy) return;
    const t = setTimeout(push, net === 'ok' ? SAVE_DELAY_MS : RETRY_MS);
    return () => clearTimeout(t);
  }, [sync.code, sync.rev, dirtyKey, busy, net, tick, push]);

  // Pick up other phones' changes on opening, on coming back to the app or online, and every so often.
  useEffect(() => {
    if (!sync.code) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') pull();
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [sync.code, pull]);

  /** Links this phone to a team that already exists online, replacing what's here with the team's copy. */
  const join = (code: string, team: Remote) => {
    const synced = adopt(team, []);
    setNet('ok');
    setSync({ code, rev: team.rev, synced, at: new Date().toISOString() });
  };

  /** Starts a new team online from this phone's data; the first save happens straight away. */
  const create = (code: string) => {
    setNet('ok');
    setSync({ code, rev: 0, synced: {} });
  };

  const disconnect = () => {
    setNet('ok');
    setSync(NO_SYNC);
  };

  const status: SyncStatus = !sync.code ? 'off' : net !== 'ok' ? net : dirty.length ? 'saving' : 'saved';

  return { sync, status, join, create, disconnect };
};
