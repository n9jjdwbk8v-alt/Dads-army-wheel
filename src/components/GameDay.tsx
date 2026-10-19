import { useState } from 'react';
import RubberSegment from './reactbits/RubberSegment';
import SpringCheck from './reactbits/SpringCheck';
import { useRendered } from './useRendered';
import type { GameDayState } from '../lib/gameDay';
import {
  buildLineup,
  fromSlots,
  LINE_STYLES,
  positionOf,
  squadKey,
  swapSlots,
  toSlots,
  type LineSlots,
  type Lineup,
  type SlotRef
} from '../lib/lines';
import { copyText, download, shareOrDownload } from '../lib/share';
import { detailsLine, drawTeamSheet, sheetTitle, type GameDetails, type SheetKind } from '../lib/teamSheet';
import type { Player, Position } from '../lib/teams';

type GameDayProps = {
  players: Player[];
  setPlayers: (update: (players: Player[]) => Player[]) => void;
  gameDay: GameDayState;
  setGameDay: (update: (g: GameDayState) => GameDayState) => void;
};

const POSITIONS: { value: Position; label: string; title: string }[] = [
  { value: 'F', label: 'F', title: 'Forward' },
  { value: 'D', label: 'D', title: 'Defence' },
  { value: 'G', label: 'G', title: 'Goalie' }
];

const sheetText = (lineup: Lineup, details: GameDetails) => {
  const lines = [`🏒 Dads Army — ${sheetTitle(details.kind)}`];
  const info = [details.opponent.trim() && `vs ${details.opponent.trim()}`, detailsLine(details)].filter(Boolean);
  if (info.length) lines.push(info.join(' · '));
  if (lineup.forwards.length) {
    lines.push('', 'FORWARDS');
    lineup.forwards.forEach((line, i) =>
      lines.push(`L${i + 1}: ${line.map((p, j) => `${p?.name ?? '—'} (${['LW', 'C', 'RW'][j]})`).join(' · ')}`)
    );
  }
  if (lineup.defence.length) {
    lines.push('', 'DEFENCE');
    lineup.defence.forEach((pair, i) => lines.push(`D${i + 1}: ${pair.map(p => p?.name ?? '—').join(' · ')}`));
  }
  const [starter, backup] = lineup.goalies;
  lines.push('', `GOALIE: ${starter ? starter.name : 'none yet'}${backup ? ` (backup: ${backup.name})` : ''}`);
  if (lineup.spares.length) lines.push(`SPARES: ${lineup.spares.map(p => p.name).join(', ')}`);
  return lines.join('\n');
};

export default function GameDay({ players, setPlayers, gameDay, setGameDay }: GameDayProps) {
  const [sheet, setSheet] = useState<'squad' | 'lines'>(() => (gameDay.available.length ? 'lines' : 'squad'));
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<GameDayState>) => setGameDay(g => ({ ...g, ...patch }));
  const available = new Set(gameDay.available);
  const squad = players.filter(p => available.has(p.id));
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const count = (pos: Position) => squad.filter(p => positionOf(p) === pos).length;

  const toggle = (id: string, on: boolean) =>
    set({ available: on ? [...gameDay.available, id] : gameDay.available.filter(x => x !== id) });
  // A goalie is a player rated 0, so choosing G sets their skill to 0, and moving a goalie to F or D gives them
  // a middling 5 to start from (adjustable on the Roster).
  const setPosition = (id: string, position: Position) =>
    setPlayers(ps =>
      ps.map(p => {
        if (p.id !== id) return p;
        if (position === 'G') return { ...p, skill: 0, position: undefined };
        return { ...p, position, skill: p.skill === 0 ? 5 : p.skill };
      })
    );

  // Hand-placed lines win while the squad and style are unchanged; otherwise show the suggestion.
  const currentSquad = squadKey(squad, gameDay.style);
  const edited = gameDay.manual?.key === currentSquad;
  const lineup = edited ? fromSlots(gameDay.manual!.slots, squad) : buildLineup(squad, gameDay.style);
  const saveSlots = (slots: LineSlots) => set({ manual: { key: currentSquad, slots } });
  const details: GameDetails = gameDay;
  // Re-draw whenever anything on the sheet changes.
  const key = JSON.stringify([lineup, details.kind, details.opponent, details.date, details.time, details.venue]);
  const picture = useRendered(key, sheet === 'lines' && squad.length > 0, () => drawTeamSheet(lineup, details));
  const current = picture?.key === key ? picture : null;
  const file = () => current && new File([current.blob], 'dads-army-team-sheet.png', { type: 'image/png' });

  const copy = async () => {
    if (await copyText(sheetText(lineup, details))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <section className="gameday">
      <nav className="tabs tabs--sub">
        <RubberSegment
          items={[
            { value: 'squad', label: `Squad (${squad.length})` },
            { value: 'lines', label: 'Lines' }
          ]}
          value={sheet}
          onChange={v => setSheet(v as 'squad' | 'lines')}
          size="sm"
          trackColor="#e3f3e9"
          thumbColor="#0f5132"
          textColor="#0f5132"
          activeTextColor="#ffffff"
          aria-label="Game day sheet"
        />
      </nav>

      {sheet === 'squad' ? (
        <>
          <div className="panel gameday__details">
            <RubberSegment
              items={[
                { value: 'game', label: 'Game · Team sheet' },
                { value: 'scrimmage', label: 'Scrimmage' }
              ]}
              value={gameDay.kind}
              onChange={v => set({ kind: v as SheetKind })}
              trackColor="#e3f3e9"
              thumbColor="#0f5132"
              textColor="#0f5132"
              activeTextColor="#ffffff"
              aria-label="Game or scrimmage"
            />
            <label className="field">
              <span>Opponent</span>
              <input
                className="text-input"
                value={gameDay.opponent}
                onChange={e => set({ opponent: e.target.value })}
                placeholder={gameDay.kind === 'game' ? 'e.g. Ice Wolves' : 'Optional'}
                maxLength={40}
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Date</span>
                <input className="text-input" type="date" value={gameDay.date} onChange={e => set({ date: e.target.value })} />
              </label>
              <label className="field">
                <span>Face-off</span>
                <input className="text-input" type="time" value={gameDay.time} onChange={e => set({ time: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>Rink</span>
              <input
                className="text-input"
                value={gameDay.venue}
                onChange={e => set({ venue: e.target.value })}
                placeholder="e.g. Planet Ice"
                maxLength={40}
              />
            </label>
          </div>

          <div className="panel">
            <div className="roster-bar">
              <p className="roster-count">
                <strong>{squad.length}</strong> available · {count('F')} F · {count('D')} D · {count('G')} G
              </p>
              <div className="roster-actions">
                <button className="btn btn--ghost" onClick={() => set({ available: players.map(p => p.id) })}>
                  Tick all
                </button>
                <button className="btn btn--ghost" onClick={() => set({ available: [] })}>
                  Clear
                </button>
              </div>
            </div>
            <p className="muted small">Tick who's available and set each player's position. Goalies are the players rated 0.</p>
            {players.length === 0 ? (
              <p className="empty">Add players on the Roster tab first.</p>
            ) : (
              <ul className="roster">
                {sorted.map(p => {
                  const pos = positionOf(p);
                  return (
                    <li key={p.id} className={available.has(p.id) ? 'roster__row' : 'roster__row roster__row--away'}>
                      <SpringCheck
                        label={p.name}
                        checked={available.has(p.id)}
                        onChange={on => toggle(p.id, on)}
                        strike="none"
                        doneOpacity={1}
                        color="#0f5132"
                        fillColor="#1f8a4c"
                        checkColor="#ffffff"
                        boxSize={22}
                        fontSize={17}
                        className="roster__check"
                      />
                      <div className="pos-picker" role="radiogroup" aria-label={`${p.name}'s position`}>
                        {POSITIONS.map(o => (
                          <button
                            key={o.value}
                            role="radio"
                            aria-checked={pos === o.value}
                            title={o.title}
                            className={pos === o.value ? 'pos pos--on' : 'pos'}
                            onClick={() => setPosition(p.id, o.value)}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <button className="btn btn--primary gameday__next" onClick={() => setSheet('lines')} disabled={!squad.length}>
              Suggest lines →
            </button>
          </div>
        </>
      ) : (
        <div className="panel graphic">
          {!squad.length ? (
            <p className="empty">Tick who's available on the Squad sheet first.</p>
          ) : (
            <>
              <p className="graphic__label">Line style</p>
              <div className="chips" role="radiogroup" aria-label="Line style">
                {LINE_STYLES.map(s => (
                  <button
                    key={s.value}
                    role="radio"
                    aria-checked={gameDay.style === s.value}
                    className={gameDay.style === s.value ? 'chip chip--on' : 'chip'}
                    onClick={() => set({ style: s.value, manual: undefined })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="muted small">{LINE_STYLES.find(s => s.value === gameDay.style)?.hint}</p>
              <p className="gameday__summary">
                {lineup.forwards.length} line{lineup.forwards.length === 1 ? '' : 's'} · {lineup.defence.length} D pair
                {lineup.defence.length === 1 ? '' : 's'} ·{' '}
                {lineup.goalies.some(Boolean) ? `${lineup.goalies.filter(Boolean).length} G` : 'no goalie'}
                {lineup.spares.length ? ` · ${lineup.spares.length} spare${lineup.spares.length === 1 ? '' : 's'}` : ''}
              </p>
              <LineEditor lineup={lineup} edited={edited} onChange={saveSlots} onReset={() => set({ manual: undefined })} />
              {picture && (
                <img
                  src={picture.url}
                  alt={`${sheetTitle(gameDay.kind)} for ${squad.length} players`}
                  className={current ? 'graphic__img' : 'graphic__img graphic__img--updating'}
                />
              )}
              <button
                className="btn btn--primary btn--whatsapp"
                onClick={() => {
                  const f = file();
                  if (f) shareOrDownload(f);
                }}
                disabled={!current}
              >
                Send to WhatsApp
              </button>
              <div className="split__actions">
                <button
                  className="btn btn--ghost"
                  onClick={() => {
                    const f = file();
                    if (f) download(f);
                  }}
                  disabled={!current}
                >
                  Download image
                </button>
                <button className="btn btn--ghost" onClick={copy}>
                  {copied ? 'Copied!' : 'Copy as text'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

const SPOT_TAGS = { forwards: ['LW', 'C', 'RW'], defence: ['LD', 'RD'], goalies: ['Starter', 'Backup'] };

type LineEditorProps = {
  lineup: Lineup;
  edited: boolean;
  onChange: (slots: LineSlots) => void;
  onReset: () => void;
};

/** Tap one spot and then another to swap them; tapping a player then an empty spot moves them there. */
function LineEditor({ lineup, edited, onChange, onReset }: LineEditorProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SlotRef | null>(null);
  const same = (a: SlotRef | null, b: SlotRef) => !!a && a.group === b.group && a.row === b.row && a.col === b.col;

  const tap = (ref: SlotRef, filled: boolean) => {
    if (same(picked, ref)) return setPicked(null);
    if (!picked) {
      if (filled) setPicked(ref);
      return;
    }
    onChange(swapSlots(toSlots(lineup), picked, ref));
    setPicked(null);
  };

  const spot = (ref: SlotRef, player: Player | undefined, tag: string) => (
    <button
      key={`${ref.group}-${ref.row}-${ref.col}`}
      className={`spot${same(picked, ref) ? ' spot--picked' : ''}${player ? '' : ' spot--empty'}`}
      onClick={() => tap(ref, !!player)}
      aria-pressed={same(picked, ref)}
    >
      <span className="spot__tag">{tag}</span>
      <span className="spot__name">{player?.name ?? 'Empty'}</span>
    </button>
  );

  const rows = (group: 'forwards' | 'defence', label: string) =>
    lineup[group].map((row, r) => (
      <div className="editor__row" key={`${group}-${r}`}>
        <span className="editor__label">
          {label}
          {r + 1}
        </span>
        {row.map((p, c) => spot({ group, row: r, col: c }, p, SPOT_TAGS[group][c]))}
      </div>
    ));

  if (!open) {
    return (
      <button className="btn btn--ghost editor__open" onClick={() => setOpen(true)}>
        ✏️ Edit lines{edited ? ' (edited)' : ''}
      </button>
    );
  }

  return (
    <div className="editor">
      <p className="muted small">
        {picked ? 'Now tap where they should go.' : 'Tap a player, then tap another spot to swap them.'}
      </p>
      {lineup.forwards.length > 0 && <p className="editor__heading">Forwards</p>}
      {rows('forwards', 'L')}
      {lineup.defence.length > 0 && <p className="editor__heading">Defence</p>}
      {rows('defence', 'D')}
      <p className="editor__heading">Goalies</p>
      <div className="editor__row">
        <span className="editor__label">G</span>
        {lineup.goalies.map((p, c) => spot({ group: 'goalies', row: 0, col: c }, p, SPOT_TAGS.goalies[c]))}
      </div>
      {(lineup.spares.length > 0 || (picked && picked.group !== 'spares')) && (
        <>
          <p className="editor__heading">Spares</p>
          <div className="editor__spares">
            {lineup.spares.map((p, c) => spot({ group: 'spares', row: 0, col: c }, p, 'Spare'))}
            {picked && picked.group !== 'spares' && (
              <button
                className="spot spot--add"
                onClick={() => tap({ group: 'spares', row: 0, col: lineup.spares.length }, false)}
              >
                <span className="spot__name">Move to spares</span>
              </button>
            )}
          </div>
        </>
      )}
      <div className="split__actions">
        {edited && (
          <button className="btn btn--ghost" onClick={onReset}>
            Reset to suggested lines
          </button>
        )}
        <button
          className="btn btn--ghost"
          onClick={() => {
            setPicked(null);
            setOpen(false);
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
