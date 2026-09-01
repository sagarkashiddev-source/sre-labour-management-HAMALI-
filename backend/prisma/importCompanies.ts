/**
 * Standalone company import — safe to run against an existing database
 * that you don't want to fully re-seed (which would also touch demo
 * users/entries). Only upserts companies by name; never deletes or
 * disables anything.
 *
 * Usage:
 *   npm run import:companies
 */
import { PrismaClient } from '@prisma/client';
import { WORKBOOK_COMPANY_NAMES } from './companies.data';

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let already = 0;
  for (const name of WORKBOOK_COMPANY_NAMES) {
    const existing = await prisma.company.findUnique({ where: { name } });
    if (existing) {
      already++;
      continue;
    }
    await prisma.company.create({ data: { name } });
    created++;
  }
  console.log(`Companies import done: ${created} created, ${already} already existed, ${WORKBOOK_COMPANY_NAMES.length} total in list.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
