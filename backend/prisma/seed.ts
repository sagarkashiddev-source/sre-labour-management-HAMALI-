import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { WORKBOOK_COMPANY_NAMES } from './companies.data';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  // --- Users -----------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { phone: '9922297341' },
    update: {},
    create: {
      name: 'Sagar (Admin)',
      phone: '9922297341',
      email: 'admin@sre.local',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: 'Owner One',
      phone: '9000000001',
      email: 'owner1@sre.local',
      passwordHash,
      role: 'OWNER',
      ownerPermission: {
        create: {
          canViewFinancials: true,
          canEditAmount: true,
          canApproveEntries: false,
          canCancelEntries: false,
          canManageCompanies: false,
          canViewFinancialReports: true,
          canExportExcel: true,
          canExportPdf: true,
          canViewAuditLogsLimited: true,
        },
      },
    },
  });

  const labour1 = await prisma.user.create({
    data: {
      name: 'Rahul Patil',
      phone: '9000000101',
      passwordHash,
      role: 'LABOUR',
      labourProfile: { create: { employeeCode: 'LAB001' } },
    },
    include: { labourProfile: true },
  });

  const labour2 = await prisma.user.create({
    data: {
      name: 'Amit Sharma',
      phone: '9000000102',
      passwordHash,
      role: 'LABOUR',
      labourProfile: { create: { employeeCode: 'LAB002' } },
    },
    include: { labourProfile: true },
  });

  // --- Companies ---------------------------------------------------------
  // Full cleaned/de-duplicated list extracted from both workbooks (see
  // prisma/companies.data.ts for how it was derived). Upsert-by-name means
  // this is safe to re-run: existing companies (and anything Admin has
  // since renamed/disabled) are left untouched, only missing ones are added.
  const companies = await Promise.all(
    WORKBOOK_COMPANY_NAMES.map((name) =>
      prisma.company.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  // --- Vehicle types (normalized from the workbook's inconsistent values) --
  const typeNames = ['909', 'PIK-UP', 'TOURS', 'ACE', '1109', '32FT', '40FT', 'DOST'];
  const vehicleTypes = await Promise.all(
    typeNames.map((name) =>
      prisma.vehicleType.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  // --- Calculation rules: reproduces the workbook's actual history -----
  // Flat 30% (March-April), flat 20% (May), then staged 10% + 20% of
  // remainder from June 2026 onward (current practice).
  await prisma.calculationRule.createMany({
    data: [
      {
        effectiveFrom: new Date('2026-03-01'),
        companyDeductionPct: 30,
        labourDeductionPct: 0,
        note: 'Historical: flat 30% deduction (matches Mar/Apr 2026 workbook sheets).',
      },
      {
        effectiveFrom: new Date('2026-05-01'),
        companyDeductionPct: 20,
        labourDeductionPct: 0,
        note: 'Historical: flat 20% deduction (matches May 2026 workbook sheet).',
      },
      {
        effectiveFrom: new Date('2026-06-01'),
        companyDeductionPct: 10,
        labourDeductionPct: 20,
        note: 'Current: 10% company deduction, then 20% labour deduction of the remainder (matches Jun/Jul 2026 workbook sheets).',
      },
    ],
  });

  // --- A few sample work entries + financials + attendance -------------
  const sampleEntry = await prisma.workEntry.create({
    data: {
      date: new Date('2026-08-20'),
      vehicleNo: 'MH12AB1234',
      vehicleTypeId: vehicleTypes[0].id,
      loadUnload: 'LOAD',
      companyId: companies[0].id,
      remark: 'Regular work',
      status: 'APPROVED',
      createdById: labour1.id,
      approvedById: admin.id,
      approvedAt: new Date(),
    },
  });

  // amount 5000, rule as of 2026-08-20 -> 10% then 20% of remainder
  const companyDeduction = 500; // 5000 * 10%
  const balance = 4500; // 5000 - 500
  const labourDeduction = 900; // 4500 * 20%
  const net = 3600; // 4500 - 900

  await prisma.entryFinancial.create({
    data: {
      workEntryId: sampleEntry.id,
      amount: 5000,
      companyDeductionPct: 10,
      companyDeduction,
      balanceAfterCompany: balance,
      labourDeductionPct: 20,
      labourDeduction,
      netAmount: net,
      createdById: admin.id,
    },
  });

  await prisma.dailyAttendance.createMany({
    data: [
      { date: new Date('2026-08-20'), labourId: labour1.labourProfile!.id, present: true },
      { date: new Date('2026-08-20'), labourId: labour2.labourProfile!.id, present: true },
    ],
  });

  console.log('Seed complete.');
  console.log('Login as Admin:  9922297341 / Password123!');
  console.log('Login as Owner:  9000000001 / Password123!');
  console.log('Login as Labour: 9000000101 / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
