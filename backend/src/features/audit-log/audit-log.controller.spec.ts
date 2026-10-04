import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditLogController', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  let prisma: { auditEntry: { findMany: jest.Mock; create: jest.Mock } };
  let controller: AuditLogController;

  beforeEach(() => {
    prisma = {
      auditEntry: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a1', action: 'login', userId: 'u1', createdAt },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'a2', action: 'logout', createdAt }),
      },
    };
    const service = new AuditLogService(prisma as unknown as PrismaService);
    controller = new AuditLogController(service);
  });

  it('is mounted at api/admin/audit-log with GET and POST on the root', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuditLogController)).toBe('api/admin/audit-log');
    const proto = AuditLogController.prototype;
    expect(Reflect.getMetadata(PATH_METADATA, proto.getApiAdminAuditLog)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.getApiAdminAuditLog)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, proto.postApiAdminAuditLog)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.postApiAdminAuditLog)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.postApiAdminAuditLog)).toBe(201);
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditLogController)).toHaveLength(2);
  });

  it('GET lists entries in chronological order', async () => {
    const res = await controller.getApiAdminAuditLog();
    expect(prisma.auditEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    );
    expect(res).toEqual([
      { id: 'a1', action: 'login', userId: 'u1', createdAt: createdAt.toISOString() },
    ]);
  });

  it('POST stores the entry and returns the created record', async () => {
    const res = await controller.postApiAdminAuditLog({ action: 'logout', userId: 'u1' });
    expect(prisma.auditEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { action: 'logout', userId: 'u1' } }),
    );
    expect(res).toEqual({ id: 'a2', action: 'logout', createdAt: createdAt.toISOString() });
  });
});
