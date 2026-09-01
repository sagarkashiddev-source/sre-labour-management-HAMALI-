import { useEffect, useState } from 'react';
import { AppUser, Role, usersApi } from '../../api/client';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-primary-100 text-primary-700',
  OWNER: 'bg-warning-100 text-warning-700',
  LABOUR: 'bg-slate-100 text-slate-600',
};

export function AdminUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', role: 'OWNER' as Role, employeeCode: '' });
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await usersApi.list();
    setUsers(res.users);
  }
  useEffect(() => { refresh(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await usersApi.create(form);
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', password: '', role: 'OWNER', employeeCode: '' });
      refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Users</h1>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
          + Add User
        </button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50">
            <tr>
              <th className="px-5 py-2.5">Name</th>
              <th className="px-5 py-2.5">Role</th>
              <th className="px-5 py-2.5">Phone</th>
              <th className="px-5 py-2.5">Status</th>
              <th className="px-5 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-5 py-2.5 font-medium">{u.name}</td>
                <td className="px-5 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role]}`}>{u.role}</span></td>
                <td className="px-5 py-2.5">{u.phone}</td>
                <td className="px-5 py-2.5">{u.status}</td>
                <td className="px-5 py-2.5">
                  {u.status === 'ACTIVE' && (
                    <button onClick={() => usersApi.disable(u.id).then(refresh)} className="text-xs font-semibold text-danger-600">Disable</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showAdd && (
        <Modal title="Add User" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-3">
            {error && <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Owner</option>
                <option value="LABOUR">Labour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
            </div>
            {form.role === 'LABOUR' && (
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Employee Code</label>
                <input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Temporary Password</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
            </div>
            <button type="submit" className="w-full rounded-lg bg-primary-700 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
