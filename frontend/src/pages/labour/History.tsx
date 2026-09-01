import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkEntry, entriesApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { LabourTopBar } from '../../layouts/LabourLayout';
import { EntryCard } from './Home';

export function LabourHistory() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    entriesApi.list({ vehicleNo: search || undefined, pageSize: 50 }).then((r) => setEntries(r.entries)).finally(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <LabourTopBar title={t('labour.history.title')} />
      <div className="space-y-4 p-5">
        <input
          type="text"
          lang="en"
          placeholder={t('labour.history.searchPlaceholder') ?? ''}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base dark:border-slate-600 dark:bg-slate-800"
        />
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">{t('labour.history.noEntries')}</p>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => <EntryCard key={e.id} entry={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function LabourMe() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  return (
    <div>
      <LabourTopBar title={t('labour.me.title')} showLanguage />
      <div className="space-y-6 p-5">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">
            {user?.name?.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-50">{user?.name}</p>
            <p className="text-sm text-slate-500" lang="en">{user?.phone}</p>
          </div>
        </div>
        <button onClick={logout} className="w-full rounded-xl border border-danger-200 py-3.5 text-sm font-semibold text-danger-600">
          {t('labour.me.logout')}
        </button>
      </div>
    </div>
  );
}
