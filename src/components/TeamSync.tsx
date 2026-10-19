import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useConfirmTap } from './useConfirmTap';
import type { SyncStatus, useTeamSync } from './useTeamSync';
import { shareText } from '../lib/share';
import { cleanCode, loadTeam, validCode, type Remote } from '../lib/sync';

type TeamSyncProps = {
  team: ReturnType<typeof useTeamSync>;
  playerCount: number;
  /** A code from an invite link, looked up straight away. */
  invite?: string;
};

type Step = { kind: 'join'; code: string; team: Remote; players: number } | { kind: 'create'; code: string };

const STATUS: Record<Exclude<SyncStatus, 'off'>, string> = {
  saving: 'Saving online…',
  saved: 'Saved online',
  offline: "Offline — changes are kept on this phone and go online when you're back.",
  unavailable: "Online saving isn't switched on for this site yet.",
  error: "Couldn't reach the team save — it'll keep trying."
};

const timeOf = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

export default function TeamSync({ team, playerCount, invite }: TeamSyncProps) {
  const [code, setCode] = useState(invite ?? '');
  const [step, setStep] = useState<Step | null>(null);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [armed, confirmTap] = useConfirmTap();
  const { sync, status } = team;

  const lookup = async (raw: string) => {
    const wanted = cleanCode(raw);
    setStep(null);
    if (!validCode(wanted)) {
      setMessage('Team codes are 6 to 32 letters, numbers or dashes, like DADSARMY-24.');
      return;
    }
    setChecking(true);
    setMessage('');
    try {
      const result = await loadTeam(wanted);
      if (result.status === 'found') {
        const players = Array.isArray(result.team.data.players) ? result.team.data.players.length : 0;
        if (playerCount === 0) team.join(wanted, result.team);
        else setStep({ kind: 'join', code: wanted, team: result.team, players });
      } else if (result.status === 'missing') setStep({ kind: 'create', code: wanted });
      else if (result.status === 'unavailable')
        setMessage(
          "Online saving isn't switched on for this site yet. Connect Upstash Redis to the project in Vercel (Storage) and it'll start working."
        );
      else setMessage('Something went wrong reaching the team save. Try again in a minute.');
    } catch {
      setMessage("You look to be offline. Try again when you've got signal.");
    } finally {
      setChecking(false);
    }
  };

  // An invite link fills in the code and looks it up once.
  const looked = useRef(false);
  const lookupRef = useRef(lookup);
  useLayoutEffect(() => {
    lookupRef.current = lookup;
  });
  useEffect(() => {
    if (!invite || looked.current || sync.code) return;
    looked.current = true;
    void lookupRef.current(invite);
  }, [invite, sync.code]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void lookup(code);
  };

  const invitePlayers = async () => {
    const link = `${location.origin}${location.pathname}?team=${encodeURIComponent(sync.code)}`;
    const result = await shareText(
      `🏒 Dads Army team picker — tap to join the team on your phone:\n${link}\n\nTeam code: ${sync.code}`
    );
    if (result === 'copied') setMessage('Invite copied — paste it into WhatsApp.');
  };

  if (sync.code) {
    return (
      <section className="backup team-sync">
        <p className="backup__title">Team save</p>
        <p className="team-sync__code">{sync.code}</p>
        <p className={`team-sync__status team-sync__status--${status}`} role="status">
          <span className="team-sync__dot" aria-hidden="true" />
          {status === 'off' ? '' : STATUS[status]}
          {status === 'saved' && sync.at ? ` · ${timeOf(sync.at)}` : ''}
        </p>
        <p className="muted small">
          Everything here saves online under this code. Open the site on another phone and enter it to pick up the same
          team. Anyone with the code can make changes, so only share it with the team.
        </p>
        <div className="backup__actions">
          <button className="btn btn--ghost" onClick={invitePlayers}>
            Share invite link
          </button>
          <button
            className={armed === 'disconnect' ? 'btn btn--danger' : 'btn btn--ghost'}
            onClick={() => {
              if (confirmTap('disconnect')) {
                team.disconnect();
                setMessage('This phone has stopped saving online. Everything stays saved here.');
              }
            }}
          >
            {armed === 'disconnect' ? 'Tap again to stop' : 'Stop saving online'}
          </button>
        </div>
        {message && <p className="backup__message">{message}</p>}
      </section>
    );
  }

  return (
    <section className="backup team-sync">
      <p className="backup__title">Team save</p>
      <p className="muted small">
        Save everything online under a team code, so it's safe if a phone is lost and can be opened on other phones.
        Enter a new code to start a team, or an existing one to join it.
      </p>
      <form className="team-sync__form" onSubmit={submit}>
        <input
          className="text-input team-sync__input"
          value={code}
          onChange={e => setCode(cleanCode(e.target.value))}
          placeholder="e.g. DADSARMY-24"
          aria-label="Team code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
        />
        <button className="btn btn--primary" type="submit" disabled={checking || !code}>
          {checking ? 'Checking…' : 'Go'}
        </button>
      </form>

      {step?.kind === 'join' && (
        <div className="backup__confirm">
          <p className="backup__message">
            Team {step.code} has {step.players} player{step.players === 1 ? '' : 's'} saved online. Load them onto this
            phone? This replaces the {playerCount} player{playerCount === 1 ? '' : 's'} saved here.
          </p>
          <div className="backup__actions">
            <button
              className="btn btn--primary"
              onClick={() => {
                team.join(step.code, step.team);
                setStep(null);
              }}
            >
              Load team
            </button>
            <button className="btn btn--ghost" onClick={() => setStep(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {step?.kind === 'create' && (
        <div className="backup__confirm">
          <p className="backup__message">
            No team called {step.code} yet. Start it with the {playerCount} player{playerCount === 1 ? '' : 's'} on this
            phone? Pick something the team will remember but others won't guess.
          </p>
          <div className="backup__actions">
            <button
              className="btn btn--primary"
              onClick={() => {
                team.create(step.code);
                setStep(null);
              }}
            >
              Start team
            </button>
            <button className="btn btn--ghost" onClick={() => setStep(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && <p className="backup__message">{message}</p>}
    </section>
  );
}
