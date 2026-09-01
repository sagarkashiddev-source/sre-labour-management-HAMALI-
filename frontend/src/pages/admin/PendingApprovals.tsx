import { useEffect, useState } from 'react';
import { WorkEntry, entriesApi } from '../../api/client';
import { Card, EmptyState } from '../../components/Card';
import { AmountEntryCard } from '../../components/AmountEntryCard';

const inr = (v?: string | null) => (v ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : null);

export function PendingApprovals() {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAmountFor, setEditingAmountFor] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const res = await entriesApi.list({ status: 'PENDING', pageSize: 50 });
    setEntries(res.entries);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function handleApprove(entry: WorkEntry) {
    try {
      await entriesApi.approve(entry.id);
      await refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleCancel(entry: WorkEntry) {
    if (!confirm('Cancel this entry?\n\nThis entry will remain in history but will no longer appear in normal reports.')) return;
    await entriesApi.cancel(entry.id);
    await refresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Pending Approvals</h1>

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : entries.length === 0 ? (
        <EmptyState title="Nothing pending." description="All entries have been reviewed." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {entries.map((e) => (
            <Card key={e.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-50">{e.vehicleNo}</p>
                  <p className="text-sm text-slate-500">{e.company.name} · {e.vehicleType.name} · {e.loadUnload}</p>
                  <p className="text-xs text-slate-400">{e.date.slice(0, 10)}</p>
                </div>
                {e.createdBy && <p className="text-xs text-slate-400">By: {e.createdBy.name}</p>}
              </div>
              {e.remark && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">{e.remark}</p>}

              {editingAmountFor === e.id || !e.financial ? (
                <AmountEntryCard
                  entryId={e.id}
                  currentAmount={e.financial?.amount}
                  onSaved={() => { setEditingAmountFor(null); refresh(); }}
                />
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/40">
                  <span>Amount: <strong>{inr(e.financial.amount)}</strong></span>
                  <button onClick={() => setEditingAmountFor(e.id)} className="text-xs font-semibold text-primary-700">Edit</button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => handleCancel(e)} className="rounded-lg border border-danger-200 px-3 py-1.5 text-xs font-semibold text-danger-600">
                  Cancel
                </button>
                <button
                  onClick={() => handleApprove(e)}
                  disabled={!e.financial}
                  className="rounded-lg bg-success-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  title={!e.financial ? 'Add an amount first' : ''}
                >
                  Approve
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
