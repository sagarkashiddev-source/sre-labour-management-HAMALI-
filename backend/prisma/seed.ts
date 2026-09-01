import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { WORKBOOK_COMPANY_NAMES } from './companies.data';

const prisma = new PrismaClient();

async function upsertLabour(params: {
  userCode: string;
  name: string;
  employeeCode: string;
  phone: string;
  email: string;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { phone: params.phone },
    update: {
      userCode: params.userCode,
      name: params.name,
      role: 'LABOUR',
      status: 'ACTIVE',
      email: params.email,
      passwordHash: params.passwordHash,
      labourProfile: {
        upsert: {
          create: { employeeCode: params.employeeCode },
          update: { employeeCode: params.employeeCode, status: 'ACTIVE' },
        },
      },
    },
    create: {
      userCode: params.userCode,
      name: params.name,
      phone: params.phone,
      email: params.email,
      passwordHash: params.passwordHash,
      role: 'LABOUR',
      labourProfile: { create: { employeeCode: params.employeeCode } },
    },
    include: { labourProfile: true },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  // Seeded accounts supplied for the SRE deployment.
  // IDs are human-readable user codes; login remains phone/email.
  const admin = await prisma.user.upsert({
    where: { phone: '9373808755' },
    update: { userCode: 'AD001', name: 'Sagar Kashid', role: 'ADMIN', status: 'ACTIVE', passwordHash },
    create: {
      userCode: 'AD001', name: 'Sagar Kashid', phone: '9373808755', email: 'admin@sre.local',
      passwordHash, role: 'ADMIN',
    },
  });

  const owner = await prisma.user.upsert({
    where: { phone: '9922297341' },
    update: { userCode: 'OW001', name: 'Shahadev Kashid', role: 'OWNER', status: 'ACTIVE', passwordHash },
    create: {
      userCode: 'OW001', name: 'Shahadev Kashid', phone: '9922297341', email: 'owner@sre.local',
      passwordHash, role: 'OWNER',
    },
  });

  await prisma.ownerPermission.upsert({
    where: { userId: owner.id },
    update: {
      canViewFinancials: true, canEditAmount: true, canApproveEntries: false,
      canCancelEntries: false, canManageCompanies: false, canViewFinancialReports: true,
      canExportExcel: true, canExportPdf: true, canViewAuditLogsLimited: true,
    },
    create: {
      userId: owner.id, canViewFinancials: true, canEditAmount: true,
      canApproveEntries: false, canCancelEntries: false, canManageCompanies: false,
      canViewFinancialReports: true, canExportExcel: true, canExportPdf: true,
      canViewAuditLogsLimited: true,
    },
  });

  const labourData = [
    ['LB001', 'Gorakh Kaitke'], ['LB002', 'Abhiman Kokate'], ['LB003', 'Manoj Das'],
    ['LB004', 'Santosh Takle'], ['LB005', 'Janak Burange'], ['LB006', 'Santosh Gaikwad'],
    ['LB007', 'Dada Gaikwad'], ['LB008', 'Rajan Prasad'], ['LB009', 'Govardhan Kadam'],
    ['LB010', 'Saif Ali Khan'], ['LB011', 'Madhukar Kokate'], ['LB012', 'Parameshwar Kokate'],
    ['LB013', 'Babasaheb Mule'],
  ];

  // Supplied mobile numbers. LB010 and LB011 were not supplied, so they keep
  // temporary unique identifiers until their real numbers are provided.
  const labourPhones: Record<string, string> = {
    LB001: '9049429272', LB002: '9356387452', LB003: '7666701549',
    LB004: '7350911525', LB005: '9130329937', LB006: '8180008058',
    LB007: '9689502690', LB008: '7248790985', LB009: '9923189432',
    LB012: '9325726216', LB013: '9730386079',
  };

  const labours = await Promise.all(labourData.map(([code, name], index) =>
    upsertLabour({
      userCode: code,
      employeeCode: code,
      name,
      phone: labourPhones[code] ?? `700000${String(index + 1).padStart(4, '0')}`,
      email: `${code.toLowerCase()}@sre.local`,
      passwordHash,
    })
  ));

  // Companies
  const companies = await Promise.all(
    WORKBOOK_COMPANY_NAMES.map((name) =>
      prisma.company.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  // Vehicle types
  const typeNames = ['909', 'PIK-UP', 'TOURS', 'ACE', '1109', '32FT', '40FT', 'DOST'];
  const vehicleTypes = await Promise.all(
    typeNames.map((name) => prisma.vehicleType.upsert({ where: { name }, update: {}, create: { name } })),
  );

  // Calculation rules — only create if missing so re-seeding is safe.
  const rules = [
    { effectiveFrom: new Date('2026-03-01'), companyDeductionPct: 30, labourDeductionPct: 0, note: 'Historical: flat 30% deduction.' },
    { effectiveFrom: new Date('2026-05-01'), companyDeductionPct: 20, labourDeductionPct: 0, note: 'Historical: flat 20% deduction.' },
    { effectiveFrom: new Date('2026-06-01'), companyDeductionPct: 10, labourDeductionPct: 20, note: 'Current: 10% company deduction, then 20% labour deduction of remainder.' },
  ];
  for (const rule of rules) {
    const existing = await prisma.calculationRule.findFirst({ where: { effectiveFrom: rule.effectiveFrom } });
    if (!existing) await prisma.calculationRule.create({ data: rule });
  }

  // Keep one sample approved entry for initial deployment verification.
  const existingSample = await prisma.workEntry.findFirst({ where: { vehicleNo: 'MH12AB1234' } });
  if (!existingSample && companies[0] && vehicleTypes[0] && labours[0].id) {
    const sampleEntry = await prisma.workEntry.create({
      data: {
        date: new Date('2026-08-20'), vehicleNo: 'MH12AB1234', vehicleTypeId: vehicleTypes[0].id,
        loadUnload: 'LOAD', companyId: companies[0].id, remark: 'Regular work', status: 'APPROVED',
        createdById: labours[0].id, approvedById: admin.id, approvedAt: new Date(),
      },
    });
    await prisma.entryFinancial.create({
      data: {
        workEntryId: sampleEntry.id, amount: 5000, companyDeductionPct: 10,
        companyDeduction: 500, balanceAfterCompany: 4500, labourDeductionPct: 20,
        labourDeduction: 900, netAmount: 3600, createdById: admin.id,
      },
    });
  }

  // Mark all seeded labourers present for the sample date.
  await prisma.dailyAttendance.createMany({
    data: labours.map((l) => ({ date: new Date('2026-08-20'), labourId: l.labourProfile!.id, present: true })),
    skipDuplicates: true,
  });

  console.log('Seed complete: 1 Owner, 1 Admin, 13 Labour.');
  console.log('Admin: AD001 / 9373808755 / Password123!');
  console.log('Owner: OW001 / 9922297341 / Password123!');
  console.log('Labour: supplied numbers seeded for LB001-LB009 and LB012-LB013; LB010/LB011 remain temporary until numbers are supplied.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
