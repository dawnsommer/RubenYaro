import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CostsPage } from './features/costs/CostsPage';
import { AccountsPage } from './features/accounts/AccountsPage';
import { TasksPage } from './features/tasks/TasksPage';
import { PlannerPage } from './features/planner/PlannerPage';
import { InheritancePage } from './features/inheritance/InheritancePage';
import { SettingsPage } from './features/settings/SettingsPage';

export function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/inheritance" element={<InheritancePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
