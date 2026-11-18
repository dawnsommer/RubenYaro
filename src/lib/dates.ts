import { addWeeks, addMonths, addYears, format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { Recurrence } from '../types';

export function formatShortDate(isoDate?: string | null): string {
  if (!isoDate) return '';
  try {
    const d = parseISO(isoDate);
    if (!isValid(d)) return isoDate;
    return format(d, 'd MMM yyyy');
  } catch {
    return isoDate;
  }
}

export function formatMonthYear(isoDate?: string | null): string {
  if (!isoDate) return 'No due date';
  try {
    const d = parseISO(isoDate);
    if (!isValid(d)) return 'No due date';
    return format(d, 'MMMM yyyy');
  } catch {
    return 'No due date';
  }
}

export function daysUntil(isoDate: string, todayIso = new Date().toISOString().slice(0, 10)): number {
  try {
    const target = parseISO(isoDate);
    const today = parseISO(todayIso);
    if (!isValid(target) || !isValid(today)) return 0;
    return differenceInCalendarDays(target, today);
  } catch {
    return 0;
  }
}

export function generateRecurrenceDates(rec: Recurrence): string[] {
  const dates: string[] = [];
  let base: Date;
  try {
    base = parseISO(rec.startDate);
    if (!isValid(base)) base = new Date();
  } catch {
    base = new Date();
  }

  const count = Math.max(1, Math.min(60, rec.occurrences || 1));
  const step = Math.max(1, rec.interval || 1);

  for (let i = 0; i < count; i++) {
    let d = base;
    if (i > 0) {
      if (rec.frequency === 'weekly') d = addWeeks(base, i * step);
      else if (rec.frequency === 'monthly') d = addMonths(base, i * step);
      else d = addYears(base, i * step);
    }
    dates.push(format(d, 'yyyy-MM-dd'));
  }

  return dates;
}
