import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Plus, Undo2, Unlink } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { isLender, lenderStats } from '../../store/selectors';
import { Account, Cost } from '../../types';
import { Button, Progress, Select } from '../../components/ui';
import { BorrowSheet, Native, RepaySheet } from '../accounts/PeopleIOwe';

/** Shown instead of "Paid" on a loan cost that follows a person. */
export function LinkedLoanPanel({ cost, lender }: { cost: Cost; lender: Account }) {
  const state = useStore();
  const [repay, setRepay] = useState(false);
  const [borrow, setBorrow] = useState(false);
  const s = lenderStats(lender, state.transactions);
  const cur = lender.currency;
  const pct = s.borrowed > 0 ? Math.min(100, (s.repaid / s.borrowed) * 100) : 0;
  const cleared = s.owed <= 0.5;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 min-h-6">
        <p className="label-micro">Owed to {lender.name}</p>
        <Link
          to="/accounts"
          className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          Open in Money
        </Link>
      </div>
      <div className="rounded-[14px] bg-[var(--surface-2)]/60 p-3 space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          {cleared ? (
            <span className="text-sm font-semibold text-[var(--positive)]">All paid back</span>
          ) : (
            <span className="text-sm">
              Still owe <Native n={s.owed} currency={cur} tone="negative" className="font-semibold" />
            </span>
          )}
          <span className="text-[11.5px] text-[var(--text-muted)] num">
            repaid <Native n={s.repaid} currency={cur} compact tone="positive" /> of{' '}
            <Native n={s.borrowed} currency={cur} compact />
          </span>
        </div>
        <Progress value={pct} tone="positive" />
        <div className="flex flex-wrap items-center gap-2">
          {!cleared && (
            <Button size="sm" onClick={() => setRepay(true)}>
              <Undo2 className="w-3.5 h-3.5" /> Pay back
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setBorrow(true)}>
            <Plus className="w-3.5 h-3.5" /> Took more
          </Button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => state.unlinkCost(cost.id)}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <Unlink className="w-3.5 h-3.5" /> Unlink
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-faint)]">
          This cost always equals what you took from {lender.name}. Paying them back (in parts is fine) counts
          as paid here.
        </p>
      </div>
      <RepaySheet lender={repay ? lender : null} onClose={() => setRepay(false)} />
      <BorrowSheet lender={borrow ? lender : null} onClose={() => setBorrow(false)} />
    </div>
  );
}

const NEW = '__new_person';

/** "Do I owe this to a person?" — link a plain cost to someone in Money → People I owe. */
export function LoanPersonPicker({ cost, prominent }: { cost: Cost; prominent?: boolean }) {
  const state = useStore();
  const free = state.accounts.filter(
    (a) => isLender(a) && !a.archived && !state.costs.some((c) => c.lenderId === a.id)
  );
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(free[0]?.id ?? NEW);
  const [name, setName] = useState('');

  const link = () => {
    let lenderId = choice;
    if (choice === NEW) {
      if (!name.trim()) return;
      lenderId = state.addAccount({
        name: name.trim(),
        kind: 'other',
        role: 'lender',
        currency: cost.money.currency,
        openingBalance: 0,
        color: '#F97316',
        icon: 'UserRound',
        includeInTotals: false,
      }).id;
    }
    state.linkCostToLender(cost.id, lenderId);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 text-[12.5px] cursor-pointer ${
          prominent
            ? 'w-full rounded-[12px] border border-dashed border-[var(--border-strong)] px-3 py-2.5 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]/50'
            : 'text-[var(--text-muted)] hover:text-[var(--text)]'
        }`}
      >
        <Link2 className="w-3.5 h-3.5" /> Owe this to a person? Link it to them in Money
      </button>
    );
  }

  return (
    <div className="rounded-[14px] bg-[var(--surface-2)]/60 p-3 space-y-2 animate-fade-in">
      <div className="flex flex-wrap items-end gap-2">
        <Select
          label="Who do you owe?"
          value={choice}
          onChange={setChoice}
          options={[
            ...free.map((a) => ({ value: a.id, label: a.name })),
            { value: NEW, label: '+ New person…' },
          ]}
          className="flex-1 min-w-[150px]"
        />
        {choice === NEW && (
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Name</label>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && link()}
              placeholder="e.g. Bhai Raheel"
              autoFocus
            />
          </div>
        )}
        <Button onClick={link} className="h-[38px]" disabled={choice === NEW && !name.trim()}>
          <Link2 className="w-3.5 h-3.5" /> Link
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} className="h-[38px]">
          Cancel
        </Button>
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">
        Then the amount follows what you took from them, and paying them back (in parts) pays this cost.
        Payments already recorded here become repayments.
      </p>
    </div>
  );
}
