import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderManagementService } from './order-management.service';

function fakePrisma() {
  return {
    customer: { findUnique: jest.fn() },
    vendorProfile: { findUnique: jest.fn(), findMany: jest.fn() },
    order: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    orderItem: {},
  };
}

describe('OrderManagementService', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let svc: OrderManagementService;

  beforeEach(() => {
    prisma = fakePrisma();
    svc = new OrderManagementService(prisma as unknown as PrismaService);
  });

  it('creates a pending order with its items for the session customer', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'v1' });
    prisma.order.create.mockResolvedValue({ id: 'o1', status: 'pending', customerId: 'c1', vendorId: 'v1' });

    const res = await svc.create(
      { userId: 'u1', role: 'CUSTOMER' },
      { vendorId: 'v1', items: [{ description: 'Widget', quantity: 2, unitPrice: 3.5 }] },
    );

    expect(res).toEqual({ id: 'o1', status: 'pending', customerId: 'c1', vendorId: 'v1' });
    expect(prisma.customer.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: {
        status: 'pending',
        customerId: 'c1',
        vendorId: 'v1',
        orderItems: { create: [{ description: 'Widget', quantity: 2, unitPrice: 3.5 }] },
      },
    });
  });

  it('rejects create when the user has no customer profile', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(svc.create({ userId: 'u1', role: 'CUSTOMER' }, { vendorId: 'v1', items: [] })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets the owning vendor confirm an order', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'pending', vendorId: 'v1' });
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'v1', userId: 'vu' });
    prisma.order.update.mockResolvedValue({ id: 'o1', status: 'confirmed' });

    const res = await svc.confirm({ userId: 'vu', role: 'VENDOR' }, 'o1', { estimatedDelivery: '2026-10-20' });
    expect(res).toEqual({ id: 'o1', status: 'confirmed', estimatedDelivery: '2026-10-20' });
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'confirmed' } });
  });

  it('forbids a vendor confirming another vendor order and 404s unknown orders', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({ id: 'o1', status: 'pending', vendorId: 'v2' });
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'v1' });
    await expect(
      svc.confirm({ userId: 'vu', role: 'VENDOR' }, 'o1', { estimatedDelivery: '2026-10-20' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(
      svc.confirm({ userId: 'vu', role: 'VENDOR' }, 'nope', { estimatedDelivery: '2026-10-20' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scopes the list by role', async () => {
    prisma.order.findMany.mockResolvedValue([{ id: 'o1', status: 'pending', customerId: 'c1', vendorId: 'v1' }]);

    prisma.customer.findUnique.mockResolvedValue({ id: 'c1' });
    await svc.list({ userId: 'u1', role: 'CUSTOMER' });
    expect(prisma.order.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { customerId: 'c1' } }));

    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'v1' });
    const vendorOrders = await svc.list({ userId: 'vu', role: 'VENDOR' });
    expect(prisma.order.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { vendorId: 'v1' } }));
    expect(vendorOrders).toEqual([{ id: 'o1', status: 'pending', customerId: 'c1', vendorId: 'v1' }]);

    await svc.list({ userId: 'a', role: 'ADMIN' });
    expect(prisma.order.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: undefined }));
  });

  it('lists vendors as id + companyName', async () => {
    prisma.vendorProfile.findMany.mockResolvedValue([{ id: 'v1', companyName: 'Acme' }]);
    await expect(svc.listVendors()).resolves.toEqual([{ id: 'v1', companyName: 'Acme' }]);
  });
});
