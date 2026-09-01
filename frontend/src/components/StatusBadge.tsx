import { EntryStatus } from '../api/client';

const STYLES: Record<EntryStatus, string> = {
  PENDING: 'bg-warning-100 text-warning-700',
  APPROVED: 'bg-success-100 text-success-700',
  CANCELLED: 'bg-danger-100 text-danger-700',
};

export function StatusBadge({ status }: { status: EntryStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
