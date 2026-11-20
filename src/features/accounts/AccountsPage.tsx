import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Wallet,
  Building2,
  Banknote,
  CreditCard,
  Globe,
  Archive,
  Pencil,
  GripVertical,
  Receipt,
  Trash2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  accountBalance,
  accountBalancePkr,
  buildAccountLedger,
  selectTotalFundsPkr,
  selectTotalPaidPkr,
  selectPlanTotalEffectivePkr,
  selectPlanTotalMarketPkr,
  selectTotalGrossFundsPkr,
  selectTotalReservedPkr,
  selectTotalOwedPkr,
  isLender,
} from '../../store/selectors';
import { PeopleIOwe } from './PeopleIOwe';
import { Account, Currency, TxnType } from '../../types';
import {
  Amount,
  Button,
  Card,
  Chip,
  ColorSwatch,
  DateInput,
  EmptyState,
  Select,
  Sheet,
  Switch,
} from '../../components/ui';
import { parseAmount } from '../../lib/parseAmount';

const KIND_ICONS: Record<Account['kind'], typeof Wallet> = {
  bank: Building2,
  cash: Banknote,
  card: CreditCard,
  wallet: Wallet,
  foreign: Globe,
  other: Wallet,
};

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return (
      <div className="h-7 flex items-center">
        <div className="w-full h-[1px] bg-[var(--border)]" />
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 120;
  const h = 28;
  const pts = values
    .map((v, idx) => {
      const x = (idx / (values.length - 1)) * w;
      const y = h - 4 - ((v - min) / span) * (h - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

interface SortableAccountCardProps {
  account: Account;
  selected: boolean;
  onSelect: () => void;
  onAction: (action: 'deposit' | 'withdrawal' | 'transfer' | 'edit' | 'archive') => void;
}

function SortableAccountCard({
  account,
  selected,
  onSelect,
  onAction,
}: SortableAccountCardProps) {
  const transactions = useStore((s) => s.transactions);
  const settings = useStore((s) => s.settings);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: account.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const nativeBal = accountBalance(account, transactions);
  const pkrBal = accountBalancePkr(account, transactions, settings);
  const usdBal =
    account.currency === 'USD'
      ? nativeBal
      : nativeBal / (settings.rates.effective || 300);

  const ledger = useMemo(
    () => buildAccountLedger(account, transactions),
    [account, transactions]
  );

  const sparkValues = useMemo(() => {
    const chronological = ledger.slice().reverse().map((r) => r.runningBalance);
    return [account.openingBalance, ...chronological].slice(-12);
  }, [account.openingBalance, ledger]);

  const KindIcon = KIND_ICONS[account.kind] ?? Wallet;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[16px] border transition-colors p-4 bg-[var(--surface)] ${
        selected
          ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
          : 'border-[var(--border)]'
      } ${account.archived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          onClick={onSelect}
          className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
        >
          <span
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder account"
            className="text-[var(--text-muted)] cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4" />
          </span>
          <span
            className="w-7 h-7 rounded-[8px] grid place-items-center text-white shrink-0"
            style={{ backgroundColor: account.color }}
          >
            <KindIcon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text)] truncate">
              {account.name}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] uppercase">
              {account.kind} · {account.currency}
              {!account.includeInTotals ? ' · Excluded' : ''}
            </p>
          </div>
        </div>
        {account.reserved && account.reserved > 0 ? (
          <Chip variant="warning">
            Reserved{' '}
            <Amount
              pkr={
                account.currency === 'PKR'
                  ? account.reserved
                  : account.reserved * settings.rates.market
              }
              usd={
                account.currency === 'USD'
                  ? account.reserved
                  : account.reserved / settings.rates.effective
              }
              displayCurrency={account.currency}
              compact
            />
          </Chip>
        ) : null}
      </div>

      <div
        onClick={onSelect}
        className="mt-3 flex items-end justify-between gap-2 cursor-pointer"
      >
        <div>
          <div className="text-2xl font-semibold num">
            <Amount
              pkr={pkrBal}
              usd={usdBal}
              displayCurrency={account.currency}
            />
          </div>
          <div className="text-xs text-[var(--text-muted)] num mt-0.5">
            ≈{' '}
            <Amount
              pkr={pkrBal}
              usd={usdBal}
              displayCurrency={account.currency === 'PKR' ? 'USD' : 'PKR'}
              tone="muted"
            />
          </div>
        </div>
        <Sparkline values={sparkValues} color={account.color} />
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => onAction('deposit')}
          className="px-2 py-1 rounded-[8px] bg-[var(--surface-2)] hover:bg-[var(--border)] font-medium cursor-pointer"
        >
          + Deposit
        </button>
        <button
          type="button"
          onClick={() => onAction('withdrawal')}
          className="px-2 py-1 rounded-[8px] bg-[var(--surface-2)] hover:bg-[var(--border)] font-medium cursor-pointer"
        >
          − Withdraw
        </button>
        <button
          type="button"
          onClick={() => onAction('transfer')}
          className="px-2 py-1 rounded-[8px] bg-[var(--surface-2)] hover:bg-[var(--border)] font-medium cursor-pointer"
        >
          ⇄ Transfer
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onAction('edit')}
          aria-label="Edit account"
          className="p-1.5 rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onAction('archive')}
          aria-label={account.archived ? 'Unarchive account' : 'Archive account'}
          className="p-1.5 rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function AccountsPage() {
  const state = useStore();
  const { accounts, transactions, costs, settings } = state;

  const [showArchived, setShowArchived] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    accounts[0]?.id ?? null
  );

  // Account Add/Edit Sheet
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accName, setAccName] = useState('');
  const [accKind, setAccKind] = useState<Account['kind']>('bank');
  const [accCurrency, setAccCurrency] = useState<Currency>('PKR');
  const [accOpening, setAccOpening] = useState('0');
  const [accReserved, setAccReserved] = useState('0');
  const [accColor, setAccColor] = useState('#6366F1');
  const [accInclude, setAccInclude] = useState(true);
  const [accNote, setAccNote] = useState('');

  // Deposit / Withdraw / Transfer Sheet
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [txMode, setTxMode] = useState<'deposit' | 'withdrawal' | 'transfer'>('deposit');
  const [txAccountId, setTxAccountId] = useState<string>('');
  const [txToAccountId, setTxToAccountId] = useState<string>('');
  const [txAmount, setTxAmount] = useState('');
  const [txToAmount, setTxToAmount] = useState('');
  const [txDate, setTxDate] = useState<string | null>(
    new Date().toISOString().slice(0, 10)
  );
  const [txNote, setTxNote] = useState('');
  const [txError, setTxError] = useState<string | null>(null);

  // Ledger filters
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | TxnType>('all');
  const [ledgerFromDate, setLedgerFromDate] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // my own money only — people I owe live in their own section
  const myAccounts = useMemo(() => accounts.filter((a) => !isLender(a)), [accounts]);
  const visibleAccounts = useMemo(
    () =>
      myAccounts
        .filter((a) => (showArchived ? true : !a.archived))
        .slice()
        .sort((a, b) => a.order - b.order),
    [myAccounts, showArchived]
  );

  const activeAccount =
    myAccounts.find((a) => a.id === selectedAccountId) ?? visibleAccounts[0] ?? null;

  const grossFundsPkr = selectTotalGrossFundsPkr(state);
  const reservedPkr = selectTotalReservedPkr(state);
  const availablePkr = selectTotalFundsPkr(state);
  const owedPkr = selectTotalOwedPkr(state);
  const lenderCount = accounts.filter((a) => isLender(a) && !a.archived).length;

  const openNewAccountSheet = () => {
    setEditingAccount(null);
    setAccName('');
    setAccKind('bank');
    setAccCurrency('PKR');
    setAccOpening('0');
    setAccReserved('0');
    setAccColor('#6366F1');
    setAccInclude(true);
    setAccNote('');
    setAccountSheetOpen(true);
  };

  const openEditAccountSheet = (acc: Account) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccKind(acc.kind);
    setAccCurrency(acc.currency);
    setAccOpening(String(acc.openingBalance));
    setAccReserved(String(acc.reserved ?? 0));
    setAccColor(acc.color);
    setAccInclude(acc.includeInTotals);
    setAccNote(acc.note ?? '');
    setAccountSheetOpen(true);
  };

  const handleSaveAccount = () => {
    if (!accName.trim()) return;
    const opening = Math.max(0, parseAmount(accOpening) ?? 0);
    const reserved = Math.max(0, parseAmount(accReserved) ?? 0);
    if (editingAccount) {
      state.updateAccount(editingAccount.id, {
        name: accName.trim(),
        kind: accKind,
        currency: accCurrency,
        openingBalance: opening,
        reserved: reserved > 0 ? reserved : undefined,
        color: accColor,
        includeInTotals: accInclude,
        note: accNote.trim() || undefined,
      });
    } else {
      const created = state.addAccount({
        name: accName.trim(),
        kind: accKind,
        currency: accCurrency,
        openingBalance: opening,
        reserved: reserved > 0 ? reserved : undefined,
        color: accColor,
        icon: 'Wallet',
        includeInTotals: accInclude,
        note: accNote.trim() || undefined,
      });
      setSelectedAccountId(created.id);
    }
    setAccountSheetOpen(false);
  };

  const openTxSheet = (
    mode: 'deposit' | 'withdrawal' | 'transfer',
    sourceAccount?: Account
  ) => {
    const src = sourceAccount ?? activeAccount ?? myAccounts[0];
    if (!src) return;
    setTxMode(mode);
    setTxAccountId(src.id);
    const other = myAccounts.find((a) => a.id !== src.id && !a.archived);
    setTxToAccountId(other?.id ?? '');
    setTxAmount('');
    setTxToAmount('');
    setTxDate(new Date().toISOString().slice(0, 10));
    setTxNote('');
    setTxError(null);
    setTxSheetOpen(true);
  };

  const srcAcc = accounts.find((a) => a.id === txAccountId);
  const dstAcc = accounts.find((a) => a.id === txToAccountId);
  const isCrossCurrency =
    txMode === 'transfer' && srcAcc && dstAcc && srcAcc.currency !== dstAcc.currency;

  const handleTxAmountChange = (val: string) => {
    setTxAmount(val);
    const parsed = parseAmount(val);
    if (isCrossCurrency && parsed && parsed > 0 && srcAcc && dstAcc) {
      const m = settings.rates.market || 280;
      const converted =
        srcAcc.currency === 'USD' ? Math.round(parsed * m) : Number((parsed / m).toFixed(2));
      setTxToAmount(String(converted));
    }
  };

  const handleSaveTx = () => {
    setTxError(null);
    const amt = parseAmount(txAmount);
    if (!amt || amt <= 0) {
      setTxError('Amount must be greater than 0.');
      return;
    }
    if (txMode === 'transfer') {
      if (!txToAccountId || txToAccountId === txAccountId) {
        setTxError('Source and destination accounts must differ.');
        return;
      }
    }
    const toAmt = isCrossCurrency ? parseAmount(txToAmount) ?? amt : amt;

    state.addTransaction({
      type: txMode,
      date: txDate ?? new Date().toISOString().slice(0, 10),
      accountId: txAccountId,
      toAccountId: txMode === 'transfer' ? txToAccountId : undefined,
      amount: amt,
      toAmount: txMode === 'transfer' ? toAmt : undefined,
      note: txNote.trim() || undefined,
    });
    setTxSheetOpen(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleAccounts.findIndex((a) => a.id === active.id);
    const newIndex = visibleAccounts.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextOrder = arrayMove(visibleAccounts, oldIndex, newIndex).map((a) => a.id);
    state.reorderAccounts(nextOrder);
  };

  const ledgerRows = useMemo(() => {
    if (!activeAccount) return [];
    return buildAccountLedger(activeAccount, transactions).filter((r) => {
      if (ledgerTypeFilter !== 'all' && r.tx.type !== ledgerTypeFilter) return false;
      if (ledgerFromDate && r.tx.date < ledgerFromDate) return false;
      return true;
    });
  }, [activeAccount, transactions, ledgerTypeFilter, ledgerFromDate]);

  const impliedRate = useMemo(() => {
    if (!isCrossCurrency || !srcAcc || !dstAcc) return null;
    const a1 = parseAmount(txAmount) ?? 0;
    const a2 = parseAmount(txToAmount) ?? 0;
    if (a1 <= 0 || a2 <= 0) return null;
    return srcAcc.currency === 'USD' ? a2 / a1 : a1 / a2;
  }, [isCrossCurrency, srcAcc, dstAcc, txAmount, txToAmount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] leading-[32px] font-semibold tracking-[-0.03em]">Money</h1>
        </div>
        <div className="flex items-center gap-2">
          {myAccounts.length >= 2 && (
            <Button variant="secondary" onClick={() => openTxSheet('transfer')}>
              <ArrowLeftRight className="w-4 h-4" />
              Transfer
            </Button>
          )}
          <Button onClick={openNewAccountSheet}>
            <Plus className="w-4 h-4" />
            Add account
          </Button>
        </div>
      </div>

      {/* Top summary: my money · what I owe people · what's really mine */}
      <div className={`grid grid-cols-1 gap-4 ${owedPkr > 0.5 || lenderCount > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Card>
          <p className="label-micro">My money</p>
          <div className="text-2xl font-semibold mt-1">
            <Amount pkr={availablePkr} tone="positive" showSecondary />
          </div>
          {reservedPkr > 0 && (
            <p className="mt-1 text-[11.5px] text-[var(--text-muted)] num">
              <Amount pkr={grossFundsPkr} compact tone="muted" /> in accounts ·{' '}
              <Amount pkr={reservedPkr} compact tone="warning" /> reserved
            </p>
          )}
        </Card>
        {(owedPkr > 0.5 || lenderCount > 0) && (
          <Card>
            <p className="label-micro">I owe people</p>
            <div className="text-2xl font-semibold mt-1">
              <Amount pkr={owedPkr} tone={owedPkr > 0.5 ? 'negative' : 'muted'} showSecondary />
            </div>
            <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">
              {lenderCount} {lenderCount === 1 ? 'person' : 'people'}
            </p>
          </Card>
        )}
        <Card>
          <p className="label-micro">{owedPkr > 0.5 ? 'Mine after repaying' : 'Reserved (earmarked)'}</p>
          <div className="text-2xl font-semibold mt-1">
            {owedPkr > 0.5 ? (
              <Amount pkr={availablePkr - owedPkr} tone={availablePkr - owedPkr >= 0 ? 'default' : 'negative'} showSecondary />
            ) : (
              <Amount pkr={reservedPkr} tone="warning" showSecondary />
            )}
          </div>
        </Card>
      </div>

      {/* Against the plan: both conversions side by side */}
      {(() => {
        const paid = selectTotalPaidPkr(state);
        const rows = [
          { label: `After tax · ₨${settings.rates.effective}/$`, plan: selectPlanTotalEffectivePkr(state) },
          { label: `Market · ₨${settings.rates.market.toFixed(1)}/$`, plan: selectPlanTotalMarketPkr(state) },
        ];
        return (
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[15px] font-semibold">Against your plan</p>
              <span className="text-xs text-[var(--text-muted)]">
                confirmed costs{owedPkr > 0.5 ? ' · after repaying loans' : ''}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {rows.map((r) => {
                const gap = availablePkr - owedPkr - Math.max(0, r.plan - paid);
                return (
                  <div key={r.label} className="rounded-[14px] bg-[var(--surface-2)] px-4 py-3">
                    <p className="text-[11px] text-[var(--text-muted)] num">{r.label}</p>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-sm">
                        Total plan <b className="num"><Amount pkr={r.plan} /></b>
                      </span>
                      <span className="text-sm font-semibold num">
                        <Amount pkr={Math.abs(gap)} prefix={gap >= 0 ? '+' : '−'} tone={gap >= 0 ? 'positive' : 'negative'} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Accounts grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[18px] leading-[26px] font-semibold">My money</h2>
            <p className="text-xs text-[var(--text-muted)]">Your own accounts — this is what everything is paid from.</p>
          </div>
          {myAccounts.some((a) => a.archived) && (
            <Switch
              checked={showArchived}
              onChange={setShowArchived}
              label="Show archived"
            />
          )}
        </div>

        {visibleAccounts.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-6 h-6" />}
            message="No accounts added yet. Add your bank, cash, or USD card to track your USMLE funds."
            actionLabel="+ Add account"
            onAction={openNewAccountSheet}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleAccounts.map((a) => a.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleAccounts.map((acc) => (
                  <SortableAccountCard
                    key={acc.id}
                    account={acc}
                    selected={activeAccount?.id === acc.id}
                    onSelect={() => setSelectedAccountId(acc.id)}
                    onAction={(act) => {
                      if (act === 'edit') openEditAccountSheet(acc);
                      else if (act === 'archive')
                        state.updateAccount(acc.id, { archived: !acc.archived });
                      else openTxSheet(act, acc);
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <PeopleIOwe />

      {/* Account detail: ledger table (§6.3) */}
      {activeAccount && (
        <Card
          title={`Ledger · ${activeAccount.name}`}
          subtitle={`Opening balance: ${
            activeAccount.currency === 'PKR' ? '₨ ' : '$'
          }${activeAccount.openingBalance.toLocaleString('en-US')}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Filter transaction type"
                value={ledgerTypeFilter}
                onChange={(v) => setLedgerTypeFilter(v as 'all' | TxnType)}
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'deposit', label: 'Deposits' },
                  { value: 'withdrawal', label: 'Withdrawals' },
                  { value: 'transfer', label: 'Transfers' },
                  { value: 'payment', label: 'Payments' },
                ]}
              />
              <DateInput
                aria-label="Filter from date"
                value={ledgerFromDate}
                onChange={setLedgerFromDate}
              />
            </div>
          }
        >
          {ledgerRows.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">
              No transactions recorded for this account yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Note / Linked Cost</th>
                    <th className="py-2 pr-3 font-medium text-right">Amount</th>
                    <th className="py-2 pr-3 font-medium text-right">Running Balance</th>
                    <th className="py-2 font-medium w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {ledgerRows.map(({ tx, signedAmount, runningBalance }) => {
                    const linkedCost = tx.costId
                      ? costs.find((c) => c.id === tx.costId)
                      : undefined;
                    const isPositive = signedAmount >= 0;
                    const absAmt = Math.abs(signedAmount);
                    const pkrVal =
                      activeAccount.currency === 'PKR'
                        ? absAmt
                        : absAmt * settings.rates.market;
                    const usdVal =
                      activeAccount.currency === 'USD'
                        ? absAmt
                        : absAmt / settings.rates.effective;
                    const runPkr =
                      activeAccount.currency === 'PKR'
                        ? runningBalance
                        : runningBalance * settings.rates.market;
                    const runUsd =
                      activeAccount.currency === 'USD'
                        ? runningBalance
                        : runningBalance / settings.rates.effective;

                    return (
                      <tr key={tx.id}>
                        <td className="py-2.5 pr-3 num text-xs text-[var(--text-muted)]">
                          {tx.date}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize">
                            {tx.type === 'deposit' && (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-[var(--positive)]" />
                            )}
                            {tx.type === 'withdrawal' && (
                              <ArrowUpRight className="w-3.5 h-3.5 text-[var(--negative)]" />
                            )}
                            {tx.type === 'transfer' && (
                              <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--accent)]" />
                            )}
                            {tx.type === 'payment' && (
                              <Receipt className="w-3.5 h-3.5 text-[var(--warning)]" />
                            )}
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{tx.note || '—'}</span>
                            {linkedCost && (
                              <Chip variant="accent">{linkedCost.name}</Chip>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-right num font-medium">
                          <Amount
                            pkr={pkrVal}
                            usd={usdVal}
                            displayCurrency={activeAccount.currency}
                            prefix={isPositive ? '+' : '−'}
                            tone={isPositive ? 'positive' : 'negative'}
                          />
                        </td>
                        <td className="py-2.5 pr-3 text-right num">
                          <Amount
                            pkr={runPkr}
                            usd={runUsd}
                            displayCurrency={activeAccount.currency}
                          />
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => state.deleteTransaction(tx.id)}
                            aria-label="Delete transaction"
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--negative)] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Account Add/Edit Sheet */}
      <Sheet
        open={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        title={editingAccount ? 'Edit account' : 'Add account'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAccountSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAccount}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Account name
            </label>
            <input
              type="text"
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              placeholder="e.g. Main Bank PKR, USD Card"
              className="field"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Account kind"
              value={accKind}
              onChange={(v) => setAccKind(v as Account['kind'])}
              options={[
                { value: 'bank', label: 'Bank' },
                { value: 'cash', label: 'Cash' },
                { value: 'card', label: 'Card' },
                { value: 'wallet', label: 'Wallet' },
                { value: 'foreign', label: 'Foreign account' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <Select
              label="Currency"
              value={accCurrency}
              onChange={(v) => setAccCurrency(v as Currency)}
              options={[
                { value: 'PKR', label: 'PKR (₨)' },
                { value: 'USD', label: 'USD ($)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Opening balance ({accCurrency})
              </label>
              <input
                type="text"
                value={accOpening}
                onChange={(e) => setAccOpening(e.target.value)}
                placeholder="e.g. 4.8m or 950k"
                className="field num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Reserved / do-not-touch ({accCurrency})
              </label>
              <input
                type="text"
                value={accReserved}
                onChange={(e) => setAccReserved(e.target.value)}
                placeholder="0"
                className="field num"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Colour
            </label>
            <ColorSwatch value={accColor} onChange={setAccColor} />
          </div>

          <Switch
            checked={accInclude}
            onChange={setAccInclude}
            label="Include in total plan funds"
          />

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              value={accNote}
              onChange={(e) => setAccNote(e.target.value)}
              placeholder="Optional note"
              className="field"
            />
          </div>
        </div>
      </Sheet>

      {/* Deposit / Withdraw / Transfer Sheet (§6.3) */}
      <Sheet
        open={txSheetOpen}
        onClose={() => setTxSheetOpen(false)}
        title={
          txMode === 'deposit'
            ? 'Deposit funds'
            : txMode === 'withdrawal'
              ? 'Withdraw funds'
              : 'Transfer between accounts'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setTxSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTx}>Record {txMode}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={txMode === 'transfer' ? 'From account' : 'Account'}
            value={txAccountId}
            onChange={setTxAccountId}
            options={myAccounts
              .filter((a) => !a.archived)
              .map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
          />

          {txMode === 'transfer' && (
            <Select
              label="To account"
              value={txToAccountId}
              onChange={setTxToAccountId}
              options={myAccounts
                .filter((a) => !a.archived && a.id !== txAccountId)
                .map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
            />
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Amount ({srcAcc?.currency ?? 'PKR'})
            </label>
            <input
              type="text"
              value={txAmount}
              onChange={(e) => handleTxAmountChange(e.target.value)}
              placeholder="e.g. 50k"
              className="field num"
              autoFocus
            />
          </div>

          {isCrossCurrency && dstAcc && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Received in {dstAcc.name} ({dstAcc.currency})
              </label>
              <input
                type="text"
                value={txToAmount}
                onChange={(e) => setTxToAmount(e.target.value)}
                className="field num"
              />
              {impliedRate && (
                <p className="mt-1 text-xs text-[var(--text-muted)] num">
                  Implied rate: 1 USD = ₨ {impliedRate.toFixed(2)}
                </p>
              )}
            </div>
          )}

          <DateInput label="Date" value={txDate} onChange={setTxDate} />

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Note
            </label>
            <input
              type="text"
              value={txNote}
              onChange={(e) => setTxNote(e.target.value)}
              placeholder="Optional description"
              className="field"
            />
          </div>

          {txError && <p className="text-xs text-[var(--negative)]">{txError}</p>}
        </div>
      </Sheet>
    </div>
  );
}
