import { useEffect, useState } from 'react';
import { DayRowDto, RangeTotalsDto, MonthlyBillRowDto, MonthlyBillTotalsDto, reportsApi } from '../../api/client';
import { Card } from '../../components/Card';

const inr = (v: string | null) => (v === null ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function AdminReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [days, setDays] = useState<DayRowDto[]>([]);
  const [totals, setTotals] = useState<RangeTotalsDto | null>(null);
  const [loading, setLoading] = useState(false);

  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState('');
  const [billRows, setBillRows] = useState<MonthlyBillRowDto[]>([]);
  const [billTotals, setBillTotals] = useState<MonthlyBillTotalsDto | null>(null);
  const [billLoading, setBillLoading] = useState(false);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await reportsApi.monthly(month, year);
      setDays(res.days);
      setTotals(res.totals);
    } finally {
      setLoading(false);
    }
  }

  async function loadBillPreview() {
    setBillLoading(true);
    try {
      const res = await reportsApi.monthlyBill(month, year);
      setBillRows(res.rows);
      setBillTotals(res.totals);
    } finally {
      setBillLoading(false);
    }
  }

  useEffect(() => { loadReport(); }, []);

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
        <button onClick={loadReport} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
          View Report
        </button>
      </Card>

      {totals && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Total Entries" value={String(totals.totalEntries)} />
            <Metric label="Gross Amount" value={inr(totals.grossAmount)} />
            <Metric label="Total Deduction" value={inr(totals.totalDeduction)} />
            <Metric label="Net Amount" value={inr(totals.netAmount)} tone="success" />
          </div>

          <div className="flex gap-3">
            <a href={reportsApi.monthlyExcelUrl(month, year)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
              Export Excel
            </a>
            <a href={reportsApi.monthlyPdfUrl(month, year)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
              Export PDF
            </a>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50">
                <tr>
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-5 py-2.5">Amount</th>
                  <th className="px-5 py-2.5">Deduction</th>
                  <th className="px-5 py-2.5">Net</th>
                  <th className="px-5 py-2.5">Present</th>
                  <th className="px-5 py-2.5">Per Person</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-2.5">{d.date}</td>
                    <td className="px-5 py-2.5">{inr(d.grossAmount)}</td>
                    <td className="px-5 py-2.5">{inr(d.totalDeduction)}</td>
                    <td className="px-5 py-2.5 font-medium">{inr(d.netAmount)}</td>
                    <td className="px-5 py-2.5">{d.present ?? '-'}</td>
                    <td className="px-5 py-2.5">{d.perPerson ? inr(d.perPerson) : '-'}</td>
                  </tr>
                ))}
                {days.length === 0 && !loading && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No approved entries for this month.</td></tr>
                )}
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
            day-level summary above. Bill No / Bill Date are optional and printed as typed, since
            SRE assigns its own bill numbering.
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

        {billTotals && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Subtotal" value={inr(billTotals.subtotal)} />
              <Metric label={`GST (${billTotals.gstRatePct}%)`} value={inr(billTotals.gstAmount)} />
              <Metric label="Grand Total" value={inr(billTotals.grandTotal)} tone="success" />
            </div>

            <div className="flex gap-3">
              <a
                href={reportsApi.monthlyBillExcelUrl(month, year, billNo || undefined, billDate || undefined)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Export Bill (Excel)
              </a>
              <a
                href={reportsApi.monthlyBillPdfUrl(month, year, billNo || undefined, billDate || undefined)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Export Bill (PDF)
              </a>
            </div>

            <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Vehicle</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Load/Unload</th>
                    <th className="px-4 py-2">Company</th>
                    <th className="px-4 py-2">Remark</th>
                    <th className="px-4 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {billRows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">{r.date}</td>
                      <td className="px-4 py-2">{r.vehicleNo}</td>
                      <td className="px-4 py-2">{r.vehicleType}</td>
                      <td className="px-4 py-2">{r.loadUnload}</td>
                      <td className="px-4 py-2">{r.companyName}</td>
                      <td className="px-4 py-2">{r.remark ?? '-'}</td>
                      <td className="px-4 py-2">{inr(r.amount)}</td>
                    </tr>
                  ))}
                  {billRows.length === 0 && !billLoading && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No approved entries for this month.</td></tr>
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === 'success' ? 'text-success-600' : 'text-slate-900 dark:text-slate-50'}`}>{value}</p>
    </Card>
  );
}
