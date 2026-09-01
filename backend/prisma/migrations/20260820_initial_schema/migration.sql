-- Initial schema for SRE Hamali Management System.

CREATE TYPE "Role" AS ENUM ('ADMIN', 'OWNER', 'LABOUR');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');
CREATE TYPE "LoadUnload" AS ENUM ('LOAD', 'UNLOAD');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "userCode" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "labourers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "labourers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "owner_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canViewFinancials" BOOLEAN NOT NULL DEFAULT false,
    "canEditAmount" BOOLEAN NOT NULL DEFAULT false,
    "canApproveEntries" BOOLEAN NOT NULL DEFAULT false,
    "canCancelEntries" BOOLEAN NOT NULL DEFAULT false,
    "canManageCompanies" BOOLEAN NOT NULL DEFAULT false,
    "canViewFinancialReports" BOOLEAN NOT NULL DEFAULT false,
    "canExportExcel" BOOLEAN NOT NULL DEFAULT false,
    "canExportPdf" BOOLEAN NOT NULL DEFAULT false,
    "canViewAuditLogsLimited" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "owner_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_entries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "vehicleNo" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,
    "loadUnload" "LoadUnload" NOT NULL,
    "companyId" TEXT NOT NULL,
    "remark" TEXT,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entry_financials" (
    "id" TEXT NOT NULL,
    "workEntryId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "companyDeductionPct" DECIMAL(5,2) NOT NULL,
    "companyDeduction" DECIMAL(10,2) NOT NULL,
    "balanceAfterCompany" DECIMAL(10,2) NOT NULL,
    "labourDeductionPct" DECIMAL(5,2) NOT NULL,
    "labourDeduction" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "entry_financials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_attendance" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "labourId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_attendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calculation_rules" (
    "id" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "companyDeductionPct" DECIMAL(5,2) NOT NULL,
    "labourDeductionPct" DECIMAL(5,2) NOT NULL,
    "otherDeductionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calculation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_userCode_key" ON "users"("userCode");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "labourers_userId_key" ON "labourers"("userId");
CREATE UNIQUE INDEX "labourers_employeeCode_key" ON "labourers"("employeeCode");
CREATE UNIQUE INDEX "owner_permissions_userId_key" ON "owner_permissions"("userId");
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");
CREATE UNIQUE INDEX "vehicle_types_name_key" ON "vehicle_types"("name");
CREATE UNIQUE INDEX "entry_financials_workEntryId_key" ON "entry_financials"("workEntryId");
CREATE UNIQUE INDEX "daily_attendance_date_labourId_key" ON "daily_attendance"("date", "labourId");

CREATE INDEX "work_entries_date_idx" ON "work_entries"("date");
CREATE INDEX "work_entries_companyId_idx" ON "work_entries"("companyId");
CREATE INDEX "work_entries_vehicleNo_idx" ON "work_entries"("vehicleNo");
CREATE INDEX "work_entries_status_idx" ON "work_entries"("status");
CREATE INDEX "daily_attendance_date_idx" ON "daily_attendance"("date");
CREATE INDEX "calculation_rules_effectiveFrom_idx" ON "calculation_rules"("effectiveFrom");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

ALTER TABLE "labourers" ADD CONSTRAINT "labourers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "owner_permissions" ADD CONSTRAINT "owner_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entry_financials" ADD CONSTRAINT "entry_financials_workEntryId_fkey" FOREIGN KEY ("workEntryId") REFERENCES "work_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entry_financials" ADD CONSTRAINT "entry_financials_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entry_financials" ADD CONSTRAINT "entry_financials_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "daily_attendance" ADD CONSTRAINT "daily_attendance_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "labourers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
