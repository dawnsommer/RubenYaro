import { CheckCircle2, Home, Landmark, LineChart, Receipt, Wallet } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'Home', short: 'Home', icon: Home, end: true },
  { to: '/costs', label: 'Costs', short: 'Costs', icon: Receipt },
  { to: '/tasks', label: 'Tasks', short: 'Tasks', icon: CheckCircle2 },
  { to: '/accounts', label: 'Money', short: 'Money', icon: Wallet },
  { to: '/planner', label: 'Planner', short: 'Planner', icon: LineChart },
  { to: '/inheritance', label: 'Inheritance', short: 'Inherit', icon: Landmark },
] as const;
