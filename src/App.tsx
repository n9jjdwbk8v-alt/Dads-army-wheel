import { useState } from 'react';
import PixelSnow from './components/reactbits/PixelSnow';
import SplitText from './components/reactbits/SplitText';
import ShinyText from './components/reactbits/ShinyText';
import RubberSegment from './components/reactbits/RubberSegment';
import ClickSpark from './components/reactbits/ClickSpark';
import Roster from './components/Roster';
import TeamsView from './components/TeamsView';
import { NO_TEAMS, type Player, type Teams } from './lib/teams';
import { usePersistentState } from './lib/storage';
import './App.css';

type Tab = 'roster' | 'teams';

export default function App() {
  const [players, setPlayers] = usePersistentState<Player[]>('dads-army:players', []);
  const [teams, setTeams] = usePersistentState<Teams>('dads-army:teams', NO_TEAMS);
  const [tab, setTab] = useState<Tab>(() => (teams.light.length ? 'teams' : 'roster'));

  const present = players.filter(p => p.here);

  return (
    <ClickSpark sparkColor={['#2e9e5b', '#a3e635', '#0f5132']} sparkCount={10} sparkRadius={22} className="spark-root">
      <header className="hero">
        <PixelSnow className="hero__snow" color="#ffffff" density={0.35} speed={0.6} variant="snowflake" />
        <div className="hero__content">
          <SplitText text="DADS ARMY" tag="h1" className="hero__title" effect="rise" splitType="chars" trigger="load" />
          <ShinyText text="Team Picker" color="#cfeedd" shineColor="#ffffff" speed={3} className="hero__sub" />
        </div>
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
          <Roster players={players} setPlayers={setPlayers} />
        ) : (
          <TeamsView present={present} teams={teams} setTeams={setTeams} />
        )}
      </main>

      <footer className="foot">Saved on this device · Light vs Dark</footer>
    </ClickSpark>
  );
}
