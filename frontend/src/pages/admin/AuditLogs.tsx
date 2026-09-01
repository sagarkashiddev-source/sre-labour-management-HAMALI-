import { useEffect, useState } from 'react';
import { AuditLogEntry, auditLogsApi } from '../../api/client';
import { Card } from '../../components/Card';

export function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [entityType, setEntityType] = useState('');

  useEffect(() => {
    auditLogsApi.list({ entityType: entityType || undefined, pageSize: 50 }).then((r) => setLogs(r.logs));
  }, [entityType]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Audit History</h1>

      <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
        <option value="">All types</option>
        <option value="WorkEntry">Work Entry</option>
        <option value="EntryFinancial">Financial</option>
        <option value="User">User</option>
        <option value="Company">Company</option>
        <option value="CalculationRule">Calculation Rule</option>
      </select>

      <Card className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-4 px-5 py-4">
            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary-600" />
            <div className="flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {log.user.name} <span className="font-normal text-slate-400">· {log.action.replace(/_/g, ' ').toLowerCase()}</span>
                </p>
                <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString('en-IN')}</p>
              </div>
              {Boolean(log.oldValue || log.newValue) && (
                <div className="mt-1.5 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                  {log.oldValue !== null && (
                    <div className="rounded bg-slate-50 px-2 py-1 font-mono text-slate-500 dark:bg-slate-900/40">
                      old: {JSON.stringify(log.oldValue)}
                    </div>
                  )}
                  {log.newValue !== null && (
                    <div className="rounded bg-slate-50 px-2 py-1 font-mono text-slate-500 dark:bg-slate-900/40">
                      new: {JSON.stringify(log.newValue)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400">No audit history yet.</p>}
      </Card>
    </div>
  );
}
