import { useRef, useState, type ChangeEvent } from 'react';
import { makeBackupFile, readBackupFile, type Backup as BackupData } from '../lib/backup';
import { shareOrDownload } from '../lib/share';
import type { GameRecord, Player } from '../lib/teams';

type BackupProps = {
  players: Player[];
  history: GameRecord[];
  onRestore: (backup: BackupData) => void;
};

export default function Backup({ players, history, onRestore }: BackupProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  // A read backup waiting for the user to confirm it in the page (confirm() is blocked in some apps).
  const [pending, setPending] = useState<BackupData | null>(null);

  const save = async () => {
    await shareOrDownload(makeBackupFile(players, history));
  };

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(await readBackupFile(file));
      setMessage('');
    } catch (err) {
      setPending(null);
      setMessage((err as Error).message);
    }
  };

  const apply = () => {
    if (!pending) return;
    onRestore(pending);
    setMessage(`Restored ${pending.players.length} players.`);
    setPending(null);
  };

  return (
    <section className="backup">
      <p className="backup__title">Backup</p>
      <p className="muted small">
        Save the roster as a file to keep somewhere safe, or to move it to another phone.
      </p>
      <div className="backup__actions">
        <button className="btn btn--ghost" onClick={save} disabled={!players.length}>
          Save backup
        </button>
        <button className="btn btn--ghost" onClick={() => inputRef.current?.click()}>
          Restore backup
        </button>
        <input ref={inputRef} type="file" accept=".json,application/json" hidden onChange={restore} />
      </div>
      {pending && (
        <div className="backup__confirm">
          <p className="backup__message">
            Replace your roster of {players.length} with the {pending.players.length} players from this backup
            {pending.saved ? ` saved ${new Date(pending.saved).toLocaleDateString()}` : ''}?
          </p>
          <div className="backup__actions">
            <button className="btn btn--primary" onClick={apply}>
              Replace roster
            </button>
            <button className="btn btn--ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && <p className="backup__message">{message}</p>}
    </section>
  );
}
