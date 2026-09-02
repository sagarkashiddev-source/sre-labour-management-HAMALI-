import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function OwnerLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const NAV_ITEMS = [
    { to: '/owner', label: t('owner.nav.dashboard'), end: true },
    { to: '/owner/entries', label: t('owner.nav.entries') },
    { to: '/owner/companies', label: t('owner.nav.companies') },
    { to: '/owner/reports', label: t('owner.nav.reports') },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <aside className="hidden w-56 flex-shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-6 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700 text-sm font-bold text-white">SR</div>
          <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">SRE</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-5">
          {NAV_ITEMS.map((item) => (
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
        </nav>
        <div className="border-t border-slate-100 px-3 py-4 dark:border-slate-800">
          <LanguageSwitcher />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 md:px-8">
          <p className="text-sm font-medium text-slate-500">{t('owner.portal')}</p>
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
