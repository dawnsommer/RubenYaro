import { ReactNode, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDownLeft,
  ChevronDown,
  CircleCheck,
  HandCoins,
  Info,
  Link2,
  Unlink,
  Pencil,
  Plus,
  Receipt,
  Undo2,
  UserRound,
  X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  accountBalance,
  costPaid,
  costTotal,
  costNextDue,
  getActivePlanCosts,
  isLender,
  lenderHistory,
  lenderStats,
  LenderEvent,
  linkedCostFor,
} from '../../store/selectors';
import { canLinkCost } from '../../store/loanLinks';
import { Link } from 'react-router-dom';
import { pkrToUsd } from '../../lib/currency';
import { formatCurrency } from '../../lib/format';
import { formatShortDate } from '../../lib/dates';
import { parseAmount } from '../../lib/parseAmount';
import { Account, Cost, Currency, Settings } from '../../types';
import { Amount, Button, ColorSwatch, DateInput, Segmented, Select, Sheet } from '../../components/ui';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Show a native amount of an account's currency through <Amount>. */
export function Native({
  n,
  currency,
  ...rest
}: { n: number; currency: Currency } & Omit<
  Parameters<typeof Amount>[0],
  'pkr' | 'usd' | 'displayCurrency'
>) {
  const market = useStore((s) => s.settings.rates.market) || 280;
  return (
    <Amount
      pkr={currency === 'PKR' ? n : n * market}
      usd={currency === 'USD' ? n : undefined}
      displayCurrency={currency}
      {...rest}
    />
  );
}

/** a → b in another currency at the market rate (real money changing hands). */
function convert(n: number, from: Currency, to: Currency, settings: Settings): number {
  if (from === to) return n;
  const m = settings.rates.market || 280;
  return from === 'USD' ? Math.round(n * m) : Math.round((n / m) * 100) / 100;
}

/** What's left to pay on a cost, in the given currency. */
function costLeftIn(cost: Cost, currency: Currency, data: ReturnType<typeof useStore.getState>): number {
  const leftPkr = Math.max(
    0,
    costTotal(cost, data.settings) - costPaid(cost, data.transactions, data.accounts, data.settings)
  );
  if (currency === 'PKR') return leftPkr;
  return pkrToUsd(
    leftPkr,
    cost.conversionMode ?? data.settings.defaultConversionMode,
    data.settings.rates.market,
    data.settings.rates.effective,
    cost.tax ?? data.settings.defaultTax
  );
}

const fmt = (n: number, c: Currency) => formatCurrency(n, c);

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[var(--text-faint)]">{hint}</p>}
    </div>
  );
}

/** "X → Y" preview line used in the borrow / repay forms. */
function Change({
  label,
  from,
  to,
  currency,
  good,
}: {
  label: ReactNode;
  from: number;
  to: number;
  currency: Currency;
  good?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-[var(--text-muted)] min-w-0 truncate">{label}</span>
      <span className="num whitespace-nowrap">
        <Native n={from} currency={currency} compact tone="muted" />
        <span className="mx-1.5 text-[var(--text-faint)]">→</span>
        <Native
          n={to}
          currency={currency}
          compact
          className="font-semibold"
          tone={good === undefined ? 'default' : good ? 'positive' : 'negative'}
        />
      </span>
    </div>
  );
}

function Preview({ children }: { children: ReactNode }) {
  return <div className="rounded-[14px] bg-[var(--surface-2)]/70 px-3.5 py-3 space-y-1.5">{children}</div>;
}

// ── Add / edit a person ──────────────────────────────────────────────────────
export function PersonSheet({
  open,
  onClose,
  person,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  person: Account | null;
  onCreated?: (acc: Account, hadOpening: boolean) => void;
}) {
  const state = useStore();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('PKR');
  const [already, setAlready] = useState('');
  const [color, setColor] = useState('#F97316');
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  // reset the form every time the sheet opens
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(person?.name ?? '');
      setCurrency(person?.currency ?? 'PKR');
      setAlready(person && person.openingBalance < 0 ? String(-person.openingBalance) : '');
      setColor(person?.color ?? '#F97316');
      setNote(person?.note ?? '');
      setConfirmDelete(false);
    }
  }

  const records = person
    ? state.transactions.filter((t) => t.accountId === person.id || t.toAccountId === person.id).length
    : 0;

  const save = () => {
    if (!name.trim()) return;
    const owed = Math.max(0, parseAmount(already) ?? 0);
    if (person) {
      state.updateAccount(person.id, {
        name: name.trim(),
        currency,
        openingBalance: -owed,
        color,
        note: note.trim() || undefined,
      });
      onClose();
    } else {
      const acc = state.addAccount({
        name: name.trim(),
        kind: 'other',
        role: 'lender',
        currency,
        openingBalance: -owed,
        color,
        icon: 'UserRound',
        includeInTotals: false,
        note: note.trim() || undefined,
      });
      onClose();
      onCreated?.(acc, owed > 0);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={person ? `Edit ${person.name}` : 'Add a person you owe'}
      footer={
        <>
          {person && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                state.deleteAccount(person.id);
                onClose();
              }}
            >
              {confirmDelete ? 'Yes, delete' : 'Delete'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            {person ? 'Save' : 'Add person'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="e.g. Bhai Raheel, Ali"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Field
            label="Already owe them (optional)"
            hint={person ? undefined : 'Leave empty if you’ll record what they paid next.'}
          >
            <input
              className="field num"
              inputMode="decimal"
              value={already}
              onChange={(e) => setAlready(e.target.value)}
              placeholder="e.g. 200k"
            />
          </Field>
          <div className={person ? '' : 'pb-[22px]'}>
            <Segmented
              ariaLabel="Currency"
              size="md"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'PKR', label: '₨' },
                { value: 'USD', label: '$' },
              ]}
            />
          </div>
        </div>
        <Field label="Colour">
          <ColorSwatch value={color} onChange={setColor} />
        </Field>
        <Field label="Note (optional)">
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. repay after the job payment"
          />
        </Field>
        {confirmDelete && (
          <p className="text-xs text-[var(--negative)]">
            This removes {person?.name} and their {records} record{records === 1 ? '' : 's'}. Costs they paid
            for go back to unpaid. Archive instead if you just want to hide them.
          </p>
        )}
      </div>
    </Sheet>
  );
}

// ── Record money taken from a person ────────────────────────────────────────
type BorrowMode = 'cost' | 'cash' | 'other';

export function BorrowSheet({
  lender,
  onClose,
  presetCostId,
}: {
  lender: Account | null;
  onClose: () => void;
  presetCostId?: string;
}) {
  const state = useStore();
  const { settings, accounts, transactions, costs } = state;
  const [mode, setMode] = useState<BorrowMode>('cost');
  const [costId, setCostId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string | null>(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);

  const myAccounts = accounts.filter((a) => !a.archived && !isLender(a));
  const unpaid = useMemo(
    () =>
      getActivePlanCosts(costs)
        .filter((c) => !c.lenderId) // a loan cost is paid by repaying its person
        .map((c) => ({ c, left: costLeftIn(c, lender?.currency ?? 'PKR', state) }))
        .filter((x) => x.left > 0.5)
        .sort((a, b) => {
          const da = costNextDue(a.c);
          const db = costNextDue(b.c);
          if (da && db) return da.localeCompare(db);
          if (da) return -1;
          if (db) return 1;
          return a.c.order - b.c.order;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [costs, transactions, accounts, settings, lender?.currency]
  );

  const id = lender?.id ?? null;
  if (id !== lastId) {
    setLastId(id);
    if (lender) {
      const preset = presetCostId && unpaid.some((x) => x.c.id === presetCostId) ? presetCostId : '';
      setMode(unpaid.length ? 'cost' : 'cash');
      setCostId(preset || unpaid[0]?.c.id || '');
      setToId(myAccounts[0]?.id ?? '');
      setAmount('');
      setDate(todayIso());
      setNote('');
      setError(null);
    }
  }
  if (!lender) return null;

  const cur = lender.currency;
  const owed = lenderStats(lender, transactions).owed;
  const selCost = unpaid.find((x) => x.c.id === costId);
  const toAcc = myAccounts.find((a) => a.id === toId);
  const typed = parseAmount(amount);
  const amt = amount.trim()
    ? (typed ?? 0)
    : mode === 'cost'
      ? Math.round((selCost?.left ?? 0) * 100) / 100
      : 0;

  const save = () => {
    setError(null);
    if (!(amt > 0)) return setError('Enter how much they gave.');
    const d = date ?? todayIso();
    if (mode === 'cost') {
      if (!selCost) return setError('Pick the cost they paid.');
      state.addTransaction({
        type: 'payment',
        date: d,
        accountId: lender.id,
        costId: selCost.c.id,
        amount: amt,
        note: note.trim() || `${lender.name} paid ${selCost.c.name}`,
      });
    } else if (mode === 'cash') {
      if (!toAcc) return setError('Add one of your own accounts first.');
      state.addTransaction({
        type: 'transfer',
        date: d,
        accountId: lender.id,
        toAccountId: toAcc.id,
        amount: amt,
        toAmount: convert(amt, cur, toAcc.currency, settings),
        note: note.trim() || `Borrowed from ${lender.name}`,
      });
    } else {
      state.addTransaction({
        type: 'withdrawal',
        date: d,
        accountId: lender.id,
        amount: amt,
        note: note.trim() || `Borrowed from ${lender.name}`,
      });
    }
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${lender.name} gave you money`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          ariaLabel="How"
          size="md"
          className="w-full [&>button]:flex-1"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'cost', label: 'Paid a cost' },
            { value: 'cash', label: 'Gave me cash' },
            { value: 'other', label: 'Other' },
          ]}
        />

        {mode === 'cost' &&
          (unpaid.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nothing in your plan is left to pay.</p>
          ) : (
            <Select
              label="Which cost did they pay?"
              value={costId}
              onChange={setCostId}
              options={unpaid.map(({ c, left }) => ({
                value: c.id,
                label: `${c.name} · ${fmt(left, cur)} left`,
              }))}
            />
          ))}
        {mode === 'cash' &&
          (myAccounts.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Add one of your own accounts first.</p>
          ) : (
            <Select
              label="Into which of my accounts?"
              value={toId}
              onChange={setToId}
              options={myAccounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
            />
          ))}

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Amount (${cur})`}>
            <input
              className="field num"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder={
                mode === 'cost' && selCost ? Math.round(selCost.left).toLocaleString('en-US') : 'e.g. 50k'
              }
              autoFocus
            />
          </Field>
          <DateInput label="Date" value={date} onChange={setDate} />
        </div>
        <Field label="Note (optional)">
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === 'other' ? 'What was it for?' : 'Optional'}
          />
        </Field>

        {amt > 0 && (
          <Preview>
            <Change
              label={`You owe ${lender.name}`}
              from={Math.max(0, owed)}
              to={owed + amt}
              currency={cur}
              good={false}
            />
            {mode === 'cost' && selCost && (
              <Change
                label={`${selCost.c.name} left`}
                from={selCost.left}
                to={Math.max(0, selCost.left - amt)}
                currency={cur}
                good
              />
            )}
            {mode === 'cash' && toAcc && (
              <Change
                label={toAcc.name}
                from={accountBalance(toAcc, transactions)}
                to={accountBalance(toAcc, transactions) + convert(amt, cur, toAcc.currency, settings)}
                currency={toAcc.currency}
                good
              />
            )}
          </Preview>
        )}
        {error && <p className="text-xs text-[var(--negative)]">{error}</p>}
      </div>
    </Sheet>
  );
}

// ── Pay a person back (all or part) ─────────────────────────────────────────
export function RepaySheet({ lender, onClose }: { lender: Account | null; onClose: () => void }) {
  const state = useStore();
  const { settings, accounts, transactions } = state;
  const myAccounts = accounts.filter((a) => !a.archived && !isLender(a));
  const [fromId, setFromId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string | null>(todayIso());
  const [note, setNote] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);

  const id = lender?.id ?? null;
  if (id !== lastId) {
    setLastId(id);
    if (lender) {
      // default to my account with the most money in it
      const best = myAccounts
        .slice()
        .sort(
          (a, b) =>
            convert(accountBalance(b, transactions), b.currency, 'PKR', settings) -
            convert(accountBalance(a, transactions), a.currency, 'PKR', settings)
        )[0];
      setFromId(best?.id ?? '');
      setAmount('');
      setDate(todayIso());
      setNote('');
    }
  }
  if (!lender) return null;

  const cur = lender.currency;
  const owed = Math.max(0, lenderStats(lender, transactions).owed);
  const from = myAccounts.find((a) => a.id === fromId);
  const amt = parseAmount(amount) ?? 0;
  const srcAmt = from ? convert(amt, cur, from.currency, settings) : 0;
  const fromBal = from ? accountBalance(from, transactions) : 0;
  const chips = [
    { label: 'All', n: owed },
    { label: 'Half', n: Math.round(owed / 2) },
    { label: 'Quarter', n: Math.round(owed / 4) },
  ].filter((c) => c.n > 0);

  const save = () => {
    if (!from || !(amt > 0)) return;
    state.addTransaction({
      type: 'transfer',
      date: date ?? todayIso(),
      accountId: from.id,
      toAccountId: lender.id,
      amount: srcAmt,
      toAmount: amt,
      note: note.trim() || `Repaid ${lender.name}`,
    });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Pay back ${lender.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!from || !(amt > 0)}>
            {amt > 0 ? `Repay ${fmt(amt, cur)}` : 'Repay'}
          </Button>
        </>
      }
    >
      {myAccounts.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Add one of your own accounts first — repayments come out of it.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[14px] bg-[var(--negative-soft)]/60 px-4 py-3 flex items-center justify-between">
            <span className="text-sm">You owe {lender.name}</span>
            <Native n={owed} currency={cur} className="text-lg font-semibold" tone="negative" />
          </div>

          <Field label={`How much are you paying back? (${cur})`}>
            <input
              className="field num text-lg"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="e.g. 50k — part is fine"
              autoFocus
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setAmount(String(c.n))}
                  className={`h-7 px-3 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    amt === c.n
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {c.label} · <span className="num">{formatCurrency(c.n, cur, { compact: true })}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="From my account"
              value={fromId}
              onChange={setFromId}
              options={myAccounts.map((a) => ({
                value: a.id,
                label: `${a.name} · ${formatCurrency(accountBalance(a, transactions), a.currency, { compact: true })}`,
              }))}
            />
            <DateInput label="Date" value={date} onChange={setDate} />
          </div>
          <Field label="Note (optional)">
            <input
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          {amt > 0 && from && (
            <Preview>
              <Change
                label={`Still owe ${lender.name}`}
                from={owed}
                to={Math.max(0, owed - amt)}
                currency={cur}
                good
              />
              <Change
                label={from.name}
                from={fromBal}
                to={fromBal - srcAmt}
                currency={from.currency}
                good={fromBal - srcAmt >= 0}
              />
              {amt > owed + 0.5 && (
                <p className="text-[11px] text-[var(--warning)]">
                  That’s {fmt(amt - owed, cur)} more than you owe.
                </p>
              )}
              {owed - amt <= 0.5 && amt <= owed + 0.5 && (
                <p className="text-[11px] text-[var(--positive)] font-medium">This clears the loan 🎉</p>
              )}
            </Preview>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ── Is this debt part of the plan? (link to a loan cost) ────────────────────
const NEW_COST = '__new_cost';

/** Cost category / phase for loans if the user has them, else the first ones. */
export function loanCostHome(settings: Settings): { categoryId: string; phaseId: string } {
  const cat =
    settings.categories.find((c) => c.id === 'loans') ??
    settings.categories.find((c) => /loan/i.test(c.name)) ??
    settings.categories[0];
  const phase =
    settings.phases.find((p) => p.id === 'obligations') ??
    settings.phases.find((p) => /loan|obligation/i.test(p.name)) ??
    settings.phases[0];
  return { categoryId: cat?.id ?? 'misc', phaseId: phase?.id ?? 'general' };
}

function LenderPlanLink({ lender, borrowed }: { lender: Account; borrowed: number }) {
  const state = useStore();
  const { costs, settings } = state;
  const linked = linkedCostFor(lender.id, costs);
  const [picking, setPicking] = useState(false);
  const home = loanCostHome(settings);
  const candidates = costs
    .filter((c) => !c.archived && !c.lenderId && canLinkCost(c))
    .sort((a, b) => Number(b.categoryId === home.categoryId) - Number(a.categoryId === home.categoryId));
  const [choice, setChoice] = useState<string>(NEW_COST);

  if (linked) {
    const counted = linked.included && !linked.maybe && !linked.archived;
    return (
      <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-[var(--accent-soft)]/60 px-3 py-2 text-[12px]">
        <Link2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
        <span className="flex-1 min-w-0 truncate">
          In plan as{' '}
          <Link
            to={`/costs?open=${linked.id}`}
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            {linked.name}
          </Link>
          {!counted && <span className="text-[var(--text-muted)]"> · not counted</span>}
        </span>
        <button
          type="button"
          onClick={() => state.unlinkCost(linked.id)}
          title="Unlink from the plan cost"
          aria-label="Unlink from the plan cost"
          className="p-1 rounded-[6px] text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer"
        >
          <Unlink className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!picking) {
    return (
      <button
        type="button"
        onClick={() => {
          setChoice(candidates.find((c) => c.categoryId === home.categoryId)?.id ?? NEW_COST);
          setPicking(true);
        }}
        className="mt-3 w-full flex items-center gap-2 rounded-[12px] border border-dashed border-[var(--border-strong)] px-3 py-2 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]/50 cursor-pointer"
      >
        <Link2 className="w-3.5 h-3.5" /> Link to a loan cost in my plan
      </button>
    );
  }

  const link = () => {
    let costId = choice;
    if (choice === NEW_COST) {
      costId = state.addCost({
        name: `Repay ${lender.name}`,
        money: { amount: Math.round(borrowed * 100) / 100, currency: lender.currency },
        kind: 'fixed',
        priority: 'must',
        ...home,
      }).id;
    }
    state.linkCostToLender(costId, lender.id);
    setPicking(false);
  };

  return (
    <div className="mt-3 rounded-[12px] bg-[var(--surface-2)]/70 p-3 space-y-2 animate-fade-in">
      <Select
        label="Which cost is this loan?"
        value={choice}
        onChange={setChoice}
        options={[
          { value: NEW_COST, label: `+ New cost “Repay ${lender.name}”` },
          ...candidates.map((c) => ({
            value: c.id,
            label: `${c.name} · ${formatCurrency(c.money.amount, c.money.currency, { compact: true })}`,
          })),
        ]}
      />
      <p className="text-[11px] text-[var(--text-muted)]">
        The cost will always equal what you took from {lender.name}; paying them back pays the cost.
        {choice !== NEW_COST && borrowed <= 0.5 ? ' Its amount becomes what you owe them.' : ''}
        {choice !== NEW_COST ? ' Payments already recorded on it become repayments.' : ''}
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={link}>
          <Link2 className="w-3.5 h-3.5" /> Link
        </Button>
      </div>
    </div>
  );
}

// ── One person ──────────────────────────────────────────────────────────────
const EVENT_ICON: Record<LenderEvent['kind'], typeof Receipt> = {
  paid_cost: Receipt,
  gave_cash: ArrowDownLeft,
  other: HandCoins,
  repaid: Undo2,
  opening: UserRound,
};

function LenderCard({
  lender,
  onRepay,
  onBorrow,
  onEdit,
}: {
  lender: Account;
  onRepay: () => void;
  onBorrow: () => void;
  onEdit: () => void;
}) {
  const state = useStore();
  const { transactions, costs, accounts } = state;
  const [open, setOpen] = useState(false);
  const cur = lender.currency;
  const s = lenderStats(lender, transactions);
  const history = lenderHistory(lender, transactions);
  const pct = s.borrowed > 0 ? Math.min(100, (s.repaid / s.borrowed) * 100) : 0;
  const cleared = s.owed <= 0.5;

  const describe = (e: LenderEvent): string => {
    const other = accounts.find((a) => a.id === e.otherAccountId);
    switch (e.kind) {
      case 'paid_cost':
        return `Paid ${costs.find((c) => c.id === e.costId)?.name ?? 'a cost'}`;
      case 'gave_cash':
        return `Gave you cash${other ? ` → ${other.name}` : ''}`;
      case 'other':
        return e.note || 'Lent you money';
      case 'repaid':
        return `You repaid${other ? ` from ${other.name}` : ''}`;
      case 'opening':
        return 'Already owed when added';
    }
  };

  return (
    <div className={`card p-4 ${lender.archived ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <span
          className="w-10 h-10 rounded-full grid place-items-center text-white text-[15px] font-semibold shrink-0"
          style={{ backgroundColor: lender.color }}
        >
          {lender.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold truncate">{lender.name}</p>
            <div className="flex items-center -mr-1.5">
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${lender.name}`}
                className="p-1.5 rounded-[8px] text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {(cleared || lender.archived) && (
                <button
                  type="button"
                  onClick={() => state.updateAccount(lender.id, { archived: !lender.archived })}
                  aria-label={lender.archived ? 'Unarchive' : 'Archive'}
                  title={lender.archived ? 'Unarchive' : 'Archive (all repaid)'}
                  className="p-1.5 rounded-[8px] text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer"
                >
                  {lender.archived ? (
                    <ArchiveRestore className="w-3.5 h-3.5" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
          {s.borrowed <= 0.5 ? (
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">Nothing recorded yet</p>
          ) : cleared ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--positive)]">
              <CircleCheck className="w-4 h-4" /> All paid back
            </p>
          ) : (
            <div className="mt-0.5">
              <p className="text-[11px] text-[var(--text-muted)]">You owe</p>
              <p className="text-[24px] leading-tight font-semibold tracking-[-0.03em]">
                <Native n={s.owed} currency={cur} tone="negative" />
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 rounded-full bg-[var(--negative-soft)] overflow-hidden">
          <div
            className="h-full bg-[var(--positive)] rounded-full transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-[var(--text-muted)] num">
          <span>
            Took <Native n={s.borrowed} currency={cur} compact className="font-medium !text-[var(--text)]" />
          </span>
          <span>
            Repaid <Native n={s.repaid} currency={cur} compact tone="positive" className="font-medium" />
          </span>
        </div>
      </div>

      <LenderPlanLink lender={lender} borrowed={s.borrowed} />

      <div className="mt-3 flex items-center gap-2">
        {!cleared && (
          <Button size="sm" onClick={onRepay}>
            <Undo2 className="w-3.5 h-3.5" /> Pay back
          </Button>
        )}
        <Button size="sm" variant={s.borrowed <= 0.5 ? 'primary' : 'secondary'} onClick={onBorrow}>
          <Plus className="w-3.5 h-3.5" /> {s.borrowed <= 0.5 ? 'Record a loan' : 'Took more'}
        </Button>
        <div className="flex-1" />
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer whitespace-nowrap"
          >
            {history.length} record{history.length === 1 ? '' : 's'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {open && (
        <ul className="mt-3 pt-1 border-t border-[var(--border)] divide-y divide-[var(--border)] animate-fade-in">
          {history.map((e) => {
            const Icon = EVENT_ICON[e.kind];
            const repaid = e.kind === 'repaid';
            return (
              <li key={e.id} className="flex items-center gap-2.5 py-2">
                <span
                  className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${
                    repaid
                      ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] leading-snug break-words">{describe(e)}</span>
                  <span className="block text-[11px] text-[var(--text-faint)] num">
                    {formatShortDate(e.date)}
                  </span>
                </span>
                <Native
                  n={e.amount}
                  currency={cur}
                  prefix={repaid ? '−' : '+'}
                  tone={repaid ? 'positive' : 'default'}
                  className="text-[13px] font-medium"
                />
                {e.tx ? (
                  <button
                    type="button"
                    onClick={() => state.deleteTransaction(e.tx!.id)}
                    aria-label="Delete record"
                    className="w-6 h-6 grid place-items-center rounded-full text-[var(--text-faint)] hover:text-[var(--negative)] hover:bg-[var(--negative-soft)] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="w-6" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── The whole section ───────────────────────────────────────────────────────
export function PeopleIOwe() {
  const state = useStore();
  const { accounts, costs } = state;
  const [showArchived, setShowArchived] = useState(false);
  const [personSheet, setPersonSheet] = useState<{ open: boolean; person: Account | null }>({
    open: false,
    person: null,
  });
  const [borrowFor, setBorrowFor] = useState<string | null>(null);
  const [repayFor, setRepayFor] = useState<string | null>(null);

  const lenders = accounts
    .filter((a) => isLender(a) && (showArchived || !a.archived))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.order - b.order);
  const archivedCount = accounts.filter((a) => isLender(a) && a.archived).length;
  const unlinkedLoanCosts = getActivePlanCosts(costs).filter(
    (c) => c.categoryId === loanCostHome(state.settings).categoryId && !c.lenderId
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[18px] leading-[26px] font-semibold">People I owe</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Borrowed to pay something? Record it here, then pay them back in parts from your own money.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              {showArchived ? 'Hide' : 'Show'} repaid ({archivedCount})
            </button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setPersonSheet({ open: true, person: null })}>
            <Plus className="w-3.5 h-3.5" /> Add person
          </Button>
        </div>
      </div>

      {lenders.length === 0 ? (
        <button
          type="button"
          onClick={() => setPersonSheet({ open: true, person: null })}
          className="w-full text-left rounded-[18px] border border-dashed border-[var(--border-strong)] p-5 hover:bg-[var(--surface-2)]/50 transition-colors cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-full grid place-items-center bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
              <HandCoins className="w-5 h-5" />
            </span>
            <div className="text-sm">
              <p className="font-semibold">No loans — nice.</p>
              <p className="mt-0.5 text-[var(--text-muted)]">
                If a friend pays a cost for you (or lends you cash), add them here. The cost counts as paid,
                and what you owe is taken off your spare until you pay them back.
              </p>
            </div>
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lenders.map((l) => (
            <LenderCard
              key={l.id}
              lender={l}
              onRepay={() => setRepayFor(l.id)}
              onBorrow={() => setBorrowFor(l.id)}
              onEdit={() => setPersonSheet({ open: true, person: l })}
            />
          ))}
        </div>
      )}

      {unlinkedLoanCosts.length > 0 && (
        <p className="flex items-start gap-1.5 text-[11.5px] text-[var(--text-muted)]">
          <Info className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>
            Loan costs in your plan not linked to a person: {unlinkedLoanCosts.map((c) => c.name).join(', ')}.
            If one is money you owe someone here, use <b>Link to a loan cost</b> on their card (or open the
            cost and pick who you owe) so it’s tracked in one place and never counted twice.
          </span>
        </p>
      )}

      <PersonSheet
        open={personSheet.open}
        person={personSheet.person}
        onClose={() => setPersonSheet({ open: false, person: null })}
        onCreated={(acc, hadOpening) => {
          if (!hadOpening) setBorrowFor(acc.id);
        }}
      />
      <BorrowSheet
        lender={accounts.find((a) => a.id === borrowFor) ?? null}
        onClose={() => setBorrowFor(null)}
      />
      <RepaySheet
        lender={accounts.find((a) => a.id === repayFor) ?? null}
        onClose={() => setRepayFor(null)}
      />
    </section>
  );
}
