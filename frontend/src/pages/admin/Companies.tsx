import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Company, companiesApi } from '../../api/client';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';

export function AdminCompanies() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', phone: '', address: '' });
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await companiesApi.list(search);
    setCompanies(res.companies);
  }
  useEffect(() => { refresh(); }, [search]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await companiesApi.create(form);
      setForm({ name: '', code: '', phone: '', address: '' });
      setShowAdd(false);
      refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{t('admin.companiesPage.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{companies.length} {t('admin.nav.companies').toLowerCase()}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
          {t('admin.companiesPage.addCompany')}
        </button>
      </div>

      <input
        type="text"
        placeholder={t('admin.companiesPage.searchPlaceholder') ?? ''}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Card key={c.id} className="p-4">
            <p className="font-semibold text-slate-900 dark:text-slate-50">{c.name}</p>
            <p className="mt-1 text-xs text-slate-500">{c.status === 'ACTIVE' ? t('admin.companiesPage.active') : t('admin.companiesPage.disabled')}</p>
            {c.phone && <p className="text-xs text-slate-400" lang="en">{c.phone}</p>}
          </Card>
        ))}
      </div>

      {showAdd && (
        <Modal title={t('admin.companiesPage.modalTitle')} onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-3">
            {error && <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
            {(['name', 'code', 'phone', 'address'] as const).map((field) => (
              <div key={field}>
                <label className="text-xs font-medium capitalize text-slate-600 dark:text-slate-400">{field}</label>
                <input
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
            ))}
            <button type="submit" className="w-full rounded-lg bg-primary-700 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
              {t('common.save')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
