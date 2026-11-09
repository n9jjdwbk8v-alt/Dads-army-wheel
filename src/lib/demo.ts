import type { GameDayState } from './gameDay';
import { addGoal, addPenalty, saveSquad, type Match } from './matches';
import type { Period } from './scoreSheet';
import { todayKey, type Player } from './teams';

// Made-up names for trying the app out. Two are goalies (rated 0).
const NAMES: [string, number, Player['position']?][] = [
  ['Sam Hart', 8, 'F'],
  ['Rob Kerr', 7, 'F'],
  ['Lee Moss', 6, 'F'],
  ['Joe Bloggs', 5, 'F'],
  ['Dan Smith', 4, 'F'],
  ['Cal Webb', 6, 'F'],
  ['Nik Shah', 5, 'F'],
  ['Pete Ward', 3, 'F'],
  ['Ben Ford', 7, 'D'],
  ['Tom Lee', 6, 'D'],
  ['Ali Khan', 5, 'D'],
  ['Max Ray', 4, 'D'],
  ['Ed Price', 3, 'D'],
  ['Ray Cole', 5, 'F'],
  ['Gus Goal', 0],
  ['Kev Pads', 0]
];

/**
 * Fills an empty phone with sample players, a game day against "Ice Wolves" and that game part-way through the
 * 2nd period, so every screen has something on it. Opened with ?demo on the address. It does nothing on a phone
 * that already has a roster, so it can never overwrite real data.
 */
export const loadDemo = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('dads-army:players') ?? '[]');
    if (Array.isArray(saved) && saved.length) return;

    const players: Player[] = NAMES.map(([name, skill, position], i) => ({
      id: `demo-${i}`,
      name,
      skill,
      here: i < 14,
      ...(position ? { position } : {})
    }));
    // Everyone but two skaters is available, including the first goalie.
    const available = players.filter(p => !['Ray Cole', 'Ed Price', 'Kev Pads'].includes(p.name));
    const gameDay: GameDayState = {
      kind: 'game',
      opponent: 'Ice Wolves',
      date: todayKey(),
      time: '19:30',
      venue: 'Planet Ice',
      available: available.map(p => p.id),
      style: 'balanced'
    };

    let [match] = saveSquad([], gameDay, available);
    const inPeriod = (period: Period, update: (m: Match) => Match) => {
      match = update({ ...match, period });
    };
    inPeriod(1, m => addGoal(m, { side: 'us', scorer: 'Sam Hart', assists: ['Rob Kerr', 'Lee Moss'] }));
    inPeriod(1, m => addPenalty(m, { side: 'them', who: '4', minutes: 2, reason: 'Hooking' }));
    inPeriod(1, m => addGoal(m, { side: 'them', assists: [], number: '17' }));
    inPeriod(2, m => addGoal(m, { side: 'us', scorer: 'Joe Bloggs', assists: [] }));
    inPeriod(2, m => addPenalty(m, { side: 'us', who: 'Max Ray', minutes: 2, reason: 'Tripping' }));

    // Some earlier scrimmages at full time, for the Leaders section.
    let seed = 7;
    const roll = (n: number) => {
      seed = (seed * 9301 + 49297) % 233280;
      return Math.floor((seed / 233280) * n);
    };
    const skaters = available.filter(p => p.skill > 0);
    const scrims: Match[] = [];
    for (let w = 1; w <= 12; w++) {
      const day = new Date();
      day.setDate(day.getDate() - 7 * w);
      const date = day.toISOString().slice(0, 10);
      const sitOut = skaters[roll(skaters.length)].id;
      const squad = available.filter(p => p.id !== sitOut);
      let [s] = saveSquad([], { ...gameDay, kind: 'scrimmage', opponent: `Scrimmage ${13 - w}`, date }, squad);
      const shooters = squad.filter(p => p.skill > 0);
      // Better players score a bit more often.
      const pick = () => {
        const a = shooters[roll(shooters.length)];
        const b = shooters[roll(shooters.length)];
        return a.skill >= b.skill ? a : b;
      };
      for (let g = 0, goals = 2 + roll(5); g < goals; g++) {
        const scorer = pick();
        const helper = shooters.filter(p => p !== scorer)[roll(shooters.length - 1)];
        s = addGoal(s, { side: 'us', scorer: scorer.name, assists: roll(4) ? [helper.name] : [] });
      }
      for (let g = 0, goals = roll(5); g < goals; g++) s = addGoal(s, { side: 'them', assists: [] });
      scrims.push({ ...s, period: 3, finished: true, detached: true });
    }

    localStorage.setItem('dads-army:players', JSON.stringify(players));
    localStorage.setItem('dads-army:gameday', JSON.stringify(gameDay));
    localStorage.setItem('dads-army:matches', JSON.stringify([match, ...scrims]));
    localStorage.setItem('dads-army:gameday-section', JSON.stringify('score'));
  } catch {
    // Storage blocked: the app just starts empty.
  }
};
