import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function AdminLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const NAV_SECTIONS = [
    { label: t('admin.nav.sectionMain'), items: [
      { to: '/admin', label: t('admin.nav.dashboard'), end: true },
      { to: '/admin/entries', label: t('admin.nav.entries') },
      { to: '/admin/approvals', label: t('admin.nav.pendingApprovals') },
    ]},
    { label: t('admin.nav.sectionManagement'), items: [
      { to: '/admin/companies', label: t('admin.nav.companies') },
      { to: '/admin/labour', label: t('admin.nav.labour') },
      { to: '/admin/attendance', label: t('admin.nav.attendance') },
    ]},
    { label: t('admin.nav.sectionReports'), items: [
      { to: '/admin/reports', label: t('admin.nav.reports') },
    ]},
    { label: t('admin.nav.sectionSystem'), items: [
      { to: '/admin/users', label: t('admin.nav.users') },
      { to: '/admin/settings', label: t('admin.nav.settings') },
      { to: '/admin/audit-logs', label: t('admin.nav.auditLogs') },
    ]},
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-6 dark:border-slate-800">
          <img src="/icons/icon-192.png" alt="Sagar Roadways and Enterprises" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">SRE Admin</span>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-100 px-3 py-4 dark:border-slate-800">
          <LanguageSwitcher />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 md:px-8">
          <p className="text-sm text-slate-400">{t('admin.searchPlaceholder')}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{user?.name}</span>
            <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-danger-600">
              {t('common.logout')}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
