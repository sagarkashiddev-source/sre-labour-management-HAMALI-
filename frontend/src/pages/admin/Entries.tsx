import { useEffect, useState } from 'react';
import { WorkEntry, entriesApi } from '../../api/client';
import { Card, EmptyState } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { EntryForm, EntryFormValues, entryToFormValues } from '../../components/EntryForm';
import { AmountEntryCard } from '../../components/AmountEntryCard';

const inr = (v?: string | null) => (v ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—');

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; entry: WorkEntry }
  | { kind: 'amount'; entry: WorkEntry }
  | null;

export function AdminEntries() {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modal, setModal] = useState<ModalState>(null);

  async function refresh() {
    setLoading(true);
    const res = await entriesApi.list({ pageSize: 50, status: (statusFilter || undefined) as any });
    setEntries(res.entries);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [statusFilter]);

  async function handleCreate(values: any) {
    const res = await entriesApi.create(values);
    if ('warning' in res) return res;
    setModal(null);
    await refresh();
  }

  async function handleUpdate(entryId: string, values: Partial<EntryFormValues>) {
    try {
      await entriesApi.update(entryId, values as any);
      setModal(null);
      await refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleCancel(entry: WorkEntry) {
    if (!confirm('Cancel this entry? It will remain in history but no longer appear in normal reports.')) return;
    try {
      await entriesApi.cancel(entry.id);
      await refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleApprove(entry: WorkEntry) {
    try {
      await entriesApi.approve(entry.id);
      await refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleReopen(entry: WorkEntry) {
    // A reason is required server-side (see reopenEntry) — asking here
    // rather than letting the request round-trip and fail keeps this a
    // single step instead of two.
    const reason = prompt(
      `Reopen ${entry.vehicleNo} (${entry.date.slice(0, 10)}) for correction?\n\n` +
        'This puts the entry back to Pending so it — and its amount — can be edited, then it will need to be approved again.\n\n' +
        'Reason (required):',
    );
    if (reason === null) return; // cancelled
    if (reason.trim().length < 3) {
      alert('Please enter a reason (at least 3 characters) to reopen an approved entry.');
      return;
    }
    try {
      await entriesApi.reopen(entry.id, reason.trim());
      await refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Entries</h1>
        <button onClick={() => setModal({ kind: 'add' })} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
          + Add Entry
        </button>
      </div>

      <div className="flex gap-2">
        {['', 'PENDING', 'APPROVED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusFilter === s ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {s || 'All (excl. cancelled)'}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : entries.length === 0 ? (
          <EmptyState title="No entries yet." description="Add your first work entry to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50">
                <tr>
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-5 py-2.5">Vehicle</th>
                  <th className="px-5 py-2.5">Company</th>
                  <th className="px-5 py-2.5">Type</th>
                  <th className="px-5 py-2.5">Work</th>
                  <th className="px-5 py-2.5">Amount</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-2.5">{e.date.slice(0, 10)}</td>
                    <td className="px-5 py-2.5 font-medium">{e.vehicleNo}</td>
                    <td className="px-5 py-2.5">{e.company.name}</td>
                    <td className="px-5 py-2.5">{e.vehicleType.name}</td>
                    <td className="px-5 py-2.5">{e.loadUnload}</td>
                    <td className="px-5 py-2.5">{inr(e.financial?.amount)}</td>
                    <td className="px-5 py-2.5"><StatusBadge status={e.status} /></td>
                    <td className="space-x-2 whitespace-nowrap px-5 py-2.5">
                      {e.status === 'APPROVED' ? (
                        // Approved entries are locked (see backend
                        // entry.controller.ts updateEntry / financial.controller.ts
                        // upsertFinancial) — showing Edit/Amount here would let an
                        // Admin fill out a form that's guaranteed to fail on submit.
                        // Reopen is the only way back in, and it's deliberately a
                        // separate, reasoned step rather than a silent edit.
                        <button onClick={() => handleReopen(e)} className="text-xs font-semibold text-warning-700">
                          Reopen for Correction
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setModal({ kind: 'edit', entry: e })} className="text-xs font-semibold text-primary-700">Edit</button>
                          <button onClick={() => setModal({ kind: 'amount', entry: e })} className="text-xs font-semibold text-primary-700">Amount</button>
                        </>
                      )}
                      {e.status === 'PENDING' && (
                        <button onClick={() => handleApprove(e)} className="text-xs font-semibold text-success-700">Approve</button>
                      )}
                      {e.status !== 'CANCELLED' && (
                        <button onClick={() => handleCancel(e)} className="text-xs font-semibold text-danger-600">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal?.kind === 'add' && (
        <Modal title="Add Work Entry" onClose={() => setModal(null)}>
          <EntryForm onSubmit={handleCreate} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.kind === 'edit' && (
        <Modal title={`Edit Entry — ${modal.entry.vehicleNo}`} onClose={() => setModal(null)}>
          <EntryForm
            initialValues={entryToFormValues(modal.entry)}
            onSubmit={(v) => handleUpdate(modal.entry.id, v)}
            onCancel={() => setModal(null)}
            submitLabel="Save Changes"
          />
        </Modal>
      )}
      {modal?.kind === 'amount' && (
        <Modal title={`Amount — ${modal.entry.vehicleNo}`} onClose={() => setModal(null)}>
          <AmountEntryCard
            entryId={modal.entry.id}
            currentAmount={modal.entry.financial?.amount}
            onSaved={() => { setModal(null); refresh(); }}
          />
        </Modal>
      )}
    </div>
  );
}
