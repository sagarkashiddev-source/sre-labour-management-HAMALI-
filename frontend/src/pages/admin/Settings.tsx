import { useEffect, useState } from 'react';
import { CalculationRule, VehicleType, calculationRulesApi, vehicleTypesApi } from '../../api/client';
import { Card } from '../../components/Card';

export function AdminSettings() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Settings</h1>
      <CalculationRulesSection />
      <VehicleTypesSection />
    </div>
  );
}

function CalculationRulesSection() {
  const [rules, setRules] = useState<CalculationRule[]>([]);
  const [form, setForm] = useState({ effectiveFrom: '', companyDeductionPct: '10', labourDeductionPct: '20', note: '' });
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await calculationRulesApi.list();
    setRules(res.rules);
  }
  useEffect(() => { refresh(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await calculationRulesApi.create({
        effectiveFrom: form.effectiveFrom,
        companyDeductionPct: Number(form.companyDeductionPct),
        labourDeductionPct: Number(form.labourDeductionPct),
        note: form.note || undefined,
      });
      setForm({ effectiveFrom: '', companyDeductionPct: '10', labourDeductionPct: '20', note: '' });
      refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Calculation Rules</h2>
        <p className="text-sm text-slate-500">
          Rules are append-only — adding a new rule never rewrites history. To change a percentage, add a new rule with today's (or a future) effective date.
        </p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50">
            <tr>
              <th className="px-5 py-2.5">Effective From</th>
              <th className="px-5 py-2.5">Company %</th>
              <th className="px-5 py-2.5">Labour %</th>
              <th className="px-5 py-2.5">Note</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-5 py-2.5">{r.effectiveFrom.slice(0, 10)}</td>
                <td className="px-5 py-2.5">{Number(r.companyDeductionPct)}%</td>
                <td className="px-5 py-2.5">{Number(r.labourDeductionPct)}%</td>
                <td className="px-5 py-2.5 text-slate-500">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {error && <div className="col-span-full rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Effective From</label>
            <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Company Deduction %</label>
            <input type="number" value={form.companyDeductionPct} onChange={(e) => setForm({ ...form, companyDeductionPct: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Labour Deduction %</label>
            <input type="number" value={form.labourDeductionPct} onChange={(e) => setForm({ ...form, labourDeductionPct: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-lg bg-primary-700 py-2 text-sm font-semibold text-white hover:bg-primary-800">Add Rule</button>
          </div>
          <div className="col-span-full">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Note</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
          </div>
        </form>
      </Card>
    </section>
  );
}

function VehicleTypesSection() {
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [newType, setNewType] = useState('');

  async function refresh() {
    const res = await vehicleTypesApi.list();
    setTypes(res.vehicleTypes);
  }
  useEffect(() => { refresh(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newType.trim()) return;
    await vehicleTypesApi.create(newType.trim());
    setNewType('');
    refresh();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Work Types</h2>
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {types.map((t) => (
            <span key={t.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800">{t.name}</span>
          ))}
        </div>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="e.g. 32FT" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
          <button type="submit" className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800">Add</button>
        </form>
      </Card>
    </section>
  );
}
