import { useState } from 'react';
import PixelSnow from './components/reactbits/PixelSnow';
import SplitText from './components/reactbits/SplitText';
import ShinyText from './components/reactbits/ShinyText';
import RubberSegment from './components/reactbits/RubberSegment';
import ClickSpark from './components/reactbits/ClickSpark';
import Roster from './components/Roster';
import Draft from './components/Draft';
import { EMPTY_DRAFT, type DraftState, type Player } from './lib/draft';
import { usePersistentState } from './lib/storage';
import './App.css';

type Tab = 'roster' | 'draft';

export default function App() {
  const [players, setPlayers] = usePersistentState<Player[]>('dads-army:players', []);
  const [draft, setDraft] = usePersistentState<DraftState>('dads-army:draft', EMPTY_DRAFT);
  const [showSkill, setShowSkill] = usePersistentState('dads-army:show-skill', true);
  const [tab, setTab] = useState<Tab>(() => (draft.tiers.length ? 'draft' : 'roster'));

  const present = players.filter(p => p.here);

  return (
    <ClickSpark sparkColor={['#2e9e5b', '#a3e635', '#0f5132']} sparkCount={10} sparkRadius={22} className="spark-root">
      <header className="hero">
        <PixelSnow className="hero__snow" color="#ffffff" density={0.35} speed={0.6} variant="snowflake" />
        <div className="hero__content">
          <SplitText text="DADS ARMY" tag="h1" className="hero__title" effect="rise" splitType="chars" trigger="load" />
          <ShinyText text="Team Picker Wheel" color="#cfeedd" shineColor="#ffffff" speed={3} className="hero__sub" />
        </div>
      </header>

      <main className="main">
        <nav className="tabs">
          <RubberSegment
            items={[
              { value: 'roster', label: `Roster (${present.length}/${players.length})` },
              { value: 'draft', label: 'Pick teams' }
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
          <Draft
            present={present}
            draft={draft}
            setDraft={setDraft}
            showSkill={showSkill}
            setShowSkill={setShowSkill}
          />
        )}
      </main>

      <footer className="foot">Saved on this device · Light vs Dark</footer>
    </ClickSpark>
  );
}
