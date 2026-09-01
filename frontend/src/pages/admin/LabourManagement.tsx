import { useEffect, useState } from 'react';
import { AppUser, usersApi } from '../../api/client';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';

export function LabourManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', password: '', employeeCode: '' });
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await usersApi.list();
    setUsers(res.users.filter((u) => u.role === 'LABOUR'));
  }
  useEffect(() => { refresh(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await usersApi.create({ ...form, role: 'LABOUR' });
      setForm({ name: '', phone: '', password: '', employeeCode: '' });
      setShowAdd(false);
      refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDisable(id: string) {
    if (!confirm('Disable this labour account?')) return;
    await usersApi.disable(id);
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Labour</h1>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
          + Add Labour
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <Card key={u.id} className="p-4">
            <p className="font-semibold text-slate-900 dark:text-slate-50">{u.name}</p>
            <p className="text-xs text-slate-500">{u.phone}</p>
            <p className="mt-1 text-xs text-slate-400">{u.status === 'ACTIVE' ? 'Active' : 'Disabled'}</p>
            {u.status === 'ACTIVE' && (
              <button onClick={() => handleDisable(u.id)} className="mt-2 text-xs font-semibold text-danger-600">Disable</button>
            )}
          </Card>
        ))}
      </div>

      {showAdd && (
        <Modal title="Add Labour" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-3">
            {error && <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Employee Code</label>
              <input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Temporary Password</label>
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
            </div>
            <button type="submit" className="w-full rounded-lg bg-primary-700 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
