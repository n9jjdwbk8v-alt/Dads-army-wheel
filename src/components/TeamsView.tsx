import { useState } from 'react';
import StarBorder from './reactbits/StarBorder';
import SpotlightCard from './reactbits/SpotlightCard';
import { splitTeams, TEAM_LABEL, type Player, type Team, type Teams } from '../lib/teams';

type TeamsViewProps = {
  present: Player[];
  teams: Teams;
  setTeams: (t: Teams) => void;
};

const shareText = (t: Teams) => {
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const line = (team: Team, players: Player[]) =>
    `${team === 'light' ? '⚪' : '🟢'} ${TEAM_LABEL[team].toUpperCase()} (${players.length}): ${players.map(p => p.name).join(', ')}`;
  return `🏒 Dads Army — ${date}\n\n${line('light', t.light)}\n${line('dark', t.dark)}`;
};

const idsKey = (players: Player[]) =>
  players
    .map(p => p.id)
    .sort()
    .join();

export default function TeamsView({ present, teams, setTeams }: TeamsViewProps) {
  const [copied, setCopied] = useState(false);
  const hasTeams = teams.light.length + teams.dark.length > 0;
  const enough = present.length >= 2;
  // Teams go stale if someone was ticked in or out after the split.
  const stale = hasTeams && idsKey(present) !== idsKey([...teams.light, ...teams.dark]);

  const share = async () => {
    const text = shareText(teams);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      // Share sheet dismissed — fall through to copying.
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt('Copy the teams:', text);
    }
  };

  return (
    <section className="split">
      <div className="panel panel--center">
        <p className="muted">
          {present.length} player{present.length === 1 ? '' : 's'} here tonight.{' '}
          {enough
            ? 'Teams are split as evenly as possible on skill.'
            : 'Tick at least 2 players on the Roster tab.'}
        </p>
        <div className="split__actions">
          <StarBorder
            theme="light"
            color="#a3e635"
            backgroundColor="#0f5132"
            textColor="#ffffff"
            className="cta"
            disabled={!enough}
            onClick={() => setTeams(splitTeams(present))}
          >
            {hasTeams && !stale ? 'Reshuffle' : 'Split teams'}
          </StarBorder>
          {hasTeams && !stale && (
            <button className="btn btn--ghost" onClick={share}>
              {copied ? 'Copied!' : 'Share teams'}
            </button>
          )}
        </div>
        {stale && <p className="notice">Who's here has changed since these teams were made. Split again.</p>}
      </div>

      {hasTeams && (
        <div key={idsKey(teams.light)} className={stale ? 'teams teams--stale' : 'teams'}>
          <TeamCard team="light" players={teams.light} />
          <TeamCard team="dark" players={teams.dark} />
        </div>
      )}
    </section>
  );
}

function TeamCard({ team, players }: { team: Team; players: Player[] }) {
  const dark = team === 'dark';
  return (
    <SpotlightCard
      theme={dark ? 'dark' : 'light'}
      spotlightColor={dark ? 'rgba(163, 230, 53, 0.35)' : 'rgba(46, 158, 91, 0.25)'}
      className={`team team--${team}`}
      style={
        {
          '--spotlight-card-surface': dark ? '#0f5132' : '#ffffff',
          '--spotlight-card-border': dark ? '#1f8a4c' : '#b9e2c8'
        } as React.CSSProperties
      }
    >
      <header className="team__head">
        <h3>{TEAM_LABEL[team]}</h3>
        <span className="team__count">{players.length} players</span>
      </header>
      <ol className="team__list">
        {players.map(p => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ol>
    </SpotlightCard>
  );
}
