import type { Player } from './teams';

/** One player owing for a night. The name is kept so a debt still reads right if they leave the roster. */
export type FeeDue = { id: string; name: string };

/** A night on the ice: what it cost each player, who owed and who has paid. */
export type FeeNight = { id: string; date: string; amount: number; due: FeeDue[]; paid: string[] };

export type FeesState = {
  /** The fee a new night starts with. */
  amount: number;
  nights: FeeNight[];
  /** 2 once the default fee went from £10 to £15. */
  v?: 2;
};

export const NEW_FEES: FeesState = { amount: 15, nights: [], v: 2 };

/** Pounds, with pence only when there are some: £10, £7.50. */
export const money = (n: number) => `£${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** Today's date as yyyy-mm-dd in local time, the format date inputs use. */
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "Tue 21 Oct", or the raw value if it isn't a date. */
export const nightLabel = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** A new night for everyone ticked as here on the Roster. */
export const startNight = (fees: FeesState, players: Player[], date = localDate()): FeeNight => ({
  id: crypto.randomUUID(),
  date,
  amount: fees.amount,
  due: players
    .filter(p => p.here)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => ({ id: p.id, name: p.name })),
  paid: []
});

export type Debt = { id: string; name: string; total: number; nights: FeeNight[] };

/** Everyone who still owes, biggest debt first. Names come from the roster when the player is still on it. */
export const debts = (nights: FeeNight[], players: Player[]): Debt[] => {
  const names = new Map(players.map(p => [p.id, p.name]));
  const byPlayer = new Map<string, Debt>();
  for (const night of nights) {
    if (night.amount <= 0) continue;
    const paid = new Set(night.paid);
    for (const d of night.due) {
      if (paid.has(d.id)) continue;
      const debt = byPlayer.get(d.id) ?? { id: d.id, name: names.get(d.id) ?? d.name, total: 0, nights: [] };
      debt.total += night.amount;
      debt.nights.push(night);
      byPlayer.set(d.id, debt);
    }
  }
  return [...byPlayer.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
};

/** Marks every night a player owes for as paid. */
export const settleUp = (nights: FeeNight[], id: string) =>
  nights.map(n => (n.due.some(d => d.id === id) && !n.paid.includes(id) ? { ...n, paid: [...n.paid, id] } : n));

/** The WhatsApp message listing who still owes. */
export const owedText = (list: Debt[]) => {
  if (!list.length) return '🏒 Dads Army ice fees — everyone is paid up. Cheers!';
  const total = list.reduce((sum, d) => sum + d.total, 0);
  return [
    '🏒 Dads Army — ice fees still owed',
    '',
    ...list.map(d => {
      const when = d.nights.length === 1 ? nightLabel(d.nights[0].date) : `${d.nights.length} nights`;
      return `• ${d.name} — ${money(d.total)} (${when})`;
    }),
    '',
    `Total: ${money(total)}`
  ].join('\n');
};

/** Keeps only well-formed nights from a backup file or this phone's storage. */
export const readFees = (raw: unknown): FeesState | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const amount = Number(r.amount);
  const nights = Array.isArray(r.nights)
    ? (r.nights as Record<string, unknown>[])
        .filter(n => typeof n?.id === 'string' && typeof n.date === 'string' && Array.isArray(n.due))
        .map(n => ({
          id: n.id as string,
          date: n.date as string,
          amount: Math.max(0, Number(n.amount) || 0),
          due: (n.due as Record<string, unknown>[])
            .filter(d => typeof d?.id === 'string' && typeof d.name === 'string')
            .map(d => ({ id: d.id as string, name: d.name as string })),
          paid: Array.isArray(n.paid) ? (n.paid as unknown[]).filter((x): x is string => typeof x === 'string') : []
        }))
    : [];
  // Fees saved before the default went up still hold the old £10 default; move those to £15.
  const kept = Number.isFinite(amount) && amount >= 0 ? amount : NEW_FEES.amount;
  return { amount: r.v !== 2 && kept === 10 ? NEW_FEES.amount : kept, nights, v: 2 };
};
