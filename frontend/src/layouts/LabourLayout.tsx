import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import React from 'react';

export function LabourLayout() {
  const { t } = useTranslation();
  const NAV_ITEMS = [
    { to: '/labour', label: t('labour.nav.home'), end: true, icon: HomeIcon },
    { to: '/labour/add', label: t('labour.nav.entry'), end: false, icon: PlusIcon },
    { to: '/labour/history', label: t('labour.nav.history'), end: false, icon: HistoryIcon },
    { to: '/labour/me', label: t('labour.nav.me'), end: false, icon: UserIcon },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 dark:bg-slate-900">
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-xs font-medium ${
                  isActive ? 'text-primary-700' : 'text-slate-400'
                }`
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function LabourTopBar({ title, showLanguage = false }: { title: string; showLanguage?: boolean }) {
  const { logout } = useAuth();
  const { t } = useTranslation();
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <span className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</span>
      <div className="flex items-center gap-3">
        {showLanguage && <LanguageSwitcher />}
        <button onClick={logout} className="text-xs font-medium text-slate-400">
          {t('common.logout')}
        </button>
      </div>
    </div>
  );
}

// Minimal inline icons so the app has zero extra icon-library weight for
// the mobile bundle Labour actually downloads on a phone connection.
function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}
function HistoryIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
    </svg>
  );
}
function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" strokeLinecap="round" />
    </svg>
  );
}
