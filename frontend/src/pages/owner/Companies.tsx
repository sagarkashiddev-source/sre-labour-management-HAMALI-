import { useEffect, useState } from 'react';
import { Company, companiesApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';

export function OwnerCompanies() {
  const { user } = useAuth();
  const canManage = !!user?.ownerPermission?.canManageCompanies;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', phone: '', address: '' });
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await companiesApi.list();
    setCompanies(res.companies);
  }
  useEffect(() => { refresh(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await companiesApi.create(form);
      setShowAdd(false);
      setForm({ name: '', code: '', phone: '', address: '' });
      refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Companies</h1>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
            + Add Company
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Card key={c.id} className="p-4">
            <p className="font-semibold text-slate-900 dark:text-slate-50">{c.name}</p>
            {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
          </Card>
        ))}
      </div>

      {showAdd && (
        <Modal title="Add Company" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-3">
            {error && <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
            {(['name', 'code', 'phone', 'address'] as const).map((field) => (
              <div key={field}>
                <label className="text-xs font-medium capitalize text-slate-600 dark:text-slate-400">{field}</label>
                <input value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
              </div>
            ))}
            <button type="submit" className="w-full rounded-lg bg-primary-700 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
