import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkEntry, entriesApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { LabourTopBar } from '../../layouts/LabourLayout';
import { getBusinessToday } from '../../utils/businessDate';

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'labour.home.greetingMorning';
  if (h < 17) return 'labour.home.greetingAfternoon';
  return 'labour.home.greetingEvening';
}

export function LabourHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = getBusinessToday();
    entriesApi.list({ from: today, to: today, pageSize: 20 }).then((r) => setEntries(r.entries)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <LabourTopBar title={t('common.appName')} showLanguage />
      <div className="space-y-6 p-5">
        <div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-50">{t(greetingKey())}, {user?.name?.split(' ')[0]}</p>
        </div>

        <Link
          to="/labour/add"
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary-700 py-5 text-lg font-bold text-white shadow-card active:bg-primary-800"
        >
          {t('labour.home.addEntry')}
        </Link>

        <div>
          <p className="mb-3 text-sm font-semibold text-slate-500">{t('labour.home.todaysEntries')}</p>
          {loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
              {t('labour.home.noEntriesToday')}
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((e) => (
                <EntryCard key={e.id} entry={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EntryCard({ entry }: { entry: WorkEntry }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs text-slate-400">{entry.date.slice(0, 10)}</p>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50" lang="en">{entry.vehicleNo}</p>
      <p className="text-sm text-slate-500">{entry.vehicleType.name} · {entry.loadUnload === 'LOAD' ? t('entryForm.load') : t('entryForm.unload')}</p>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{entry.company.name}</p>
      {entry.remark && <p className="mt-1 text-sm text-slate-400">{entry.remark}</p>}
      {entry.status === 'PENDING' && (
        <Link to={`/labour/edit/${entry.id}`} className="mt-3 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
          {t('labour.entryCard.editBtn')}
        </Link>
      )}
      {entry.status !== 'PENDING' && (
        <p className="mt-2 text-xs font-medium text-slate-400">
          {entry.status === 'APPROVED' ? t('labour.entryCard.approved') : t('labour.entryCard.cancelled')}
        </p>
      )}
    </div>
  );
}
