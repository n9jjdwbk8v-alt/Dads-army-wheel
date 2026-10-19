import { useState } from 'react';
import ShinyText from './components/reactbits/ShinyText';
import RubberSegment from './components/reactbits/RubberSegment';
import ClickSpark from './components/reactbits/ClickSpark';
import Backdrop from './components/Backdrop';
import Roster from './components/Roster';
import Backup from './components/Backup';
import TeamsView from './components/TeamsView';
import { NO_TEAMS, recordGame, todayKey, type GameRecord, type Player, type Teams } from './lib/teams';
import type { Backup as BackupData } from './lib/backup';
import { usePersistentState } from './lib/storage';
import './App.css';

type Tab = 'roster' | 'teams';

export default function App() {
  const [players, setPlayers] = usePersistentState<Player[]>('dads-army:players', []);
  const [teams, setTeams] = usePersistentState<Teams>('dads-army:teams', NO_TEAMS);
  const [history, setHistory] = usePersistentState<GameRecord[]>('dads-army:history', []);
  const [tab, setTab] = useState<Tab>(() => (teams.light.length ? 'teams' : 'roster'));

  const present = players.filter(p => p.here);
  // Earlier game nights to avoid repeating; today's splits just replace each other.
  const today = todayKey();
  const recent = history.filter(g => g.date !== today);

  const split = (next: Teams) => {
    setTeams(next);
    setHistory(h => recordGame(h, next, today));
  };

  const restore = (backup: BackupData) => {
    setPlayers(() => backup.players);
    setHistory(backup.history);
    setTeams(NO_TEAMS);
  };

  return (
    <ClickSpark sparkColor={['#7bd64a', '#c8e66b', '#ffffff']} sparkCount={10} sparkRadius={22} className="spark-root">
      <Backdrop />

      <header className="hero">
        <img className="hero__logo" src="./logo.png" alt="Dads Army" width={467} height={520} />
        <ShinyText text="Team Picker" color="#d9e8c4" shineColor="#ffffff" speed={3} className="hero__sub" />
      </header>

      <main className="main">
        <nav className="tabs">
          <RubberSegment
            items={[
              { value: 'roster', label: `Roster (${present.length}/${players.length})` },
              { value: 'teams', label: 'Teams' }
            ]}
            value={tab}
            onChange={v => setTab(v as Tab)}
            trackColor="#e3f3e9"
            thumbColor="#0f5132"
            textColor="#0f5132"
            activeTextColor="#ffffff"
            aria-label="Section"
          />
        </nav>

        {tab === 'roster' ? (
          <Roster players={players} setPlayers={setPlayers}>
            <Backup players={players} history={history} onRestore={restore} />
          </Roster>
        ) : (
          <TeamsView present={present} teams={teams} recent={recent} onSplit={split} />
        )}
      </main>

      <footer className="foot">Saved on this device · Lights vs Darks</footer>
    </ClickSpark>
  );
}
