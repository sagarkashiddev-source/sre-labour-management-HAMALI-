import { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sublabel,
  tone = 'default',
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success' ? 'text-success-600' : tone === 'warning' ? 'text-warning-600' : 'text-slate-900 dark:text-slate-50';
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${toneClass}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action}
    </Card>
  );
}
