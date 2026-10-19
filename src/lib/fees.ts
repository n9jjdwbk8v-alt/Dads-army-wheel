import { isGoalie, type Player } from './teams';

/**
 * One player owing for a night. The name is kept so a debt still reads right if they leave the roster, and
 * whether they were in goal so they pay the goalie price.
 */
export type FeeDue = { id: string; name: string; goalie?: boolean };

/** A night on the ice: what it cost skaters and goalies, who owed and who has paid. */
export type FeeNight = {
  id: string;
  date: string;
  /** The skaters' price. */
  amount: number;
  goalieAmount: number;
  due: FeeDue[];
  paid: string[];
};

export type FeesState = {
  /** The skaters' price a new night starts with. */
  amount: number;
  /** The goalies' price a new night starts with. */
  goalieAmount: number;
  nights: FeeNight[];
  /** 2 once the default fee went from £10 to £15. */
  v?: 2;
};

export const NEW_FEES: FeesState = { amount: 15, goalieAmount: 10, nights: [], v: 2 };

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

/** A player's place on a night's list, marked as a goalie if they're rated 0. */
export const dueFor = (p: Player): FeeDue => ({ id: p.id, name: p.name, ...(isGoalie(p) ? { goalie: true } : {}) });

/** A new night for everyone ticked as here on the Roster. */
export const startNight = (fees: FeesState, players: Player[], date = localDate()): FeeNight => ({
  id: crypto.randomUUID(),
  date,
  amount: fees.amount,
  goalieAmount: fees.goalieAmount,
  due: players
    .filter(p => p.here)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(dueFor),
  paid: []
});

/** What one player owes for a night: the goalie price if they were in goal, otherwise the skaters'. */
export const feeFor = (night: FeeNight, d: FeeDue) => (d.goalie ? night.goalieAmount : night.amount);

/** What a night brings in: from everyone on it, and from those who've paid so far. */
export const nightTotals = (night: FeeNight) => {
  const paid = new Set(night.paid);
  return night.due.reduce(
    (t, d) => ({ due: t.due + feeFor(night, d), paid: t.paid + (paid.has(d.id) ? feeFor(night, d) : 0) }),
    { due: 0, paid: 0 }
  );
};

export type Debt = { id: string; name: string; total: number; nights: FeeNight[] };

/** Everyone who still owes, biggest debt first. Names come from the roster when the player is still on it. */
export const debts = (nights: FeeNight[], players: Player[]): Debt[] => {
  const names = new Map(players.map(p => [p.id, p.name]));
  const byPlayer = new Map<string, Debt>();
  for (const night of nights) {
    const paid = new Set(night.paid);
    for (const d of night.due) {
      if (paid.has(d.id) || feeFor(night, d) <= 0) continue;
      const debt = byPlayer.get(d.id) ?? { id: d.id, name: names.get(d.id) ?? d.name, total: 0, nights: [] };
      debt.total += feeFor(night, d);
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

/** A night's fees as a message: who has paid and who still owes. */
export const nightText = (night: FeeNight, players: Player[]) => {
  const names = new Map(players.map(p => [p.id, p.name]));
  const paid = new Set(night.paid);
  const rows = night.due
    .map(d => ({ name: `${names.get(d.id) ?? d.name}${d.goalie ? ' (G)' : ''}`, paid: paid.has(d.id), fee: feeFor(night, d) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const paidRows = rows.filter(r => r.paid);
  const unpaid = rows.filter(r => !r.paid);
  const totals = nightTotals(night);
  const prices = night.due.some(d => d.goalie)
    ? `${money(night.amount)} players, ${money(night.goalieAmount)} goalies`
    : `${money(night.amount)} each`;
  return [
    `🏒 Dads Army — ice fees, ${nightLabel(night.date)}`,
    `${prices} · ${paidRows.length} of ${rows.length} paid · ${money(totals.paid)} of ${money(totals.due)}`,
    ...(paidRows.length ? ['', 'PAID', ...paidRows.map(r => `✅ ${r.name}`)] : []),
    ...(unpaid.length ? ['', 'STILL TO PAY', ...unpaid.map(r => `❌ ${r.name} — ${money(r.fee)}`)] : [])
  ].join('\n');
};

/** Keeps only well-formed nights from a backup file or this phone's storage. */
export const readFees = (raw: unknown): FeesState | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const amount = Number(r.amount);
  const goalieAmount = Number(r.goalieAmount);
  const nights = Array.isArray(r.nights)
    ? (r.nights as Record<string, unknown>[])
        .filter(n => typeof n?.id === 'string' && typeof n.date === 'string' && Array.isArray(n.due))
        .map(n => {
          const nightAmount = Math.max(0, Number(n.amount) || 0);
          // Nights from before goalies had their own price charged everyone the same.
          const nightGoalie = Number(n.goalieAmount);
          return {
            id: n.id as string,
            date: n.date as string,
            amount: nightAmount,
            goalieAmount: Number.isFinite(nightGoalie) && nightGoalie >= 0 ? nightGoalie : nightAmount,
            due: (n.due as Record<string, unknown>[])
              .filter(d => typeof d?.id === 'string' && typeof d.name === 'string')
              .map(d => ({ id: d.id as string, name: d.name as string, ...(d.goalie === true ? { goalie: true } : {}) })),
            paid: Array.isArray(n.paid) ? (n.paid as unknown[]).filter((x): x is string => typeof x === 'string') : []
          };
        })
    : [];
  // Fees saved before the default went up still hold the old £10 default; move those to £15.
  const kept = Number.isFinite(amount) && amount >= 0 ? amount : NEW_FEES.amount;
  return {
    amount: r.v !== 2 && kept === 10 ? NEW_FEES.amount : kept,
    goalieAmount: Number.isFinite(goalieAmount) && goalieAmount >= 0 ? goalieAmount : NEW_FEES.goalieAmount,
    nights,
    v: 2
  };
};
