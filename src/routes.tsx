import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CostsPage } from './features/costs/CostsPage';
import { AccountsPage } from './features/accounts/AccountsPage';
import { TasksPage } from './features/tasks/TasksPage';
import { PlannerPage } from './features/planner/PlannerPage';
import { SettingsPage } from './features/settings/SettingsPage';

export function AppRoutes() {
  return (
    <div>
      <nav className="flex gap-4 p-4 border-b text-sm">
        <Link to="/">Dashboard</Link>
        <Link to="/costs">Costs</Link>
        <Link to="/accounts">Accounts</Link>
        <Link to="/tasks">Tasks</Link>
        <Link to="/planner">Planner</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
