import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DayRowDto, RangeTotalsDto, WorkEntry, entriesApi, reportsApi } from '../../api/client';
import { MetricCard, Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { getBusinessToday } from '../../utils/businessDate';

const inr = (v: string | number) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function AdminDashboard() {
  const [today, setToday] = useState<DayRowDto | null>(null);
  const [monthTotals, setMonthTotals] = useState<RangeTotalsDto | null>(null);
  const [recent, setRecent] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const todayStr = getBusinessToday();
    Promise.all([
      reportsApi.daily(todayStr).catch(() => ({ row: null })),
      reportsApi.monthly(now.getMonth() + 1, now.getFullYear()).catch(() => ({ totals: null as any })),
      entriesApi.list({ pageSize: 10 }),
    ])
      .then(([daily, monthly, entries]) => {
        setToday(daily.row);
        setMonthTotals(monthly.totals);
        setRecent(entries.entries);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Dashboard</h1>
        <p className="text-sm text-slate-500">Today's snapshot and recent activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Today's Entries" value={String(today?.entriesCount ?? 0)} />
        <MetricCard label="Today's Amount" value={today ? inr(today.grossAmount) : '₹0'} />
        <MetricCard label="This Month (Net)" value={monthTotals ? inr(monthTotals.netAmount) : '₹0'} tone="success" />
        <MetricCard label="Labour Days (Month)" value={String(monthTotals?.totalLabourDays ?? 0)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/admin/entries" className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
          + Add Entry
        </Link>
        <Link to="/admin/companies" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
          Add Company
        </Link>
        <Link to="/admin/labour" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
          Add Labour
        </Link>
        <Link to="/admin/reports" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
          Monthly Report
        </Link>
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
                <th className="px-5 py-2.5">Work</th>
                <th className="px-5 py-2.5">Amount</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-2.5">{e.date.slice(0, 10)}</td>
                  <td className="px-5 py-2.5 font-medium">{e.vehicleNo}</td>
                  <td className="px-5 py-2.5">{e.company.name}</td>
                  <td className="px-5 py-2.5">{e.vehicleType.name} · {e.loadUnload}</td>
                  <td className="px-5 py-2.5">{e.financial ? inr(e.financial.amount) : '—'}</td>
                  <td className="px-5 py-2.5"><StatusBadge status={e.status} /></td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-700" />)}
      </div>
      <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
