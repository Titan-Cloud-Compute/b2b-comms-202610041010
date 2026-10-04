import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { ROLES_KEY } from '../../auth/roles.guard';
import { InvoiceGenerationController } from './invoice-generation.controller';
import { InvoiceGenerationService } from './invoice-generation.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MinioService } from '../../lib/integrations/minio.service';

describe('InvoiceGenerationController', () => {
  const orders = new Map<string, { id: string; status: string }>();
  const invoices = new Map<string, any>();
  const prisma = {
    order: { findUnique: jest.fn(async ({ where }: any) => orders.get(where.id) ?? null) },
    invoice: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return invoices.get(where.id) ?? null;
        return [...invoices.values()].find((i) => i.orderId === where.orderId) ?? null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const inv = { id: `inv-${invoices.size + 1}`, ...data, createdAt: new Date() };
        invoices.set(inv.id, inv);
        return inv;
      }),
    },
  };
  const minio = {
    putObject: jest.fn(async (key: string) => ({ etag: 'e', bucket: 'b', key })),
    getSignedUrl: jest.fn(async (key: string) => `https://minio.local/b/${key}?sig=x`),
  };
  let controller: InvoiceGenerationController;

  beforeEach(() => {
    orders.clear();
    invoices.clear();
    jest.clearAllMocks();
    orders.set('order-1', { id: 'order-1', status: 'confirmed' });
    orders.set('order-2', { id: 'order-2', status: 'pending' });
    const service = new InvoiceGenerationService(
      prisma as unknown as PrismaService,
      minio as unknown as MinioService,
    );
    controller = new InvoiceGenerationController(service);
  });

  it('routes POST /api/invoices and GET /api/invoices/:id/download', () => {
    expect(Reflect.getMetadata(PATH_METADATA, InvoiceGenerationController)).toBe('api/invoices');
    const post = InvoiceGenerationController.prototype.postApiInvoices;
    const get = InvoiceGenerationController.prototype.getApiInvoicesIdDownload;
    expect(Reflect.getMetadata(PATH_METADATA, post)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, post)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, get)).toBe(':id/download');
    expect(Reflect.getMetadata(METHOD_METADATA, get)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata('__httpCode__', post)).toBe(201);
    expect(Reflect.getMetadata(ROLES_KEY, post)).toEqual(['VENDOR']);
    expect(Reflect.getMetadata(ROLES_KEY, get)).toContain('CUSTOMER');
  });

  it('vendor generates an invoice for a confirmed order', async () => {
    const res = await controller.postApiInvoices({ orderId: 'order-1', amount: 120.5 });
    expect(res).toEqual({ id: expect.any(String), orderId: 'order-1', amount: 120.5 });
    expect(minio.putObject).toHaveBeenCalledWith(
      `invoices/${res.id}.txt`, expect.any(Buffer), expect.any(Number), 'text/plain',
    );
  });

  it('rejects unconfirmed or missing orders', async () => {
    await expect(controller.postApiInvoices({ orderId: 'order-2', amount: 1 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.postApiInvoices({ orderId: 'nope', amount: 1 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer downloads the stored invoice', async () => {
    const created = await controller.postApiInvoices({ orderId: 'order-1', amount: 10 });
    const res = await controller.getApiInvoicesIdDownload(created.id);
    expect(res.id).toBe(created.id);
    expect(res.downloadUrl).toContain(`invoices/${created.id}.txt`);
    await expect(controller.getApiInvoicesIdDownload('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
