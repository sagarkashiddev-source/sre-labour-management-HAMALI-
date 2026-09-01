import { useEffect, useState } from 'react';
import { WorkEntry, entriesApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card, EmptyState } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { EntryForm } from '../../components/EntryForm';

export function OwnerEntries() {
  const { user } = useAuth();
  const canViewFinancials = !!user?.ownerPermission?.canViewFinancials;
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function refresh() {
    setLoading(true);
    const res = await entriesApi.list({ pageSize: 50 });
    setEntries(res.entries);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function handleCreate(values: any) {
    const res = await entriesApi.create(values);
    if ('warning' in res) return res;
    setShowAdd(false);
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Entries</h1>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
          + Add Entry
        </button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : entries.length === 0 ? (
          <EmptyState title="No entries yet." description="Add a work entry to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50">
                <tr>
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-5 py-2.5">Vehicle</th>
                  <th className="px-5 py-2.5">Company</th>
                  <th className="px-5 py-2.5">Work</th>
                  {canViewFinancials && <th className="px-5 py-2.5">Amount</th>}
                  <th className="px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-2.5">{e.date.slice(0, 10)}</td>
                    <td className="px-5 py-2.5 font-medium">{e.vehicleNo}</td>
                    <td className="px-5 py-2.5">{e.company.name}</td>
                    <td className="px-5 py-2.5">{e.vehicleType.name} · {e.loadUnload}</td>
                    {canViewFinancials && <td className="px-5 py-2.5">{e.financial ? `₹${Number(e.financial.amount).toLocaleString('en-IN')}` : '—'}</td>}
                    <td className="px-5 py-2.5"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && (
        <Modal title="Add Work Entry" onClose={() => setShowAdd(false)}>
          <EntryForm onSubmit={handleCreate} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}
    </div>
  );
}
