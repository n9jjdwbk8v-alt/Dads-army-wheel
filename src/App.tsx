import { useState } from 'react';
import ShinyText from './components/reactbits/ShinyText';
import ClickSpark from './components/reactbits/ClickSpark';
import Backdrop from './components/Backdrop';
import PatchTabs, { FeesIcon, GameDayIcon, RosterIcon, TeamsIcon } from './components/PatchTabs';
import Roster from './components/Roster';
import Backup from './components/Backup';
import TeamsView from './components/TeamsView';
import GameDay from './components/GameDay';
import Fees from './components/Fees';
import { NEW_GAME_DAY, type GameDayState } from './lib/gameDay';
import { NEW_FEES, readFees, type FeesState } from './lib/fees';
import { NO_TEAMS, recordGame, todayKey, type GameRecord, type Player, type Teams } from './lib/teams';
import type { Backup as BackupData } from './lib/backup';
import { usePersistentState } from './lib/storage';
import './App.css';

type Tab = 'roster' | 'teams' | 'fees' | 'gameday';

export default function App() {
  const [players, setPlayers] = usePersistentState<Player[]>('dads-army:players', []);
  const [teams, setTeams] = usePersistentState<Teams>('dads-army:teams', NO_TEAMS);
  const [history, setHistory] = usePersistentState<GameRecord[]>('dads-army:history', []);
  const [gameDay, setGameDay] = usePersistentState<GameDayState>('dads-army:gameday', NEW_GAME_DAY);
  const [fees, setFees] = usePersistentState<FeesState>('dads-army:fees', NEW_FEES, readFees);
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
    if (backup.fees) setFees(backup.fees);
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
          <PatchTabs<Tab>
            tabs={[
              { value: 'roster', label: 'Roster', icon: <RosterIcon />, badge: players.length ? { text: String(present.length), spoken: `${present.length} here tonight` } : undefined },
              { value: 'teams', label: 'Teams', icon: <TeamsIcon /> },
              { value: 'fees', label: 'Fees', icon: <FeesIcon /> },
              { value: 'gameday', label: 'Game day', icon: <GameDayIcon /> }
            ]}
            value={tab}
            onChange={setTab}
            aria-label="Section"
          />
        </nav>

        {tab === 'roster' && (
          <Roster players={players} setPlayers={setPlayers}>
            <Backup players={players} history={history} fees={fees} onRestore={restore} />
          </Roster>
        )}
        {tab === 'teams' && <TeamsView present={present} teams={teams} recent={recent} onSplit={split} />}
        {tab === 'gameday' && (
          <GameDay players={players} setPlayers={setPlayers} gameDay={gameDay} setGameDay={setGameDay} />
        )}
        {tab === 'fees' && <Fees players={players} fees={fees} setFees={setFees} />}
      </main>

      <footer className="foot">Saved on this device · Lights vs Darks</footer>
    </ClickSpark>
  );
}
