import { useEffect, useRef, useState } from 'react';
import Wheel, { type WheelHandle } from './Wheel';
import StarBorder from './reactbits/StarBorder';
import SpotlightCard from './reactbits/SpotlightCard';
import CountUp from './reactbits/CountUp';
import {
  applySwap,
  bestSwap,
  finishDraft,
  isComplete,
  nextTeam,
  pickPlayer,
  startDraft,
  TEAM_LABEL,
  totalSkill,
  type DraftState,
  type Player,
  type Team
} from '../lib/draft';

type DraftProps = {
  present: Player[];
  draft: DraftState;
  setDraft: (d: DraftState) => void;
  showSkill: boolean;
  setShowSkill: (v: boolean) => void;
};

const shareText = (d: DraftState) => {
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const line = (team: Team, players: Player[]) =>
    `${team === 'light' ? '⚪' : '🟢'} ${TEAM_LABEL[team].toUpperCase()} (${players.length}): ${players.map(p => p.name).join(', ')}`;
  return `🏒 Dads Army — ${date}\n\n${line('light', d.light)}\n${line('dark', d.dark)}`;
};

export default function Draft({ present, draft, setDraft, showSkill, setShowSkill }: DraftProps) {
  const wheelRef = useRef<WheelHandle>(null);
  const [spinning, setSpinning] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [copied, setCopied] = useState(false);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const started = draft.tiers.length > 0;
  const complete = isComplete(draft);
  const upNext = nextTeam(draft);
  const last = draft.log[draft.log.length - 1];
  const swap = complete ? bestSwap(draft.light, draft.dark) : null;

  const pause = (ms: number) => new Promise(r => window.setTimeout(r, ms));

  const spinOnce = async (ms?: number) => {
    const wheel = wheelRef.current;
    if (!wheel) return false;
    const player = await wheel.spin(ms);
    await pause(ms && ms < 2500 ? 450 : 900);
    const next = pickPlayer(draftRef.current, player.id);
    draftRef.current = next;
    setDraft(next);
    return next.pool.length > 0;
  };

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await spinOnce();
    } finally {
      setSpinning(false);
    }
  };

  const spinRest = async () => {
    if (spinning) return;
    setSpinning(true);
    setAutoSpin(true);
    try {
      // Let React render each new pool before the next spin.
      while (await spinOnce(1600)) await pause(120);
    } finally {
      setSpinning(false);
      setAutoSpin(false);
    }
  };

  const share = async () => {
    const text = shareText(draft);
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

  if (!started) {
    const enough = present.length >= 2;
    return (
      <section className="panel panel--center">
        <h2 className="panel__title">Ready to pick?</h2>
        <p className="muted">
          {present.length} player{present.length === 1 ? '' : 's'} ticked in. Players are sorted by skill into tiers of
          four; the wheel picks who goes where within each tier, and the team that's behind gets first pick.
        </p>
        <StarBorder
          theme="light"
          color="#2e9e5b"
          backgroundColor="#0f5132"
          textColor="#ffffff"
          className="cta"
          disabled={!enough}
          onClick={() => setDraft(startDraft(present))}
        >
          Start the draft
        </StarBorder>
        {!enough && <p className="muted small">Tick at least 2 players on the Roster tab.</p>}
      </section>
    );
  }

  return (
    <section className="draft">
      <div className="draft__wheel panel">
        {!complete ? (
          <>
            <p className="draft__status">
              Tier {draft.tier + 1} of {draft.tiers.length} · next pick to{' '}
              <span className={`pill pill--${upNext}`}>{upNext && TEAM_LABEL[upNext]}</span>
            </p>
            <Wheel ref={wheelRef} players={draft.pool} showSkill={showSkill} />
            <div className="draft__controls">
              <StarBorder
                theme="light"
                color="#a3e635"
                backgroundColor="#0f5132"
                textColor="#ffffff"
                className="cta"
                disabled={spinning}
                onClick={spin}
              >
                {spinning && !autoSpin ? 'Spinning…' : 'Spin!'}
              </StarBorder>
              <button className="btn btn--ghost" onClick={spinRest} disabled={spinning}>
                {autoSpin ? 'Auto-spinning…' : 'Spin the rest'}
              </button>
              <button className="btn btn--ghost" onClick={() => setDraft(finishDraft(draft))} disabled={spinning}>
                Instant split
              </button>
            </div>
          </>
        ) : (
          <div className="draft__done">
            <h2 className="panel__title">Teams are set 🏒</h2>
            {swap && swap.gapBefore > 0 && (
              <div className="swap">
                <p>
                  Skill gap is <strong>{swap.gapBefore}</strong>. Swapping <strong>{swap.light.name}</strong> ↔{' '}
                  <strong>{swap.dark.name}</strong> would make it {swap.gapAfter}.
                </p>
                <button className="btn btn--primary" onClick={() => setDraft(applySwap(draft, swap))}>
                  Even it up
                </button>
              </div>
            )}
            <div className="draft__controls">
              <StarBorder
                theme="light"
                color="#a3e635"
                backgroundColor="#0f5132"
                textColor="#ffffff"
                className="cta"
                onClick={share}
              >
                {copied ? 'Copied!' : 'Share teams'}
              </StarBorder>
            </div>
          </div>
        )}
        {last && !complete && (
          <p className="draft__last" key={draft.log.length}>
            {last.player.name} → <span className={`pill pill--${last.team}`}>{TEAM_LABEL[last.team]}</span>
            {last.auto && <span className="muted small"> (last in tier)</span>}
          </p>
        )}
        <div className="draft__footer">
          <label className="toggle">
            <input type="checkbox" checked={showSkill} onChange={e => setShowSkill(e.target.checked)} />
            Show ratings
          </label>
          <button
            className="btn btn--link"
            disabled={spinning}
            onClick={() => setDraft(startDraft(present))}
          >
            Redo draft
          </button>
        </div>
      </div>

      <div className="teams">
        <TeamCard team="light" players={draft.light} showSkill={showSkill} />
        <TeamCard team="dark" players={draft.dark} showSkill={showSkill} />
      </div>
    </section>
  );
}

function TeamCard({ team, players, showSkill }: { team: Team; players: Player[]; showSkill: boolean }) {
  const dark = team === 'dark';
  const total = totalSkill(players);
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
      {showSkill && (
        <div className="team__total">
          <CountUp to={total} duration={0.8} trigger="load" />
          <span className="team__total-label">total skill</span>
        </div>
      )}
      <ol className="team__list">
        {players.map(p => (
          <li key={p.id}>
            <span>{p.name}</span>
            {showSkill && <span className="team__skill">{p.skill}</span>}
          </li>
        ))}
        {!players.length && <li className="team__empty">Waiting for the wheel…</li>}
      </ol>
    </SpotlightCard>
  );
}
