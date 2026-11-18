import { CostStatus } from '../../store/selectors';
import { ChipVariant } from '../../components/ui';

export const STATUS_LABEL: Record<CostStatus, string> = {
  paid: 'Paid',
  partial: 'Part paid',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  planned: 'Planned',
};

export const STATUS_VARIANT: Record<CostStatus, ChipVariant> = {
  paid: 'positive',
  partial: 'accent',
  due_soon: 'warning',
  overdue: 'negative',
  planned: 'default',
};

export const todayIso = () => new Date().toISOString().slice(0, 10);
