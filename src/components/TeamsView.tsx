import { useEffect, useRef, useState } from 'react';
import StarBorder from './reactbits/StarBorder';
import { isGoalie, splitTeams, TEAM_LABEL, type GameRecord, type Player, type Team, type Teams } from '../lib/teams';
import { drawTeamsGraphic, makeTeamsGif, GRAPHIC_DESIGNS, type GraphicDesign } from '../lib/teamGraphic';
import { usePersistentState } from '../lib/storage';

type TeamsViewProps = {
  present: Player[];
  teams: Teams;
  /** Earlier game nights, newest first, to avoid repeating. */
  recent: GameRecord[];
  onSplit: (t: Teams) => void;
};

const gameDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
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

type Rendered = { key: string; blob: Blob; url: string };

/** Renders a blob whenever `key` changes (while enabled), keeping an object URL for it alive until replaced. */
const useRendered = (key: string, enabled: boolean, render: () => Promise<Blob>) => {
  const [out, setOut] = useState<Rendered | null>(null);
  const renderRef = useRef(render);
  const urlRef = useRef('');
  useEffect(() => {
    renderRef.current = render;
  });
  useEffect(() => () => URL.revokeObjectURL(urlRef.current), []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    renderRef.current().then(blob => {
      if (cancelled) return;
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setOut({ key, blob, url: urlRef.current });
    });
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);
  return out;
};

export default function TeamsView({ present, teams, recent, onSplit }: TeamsViewProps) {
  const [copied, setCopied] = useState(false);
  const [savedDesign, setDesign] = usePersistentState<GraphicDesign>('dads-army:graphic-design', 'rink');
  const design = GRAPHIC_DESIGNS.some(d => d.value === savedDesign) ? savedDesign : 'rink';
  const hasTeams = teams.light.length + teams.dark.length > 0;
  const enough = present.length >= 2;
  // Teams go stale if someone was ticked in or out after the split.
  const stale = hasTeams && idsKey(present) !== idsKey([...teams.light, ...teams.dark]);
  const ready = hasTeams && !stale;
  const key = `${idsKey(teams.light)}|${idsKey(teams.dark)}|${design}`;

  const animated = GRAPHIC_DESIGNS.some(d => d.value === design && d.animated);
  const picture = useRendered(key, ready, () => (animated ? makeTeamsGif : drawTeamsGraphic)(teams, design));
  // Only share a picture made for the teams and style currently chosen; an older one is just a placeholder.
  const shareable = ready && picture?.key === key ? picture : null;
  const fileName = `dads-army-teams.${animated ? 'gif' : 'png'}`;

  const download = () => {
    if (!shareable) return;
    const a = document.createElement('a');
    a.href = shareable.url;
    a.download = fileName;
    a.click();
  };

  const shareImage = async () => {
    if (!shareable) return;
    const file = new File([shareable.blob], fileName, { type: shareable.blob.type });
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
            onClick={() => onSplit(splitTeams(present, recent))}
          >
            {hasTeams && !stale ? 'Reshuffle' : 'Split teams'}
          </StarBorder>
        </div>
        {enough && recent.length > 0 && (
          <p className="muted small">Mixes things up from your last game ({gameDate(recent[0].date)}) where it can.</p>
        )}
        {stale && <p className="notice">Who's here has changed since these teams were made. Split again.</p>}
      </div>

      {ready && picture && (
        <div className="panel graphic">
          <p className="graphic__label">Picture style</p>
          <div className="chips" role="group" aria-label="Picture style">
            {GRAPHIC_DESIGNS.map(d => (
              <button
                key={d.value}
                className={d.value === design ? 'chip chip--on' : 'chip'}
                aria-pressed={d.value === design}
                onClick={() => setDesign(d.value)}
              >
                {d.label}
                {d.animated && <span className="chip__tag">GIF</span>}
              </button>
            ))}
          </div>
          <img
            src={picture.url}
            alt="Lights vs Darks team picture"
            className={shareable ? 'graphic__img' : 'graphic__img graphic__img--updating'}
          />
          <button className="btn btn--primary btn--whatsapp" onClick={shareImage} disabled={!shareable}>
            {shareable || !animated ? 'Send to WhatsApp' : 'Making GIF…'}
          </button>
          <p className="muted small">Tip: on a phone you can also press and hold the picture to save or share it.</p>
          <div className="split__actions">
            <button className="btn btn--ghost" onClick={download} disabled={!shareable}>
              Download {animated ? 'GIF' : 'image'}
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
