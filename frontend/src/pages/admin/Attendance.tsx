import { useEffect, useState } from 'react';
import { AttendanceRosterEntry, attendanceApi } from '../../api/client';
import { Card } from '../../components/Card';
import { getBusinessToday } from '../../utils/businessDate';

export function AdminAttendance() {
  const [date, setDate] = useState(getBusinessToday());
  const [roster, setRoster] = useState<AttendanceRosterEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    attendanceApi.getDay(date).then((r) => setRoster(r.roster));
    setSaved(false);
  }, [date]);

  function toggle(labourId: string) {
    setRoster((prev) => prev.map((r) => (r.labourId === labourId ? { ...r, present: !r.present } : r)));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await attendanceApi.setDay(date, roster.filter((r) => r.present).map((r) => r.labourId));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const presentCount = roster.filter((r) => r.present).length;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Attendance</h1>
      <p className="text-sm text-slate-500">
        Mark who was present for hamali work — this headcount drives the Per Person calculation, independent of how many entries exist for the day.
      </p>

      <div className="flex items-center gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
        <span className="text-sm text-slate-500">{presentCount} present</span>
      </div>

      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {roster.map((r) => (
          <label key={r.labourId} className="flex cursor-pointer items-center justify-between px-5 py-3">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">{r.name}</p>
              <p className="text-xs text-slate-400">{r.employeeCode}</p>
            </div>
            <input type="checkbox" checked={r.present} onChange={() => toggle(r.labourId)} className="h-5 w-5 rounded text-primary-700" />
          </label>
        ))}
        {roster.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400">No active labourers.</p>}
      </Card>

      <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Attendance'}
      </button>
    </div>
  );
}
