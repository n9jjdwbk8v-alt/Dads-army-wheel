import { useState, type FormEvent, type ReactNode } from 'react';
import ScrubField from './reactbits/ScrubField';
import SpringCheck from './reactbits/SpringCheck';
import { isGoalie, type Player } from '../lib/teams';

type RosterProps = {
  players: Player[];
  setPlayers: (update: (players: Player[]) => Player[]) => void;
  children?: ReactNode;
};

export default function Roster({ players, setPlayers, children }: RosterProps) {
  const [name, setName] = useState('');
  const [skill, setSkill] = useState(5);
  const [filter, setFilter] = useState('');

  const hereCount = players.filter(p => p.here).length;
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const visible = filter ? sorted.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())) : sorted;

  const update = (id: string, patch: Partial<Player>) =>
    setPlayers(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const add = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayers(ps => [...ps, { id: crypto.randomUUID(), name: trimmed, skill, here: true }]);
    setName('');
  };

  const remove = (p: Player) => {
    if (confirm(`Remove ${p.name} from the roster?`)) setPlayers(ps => ps.filter(x => x.id !== p.id));
  };

  const setAll = (here: boolean) => setPlayers(ps => ps.map(p => ({ ...p, here })));

  return (
    <section className="panel">
      <form className="add-row" onSubmit={add}>
        <input
          className="text-input"
          placeholder="Player name"
          value={name}
          onChange={e => setName(e.target.value)}
          aria-label="Player name"
          maxLength={40}
        />
        <ScrubField
          label="Skill"
          value={skill}
          min={0}
          max={10}
          step={1}
          onChange={setSkill}
          accent="#1f8a4c"
          suffix=""
          chipColor="#e3f3e9"
        />
        <button className="btn btn--primary" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>

      <div className="roster-bar">
        <p className="roster-count">
          <strong>{hereCount}</strong> of {players.length} here tonight
        </p>
        <div className="roster-actions">
          <button className="btn btn--ghost" onClick={() => setAll(true)}>
            Tick all
          </button>
          <button className="btn btn--ghost" onClick={() => setAll(false)}>
            Clear
          </button>
        </div>
      </div>

      {players.length > 8 && (
        <input
          className="text-input text-input--search"
          placeholder="Search players…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label="Search players"
        />
      )}

      {players.length === 0 ? (
        <p className="empty">No players yet — add the squad above. Rate each one 1 (learning to skate) to 10 (ex-pro), or 0 for a goalie.</p>
      ) : (
        <ul className="roster">
          {visible.map(p => (
            <li key={p.id} className={p.here ? 'roster__row' : 'roster__row roster__row--away'}>
              <SpringCheck
                label={
                  <>
                    {p.name}
                    {isGoalie(p) && <span className="goalie-tag" title="Goalie">G</span>}
                  </>
                }
                checked={p.here}
                onChange={here => update(p.id, { here })}
                strike="none"
                doneOpacity={1}
                color="#0f5132"
                fillColor="#1f8a4c"
                checkColor="#ffffff"
                boxSize={22}
                fontSize={17}
                className="roster__check"
              />
              <ScrubField
                label="Skill"
                value={p.skill}
                min={0}
                max={10}
                step={1}
                size="sm"
                onChange={v => update(p.id, { skill: v })}
                accent="#1f8a4c"
                chipColor="#ffffff"
                suffix=""
              />
              <button className="icon-btn" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}
