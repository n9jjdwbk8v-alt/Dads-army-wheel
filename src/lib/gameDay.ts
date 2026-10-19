import type { LineSlots, LineStyle } from './lines';
import type { GameDetails } from './teamSheet';

/** Everything on the Game day sheets: match details, who's available, the line style and any hand edits. */
export type GameDayState = GameDetails & {
  available: string[];
  style: LineStyle;
  /** Lines placed by hand, kept only while the squad and style they were made for stay the same. */
  manual?: { key: string; slots: LineSlots };
};

export const NEW_GAME_DAY: GameDayState = {
  kind: 'game',
  opponent: '',
  date: '',
  time: '',
  venue: '',
  available: [],
  style: 'balanced'
};
