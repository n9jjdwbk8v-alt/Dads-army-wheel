import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useConfirmTap } from './useConfirmTap';
import { useRendered } from './useRendered';
import {
  addGoal,
  addPenalty,
  matchTitle,
  PERIODS,
  points,
  sameGame,
  saveSquad,
  score,
  seenNumbers,
  theirName,
  toScoreSheet,
  undoLast,
  updateMatch,
  type Match,
  type MatchPlayer
} from '../lib/matches';
import { drawScoreSheet, type Period } from '../lib/scoreSheet';
import { download, shareOrDownload } from '../lib/share';
import type { GameDetails } from '../lib/teamSheet';
import type { Player } from '../lib/teams';

type ScoreSectionProps = {
  matches: Match[];
  setMatches: (update: (matches: Match[]) => Match[]) => void;
  /** The game day being planned now, and who's available for it. */
  details: GameDetails;
  available: Player[];
  /** Everyone on the roster, for adding to a game's squad. */
  roster: Player[];
};

type View = 'live' | 'goal' | 'their' | 'penalty' | 'squad' | 'add' | 'period' | 'final';

const MINUTES = [2, 4, 5, 10];
const REASONS = ['Tripping', 'Hooking', 'Slashing', 'Holding', 'Interference', 'Too many men'];

const shortDate = (date: string) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const nameHas = (name: string, query: string) => name.toLowerCase().includes(query.trim().toLowerCase());

/** Game day's Score section: pick a game whose squad was saved from its team sheet, then score it live. */
export default function ScoreSection({ matches: all, setMatches, details, available, roster }: ScoreSectionProps) {
  const current = all.find(m => sameGame(m.details, details));
  const [pickedId, setPickedId] = useState<string | null>(current?.id ?? null);
  const [view, setView] = useState<View>('live');
  const match = all.find(m => m.id === pickedId) ?? null;
  const top = useRef<HTMLDivElement>(null);

  // Where the live score was scrolled to, so coming back from a form lands in the same place.
  const liveScroll = useRef<number | null>(null);
  const go = (next: View) => {
    if (view === 'live' && next !== 'live') liveScroll.current = window.scrollY;
    setView(next);
  };

  // Back on the live score: return to where you were. Opening a form: bring its top into view only if it's off
  // the top of the screen or low down, so taps near the top don't move the page at all.
  useLayoutEffect(() => {
    if (view === 'live' && liveScroll.current !== null) {
      window.scrollTo({ top: liveScroll.current });
      liveScroll.current = null;
      return;
    }
    const el = top.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top;
    if (y < 0 || y > window.innerHeight * 0.5) {
      el.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  }, [view, pickedId]);

  const open = (id: string) => {
    setPickedId(id);
    setView('live');
  };

  // Starts scoring this game day with whoever is ticked available, and opens it.
  const startCurrent = () => {
    const next = saveSquad(all, details, available);
    setMatches(() => next);
    const started = next.find(m => sameGame(m.details, details));
    if (started) open(started.id);
  };

  if (!match) {
    return (
      <div ref={top}>
        <GameList
          all={all}
          details={details}
          available={available}
          current={current}
          onOpen={open}
          onStart={startCurrent}
        />
      </div>
    );
  }

  const change = (update: (m: Match) => Match) => setMatches(ms => updateMatch(ms, match.id, update));
  const back = () => go('live');

  return (
    <div ref={top} className="score">
      <div key={view} className="score__view">
        {view === 'live' && <Live match={match} onChange={change} onView={go} onAllGames={() => setPickedId(null)} />}
        {view === 'goal' && (
          <GoalForm
            match={match}
            onCancel={back}
            onSave={(scorer, assists, time) => {
              change(m => addGoal(m, { side: 'us', scorer, assists, ...(time ? { time } : {}) }));
              back();
            }}
            onSquad={() => go('squad')}
          />
        )}
        {view === 'their' && (
          <TheirGoalForm
            match={match}
            onCancel={back}
            onSave={(number, time) => {
              change(m =>
                addGoal(m, { side: 'them', assists: [], ...(number ? { number } : {}), ...(time ? { time } : {}) })
              );
              back();
            }}
          />
        )}
        {view === 'penalty' && (
          <PenaltyForm
            match={match}
            onCancel={back}
            onSave={penalty => {
              change(m => addPenalty(m, penalty));
              back();
            }}
          />
        )}
        {view === 'squad' && <SquadEditor match={match} onChange={change} onAdd={() => go('add')} onDone={back} />}
        {view === 'add' && (
          <AddPlayers
            match={match}
            roster={roster}
            onCancel={() => go('squad')}
            onAdd={people => {
              change(m => ({ ...m, squad: [...m.squad, ...people] }));
              go('squad');
            }}
          />
        )}
        {view === 'period' && (
          <PeriodEnd
            match={match}
            onBack={back}
            onNext={() => {
              change(m => ({ ...m, period: Math.min(4, m.period + 1) as Period }));
              back();
            }}
          />
        )}
        {view === 'final' && (
          <FullTime
            match={match}
            onChange={change}
            onBack={back}
            onFinish={() => {
              change(m => ({ ...m, finished: true }));
              back();
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Picking the game ----------

type GameListProps = {
  all: Match[];
  details: GameDetails;
  available: Player[];
  current?: Match;
  onOpen: (id: string) => void;
  onStart: () => void;
};

function GameList({ all, details, available, current, onOpen, onStart }: GameListProps) {
  const others = all.filter(m => m !== current);
  const hasDetails = !!(details.opponent.trim() || details.date);
  return (
    <div className="panel score__pick">
      <h2 className="panel__title">Which game?</h2>
      <p className="muted small">Sending the team sheet saves its squad here, ready to score.</p>
      {current ? (
        <GameCard match={current} onOpen={onOpen} highlight />
      ) : (
        <div className="score-card score-card--new">
          <p className="score-card__title">{hasDetails ? matchTitle(details) : 'This game day'}</p>
          <p className="muted small">
            {available.length
              ? `${shortDate(details.date) || 'No date yet'} · ${available.length} available`
              : "Tick who's available in Squad first."}
          </p>
          <button className="btn btn--primary" onClick={onStart} disabled={!available.length}>
            Start scoring
          </button>
        </div>
      )}
      {others.length > 0 && (
        <>
          <p className="graphic__label score__earlier">Earlier games</p>
          <div className="score__games">
            {others.map(m => (
              <GameCard key={m.id} match={m} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GameCard({ match, onOpen, highlight }: { match: Match; onOpen: (id: string) => void; highlight?: boolean }) {
  const { us, them } = score(match);
  const played = match.goals.length > 0 || match.finished;
  const result = us > them ? 'W' : us < them ? 'L' : 'D';
  return (
    <button className={highlight ? 'score-card score-card--on' : 'score-card'} onClick={() => onOpen(match.id)}>
      <span className="score-card__body">
        <span className="score-card__title">{matchTitle(match.details)}</span>
        <span className="muted small">
          {[
            shortDate(match.details.date),
            match.details.kind === 'scrimmage' ? 'Scrimmage' : '',
            `${match.squad.length} players`
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="score-card__result">
        {played ? `${match.finished ? result : 'Live'} ${us}–${them}` : 'Not started'}
      </span>
    </button>
  );
}

// ---------- Scoring ----------

type LiveProps = {
  match: Match;
  onChange: (update: (m: Match) => Match) => void;
  onView: (v: View) => void;
  onAllGames: () => void;
};

function Live({ match, onChange, onView, onAllGames }: LiveProps) {
  // Anything added in the moments before this screen appeared (just saved) gets a brief highlight.
  const [shownAt] = useState(() => Date.now());
  const fresh = (at: number) => (shownAt - at < 4000 ? ' log__row--new' : '');
  const [armed, confirmTap] = useConfirmTap();
  const { us, them } = score(match);
  const theirs = theirName(match.details);
  const nameOf = (p: Period) => PERIODS.find(x => x.value === p)!;
  const events = [
    ...match.goals.map(g => ({ kind: 'goal' as const, at: g.at, g })),
    ...match.penalties.map(p => ({ kind: 'penalty' as const, at: p.at, p }))
  ].sort((a, b) => b.at - a.at);
  // The running score after each goal, for the log.
  const after = new Map<string, string>();
  let u = 0;
  let t = 0;
  match.goals.forEach(g => {
    if (g.side === 'us') u++;
    else t++;
    after.set(g.id, `${u}–${t}`);
  });
  const ending = match.period >= 3 ? 'Full time' : `End ${nameOf(match.period).long}`;

  return (
    <>
      <div className="panel score__board">
        <div className="score__top">
          <button className="btn btn--link score__back" onClick={onAllGames}>
            ‹ All games
          </button>
          <button className="score__squad" onClick={() => onView('squad')}>
            Squad · {match.squad.length}
          </button>
        </div>
        <p className="graphic__label">
          {[matchTitle(match.details), shortDate(match.details.date)].filter(Boolean).join(' · ')}
          {match.finished ? ' · Full time' : ''}
        </p>
        <div className="scoreboard" aria-live="polite">
          <div className="scoreboard__side">
            <span className="scoreboard__name scoreboard__name--us">Dads Army</span>
            <span key={us} className="scoreboard__num">
              {us}
            </span>
          </div>
          <span className="scoreboard__dash" aria-hidden="true">
            –
          </span>
          <div className="scoreboard__side">
            <span className="scoreboard__name">{theirs}</span>
            <span key={them} className="scoreboard__num scoreboard__num--them">
              {them}
            </span>
          </div>
        </div>
        <div className="period-pick" role="radiogroup" aria-label="Period">
          {PERIODS.map(p => (
            <button
              key={p.value}
              role="radio"
              aria-checked={match.period === p.value}
              className={match.period === p.value ? 'chip chip--on' : 'chip'}
              onClick={() => onChange(m => ({ ...m, period: p.value }))}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="score__actions">
        <button className="btn btn--primary score__big" onClick={() => onView('goal')}>
          + Our goal
        </button>
        <button className="btn score__big score__big--them" onClick={() => onView('their')}>
          + Their goal
        </button>
        <button className="btn btn--ghost" onClick={() => onView('penalty')}>
          Penalty
        </button>
        <button
          className={armed === 'undo' ? 'btn btn--danger' : 'btn btn--ghost'}
          onClick={() => confirmTap('undo') && onChange(undoLast)}
          disabled={!events.length}
        >
          {armed === 'undo' ? 'Tap again to undo' : 'Undo last'}
        </button>
      </div>

      <div className="panel score__log">
        <p className="graphic__label">Game log</p>
        {events.length === 0 ? (
          <p className="muted small">Goals and penalties show here as you add them.</p>
        ) : (
          <ul className="log">
            {events.map(e =>
              e.kind === 'goal' ? (
                <li key={e.g.id} className={`log__row${e.g.side === 'us' ? ' log__row--us' : ''}${fresh(e.at)}`}>
                  <span className="log__period">{nameOf(e.g.period).label}</span>
                  <span className="log__text">
                    <strong>
                      {e.g.side === 'us'
                        ? `${e.g.scorer} · goal`
                        : `${theirs}${e.g.number ? ` #${e.g.number}` : ''} · goal`}
                    </strong>
                    <span className="muted small">
                      {e.g.side === 'us' ? (e.g.assists?.length ? e.g.assists.join(', ') : 'Unassisted') : theirs}
                      {e.g.time ? ` · ${e.g.time}` : ''}
                    </span>
                  </span>
                  <span className="log__score">{after.get(e.g.id)}</span>
                </li>
              ) : (
                <li key={e.p.id} className={`log__row${e.p.side === 'us' ? ' log__row--us' : ''}${fresh(e.at)}`}>
                  <span className="log__period">{nameOf(e.p.period).label}</span>
                  <span className="log__text">
                    <strong>
                      {e.p.side === 'us' ? e.p.who : `${theirs} #${e.p.who}`} · {e.p.minutes} min
                    </strong>
                    <span className="muted small">Penalty{e.p.reason ? ` · ${e.p.reason}` : ''}</span>
                  </span>
                  <span className="log__score" />
                </li>
              )
            )}
          </ul>
        )}
      </div>

      <button
        className="btn btn--primary btn--whatsapp score__end"
        onClick={() => onView(match.period >= 3 ? 'final' : 'period')}
      >
        {match.finished ? 'Full time sheet' : ending}
      </button>
    </>
  );
}

// ---------- Forms ----------

function FormHead({ kicker, title, onCancel }: { kicker: string; title: string; onCancel: () => void }) {
  return (
    <div className="form-head">
      <div>
        <p className="graphic__label">{kicker}</p>
        <h2 className="panel__title">{title}</h2>
      </div>
      <button className="btn btn--ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function Search({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      className="text-input text-input--search"
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={label}
      aria-label={label}
    />
  );
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="field form__time">
      <span>Time on clock (optional)</span>
      <input
        className="text-input"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^\d:]/g, '').slice(0, 5))}
        placeholder="12:40"
      />
    </label>
  );
}

type GoalFormProps = {
  match: Match;
  onCancel: () => void;
  onSave: (scorer: string, assists: string[], time: string) => void;
  onSquad: () => void;
};

function GoalForm({ match, onCancel, onSave, onSquad }: GoalFormProps) {
  const [query, setQuery] = useState('');
  const [scorer, setScorer] = useState('');
  const [assists, setAssists] = useState<string[]>([]);
  const [time, setTime] = useState('');
  // Skaters first; a goalie can still be picked.
  const people = [...match.squad].sort((a, b) => Number(a.goalie) - Number(b.goalie) || a.name.localeCompare(b.name));
  const shown = people.filter(p => nameHas(p.name, query));
  const period = PERIODS.find(p => p.value === match.period)!;

  return (
    <div className="panel form">
      <FormHead kicker={`${period.long} · ${matchTitle(match.details)}`} title="Dads Army goal" onCancel={onCancel} />
      <Search value={query} onChange={setQuery} label="Search players" />
      <p className="graphic__label">Who scored?</p>
      <div className="pick-grid">
        {shown.map(p => (
          <button
            key={p.id}
            aria-pressed={scorer === p.name}
            className={scorer === p.name ? 'pick pick--on' : 'pick'}
            onClick={() => {
              setScorer(p.name);
              setAssists(a => a.filter(x => x !== p.name));
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="muted small">
          No one in this game's squad matches.{' '}
          <button className="btn--link" onClick={onSquad}>
            Add them to the squad
          </button>
        </p>
      )}
      <p className="graphic__label">Assists · up to 2</p>
      <div className="chips">
        {people
          .filter(p => p.name !== scorer)
          .map(p => {
            const on = assists.includes(p.name);
            return (
              <button
                key={p.id}
                aria-pressed={on}
                className={on ? 'chip chip--on' : 'chip'}
                onClick={() => setAssists(a => (on ? a.filter(x => x !== p.name) : [...a, p.name].slice(-2)))}
              >
                {p.name}
              </button>
            );
          })}
      </div>
      <TimeField value={time} onChange={setTime} />
      <button
        className="btn btn--primary btn--whatsapp"
        disabled={!scorer}
        onClick={() => onSave(scorer, assists, time)}
      >
        {scorer ? `Save goal · ${scorer}` : 'Pick who scored'}
      </button>
    </div>
  );
}

function NumberPicker({ match, value, onChange }: { match: Match; value: string; onChange: (v: string) => void }) {
  const seen = seenNumbers(match);
  return (
    <>
      <label className="field">
        <span>Shirt number (optional)</span>
        <input
          className="text-input number-input"
          inputMode="numeric"
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
          placeholder="#"
        />
      </label>
      {seen.length > 0 && (
        <div className="chips" aria-label="Numbers seen tonight">
          {seen.map(n => (
            <button
              key={n}
              className={value === n ? 'chip chip--on' : 'chip'}
              onClick={() => onChange(value === n ? '' : n)}
            >
              #{n}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function TheirGoalForm({
  match,
  onCancel,
  onSave
}: {
  match: Match;
  onCancel: () => void;
  onSave: (number: string, time: string) => void;
}) {
  const [number, setNumber] = useState('');
  const [time, setTime] = useState('');
  const period = PERIODS.find(p => p.value === match.period)!;
  return (
    <div className="panel form">
      <FormHead kicker={period.long} title={`${theirName(match.details)} goal`} onCancel={onCancel} />
      <p className="muted small">We don't have their roster, so just add the shirt number if you saw it.</p>
      <NumberPicker match={match} value={number} onChange={setNumber} />
      <TimeField value={time} onChange={setTime} />
      <button className="btn btn--primary btn--whatsapp" onClick={() => onSave(number, time)}>
        Save their goal
      </button>
    </div>
  );
}

type PenaltyFormProps = {
  match: Match;
  onCancel: () => void;
  onSave: (p: { side: 'us' | 'them'; who: string; minutes: number; reason?: string }) => void;
};

function PenaltyForm({ match, onCancel, onSave }: PenaltyFormProps) {
  const [side, setSide] = useState<'us' | 'them'>('us');
  const [who, setWho] = useState('');
  const [number, setNumber] = useState('');
  const [minutes, setMinutes] = useState(2);
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const shown = [...match.squad].sort((a, b) => a.name.localeCompare(b.name)).filter(p => nameHas(p.name, query));
  const period = PERIODS.find(p => p.value === match.period)!;
  const them = theirName(match.details);
  const ready = side === 'us' ? !!who : !!number;

  return (
    <div className="panel form">
      <FormHead kicker={period.long} title="Penalty" onCancel={onCancel} />
      <div
        className="segment"
        role="radiogroup"
        aria-label="Team"
        style={{ '--i': side === 'us' ? 0 : 1, '--n': 2 } as CSSProperties}
      >
        {(['us', 'them'] as const).map(s => (
          <button
            key={s}
            role="radio"
            aria-checked={side === s}
            className={side === s ? 'segment__on' : ''}
            onClick={() => setSide(s)}
          >
            {s === 'us' ? 'Dads Army' : them}
          </button>
        ))}
      </div>
      {side === 'us' ? (
        <>
          <Search value={query} onChange={setQuery} label="Search players" />
          <div className="pick-grid">
            {shown.map(p => (
              <button
                key={p.id}
                aria-pressed={who === p.name}
                className={who === p.name ? 'pick pick--on' : 'pick'}
                onClick={() => setWho(p.name)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <NumberPicker match={match} value={number} onChange={setNumber} />
      )}
      <p className="graphic__label">Minutes</p>
      <div className="period-pick">
        {MINUTES.map(m => (
          <button
            key={m}
            aria-pressed={minutes === m}
            className={minutes === m ? 'chip chip--on' : 'chip'}
            onClick={() => setMinutes(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <p className="graphic__label">For (optional)</p>
      <div className="chips">
        {REASONS.map(r => (
          <button
            key={r}
            aria-pressed={reason === r}
            className={reason === r ? 'chip chip--on' : 'chip'}
            onClick={() => setReason(reason === r ? '' : r)}
          >
            {r}
          </button>
        ))}
      </div>
      <button
        className="btn btn--primary btn--whatsapp"
        disabled={!ready}
        onClick={() => onSave({ side, who: side === 'us' ? who : number, minutes, ...(reason ? { reason } : {}) })}
      >
        {ready
          ? `Save · ${side === 'us' ? who : `${them} #${number}`} ${minutes} min`
          : side === 'us'
            ? 'Pick who'
            : 'Add their number'}
      </button>
    </div>
  );
}

// ---------- The squad ----------

type SquadEditorProps = {
  match: Match;
  onChange: (update: (m: Match) => Match) => void;
  onAdd: () => void;
  onDone: () => void;
};

function SquadEditor({ match, onChange, onAdd, onDone }: SquadEditorProps) {
  const [query, setQuery] = useState('');
  const [removed, setRemoved] = useState<MatchPlayer[]>([]);
  const people = [...match.squad]
    .sort((a, b) => Number(b.goalie) - Number(a.goalie) || a.name.localeCompare(b.name))
    .filter(p => nameHas(p.name, query));
  const last = removed.at(-1);

  return (
    <div className="panel form">
      <FormHead kicker={matchTitle(match.details)} title={`Squad · ${match.squad.length}`} onCancel={onDone} />
      <Search value={query} onChange={setQuery} label="Search the squad" />
      <ul className="squad-list">
        {people.map(p => (
          <li key={p.id} className="squad-list__row">
            <span className="squad-list__pos">{p.goalie ? 'G' : ''}</span>
            <span className="squad-list__name">
              {p.name}
              {p.guest ? <span className="muted small"> · guest</span> : null}
            </span>
            <button
              className="squad-list__remove"
              aria-label={`Take ${p.name} out`}
              onClick={() => {
                setRemoved(r => [...r, p]);
                onChange(m => ({ ...m, squad: m.squad.filter(x => x.id !== p.id) }));
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {last && (
        <div className="squad-list__undo">
          <span className="muted small">Took out {last.name}</span>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setRemoved(r => r.slice(0, -1));
              onChange(m => ({ ...m, squad: [...m.squad, last] }));
            }}
          >
            Undo
          </button>
        </div>
      )}
      <button className="btn btn--ghost" onClick={onAdd}>
        + Add a player
      </button>
      <button className="btn btn--primary btn--whatsapp" onClick={onDone}>
        Done
      </button>
      <p className="muted small">Changes here are just for this game. The team sheet and roster stay as they are.</p>
    </div>
  );
}

type AddPlayersProps = {
  match: Match;
  roster: Player[];
  onCancel: () => void;
  onAdd: (people: MatchPlayer[]) => void;
};

function AddPlayers({ match, roster, onCancel, onAdd }: AddPlayersProps) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [guest, setGuest] = useState('');
  const inSquad = new Set(match.squad.map(p => p.id));
  const shown = roster
    .filter(p => !inSquad.has(p.id) && nameHas(p.name, query))
    .sort((a, b) => a.name.localeCompare(b.name));
  const chosen = roster.filter(p => picked.includes(p.id));

  const add = () =>
    onAdd([
      ...chosen.map(p => ({ id: p.id, name: p.name, goalie: p.skill === 0 })),
      ...(guest.trim()
        ? [{ id: crypto.randomUUID(), name: guest.trim().slice(0, 40), goalie: false, guest: true }]
        : [])
    ]);
  const count = chosen.length + (guest.trim() ? 1 : 0);

  return (
    <div className="panel form">
      <FormHead kicker="From the roster" title="Add a player" onCancel={onCancel} />
      <Search value={query} onChange={setQuery} label="Search the roster" />
      <ul className="squad-list">
        {shown.map(p => {
          const on = picked.includes(p.id);
          return (
            <li key={p.id}>
              <button
                className={on ? 'squad-list__pick squad-list__pick--on' : 'squad-list__pick'}
                aria-pressed={on}
                onClick={() => setPicked(ps => (on ? ps.filter(x => x !== p.id) : [...ps, p.id]))}
              >
                <span className="squad-list__box" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                {p.name}
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <p className="muted small">
          {query ? `No one on the roster matches “${query}”.` : 'Everyone on the roster is already in.'}
        </p>
      )}
      <label className="field">
        <span>Or a guest who isn't on the roster</span>
        <input
          className="text-input"
          value={guest}
          onChange={e => setGuest(e.target.value)}
          placeholder="Their name"
          maxLength={40}
        />
      </label>
      <button className="btn btn--primary btn--whatsapp" disabled={!count} onClick={add}>
        {count ? `Add ${count} player${count > 1 ? 's' : ''}` : 'Pick who to add'}
      </button>
    </div>
  );
}

// ---------- Sending the sheet ----------

function SheetShare({ match, stage, label }: { match: Match; stage: Period | 'final'; label: string }) {
  const sheet = toScoreSheet(match, stage);
  const key = JSON.stringify(sheet);
  const picture = useRendered(key, true, () => drawScoreSheet(sheet));
  const ready = picture?.key === key ? picture : null;
  const file = () => ready && new File([ready.blob], `dads-army-score-${stage}.png`, { type: 'image/png' });
  return (
    <>
      {picture ? (
        <img src={picture.url} alt={label} className={ready ? 'graphic__img' : 'graphic__img graphic__img--updating'} />
      ) : (
        <div className="graphic__img graphic__img--waiting" aria-hidden="true" />
      )}
      <button
        className="btn btn--primary btn--whatsapp"
        disabled={!ready}
        onClick={() => {
          const f = file();
          if (f) shareOrDownload(f);
        }}
      >
        Send sheet to WhatsApp
      </button>
      <button
        className="btn btn--ghost"
        disabled={!ready}
        onClick={() => {
          const f = file();
          if (f) download(f);
        }}
      >
        Download image
      </button>
    </>
  );
}

function PeriodEnd({ match, onBack, onNext }: { match: Match; onBack: () => void; onNext: () => void }) {
  const { us, them } = score(match);
  const period = PERIODS.find(p => p.value === match.period)!;
  const next = PERIODS.find(p => p.value === match.period + 1);
  return (
    <div className="panel graphic">
      <p className="graphic__label">
        {matchTitle(match.details)} · {us}–{them}
      </p>
      <h2 className="panel__title">End of {period.long}</h2>
      <SheetShare match={match} stage={match.period} label={`Score sheet after the ${period.long}: ${us}–${them}`} />
      <div className="split__actions">
        {next && (
          <button className="btn btn--ghost" onClick={onNext}>
            Start {next.long}
          </button>
        )}
        <button className="btn btn--ghost" onClick={onBack}>
          Back, not finished
        </button>
      </div>
    </div>
  );
}

type FullTimeProps = {
  match: Match;
  onChange: (update: (m: Match) => Match) => void;
  onBack: () => void;
  onFinish: () => void;
};

function FullTime({ match, onChange, onBack, onFinish }: FullTimeProps) {
  const { us, them } = score(match);
  const result = us > them ? 'WIN' : us < them ? 'LOSS' : 'DRAW';
  const ranked = points(match);
  const line = (g: number, a: number) => [g ? `${g}G` : '', a ? `${a}A` : ''].filter(Boolean).join(' ');
  return (
    <div className="panel graphic">
      <p className="graphic__label">Full time · {matchTitle(match.details)}</p>
      <h2 className="panel__title">
        {us}–{them} {result}
      </h2>
      <p className="graphic__label">Player of the match</p>
      <div className="chips">
        {ranked.map(({ player, goals, assists }) => {
          const on = match.playerOfMatch === player.name;
          return (
            <button
              key={player.id}
              aria-pressed={on}
              className={on ? 'chip chip--on' : 'chip'}
              onClick={() => onChange(m => ({ ...m, playerOfMatch: on ? undefined : player.name }))}
            >
              {player.name}
              {goals || assists ? ` · ${line(goals, assists)}` : ''}
            </button>
          );
        })}
      </div>
      <SheetShare match={match} stage="final" label={`Final score sheet: ${us}–${them}`} />
      <div className="split__actions">
        <button className="btn btn--ghost" onClick={onBack}>
          Back to game
        </button>
        {!match.finished && (
          <button className="btn btn--ghost" onClick={onFinish}>
            Finish game
          </button>
        )}
      </div>
    </div>
  );
}
