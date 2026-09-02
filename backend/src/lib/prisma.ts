import { PrismaClient } from '@prisma/client';

// Single shared PrismaClient for the whole process.
//
// Every controller/service previously did `const prisma = new PrismaClient()`
// at its own module scope — 13 separate files, 13 separate clients, each
// opening its own connection pool (default pool size scales with the
// number of clients, not the number of concurrent requests). Under real
// concurrent load that exhausts Postgres's max_connections far sooner than
// a single shared client would, for no benefit: PrismaClient is designed
// to be a long-lived singleton reused across the app.
//
// In dev, `tsx watch` / ts-node-dev style hot-reloading re-executes this
// module on every file change, which would otherwise create a fresh client
// (and fresh connections) on every reload. Stashing it on `global` survives
// module reloads in the same process, same as Prisma's own recommended
// Next.js pattern.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
