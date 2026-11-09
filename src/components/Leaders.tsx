import { useState } from 'react';
import { useRendered } from './useRendered';
import {
  boardMonths,
  countedScrims,
  drawLeaderboardSheet,
  inPeriod,
  leaderboardText,
  monthLong,
  monthShort,
  periodLabel,
  playerGames,
  resultOf,
  sortTallies,
  tally,
  type BoardPeriod,
  type SortKey,
  type Tally
} from '../lib/leaderboard';
import type { Match } from '../lib/matches';
import { copyText, shareOrDownload } from '../lib/share';
import type { Player } from '../lib/teams';

type LeadersProps = { matches: Match[]; roster: Player[] };

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: 'goals', label: 'G', title: 'goals' },
  { key: 'assists', label: 'A', title: 'assists' },
  { key: 'points', label: 'PTS', title: 'points' }
];

const shortDate = (date: string) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
};

const count = (n: number) => `${n} scrimmage${n === 1 ? '' : 's'}`;

/** Game day's Leaders section: goals and assists from every scrimmage that reached full time. */
export default function Leaders({ matches, roster }: LeadersProps) {
  const scrims = countedScrims(matches);
  const months = boardMonths(scrims);
  const [picked, setPicked] = useState<BoardPeriod>('all');
  const [sort, setSort] = useState<SortKey>('goals');
  const [playerKey, setPlayerKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // A month that no longer has any scrimmages falls back to the running total.
  const period = picked === 'all' || months.includes(picked) ? picked : 'all';
  const games = inPeriod(scrims, period);
  const rows = sortTallies(tally(games, roster), sort);
  const allTime = tally(scrims, roster);

  const drawKey = JSON.stringify([period, games.length, rows]);
  const picture = useRendered(drawKey, rows.length > 0, () => drawLeaderboardSheet(period, games.length, rows));
  const ready = picture?.key === drawKey ? picture : null;
  const fileName = `dads-army-leaderboard-${period === 'all' ? 'all-time' : period}.png`;

  const player = playerKey ? allTime.find(t => t.key === playerKey) : undefined;
  if (player) {
    const rank = sortTallies(allTime, 'goals').findIndex(t => t.key === player.key) + 1;
    return <PlayerGames player={player} rank={rank} scrims={scrims} onBack={() => setPlayerKey(null)} />;
  }

  if (!scrims.length) {
    return (
      <div className="panel leaders">
        <p className="graphic__label">Scrimmages only</p>
        <h2 className="panel__title">Goals leaderboard</h2>
        <p className="empty">
          No scrimmages at full time yet. Score a scrimmage in Score and finish it, and its goals and assists add up
          here.
        </p>
      </div>
    );
  }

  const copy = async () => {
    if (await copyText(leaderboardText(period, games.length, rows))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="panel leaders">
      <div className="leaders__head">
        <div>
          <p className="graphic__label">Scrimmages only</p>
          <h2 className="panel__title">Goals leaderboard</h2>
        </div>
        <span className="muted small leaders__count">
          {period === 'all'
            ? `${count(games.length)} · running total`
            : `${count(games.length)} in ${monthShort(period)}`}
        </span>
      </div>

      <div className="leaders__periods" role="radiogroup" aria-label="Which scrimmages">
        {(['all', ...months] as BoardPeriod[]).map(p => (
          <button
            key={p}
            role="radio"
            aria-checked={period === p}
            className={period === p ? 'chip chip--on' : 'chip'}
            onClick={() => setPicked(p)}
          >
            {p === 'all' ? 'All time' : monthShort(p)}
          </button>
        ))}
      </div>

      <div className="board" role="table" aria-label={`Goals leaderboard, ${periodLabel(period)}`}>
        <div className="board__row board__row--head" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">{period === 'all' ? 'All time' : monthLong(period)}</span>
          {COLUMNS.map(c => (
            <span key={c.key} role="columnheader" aria-sort={sort === c.key ? 'descending' : 'none'}>
              <button
                className={sort === c.key ? 'board__sort board__sort--on' : 'board__sort'}
                onClick={() => setSort(c.key)}
                aria-label={`Sort by ${c.title}`}
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>
        {rows.map((r, i) => (
          <button
            key={r.key}
            role="row"
            className={i < 3 ? `board__row board__row--top board__row--${i + 1}` : 'board__row'}
            onClick={() => setPlayerKey(r.key)}
          >
            <span role="cell" className="board__rank">
              {i + 1}
            </span>
            <span role="cell" className="board__name">
              {r.name}
            </span>
            {COLUMNS.map(c => (
              <span
                key={c.key}
                role="cell"
                className={`board__num board__num--${c.key}${sort === c.key ? ' board__num--on' : ''}`}
              >
                {r[c.key]}
              </span>
            ))}
          </button>
        ))}
      </div>

      <button
        className="btn btn--primary btn--whatsapp"
        disabled={!ready}
        onClick={() => ready && shareOrDownload(new File([ready.blob], fileName, { type: 'image/png' }))}
      >
        Send to WhatsApp
      </button>
      <button className="btn btn--ghost" onClick={copy}>
        {copied ? 'Copied!' : 'Copy as text'}
      </button>
      <p className="muted small leaders__note">
        Every scrimmage at full time adds here. Tap a name to see their scrimmages.
      </p>
    </div>
  );
}

type PlayerGamesProps = { player: Tally; rank: number; scrims: Match[]; onBack: () => void };

/** One player's all-time totals, then each scrimmage they played, month by month. */
function PlayerGames({ player, rank, scrims, onBack }: PlayerGamesProps) {
  const months = playerGames(scrims, player);
  return (
    <div className="panel leaders">
      <button className="btn btn--link score__back leaders__back" onClick={onBack}>
        ‹ Leaders
      </button>
      <div className="leaders__player">
        <span className={`leaders__badge leaders__badge--${Math.min(rank, 4)}`}>{rank}</span>
        <div>
          <h2 className="panel__title">{player.name}</h2>
          <p className="muted small">
            {rank === 1 ? 'Top scorer · all time' : `${ordinal(rank)} for goals · all time`}
          </p>
        </div>
      </div>
      <div className="leaders__totals">
        {COLUMNS.map(c => (
          <div key={c.key} className={`leaders__total board__num--${c.key}`}>
            <strong>{player[c.key]}</strong>
            <span>{c.title}</span>
          </div>
        ))}
      </div>

      <div className="board board--player" role="table" aria-label={`${player.name}'s scrimmages`}>
        <div className="board__row board__row--head" role="row">
          <span role="columnheader">Scrimmage by scrimmage</span>
          {COLUMNS.map(c => (
            <span key={c.key} role="columnheader">
              {c.label}
            </span>
          ))}
        </div>
        {months.map(([month, games]) => {
          const g = games.reduce((t, x) => t + x.goals, 0);
          const a = games.reduce((t, x) => t + x.assists, 0);
          return [
            <div key={month} role="row" className="board__row board__row--month">
              <span role="cell">{monthLong(month).split(' ')[0]}</span>
              <span role="cell" className="board__num board__num--goals">
                {g}
              </span>
              <span role="cell" className="board__num board__num--assists">
                {a}
              </span>
              <span role="cell" className="board__num board__num--points">
                {g + a}
              </span>
            </div>,
            ...games.map(x => (
              <div key={x.match.id} role="row" className="board__row">
                <span role="cell" className="board__game">
                  <span className="board__name">{x.title}</span>
                  <span className="muted small">
                    {[shortDate(x.match.details.date), resultOf(x.match)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span role="cell" className="board__num board__num--goals">
                  {x.goals}
                </span>
                <span role="cell" className="board__num board__num--assists">
                  {x.assists}
                </span>
                <span role="cell" className="board__num board__num--points">
                  {x.goals + x.assists}
                </span>
              </div>
            ))
          ];
        })}
      </div>
    </div>
  );
}
