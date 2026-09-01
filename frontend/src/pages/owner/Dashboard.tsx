import { useEffect, useState } from 'react';
import { WorkEntry, entriesApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';

export function OwnerDashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const canViewFinancials = !!user?.ownerPermission?.canViewFinancials;

  useEffect(() => {
    entriesApi.list({ pageSize: 10 }).then((r) => setEntries(r.entries)).finally(() => setLoading(false));
  }, []);

  const pending = entries.filter((e) => e.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back, {user?.name}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Recent Entries</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">{entries.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-bold text-warning-600">{pending}</p>
        </Card>
        {!canViewFinancials && (
          <Card className="flex items-center p-5 text-sm text-slate-400">
            Financial figures are hidden — ask Admin to enable financial access for your account if needed.
          </Card>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50">
              <tr>
                <th className="px-5 py-2.5">Date</th>
                <th className="px-5 py-2.5">Vehicle</th>
                <th className="px-5 py-2.5">Company</th>
                {canViewFinancials && <th className="px-5 py-2.5">Amount</th>}
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && entries.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-2.5">{e.date.slice(0, 10)}</td>
                  <td className="px-5 py-2.5 font-medium">{e.vehicleNo}</td>
                  <td className="px-5 py-2.5">{e.company.name}</td>
                  {canViewFinancials && <td className="px-5 py-2.5">{e.financial ? `₹${Number(e.financial.amount).toLocaleString('en-IN')}` : '—'}</td>}
                  <td className="px-5 py-2.5"><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
