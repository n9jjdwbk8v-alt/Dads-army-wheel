import type { LineStyle } from './lines';
import type { GameDetails } from './teamSheet';

/** Everything on the Game day sheets: match details, who's available and the chosen line style. */
export type GameDayState = GameDetails & { available: string[]; style: LineStyle };

export const NEW_GAME_DAY: GameDayState = {
  kind: 'game',
  opponent: '',
  date: '',
  time: '',
  venue: '',
  available: [],
  style: 'balanced'
};
