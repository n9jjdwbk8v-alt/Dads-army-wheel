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

  const save = async () => {
    await shareOrDownload(makeBackupFile(players, history));
  };

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = await readBackupFile(file);
      const when = backup.saved ? ` saved ${new Date(backup.saved).toLocaleDateString()}` : '';
      const ok = confirm(
        `Replace your roster of ${players.length} with the ${backup.players.length} players from this backup${when}?`
      );
      if (!ok) return;
      onRestore(backup);
      setMessage(`Restored ${backup.players.length} players.`);
    } catch (err) {
      setMessage((err as Error).message);
    }
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
      {message && <p className="backup__message">{message}</p>}
    </section>
  );
}
