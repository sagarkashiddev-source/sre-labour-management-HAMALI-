import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';

/**
 * Attendance is recorded here as its own manual daily action — NOT derived
 * from work_entries. The workbook's "Present" figure is a headcount taken
 * independently of how many entries happen to exist that day, and
 * per-person calculations are wrong if the two are conflated.
 */

const setDaySchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: 'A valid date is required.' }) }),
  presentLabourIds: z.array(z.string().uuid()),
});

/**
 * POST /api/attendance/day — bulk-sets the full day's roster in one call:
 * every active labourer becomes present:true if their id is in the list,
 * present:false otherwise. This matches how the admin will actually do it
 * ("mark who showed up today") rather than one-row-at-a-time.
 */
export async function setDayAttendance(req: Request, res: Response) {
  const { date, presentLabourIds } = setDaySchema.parse(req.body);

  const activeLabour = await prisma.labourProfile.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });
  const presentSet = new Set(presentLabourIds);

  // Same atomicity rule as everywhere else: the roster upserts and their
  // audit log entry commit as one unit. This uses the array form of
  // $transaction (all statements in one batch) rather than the interactive
  // callback form used elsewhere, since every statement here is already a
  // plain Prisma call with no branching logic between them.
  await prisma.$transaction([
    ...activeLabour.map((l: { id: string }) =>
      prisma.dailyAttendance.upsert({
        where: { date_labourId: { date, labourId: l.id } },
        create: { date, labourId: l.id, present: presentSet.has(l.id) },
        update: { present: presentSet.has(l.id) },
      }),
    ),
    prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'ATTENDANCE_SET',
        entityType: 'DailyAttendance',
        entityId: date.toISOString().slice(0, 10),
        newValue: { date: date.toISOString().slice(0, 10), presentCount: presentSet.size },
        ipAddress: req.ip,
      },
    }),
  ]);

  return res.json({ date: date.toISOString().slice(0, 10), presentCount: presentSet.size });
}

const dateQuerySchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: 'A valid date is required.' }) }),
});

export async function getDayAttendance(req: Request, res: Response) {
  const { date } = dateQuerySchema.parse(req.query);

  const activeLabour = await prisma.labourProfile.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, employeeCode: true, user: { select: { name: true } } },
    orderBy: { employeeCode: 'asc' },
  });

  const attendance = await prisma.dailyAttendance.findMany({ where: { date } });
  const presentMap = new Map(attendance.map((a: { labourId: string; present: boolean }) => [a.labourId, a.present]));

  const roster = activeLabour.map((l: { id: string; employeeCode: string; user: { name: string } }) => ({
    labourId: l.id,
    employeeCode: l.employeeCode,
    name: l.user.name,
    present: presentMap.get(l.id) ?? false,
  }));

  return res.json({
    date: date.toISOString().slice(0, 10),
    roster,
    presentCount: roster.filter((r: { present: boolean }) => r.present).length,
  });
}
