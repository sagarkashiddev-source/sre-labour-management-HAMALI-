import { describe, it, expect, vi } from 'vitest';
import {
  requireRole,
  entrySelectFor,
  OPERATIONAL_ENTRY_SELECT,
  FINANCIAL_ENTRY_SELECT,
} from './rbac.middleware';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireRole', () => {
  it('calls next() when the user has an allowed role', () => {
    const middleware = requireRole('ADMIN', 'OWNER');
    const req: any = { user: { userId: 'u1', role: 'ADMIN' } };
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 for a role that is not in the allowed list', () => {
    const middleware = requireRole('ADMIN');
    const req: any = { user: { userId: 'u1', role: 'LABOUR' } };
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 401 rather than 403 when there is no authenticated user at all', () => {
    // Distinguishing "not logged in" from "logged in but wrong role"
    // matters for the client — a 401 should trigger a re-login, a 403
    // should not.
    const middleware = requireRole('ADMIN');
    const req: any = {};
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('never treats an unlisted role as implicitly allowed', () => {
    // requireRole('ADMIN') must not accidentally let OWNER or LABOUR through.
    const middleware = requireRole('ADMIN');
    for (const role of ['OWNER', 'LABOUR']) {
      const req: any = { user: { userId: 'u1', role } };
      const res = mockRes();
      const next = vi.fn();
      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
    }
  });
});

describe('entrySelectFor — the boundary that keeps financial data out of unauthorized responses', () => {
  it('gives ADMIN the full financial select, unconditionally', async () => {
    const select = await entrySelectFor('ADMIN', false);
    expect(select).toBe(FINANCIAL_ENTRY_SELECT);
  });

  it('gives OWNER the financial select only when canViewFinancials is true', async () => {
    const withGrant = await entrySelectFor('OWNER', true);
    expect(withGrant).toBe(FINANCIAL_ENTRY_SELECT);
  });

  it('gives OWNER the operational-only select when canViewFinancials is false', async () => {
    const withoutGrant = await entrySelectFor('OWNER', false);
    expect(withoutGrant).toBe(OPERATIONAL_ENTRY_SELECT);
  });

  it('defaults OWNER to operational-only for null/undefined permission (never default-allow)', async () => {
    // Mirrors schema.prisma's OwnerPermission comment: "Absence of a row
    // (or a false flag) means denied — never default-allow." A missing
    // permission row must fail closed, not open.
    expect(await entrySelectFor('OWNER', null)).toBe(OPERATIONAL_ENTRY_SELECT);
    expect(await entrySelectFor('OWNER', undefined)).toBe(OPERATIONAL_ENTRY_SELECT);
  });

  it('always gives LABOUR the operational-only select, regardless of the flag passed in', async () => {
    // Even if a caller accidentally passed true for a Labour request, the
    // role check must win — Labour should never see financial data.
    expect(await entrySelectFor('LABOUR', true)).toBe(OPERATIONAL_ENTRY_SELECT);
  });

  it('the operational select never includes a financial relation, even by field name typo risk', () => {
    expect('financial' in OPERATIONAL_ENTRY_SELECT).toBe(false);
  });
});
