// Thin fetch wrapper. Uses the httpOnly cookie set by the backend on
// login (credentials: 'include'), never stores the token in JS-reachable
// storage. Every backend error already returns { error: "plain message" }
// (see backend/src/middleware/error.middleware.ts) — we surface that
// message directly rather than a generic "Request failed".

// Defaults to a same-origin relative path — correct for this app's
// intended deploy shape (one Railway service serving both API and built
// frontend, see backend/src/index.ts). Can be overridden at build time
// with VITE_API_URL for a split-origin deploy instead.
const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? body?.warning ?? 'Something went wrong. Please try again.');
  }
  return body as T;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (usable.length === 0) return '';
  return '?' + usable.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

// --- Types (mirrors backend Prisma models / controller shapes) ---------

export type Role = 'ADMIN' | 'OWNER' | 'LABOUR';
export type EntryStatus = 'PENDING' | 'APPROVED' | 'CANCELLED';
export type LoadUnload = 'LOAD' | 'UNLOAD';

export interface CurrentUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  ownerPermission?: OwnerPermission | null;
}

export interface OwnerPermission {
  canViewFinancials: boolean;
  canEditAmount: boolean;
  canApproveEntries: boolean;
  canCancelEntries: boolean;
  canManageCompanies: boolean;
  canViewFinancialReports: boolean;
  canExportExcel: boolean;
  canExportPdf: boolean;
  canViewAuditLogsLimited: boolean;
}

export interface Company {
  id: string;
  name: string;
  code?: string | null;
  phone?: string | null;
  address?: string | null;
  status: 'ACTIVE' | 'DISABLED';
}

export interface VehicleType {
  id: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
}

export interface WorkEntry {
  id: string;
  date: string;
  vehicleNo: string;
  vehicleType: { id: string; name: string };
  loadUnload: LoadUnload;
  company: { id: string; name: string };
  remark: string | null;
  status: EntryStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string } | null;
  approvedAt?: string | null;
  financial?: {
    amount: string;
    companyDeductionPct: string;
    companyDeduction: string;
    balanceAfterCompany: string;
    labourDeductionPct: string;
    labourDeduction: string;
    netAmount: string;
  } | null;
}

// --- Auth ---------------------------------------------------------------

export const authApi = {
  login: (identifier: string, password: string) =>
    request<{ user: CurrentUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: CurrentUser }>('/auth/me'),
};

// --- Entries --------------------------------------------------------------

export interface EntryListParams {
  from?: string; to?: string; companyId?: string; vehicleNo?: string;
  vehicleTypeId?: string; loadUnload?: LoadUnload; status?: EntryStatus;
  createdById?: string; search?: string; page?: number; pageSize?: number;
}

export interface EntryFormInput {
  date: string; vehicleNo: string; vehicleTypeId: string;
  loadUnload: LoadUnload; companyId: string; remark?: string; force?: boolean;
}

export const entriesApi = {
  list: (params: EntryListParams = {}) =>
    request<{ entries: WorkEntry[]; total: number; page: number; pageSize: number }>(`/entries${qs(params as any)}`),
  get: (id: string) => request<{ entry: WorkEntry }>(`/entries/${id}`),
  create: (data: EntryFormInput) =>
    request<{ entry: { id: string; status: string } } | { warning: string; duplicateEntryId: string }>('/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<EntryFormInput>) =>
    request<{ entry: { id: string; status: string } }>(`/entries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancel: (id: string, reason?: string) =>
    request<{ entry: { id: string; status: string } }>(`/entries/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  approve: (id: string) =>
    request<{ entry: { id: string; status: string } }>(`/entries/${id}/approve`, { method: 'PATCH' }),
  // Admin-only correction workflow (see backend entry.controller.ts
  // reopenEntry): drops an APPROVED entry back to PENDING so it — and its
  // amount, via financialsApi — can be edited again, fully audited.
  reopen: (id: string, reason: string) =>
    request<{ entry: { id: string; status: string } }>(`/entries/${id}/reopen`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
};

export interface FinancialBreakdown {
  amount: string; companyDeductionPct: string; companyDeduction: string;
  balanceAfterCompany: string; labourDeductionPct: string; labourDeduction: string; netAmount: string;
}

export const financialsApi = {
  set: (entryId: string, amount: number) =>
    request<{ financial: FinancialBreakdown }>(`/entries/${entryId}/financials`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  preview: (entryId: string, amount: number) =>
    request<{ preview: FinancialBreakdown; rule: { companyDeductionPct: string; labourDeductionPct: string } }>(
      `/entries/${entryId}/financials/preview${qs({ amount })}`,
    ),
};

// --- Companies / Vehicle Types -------------------------------------------

export const companiesApi = {
  list: (search?: string) => request<{ companies: Company[] }>(`/companies${qs({ search })}`),
  create: (data: { name: string; code?: string; phone?: string; address?: string }) =>
    request<{ company: Company }>('/companies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; code: string; phone: string; address: string }>) =>
    request<{ company: Company }>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  disable: (id: string) => request<{ company: Company }>(`/companies/${id}/disable`, { method: 'PATCH' }),
};

export const vehicleTypesApi = {
  list: () => request<{ vehicleTypes: VehicleType[] }>('/vehicle-types'),
  create: (name: string) => request<{ vehicleType: VehicleType }>('/vehicle-types', { method: 'POST', body: JSON.stringify({ name }) }),
  disable: (id: string) => request<{ vehicleType: VehicleType }>(`/vehicle-types/${id}/disable`, { method: 'PATCH' }),
};

// --- Users ----------------------------------------------------------------

export interface AppUser {
  id: string; name: string; phone: string; email: string | null;
  role: Role; status: 'ACTIVE' | 'DISABLED'; createdAt: string;
}

export const usersApi = {
  list: () => request<{ users: AppUser[] }>('/users'),
  create: (data: { name: string; phone: string; email?: string; password: string; role: Role; employeeCode?: string }) =>
    request<{ user: AppUser }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  disable: (id: string) => request<{ user: AppUser }>(`/users/${id}/disable`, { method: 'PATCH' }),
};

// --- Attendance -------------------------------------------------------------

export interface AttendanceRosterEntry {
  labourId: string; employeeCode: string; name: string; present: boolean;
}

export const attendanceApi = {
  getDay: (date: string) =>
    request<{ date: string; roster: AttendanceRosterEntry[]; presentCount: number }>(`/attendance/day${qs({ date })}`),
  setDay: (date: string, presentLabourIds: string[]) =>
    request<{ date: string; presentCount: number }>('/attendance/day', {
      method: 'POST',
      body: JSON.stringify({ date, presentLabourIds }),
    }),
};

// --- Reports ----------------------------------------------------------------

export interface DayRowDto {
  date: string; entriesCount: number; grossAmount: string; totalDeduction: string;
  netAmount: string; present: number | null; perPerson: string | null;
}
export interface RangeTotalsDto {
  totalEntries: number; grossAmount: string; totalDeduction: string;
  netAmount: string; totalLabourDays: number; averagePerPerson: string | null;
}
export interface MonthlyBillRowDto {
  date: string; vehicleNo: string; vehicleType: string; loadUnload: string;
  companyName: string; remark: string | null; amount: string;
}
export interface MonthlyBillTotalsDto {
  subtotal: string; gstRatePct: number; gstAmount: string; grandTotal: string;
}

export const reportsApi = {
  daily: (date: string) => request<{ date: string; row: DayRowDto | null }>(`/reports/daily${qs({ date })}`),
  monthly: (month: number, year: number) =>
    request<{ month: number; year: number; days: DayRowDto[]; totals: RangeTotalsDto }>(`/reports/monthly${qs({ month, year })}`),
  monthlyExcelUrl: (month: number, year: number) => `${BASE}/reports/monthly/export/excel${qs({ month, year })}`,
  monthlyPdfUrl: (month: number, year: number) => `${BASE}/reports/monthly/export/pdf${qs({ month, year })}`,
  // The itemized, GST-added "Bill" document (SAGAR ROADWAYS AND
  // ENTERPRISES billing their client for the month) — distinct from the
  // day-level hamali summary above. billNo/billDate are optional: the
  // business assigns its own bill numbering, so these are passed through
  // as free text rather than generated here.
  monthlyBill: (month: number, year: number) =>
    request<{ month: number; year: number; rows: MonthlyBillRowDto[]; totals: MonthlyBillTotalsDto }>(
      `/reports/monthly-bill${qs({ month, year })}`,
    ),
  monthlyBillExcelUrl: (month: number, year: number, billNo?: string, billDate?: string) =>
    `${BASE}/reports/monthly-bill/export/excel${qs({ month, year, billNo, billDate })}`,
  monthlyBillPdfUrl: (month: number, year: number, billNo?: string, billDate?: string) =>
    `${BASE}/reports/monthly-bill/export/pdf${qs({ month, year, billNo, billDate })}`,
  company: (companyId: string, from: string, to: string) =>
    request<{ companyId: string; companyName: string; from: string; to: string; rows: any[]; totals: any }>(
      `/reports/company${qs({ companyId, from, to })}`,
    ),
  labour: (labourId: string, month: number, year: number) =>
    request<{ labourId: string; month: number; year: number; rows: any[]; totals: any }>(
      `/reports/labour${qs({ labourId, month, year })}`,
    ),
};

// --- Calculation Rules --------------------------------------------------

export interface CalculationRule {
  id: string; effectiveFrom: string; companyDeductionPct: string;
  labourDeductionPct: string; note: string | null;
}

export const calculationRulesApi = {
  list: () => request<{ rules: CalculationRule[] }>('/calculation-rules'),
  create: (data: { effectiveFrom: string; companyDeductionPct: number; labourDeductionPct: number; note?: string }) =>
    request<{ rule: CalculationRule }>('/calculation-rules', { method: 'POST', body: JSON.stringify(data) }),
};

// --- Audit Logs -----------------------------------------------------------

export interface AuditLogEntry {
  id: string; action: string; entityType: string; entityId: string;
  oldValue: unknown; newValue: unknown; createdAt: string;
  user: { id: string; name: string; role: Role };
}

export const auditLogsApi = {
  list: (params: { entityType?: string; entityId?: string; page?: number; pageSize?: number } = {}) =>
    request<{ logs: AuditLogEntry[]; total: number; page: number; pageSize: number }>(`/audit-logs${qs(params)}`),
  history: (entityType: string, entityId: string) =>
    request<{ entityType: string; entityId: string; logs: AuditLogEntry[] }>(`/audit-logs/history/${entityType}/${entityId}`),
};

export { ApiError as default };
