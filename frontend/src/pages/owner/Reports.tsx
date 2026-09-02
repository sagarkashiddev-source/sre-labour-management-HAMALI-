import { useEffect, useState } from 'react';
import { DayRowDto, RangeTotalsDto, MonthlyBillRowDto, MonthlyBillTotalsDto, reportsApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card, EmptyState } from '../../components/Card';

const inr = (v: string | null) => (v === null ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function OwnerReports() {
  const { user } = useAuth();
  const perm = user?.ownerPermission;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [days, setDays] = useState<DayRowDto[]>([]);
  const [totals, setTotals] = useState<RangeTotalsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState('');
  const [billRows, setBillRows] = useState<MonthlyBillRowDto[]>([]);
  const [billTotals, setBillTotals] = useState<MonthlyBillTotalsDto | null>(null);
  const [billError, setBillError] = useState<string | null>(null);

  async function loadReport() {
    setError(null);
    try {
      const res = await reportsApi.monthly(month, year);
      setDays(res.days);
      setTotals(res.totals);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function loadBillPreview() {
    setBillError(null);
    try {
      const res = await reportsApi.monthlyBill(month, year);
      setBillRows(res.rows);
      setBillTotals(res.totals);
    } catch (err: any) {
      setBillError(err.message);
    }
  }

  useEffect(() => {
    if (perm?.canViewFinancialReports) loadReport();
  }, []);

  if (!perm?.canViewFinancialReports) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Reports</h1>
        <EmptyState title="Reports not enabled" description="Your account doesn't have permission to view financial reports. Ask Admin to enable it if you need access." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Reports</h1>

      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Month</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Year</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
        </div>
        <button onClick={loadReport} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">View Report</button>
      </Card>

      {error && <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}

      {totals && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Total Entries" value={String(totals.totalEntries)} />
            <Metric label="Gross" value={inr(totals.grossAmount)} />
            <Metric label="Deduction" value={inr(totals.totalDeduction)} />
            <Metric label="Net" value={inr(totals.netAmount)} />
          </div>
          {(perm.canExportExcel || perm.canExportPdf) && (
            <div className="flex gap-3">
              {perm.canExportExcel && <a href={reportsApi.monthlyExcelUrl(month, year)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">Export Excel</a>}
              {perm.canExportPdf && <a href={reportsApi.monthlyPdfUrl(month, year)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">Export PDF</a>}
            </div>
          )}
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50">
                <tr><th className="px-5 py-2.5">Date</th><th className="px-5 py-2.5">Net</th><th className="px-5 py-2.5">Present</th></tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-2.5">{d.date}</td>
                    <td className="px-5 py-2.5 font-medium">{inr(d.netAmount)}</td>
                    <td className="px-5 py-2.5">{d.present ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Monthly Bill</h2>
          <p className="text-sm text-slate-500">
            The itemized invoice (every entry across all companies, plus GST) — separate from the
            day-level summary above.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Bill No</label>
            <input
              value={billNo}
              onChange={(e) => setBillNo(e.target.value)}
              placeholder="SRE 2026/27-000440"
              className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Bill Date</label>
            <input
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              placeholder="01/MAY/2026"
              className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <button onClick={loadBillPreview} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
            Preview Bill
          </button>
        </div>

        {billError && <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{billError}</div>}

        {billTotals && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Subtotal" value={inr(billTotals.subtotal)} />
              <Metric label={`GST (${billTotals.gstRatePct}%)`} value={inr(billTotals.gstAmount)} />
              <Metric label="Grand Total" value={inr(billTotals.grandTotal)} />
            </div>

            {(perm.canExportExcel || perm.canExportPdf) && (
              <div className="flex gap-3">
                {perm.canExportExcel && (
                  <a
                    href={reportsApi.monthlyBillExcelUrl(month, year, billNo || undefined, billDate || undefined)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600"
                  >
                    Export Bill (Excel)
                  </a>
                )}
                {perm.canExportPdf && (
                  <a
                    href={reportsApi.monthlyBillPdfUrl(month, year, billNo || undefined, billDate || undefined)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600"
                  >
                    Export Bill (PDF)
                  </a>
                )}
              </div>
            )}

            <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Vehicle</th>
                    <th className="px-4 py-2">Company</th>
                    <th className="px-4 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {billRows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">{r.date}</td>
                      <td className="px-4 py-2">{r.vehicleNo}</td>
                      <td className="px-4 py-2">{r.companyName}</td>
                      <td className="px-4 py-2">{inr(r.amount)}</td>
                    </tr>
                  ))}
                  {billRows.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No approved entries for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
    </Card>
  );
}
