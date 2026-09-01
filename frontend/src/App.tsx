import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireRole, RootRedirect } from './auth/RequireRole';
import { LoginPage } from './pages/Login';

import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminEntries } from './pages/admin/Entries';
import { PendingApprovals } from './pages/admin/PendingApprovals';
import { AdminCompanies } from './pages/admin/Companies';
import { LabourManagement } from './pages/admin/LabourManagement';
import { AdminAttendance } from './pages/admin/Attendance';
import { AdminReports } from './pages/admin/Reports';
import { AdminSettings } from './pages/admin/Settings';
import { AdminAuditLogs } from './pages/admin/AuditLogs';
import { AdminUsers } from './pages/admin/Users';

import { OwnerLayout } from './layouts/OwnerLayout';
import { OwnerDashboard } from './pages/owner/Dashboard';
import { OwnerEntries } from './pages/owner/Entries';
import { OwnerCompanies } from './pages/owner/Companies';
import { OwnerReports } from './pages/owner/Reports';

import { LabourLayout } from './layouts/LabourLayout';
import { LabourHome } from './pages/labour/Home';
import { LabourAddEntry } from './pages/labour/AddEntry';
import { LabourHistory, LabourMe } from './pages/labour/History';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />

          <Route path="/admin" element={<RequireRole role="ADMIN"><AdminLayout /></RequireRole>}>
            <Route index element={<AdminDashboard />} />
            <Route path="entries" element={<AdminEntries />} />
            <Route path="approvals" element={<PendingApprovals />} />
            <Route path="companies" element={<AdminCompanies />} />
            <Route path="labour" element={<LabourManagement />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>

          <Route path="/owner" element={<RequireRole role="OWNER"><OwnerLayout /></RequireRole>}>
            <Route index element={<OwnerDashboard />} />
            <Route path="entries" element={<OwnerEntries />} />
            <Route path="companies" element={<OwnerCompanies />} />
            <Route path="reports" element={<OwnerReports />} />
          </Route>

          <Route path="/labour" element={<RequireRole role="LABOUR"><LabourLayout /></RequireRole>}>
            <Route index element={<LabourHome />} />
            <Route path="add" element={<LabourAddEntry />} />
            <Route path="edit/:entryId" element={<LabourAddEntry />} />
            <Route path="history" element={<LabourHistory />} />
            <Route path="me" element={<LabourMe />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
