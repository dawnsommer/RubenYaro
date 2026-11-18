import { Account, Cost, Settings, Transaction } from '../types';
import { costPaid, costSource, costStatus, costTotal } from '../store/selectors';
import { getConversionContext, moneyToUsd } from './currency';

function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCostsCsv(
  costs: Cost[],
  settings: Settings,
  transactions: Transaction[],
  accounts: Account[]
): string {
  const ctx = getConversionContext(settings);
  const phaseMap = new Map(settings.phases.map((p) => [p.id, p.name]));
  const catMap = new Map(settings.categories.map((c) => [c.id, c.name]));

  const headers = [
    'Name',
    'Phase',
    'Category',
    'Kind',
    'Priority',
    'Maybe',
    'Included',
    'USD',
    'PKR',
    'Paid (PKR)',
    'Status',
    'Due Date',
  ];

  const rows = costs.map((c) => {
    const src = costSource(c);
    const totalPkr = Math.round(costTotal(c, settings));
    const occ = c.recurrence?.occurrences ?? 1;
    const totalUsd =
      Math.round(
        moneyToUsd({ amount: totalPkr, currency: 'PKR' }, ctx, c.conversionMode, c.tax) *
          100
      ) / 100;
    const paidPkr = Math.round(costPaid(c, transactions, accounts, settings));
    const status = costStatus(c, transactions, accounts, settings);

    return [
      c.name,
      phaseMap.get(c.phaseId) ?? c.phaseId,
      catMap.get(c.categoryId) ?? c.categoryId,
      c.kind,
      c.priority,
      c.maybe ? 'Yes' : 'No',
      c.included ? 'Yes' : 'No',
      src.money.currency === 'USD' && src.subCosts.length === 0
        ? src.money.amount * occ
        : totalUsd,
      totalPkr,
      paidPkr,
      status,
      c.dueDate ?? '',
    ].map(escapeCsvCell);
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
