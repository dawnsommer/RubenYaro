import { useState } from 'react';
import { ChevronDown, Coins, Plus, Sparkles, Tag, Trash2, Undo2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  accountBalance,
  extraPkr,
  extraReceived,
  isLender,
  selectExtrasPkr,
  selectGapPkr,
} from '../../store/selectors';
import { formatShortDate } from '../../lib/dates';
import { parseAmount } from '../../lib/parseAmount';
import { Extra, ExtraChance, Money } from '../../types';
import { Amount, Button, DateInput, MoneyInput, Segmented, Select } from '../../components/ui';

const todayIso = () => new Date().toISOString().slice(0, 10);

const CHANCE: Record<ExtraChance, { label: string; cls: string; next: ExtraChance }> = {
  sure: { label: 'Sure', cls: 'bg-[var(--positive-soft)] text-[var(--positive)]', next: 'likely' },
  likely: { label: 'Likely', cls: 'bg-[var(--accent-soft)] text-[var(--accent)]', next: 'maybe' },
  maybe: { label: 'Maybe', cls: 'bg-[var(--maybe-soft)] text-[var(--maybe)]', next: 'sure' },
};

function ChanceChip({ value, onChange }: { value: ExtraChance; onChange: (c: ExtraChance) => void }) {
  const c = CHANCE[value];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(c.next);
      }}
      title="Tap to change: sure → likely → maybe"
      className={`h-6 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer shrink-0 ${c.cls}`}
    >
      {c.label}
    </button>
  );
}

/** "It came in" — deposit it into one of my accounts. */
function ReceiveForm({ extra, onDone }: { extra: Extra; onDone: () => void }) {
  const state = useStore();
  const mine = state.accounts.filter((a) => !a.archived && !isLender(a));
  const [accId, setAccId] = useState(
    mine.find((a) => a.currency === extra.money.currency)?.id ?? mine[0]?.id ?? ''
  );
  const acc = mine.find((a) => a.id === accId);
  const m = state.settings.rates.market || 280;
  const suggested = !acc
    ? extra.money.amount
    : acc.currency === extra.money.currency
      ? extra.money.amount
      : acc.currency === 'PKR'
        ? Math.round(extra.money.amount * m)
        : Math.round((extra.money.amount / m) * 100) / 100;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string | null>(todayIso());

  if (!mine.length) {
    return <p className="text-xs text-[var(--text-muted)]">Add one of your own accounts first.</p>;
  }
  const save = () => {
    const amt = amount.trim() ? (parseAmount(amount) ?? 0) : suggested;
    if (!acc || !(amt > 0)) return;
    state.receiveExtra(extra.id, acc.id, amt, date ?? todayIso());
    onDone();
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-[12px] bg-[var(--positive-soft)]/50 p-3 animate-fade-in">
      <Select
        label="Into"
        value={accId}
        onChange={setAccId}
        options={mine.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
        className="flex-1 min-w-[140px]"
      />
      <div className="w-[120px]">
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          Got ({acc?.currency})
        </label>
        <input
          className="field num"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={suggested.toLocaleString('en-US')}
          autoFocus
        />
      </div>
      <DateInput label="Date" value={date} onChange={setDate} className="w-[140px]" />
      <Button onClick={save} className="h-[38px]">
        Add to {acc?.name ?? 'account'}
      </Button>
      <Button variant="ghost" onClick={onDone} className="h-[38px]">
        Cancel
      </Button>
      {acc && (
        <p className="basis-full text-[11px] text-[var(--text-muted)] num">
          {acc.name}:{' '}
          <Amount
            pkr={
              acc.currency === 'PKR'
                ? accountBalance(acc, state.transactions)
                : accountBalance(acc, state.transactions) * m
            }
            usd={acc.currency === 'USD' ? accountBalance(acc, state.transactions) : undefined}
            displayCurrency={acc.currency}
            compact
            tone="muted"
          />{' '}
          → it then counts as your money.
        </p>
      )}
    </div>
  );
}

function ExtraRow({ extra }: { extra: Extra }) {
  const state = useStore();
  const [mode, setMode] = useState<'view' | 'edit' | 'receive'>('view');
  const Icon = extra.kind === 'sell' ? Tag : Coins;
  const upd = (patch: Partial<Extra>) => state.updateExtra(extra.id, patch);

  return (
    <li className="py-2.5">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setMode((m) => (m === 'edit' ? 'view' : 'edit'))}
        onKeyDown={(e) => e.key === 'Enter' && setMode((m) => (m === 'edit' ? 'view' : 'edit'))}
        className="flex items-center gap-3 cursor-pointer"
      >
        <span className="w-8 h-8 rounded-full grid place-items-center bg-[var(--surface-2)] text-[var(--text-muted)] shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">{extra.name}</span>
          <span className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-muted)]">
            <ChanceChip value={extra.chance} onChange={(chance) => upd({ chance })} />
            <span className="truncate">
              {extra.kind === 'sell' ? 'Could sell' : 'Expected'}
              {extra.date ? ` · ${formatShortDate(extra.date)}` : ''}
              {extra.note ? ` · ${extra.note}` : ''}
            </span>
          </span>
        </span>
        <span className="text-sm font-semibold num text-right shrink-0">
          <Amount
            pkr={extraPkr(extra, state.settings)}
            usd={extra.money.currency === 'USD' ? extra.money.amount : undefined}
            displayCurrency={extra.money.currency}
            prefix="+"
          />
        </span>
        {mode !== 'receive' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setMode('receive');
            }}
          >
            Got it
          </Button>
        )}
      </div>

      {mode === 'receive' && (
        <div className="mt-2">
          <ReceiveForm extra={extra} onDone={() => setMode('view')} />
        </div>
      )}

      {mode === 'edit' && (
        <div className="mt-2 rounded-[12px] bg-[var(--surface-2)]/60 p-3 space-y-3 animate-fade-in">
          <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
            <input
              className="field"
              value={extra.name}
              onChange={(e) => upd({ name: e.target.value })}
              aria-label="Name"
            />
            <MoneyInput value={extra.money} onChange={(money) => upd({ money })} compact />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Segmented
              ariaLabel="Kind"
              value={extra.kind}
              onChange={(kind) => upd({ kind })}
              options={[
                { value: 'sell', label: 'Could sell' },
                { value: 'income', label: 'Expected' },
              ]}
            />
            <Segmented
              ariaLabel="Chance"
              value={extra.chance}
              onChange={(chance) => upd({ chance })}
              options={[
                { value: 'sure', label: 'Sure' },
                { value: 'likely', label: 'Likely' },
                { value: 'maybe', label: 'Maybe' },
              ]}
            />
            <DateInput
              value={extra.date ?? null}
              onChange={(d) => upd({ date: d ?? undefined })}
              aria-label="Expected date"
              className="w-[150px]"
            />
          </div>
          <input
            className="field"
            value={extra.note ?? ''}
            onChange={(e) => upd({ note: e.target.value || undefined })}
            placeholder="Note (e.g. OLX price, who owes it)"
          />
          <div className="flex justify-between">
            <Button size="sm" variant="ghost" onClick={() => state.deleteExtra(extra.id)}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
            <Button size="sm" onClick={() => setMode('view')}>
              Done
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function AddExtra() {
  const state = useStore();
  const [kind, setKind] = useState<Extra['kind']>('sell');
  const [name, setName] = useState('');
  const [money, setMoney] = useState<Money>({ amount: 0, currency: 'PKR' });
  const [chance, setChance] = useState<ExtraChance>('likely');

  const add = () => {
    if (!name.trim() || !(money.amount > 0)) return;
    state.addExtra({ name: name.trim(), kind, money, chance });
    setName('');
    setMoney({ amount: 0, currency: money.currency });
  };

  return (
    <div className="pt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          ariaLabel="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'sell', label: 'Something to sell' },
            { value: 'income', label: 'Money I expect' },
          ]}
        />
        <Segmented
          ariaLabel="Chance"
          value={chance}
          onChange={setChance}
          options={[
            { value: 'sure', label: 'Sure' },
            { value: 'likely', label: 'Likely' },
            { value: 'maybe', label: 'Maybe' },
          ]}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={
            kind === 'sell' ? 'e.g. Old laptop, bike, iPad' : 'e.g. Job salary arrears, refund, gift'
          }
        />
        <MoneyInput value={money} onChange={setMoney} compact placeholder="Amount" onEnter={add} />
        <Button onClick={add} disabled={!name.trim() || !(money.amount > 0)} className="h-[38px]">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
    </div>
  );
}

export function Extras() {
  const state = useStore();
  const extras = state.extras ?? [];
  const [showReceived, setShowReceived] = useState(false);
  const pending = extras
    .filter((e) => !extraReceived(e, state.transactions))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.order - b.order);
  const received = extras.filter((e) => extraReceived(e, state.transactions));
  const sum = selectExtrasPkr(state);
  const spare = selectGapPkr(state);

  const ladder = [
    { label: 'Spare now', v: spare },
    { label: '+ sure', v: spare + sum.sure },
    { label: '+ likely', v: spare + sum.sure + sum.likely },
    { label: '+ maybes', v: spare + sum.total },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[18px] leading-[26px] font-semibold">Extras</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Things you could sell, or money you expect from somewhere. Not counted as your money until it comes
          in.
        </p>
      </div>

      <div className="card p-4 sm:p-5">
        {pending.length > 0 && (
          <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ladder.map((l, i) => (
              <div
                key={l.label}
                className={`rounded-[12px] px-3 py-2.5 ${i === 0 ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface-2)]/50'}`}
              >
                <p className="text-[11px] text-[var(--text-muted)]">
                  {i === 0 ? 'Spare now (after tax)' : `Spare ${l.label}`}
                </p>
                <p className="text-[15px] font-semibold num mt-0.5">
                  <Amount
                    pkr={Math.abs(l.v)}
                    prefix={l.v >= 0 ? '+' : '−'}
                    compact
                    tone={l.v >= 0 ? 'positive' : 'negative'}
                  />
                </p>
              </div>
            ))}
          </div>
        )}

        {pending.length === 0 ? (
          <div className="flex items-start gap-3 text-sm pb-1">
            <span className="w-9 h-9 rounded-full grid place-items-center bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <p className="text-[var(--text-muted)]">
              Nothing here yet. Add something you could sell (laptop, bike…) or money you expect (a job
              payment, a refund) — you’ll see how much it would add to your spare.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {pending.map((e) => (
              <ExtraRow key={e.id} extra={e} />
            ))}
          </ul>
        )}

        <div className="border-t border-[var(--border)] mt-2">
          <AddExtra />
        </div>

        {received.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setShowReceived((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              Came in ({received.length})
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showReceived ? 'rotate-180' : ''}`}
              />
            </button>
            {showReceived && (
              <ul className="mt-2 space-y-1.5 animate-fade-in">
                {received.map((e) => {
                  const tx = state.transactions.find((t) => t.id === e.receivedTxId);
                  const acc = state.accounts.find((a) => a.id === tx?.accountId);
                  return (
                    <li key={e.id} className="flex items-center gap-2 text-[13px]">
                      <span className="flex-1 min-w-0 truncate text-[var(--text-muted)]">
                        <span className="line-through">{e.name}</span>
                        {tx ? ` · ${formatShortDate(tx.date)}${acc ? ` → ${acc.name}` : ''}` : ''}
                      </span>
                      <span className="num text-[var(--positive)]">
                        <Amount
                          pkr={
                            acc?.currency === 'USD'
                              ? (tx?.amount ?? 0) * state.settings.rates.market
                              : (tx?.amount ?? 0)
                          }
                          usd={acc?.currency === 'USD' ? tx?.amount : undefined}
                          displayCurrency={acc?.currency ?? 'PKR'}
                          compact
                          prefix="+"
                          tone="positive"
                        />
                      </span>
                      <button
                        type="button"
                        onClick={() => state.unreceiveExtra(e.id)}
                        title="Undo — removes the deposit"
                        aria-label="Undo received"
                        className="p-1 rounded-[6px] text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
