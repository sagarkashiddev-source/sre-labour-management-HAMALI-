import { PrismaClient, OwnerPermission } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fetches an Owner's permission flags. Returns null for non-owners.
 * Absence of a row (or a false flag) always means denied — callers must
 * treat `null` the same as "no permissions granted", never as "allow".
 */
export async function getOwnerPermission(userId: string): Promise<OwnerPermission | null> {
  return prisma.ownerPermission.findUnique({ where: { userId } });
}
