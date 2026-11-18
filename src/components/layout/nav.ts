import { CheckCircle2, Home, LineChart, Receipt, Wallet } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/costs', label: 'Costs', icon: Receipt },
  { to: '/tasks', label: 'Tasks', icon: CheckCircle2 },
  { to: '/accounts', label: 'Money', icon: Wallet },
  { to: '/planner', label: 'Planner', icon: LineChart },
] as const;
