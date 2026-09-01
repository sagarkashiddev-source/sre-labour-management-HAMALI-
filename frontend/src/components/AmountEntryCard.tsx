import { useEffect, useState } from 'react';
import { FinancialBreakdown, financialsApi } from '../api/client';

const inr = (v: string | number) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/**
 * Amount + live calculation preview (spec sections 18/19). Only ever
 * rendered on Admin/Owner screens — never imported anywhere in the Labour
 * page tree.
 */
export function AmountEntryCard({
  entryId,
  currentAmount,
  onSaved,
}: {
  entryId: string;
  currentAmount?: string;
  onSaved: (financial: FinancialBreakdown) => void;
}) {
  const [amount, setAmount] = useState(currentAmount ?? '');
  const [preview, setPreview] = useState<FinancialBreakdown | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const num = Number(amount);
    if (!amount || Number.isNaN(num) || num < 0) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      financialsApi
        .preview(entryId, num)
        .then((r) => setPreview(r.preview))
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [amount, entryId]);

  async function handleSave() {
    setError(null);
    const num = Number(amount);
    if (!amount || Number.isNaN(num) || num < 0) return setError('Enter a valid amount.');
    setSaving(true);
    try {
      const res = await financialsApi.set(entryId, num);
      onSaved(res.financial);
    } catch (err: any) {
      setError(err.message ?? 'Could not save amount.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="₹ 0"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}

      {preview && (
        <div className="space-y-2 rounded-lg bg-white p-3 text-sm shadow-card dark:bg-slate-800">
          <Row label="Amount" value={inr(preview.amount)} />
          <Arrow />
          <Row label={`Company Deduction (${Number(preview.companyDeductionPct)}%)`} value={`− ${inr(preview.companyDeduction)}`} muted />
          <Arrow />
          <Row label={`Labour Deduction (${Number(preview.labourDeductionPct)}% of balance)`} value={`− ${inr(preview.labourDeduction)}`} muted />
          <Arrow />
          <Row label="Net Amount" value={inr(preview.netAmount)} strong />
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-primary-700 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Amount'}
      </button>
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-slate-500' : strong ? 'font-semibold text-slate-900 dark:text-slate-50' : 'text-slate-700 dark:text-slate-300'}>
        {label}
      </span>
      <span className={muted ? 'text-danger-600' : strong ? 'font-bold text-success-700' : 'font-medium'}>{value}</span>
    </div>
  );
}
function Arrow() {
  return <div className="text-center text-slate-300">↓</div>;
}
