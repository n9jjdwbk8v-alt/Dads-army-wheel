import { useEffect, useRef, useState } from 'react';
import StarBorder from './reactbits/StarBorder';
import SpotlightCard from './reactbits/SpotlightCard';
import { isGoalie, splitTeams, TEAM_LABEL, type Player, type Team, type Teams } from '../lib/teams';
import RubberSegment from './reactbits/RubberSegment';
import { drawTeamsGraphic, GRAPHIC_BACKGROUNDS, type GraphicBackground } from '../lib/teamGraphic';
import { usePersistentState } from '../lib/storage';

type TeamsViewProps = {
  present: Player[];
  teams: Teams;
  setTeams: (t: Teams) => void;
};

const shareText = (t: Teams) => {
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const line = (team: Team, players: Player[]) =>
    `${team === 'light' ? '⚪' : '🟢'} ${TEAM_LABEL[team].toUpperCase()} (${players.length}): ${players.map(p => (isGoalie(p) ? `${p.name} (G)` : p.name)).join(', ')}`;
  return `🏒 Dads Army — ${date}\n\n${line('light', t.light)}\n${line('dark', t.dark)}`;
};

const idsKey = (players: Player[]) =>
  players
    .map(p => p.id)
    .sort()
    .join();

export default function TeamsView({ present, teams, setTeams }: TeamsViewProps) {
  const [copied, setCopied] = useState(false);
  const [drawn, setDrawn] = useState<{ key: string; blob: Blob; url: string } | null>(null);
  const [background, setBackground] = usePersistentState<GraphicBackground>('dads-army:graphic-bg', 'woodland');
  const hasTeams = teams.light.length + teams.dark.length > 0;
  const enough = present.length >= 2;
  // Teams go stale if someone was ticked in or out after the split.
  const stale = hasTeams && idsKey(present) !== idsKey([...teams.light, ...teams.dark]);
  const ready = hasTeams && !stale;
  const teamsKey = `${idsKey(teams.light)}|${idsKey(teams.dark)}|${background}`;
  // Only share a graphic drawn for the teams and background currently chosen; an older one is just a placeholder.
  const graphic = ready && drawn?.key === teamsKey ? drawn : null;

  const urlRef = useRef('');
  useEffect(() => () => URL.revokeObjectURL(urlRef.current), []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    drawTeamsGraphic(teams, background).then(blob => {
      if (cancelled) return;
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setDrawn({ key: teamsKey, blob, url: urlRef.current });
    });
    return () => {
      cancelled = true;
    };
  }, [teams, background, teamsKey, ready]);

  const download = () => {
    if (!graphic) return;
    const a = document.createElement('a');
    a.href = graphic.url;
    a.download = 'dads-army-teams.png';
    a.click();
  };

  const shareImage = async () => {
    if (!graphic) return;
    const file = new File([graphic.blob], 'dads-army-teams.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    download();
  };

  const copyText = async () => {
    const text = shareText(teams);
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
            ? 'Goalies (skill 0) are shared one per team, then skaters are split as evenly as possible on skill.'
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
        </div>
        {stale && <p className="notice">Who's here has changed since these teams were made. Split again.</p>}
      </div>

      {hasTeams && (
        <div key={idsKey(teams.light)} className={stale ? 'teams teams--stale' : 'teams'}>
          <TeamCard team="light" players={teams.light} />
          <TeamCard team="dark" players={teams.dark} />
        </div>
      )}

      {ready && drawn && (
        <div className="panel graphic">
          <p className="graphic__label">Picture background</p>
          <RubberSegment
            items={GRAPHIC_BACKGROUNDS}
            value={background}
            onChange={v => setBackground(v as GraphicBackground)}
            size="sm"
            trackColor="#e3f3e9"
            thumbColor="#0f5132"
            textColor="#0f5132"
            activeTextColor="#ffffff"
            aria-label="Picture background"
          />
          <img
            src={drawn.url}
            alt="Lights vs Darks team graphic"
            className={graphic ? 'graphic__img' : 'graphic__img graphic__img--updating'}
          />
          <button className="btn btn--primary btn--whatsapp" onClick={shareImage} disabled={!graphic}>
            Send to WhatsApp
          </button>
          <p className="muted small">Tip: on a phone you can also press and hold the picture to save or share it.</p>
          <div className="split__actions">
            <button className="btn btn--ghost" onClick={download} disabled={!graphic}>
              Download image
            </button>
            <button className="btn btn--ghost" onClick={copyText}>
              {copied ? 'Copied!' : 'Copy as text'}
            </button>
          </div>
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
          <li key={p.id}>
            {p.name}
            {isGoalie(p) && (
              <span className="goalie-tag" title="Goalie">
                G
              </span>
            )}
          </li>
        ))}
      </ol>
    </SpotlightCard>
  );
}
