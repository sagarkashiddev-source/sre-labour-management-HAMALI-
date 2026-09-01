import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkEntry, entriesApi } from '../../api/client';
import { EntryForm, entryToFormValues } from '../../components/EntryForm';

/**
 * Add and Edit share this exact component (spec section 12: "Exactly the
 * same form as Add Entry"). EntryForm itself has no amount field in its
 * state or markup at all — there is nothing here to hide, because there
 * is nothing here that exists.
 */
export function LabourAddEntry() {
  const { t } = useTranslation();
  const { entryId } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<WorkEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    if (!entryId) return;
    entriesApi
      .get(entryId)
      .then((r) => setEntry(r.entry))
      .catch((err) => setLoadError(err.message));
  }, [entryId]);

  async function handleSubmit(values: any) {
    const res = entryId ? await entriesApi.update(entryId, values) : await entriesApi.create(values);
    if (res && 'warning' in res) return res;
    setSavedMessage(true);
    setTimeout(() => navigate('/labour'), 900);
  }

  if (savedMessage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100 text-3xl text-success-600">✓</div>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-50">{t('labour.addEntry.savedTitle')}</p>
        <p className="text-sm text-slate-500">{t('labour.addEntry.savedDesc')}</p>
      </div>
    );
  }

  if (entryId && loadError) {
    return <div className="p-6 text-center text-sm text-danger-600">{loadError}</div>;
  }
  if (entryId && !entry) {
    return <div className="p-6 text-center text-sm text-slate-400">{t('common.loading')}</div>;
  }
  if (entryId && entry && entry.status !== 'PENDING') {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        {t('labour.addEntry.alreadyProcessed')}
      </div>
    );
  }

  return (
    <div className="p-5">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">← {t('common.back')}</button>
      <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-50">
        {entryId ? t('labour.addEntry.editTitle') : t('labour.addEntry.addTitle')}
      </h1>
      <EntryForm
        size="large"
        initialValues={entry ? entryToFormValues(entry) : undefined}
        onSubmit={handleSubmit}
        submitLabel={entryId ? t('labour.addEntry.saveChanges') : t('labour.addEntry.saveEntry')}
      />
    </div>
  );
}
