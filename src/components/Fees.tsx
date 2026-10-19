import { useState } from 'react';
import SpringCheck from './reactbits/SpringCheck';
import { useConfirmTap } from './useConfirmTap';
import {
  debts,
  money,
  nightLabel,
  owedText,
  settleUp,
  startNight,
  type FeeNight,
  type FeesState
} from '../lib/fees';
import { copyText, shareText } from '../lib/share';
import type { Player } from '../lib/teams';

type FeesProps = {
  players: Player[];
  fees: FeesState;
  setFees: (update: (f: FeesState) => FeesState) => void;
};

const CHECK = {
  strike: 'none',
  doneOpacity: 1,
  color: '#0f5132',
  fillColor: '#1f8a4c',
  checkColor: '#ffffff',
  boxSize: 22,
  fontSize: 17,
  className: 'roster__check'
} as const;

export default function Fees({ players, fees, setFees }: FeesProps) {
  const nights = [...fees.nights].sort((a, b) => a.date.localeCompare(b.date));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [armed, confirmTap] = useConfirmTap();

  const night = nights.find(n => n.id === selectedId) ?? nights[nights.length - 1];
  const index = night ? nights.indexOf(night) : -1;
  const owed = debts(fees.nights, players);
  const owedTotal = owed.reduce((sum, d) => sum + d.total, 0);

  const updateNight = (id: string, update: (n: FeeNight) => FeeNight) =>
    setFees(f => ({ ...f, nights: f.nights.map(n => (n.id === id ? update(n) : n)) }));

  const newNight = () => {
    const created = startNight(fees, players);
    setFees(f => ({ ...f, nights: [...f.nights, created] }));
    setSelectedId(created.id);
    setEditing(!created.due.length);
  };

  const go = (step: number) => {
    const next = nights[index + step];
    if (!next) return;
    setSelectedId(next.id);
    setEditing(false);
  };

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote(''), 2200);
  };

  const send = async () => {
    const result = await shareText(owedText(owed));
    if (result === 'copied') flash('Copied — paste it into WhatsApp.');
  };

  const copy = async () => {
    if (await copyText(owedText(owed))) flash('Copied!');
  };

  return (
    <section className="gameday fees">
      <div className="panel">
        {night ? (
          <>
            <div className="sheet-switch">
              <button className="sheet-switch__arrow" onClick={() => go(-1)} disabled={index <= 0} aria-label="Earlier night">
                ‹
              </button>
              <div className="sheet-switch__title" aria-live="polite">
                <span>{nightLabel(night.date)}</span>
                <span className="fees__count">
                  Night {index + 1} of {nights.length}
                </span>
              </div>
              <button
                className="sheet-switch__arrow"
                onClick={() => go(1)}
                disabled={index >= nights.length - 1}
                aria-label="Later night"
              >
                ›
              </button>
            </div>
            <NightView
              key={night.id}
              night={night}
              players={players}
              editing={editing}
              setEditing={setEditing}
              onChange={update => updateNight(night.id, update)}
            />
            <div className="split__actions">
              <button className="btn btn--primary" onClick={newNight}>
                + New night
              </button>
              <button
                className={armed === `night-${night.id}` ? 'btn btn--danger' : 'btn btn--ghost'}
                onClick={() => {
                  if (!confirmTap(`night-${night.id}`)) return;
                  setFees(f => ({ ...f, nights: f.nights.filter(n => n.id !== night.id) }));
                  setSelectedId(null);
                  setEditing(false);
                }}
              >
                {armed === `night-${night.id}` ? 'Tap again to delete' : 'Delete night'}
              </button>
            </div>
          </>
        ) : (
          <div className="fees__start">
            <p className="panel__title">Ice fees</p>
            <p className="muted">
              Start a night to list everyone ticked on the Roster, then tick people off as they pay.
            </p>
            <button className="btn btn--primary" onClick={newNight}>
              Start tonight's fees
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="roster-bar">
          <p className="panel__title fees__title">Still owed</p>
          <p className="fees__total">{money(owedTotal)}</p>
        </div>
        {owed.length === 0 ? (
          <p className="muted">{fees.nights.length ? 'Everyone is paid up. 🎉' : 'Nothing owed yet.'}</p>
        ) : (
          <ul className="roster">
            {owed.map(d => {
              const key = `settle-${d.id}`;
              return (
                <li key={d.id} className="roster__row fees__debt">
                  <div className="fees__who">
                    <span className="fees__name">{d.name}</span>
                    <span className="small">
                      <strong className="fees__amount">{money(d.total)}</strong>
                      <span className="muted">
                        {' · '}
                        {d.nights.length === 1 ? nightLabel(d.nights[0].date) : `${d.nights.length} nights`}
                      </span>
                    </span>
                  </div>
                  <button
                    className={armed === key ? 'btn btn--danger fees__settle' : 'btn btn--ghost fees__settle'}
                    onClick={() => {
                      if (confirmTap(key)) setFees(f => ({ ...f, nights: settleUp(f.nights, d.id) }));
                    }}
                    aria-label={armed === key ? `Tap again to mark ${d.name} paid up` : `Mark ${d.name} paid up`}
                  >
                    {armed === key ? 'Sure?' : 'Paid up'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {fees.nights.length > 0 && (
          <>
            <button className="btn btn--primary btn--whatsapp fees__send" onClick={send}>
              Send who owes to WhatsApp
            </button>
            <div className="split__actions">
              <button className="btn btn--ghost" onClick={copy}>
                Copy as text
              </button>
            </div>
          </>
        )}
        {note && <p className="backup__message">{note}</p>}
      </div>

      <div className="panel fees__settings">
        <p className="panel__title fees__title">New nights</p>
        <p className="muted small">What a new night starts with. Change a single night's fee on the night itself.</p>
        <label className="field">
          <span>Fee per player</span>
          <MoneyInput value={fees.amount} onChange={amount => setFees(f => ({ ...f, amount }))} />
        </label>
        <SpringCheck
          {...CHECK}
          className=""
          label="Goalies skate free"
          checked={fees.goaliesFree}
          onChange={goaliesFree => setFees(f => ({ ...f, goaliesFree }))}
        />
      </div>
    </section>
  );
}

type NightViewProps = {
  night: FeeNight;
  players: Player[];
  editing: boolean;
  setEditing: (editing: boolean) => void;
  onChange: (update: (n: FeeNight) => FeeNight) => void;
};

/** One night: its date and fee, who's paid, and (when editing) who was on the ice. */
function NightView({ night, players, editing, setEditing, onChange }: NightViewProps) {
  const paid = new Set(night.paid);
  const due = new Set(night.due.map(d => d.id));
  const names = new Map(players.map(p => [p.id, p.name]));
  const nameOf = (d: { id: string; name: string }) => names.get(d.id) ?? d.name;
  const rows = [...night.due].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const paidCount = night.due.filter(d => paid.has(d.id)).length;

  const setPaid = (id: string, on: boolean) =>
    onChange(n => ({ ...n, paid: on ? [...n.paid.filter(x => x !== id), id] : n.paid.filter(x => x !== id) }));

  const setDue = (p: { id: string; name: string }, on: boolean) =>
    onChange(n => ({
      ...n,
      due: on ? [...n.due.filter(d => d.id !== p.id), { id: p.id, name: p.name }] : n.due.filter(d => d.id !== p.id),
      paid: on ? n.paid : n.paid.filter(x => x !== p.id)
    }));

  // Everyone on the roster, plus anyone on this night who has since left it.
  const everyone = [
    ...players.map(p => ({ id: p.id, name: p.name })),
    ...night.due.filter(d => !names.has(d.id))
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="field-row fees__fields">
        <label className="field">
          <span>Date</span>
          <input
            className="text-input"
            type="date"
            value={night.date}
            onChange={e => e.target.value && onChange(n => ({ ...n, date: e.target.value }))}
          />
        </label>
        <label className="field">
          <span>Fee per player</span>
          <MoneyInput value={night.amount} onChange={amount => onChange(n => ({ ...n, amount }))} />
        </label>
      </div>

      <div className="roster-bar">
        <p className="roster-count">
          <strong>{paidCount}</strong> of {night.due.length} paid · {money(paidCount * night.amount)} of{' '}
          {money(night.due.length * night.amount)}
        </p>
        <div className="roster-actions">
          {!editing && night.due.length > 0 && paidCount < night.due.length && (
            <button className="btn btn--ghost" onClick={() => onChange(n => ({ ...n, paid: n.due.map(d => d.id) }))}>
              All paid
            </button>
          )}
          <button className="btn btn--ghost" onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : "Who's in"}
          </button>
        </div>
      </div>

      {editing ? (
        <>
          <p className="muted small">Tick everyone who skated and owes for this night.</p>
          {everyone.length === 0 ? (
            <p className="empty">Add players on the Roster tab first.</p>
          ) : (
            <ul className="roster">
              {everyone.map(p => (
                <li key={p.id} className={due.has(p.id) ? 'roster__row' : 'roster__row roster__row--away'}>
                  <SpringCheck {...CHECK} label={p.name} checked={due.has(p.id)} onChange={on => setDue(p, on)} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : rows.length === 0 ? (
        <p className="empty">Nobody on this night yet — tap Who's in to add players.</p>
      ) : (
        <>
          <p className="muted small">Tick each player as they pay.</p>
          <ul className="roster">
            {rows.map(d => (
              <li key={d.id} className={paid.has(d.id) ? 'roster__row fees__row--paid' : 'roster__row'}>
                <SpringCheck {...CHECK} label={nameOf(d)} checked={paid.has(d.id)} onChange={on => setPaid(d.id, on)} />
                <span className={paid.has(d.id) ? 'fees__tag fees__tag--paid' : 'fees__tag'}>
                  {paid.has(d.id) ? 'Paid' : money(night.amount)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** A pounds box that lets you type freely ("7.", "") and reports a number. */
function MoneyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  // Follow changes made elsewhere, such as switching to another night.
  if (value !== shown) {
    setShown(value);
    setText(String(value));
  }

  return (
    <span className="money-input">
      <span className="money-input__sign" aria-hidden="true">
        £
      </span>
      <input
        className="text-input"
        inputMode="decimal"
        value={text}
        placeholder="0"
        onChange={e => {
          const next = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7);
          const n = Math.round((parseFloat(next) || 0) * 100) / 100;
          setText(next);
          setShown(n);
          onChange(n);
        }}
      />
    </span>
  );
}
