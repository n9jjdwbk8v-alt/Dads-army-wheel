import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { BombIcon } from '@hugeicons/core-free-icons';
import SwipeRow from './reactbits/SwipeRow';
import { useRendered } from './useRendered';
import { copyText, download as downloadFile, shareOrDownload } from '../lib/share';
import { isGoalie, splitTeams, stackTeams, TEAM_LABEL, type GameRecord, type Player, type Team, type Teams } from '../lib/teams';
import {
  drawTeamsGraphic,
  drawTeamsThumbnail,
  makeTeamsGif,
  playTeamsAnimation,
  GRAPHIC_DESIGNS,
  type GraphicDesign
} from '../lib/teamGraphic';
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
  return `🏒 Dads Army — ${date}${t.danSmith ? '\n💣 DAN SMITH MODE' : ''}\n\n${line('light', t.light)}\n${line('dark', t.dark)}`;
};

const idsKey = (players: Player[]) =>
  players
    .map(p => p.id)
    .sort()
    .join();

export default function TeamsView({ present, teams, recent, onSplit }: TeamsViewProps) {
  const [copied, setCopied] = useState(false);
  // Bumped after Dan Smith mode so the classified strip comes back closed.
  const [classified, setClassified] = useState(0);
  const [savedDesign, setDesign] = usePersistentState<GraphicDesign>('dads-army:graphic-design', 'rink');
  const design = GRAPHIC_DESIGNS.some(d => d.value === savedDesign) ? savedDesign : 'rink';
  const hasTeams = teams.light.length + teams.dark.length > 0;
  const enough = present.length >= 2;
  // Teams go stale if someone was ticked in or out after the split.
  const stale = hasTeams && idsKey(present) !== idsKey([...teams.light, ...teams.dark]);
  const ready = hasTeams && !stale;
  const teamsKey = `${teams.danSmith ? 'dan-smith|' : ''}${idsKey(teams.light)}|${idsKey(teams.dark)}`;
  const key = `${teamsKey}|${design}`;
  const animated = GRAPHIC_DESIGNS.some(d => d.value === design && d.animated);

  // Mini previews of every style with tonight's teams, filled in one at a time.
  const [thumbs, setThumbs] = useState<{ key: string; urls: Partial<Record<GraphicDesign, string>> }>({
    key: '',
    urls: {}
  });
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const urls: Partial<Record<GraphicDesign, string>> = {};
      for (const d of GRAPHIC_DESIGNS) {
        urls[d.value] = await drawTeamsThumbnail(teams, d.value);
        if (cancelled) return;
        setThumbs({ key: teamsKey, urls: { ...urls } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teams, teamsKey, ready]);
  const thumbUrls = thumbs.key === teamsKey ? thumbs.urls : {};
  // The preview is always the finished still; an animated style also builds its GIF for sending.
  const picture = useRendered(key, ready, () => drawTeamsGraphic(teams, design));
  const gif = useRendered(key, ready && animated, () => makeTeamsGif(teams, design));
  const toSend = animated ? gif : picture;
  // Only share a picture made for the teams and style currently chosen; an older one is just a placeholder.
  const shareable = ready && toSend?.key === key ? toSend : null;
  const fileName = `dads-army-teams.${animated ? 'gif' : 'png'}`;

  // Plays an animated style in place over the preview.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const playing = playingKey === key;
  useEffect(() => () => stopRef.current?.(), [key]);
  const play = async () => {
    if (!canvasRef.current || playing) return;
    setPlayingKey(key);
    stopRef.current?.();
    stopRef.current = await playTeamsAnimation(canvasRef.current, teams, design, () => setPlayingKey(null));
  };

  const file = () => shareable && new File([shareable.blob], fileName, { type: shareable.blob.type });
  const download = () => {
    const f = file();
    if (f) downloadFile(f);
  };
  const shareImage = () => {
    const f = file();
    if (f) shareOrDownload(f);
  };
  const copy = async () => {
    if (await copyText(shareText(teams))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
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
          <button
            className="btn btn--primary cta"
            disabled={!enough}
            onClick={() => onSplit(splitTeams(present, recent))}
          >
            {hasTeams && !stale ? 'Reshuffle' : 'Split teams'}
          </button>
        </div>
        {enough && recent.length > 0 && (
          <p className="muted small">Mixes things up from your last game ({gameDate(recent[0].date)}) where it can.</p>
        )}
        {enough && (
          // A faint classified badge: swipe left to right inside it to fill it with Dan Smith mode, then tap.
          <div className="classified">
            <SwipeRow
              key={classified}
              label="Classified"
              direction="right"
              height={38}
              radius={2}
              actionWidth={220}
              fullSwipe={false}
              rowColor="#151d10"
              drawerColor="#151d10"
              actionColor="#c4321f"
              textColor="#e6f0d6"
              actions={[
                {
                  id: 'dan-smith',
                  label: 'Dan Smith mode',
                  icon: <HugeiconsIcon icon={BombIcon} size={16} strokeWidth={2} />
                }
              ]}
              onCommit={() => {
                onSplit(stackTeams(present));
                setClassified(c => c + 1);
              }}
            >
              <span className="classified__word">Classified</span>
            </SwipeRow>
          </div>
        )}
        {stale && <p className="notice">Who's here has changed since these teams were made. Split again.</p>}
      </div>

      {ready && picture && (
        <div className="panel graphic">
          <div className="graphic__frame">
            <img
              src={picture.url}
              alt="Lights vs Darks team picture"
              className={picture.key === key ? 'graphic__img' : 'graphic__img graphic__img--updating'}
              hidden={playing}
            />
            <canvas ref={canvasRef} className="graphic__img" hidden={!playing} aria-label="Animated team picture" />
            {animated && !playing && (
              <button className="graphic__play" onClick={play} aria-label="Play animation">
                <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                </svg>
              </button>
            )}
            {animated && <span className="graphic__badge">GIF</span>}
          </div>
          <p className="graphic__label">Choose a style</p>
          <div className="thumbs" role="radiogroup" aria-label="Picture style">
            {GRAPHIC_DESIGNS.map(d => (
              <button
                key={d.value}
                role="radio"
                aria-checked={d.value === design}
                className={d.value === design ? 'thumb thumb--on' : 'thumb'}
                onClick={() => setDesign(d.value)}
              >
                <span className="thumb__img">
                  {thumbUrls[d.value] && <img src={thumbUrls[d.value]} alt="" />}
                  {d.animated && <span className="thumb__gif">GIF</span>}
                </span>
                <span className="thumb__label">{d.label}</span>
              </button>
            ))}
          </div>
          <button className="btn btn--primary btn--whatsapp" onClick={shareImage} disabled={!shareable}>
            {shareable || !animated ? 'Send to WhatsApp' : 'Making GIF…'}
          </button>
          <p className="muted small">Tip: on a phone you can also press and hold the picture to save or share it.</p>
          <div className="split__actions">
            <button className="btn btn--ghost" onClick={download} disabled={!shareable}>
              Download {animated ? 'GIF' : 'image'}
            </button>
            <button className="btn btn--ghost" onClick={copy}>
              {copied ? 'Copied!' : 'Copy as text'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
