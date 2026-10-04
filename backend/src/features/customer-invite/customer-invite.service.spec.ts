import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerInviteService } from './customer-invite.service';

function makePrisma() {
  const tx = {
    customer: { findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    customer: { findMany: jest.fn() },
  };
  return { tx, prisma };
}

describe('CustomerInviteService', () => {
  it('creates User (role CUSTOMER) and Customer in one transaction and returns invitationSent true', async () => {
    const { tx, prisma } = makePrisma();
    tx.customer.findUnique.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    tx.customer.create.mockResolvedValue({ id: 'c1', email: 'a@b.com', userId: 'u1' });
    const svc = new CustomerInviteService(prisma as unknown as PrismaService);

    const res = await svc.invite(' A@B.com ');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith({ data: { email: 'a@b.com', role: 'CUSTOMER' } });
    expect(tx.customer.create).toHaveBeenCalledWith({ data: { email: 'a@b.com', userId: 'u1' } });
    expect(res).toEqual({ customerId: 'c1', email: 'a@b.com', invitationSent: true });
  });

  it('reuses an existing User', async () => {
    const { tx, prisma } = makePrisma();
    tx.customer.findUnique.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue({ id: 'u9', email: 'x@y.com' });
    tx.customer.create.mockResolvedValue({ id: 'c9', email: 'x@y.com', userId: 'u9' });
    const svc = new CustomerInviteService(prisma as unknown as PrismaService);

    await svc.invite('x@y.com');
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('throws 409 ConflictException when the customer already exists', async () => {
    const { tx, prisma } = makePrisma();
    tx.customer.findUnique.mockResolvedValue({ id: 'c1', email: 'a@b.com' });
    const svc = new CustomerInviteService(prisma as unknown as PrismaService);

    await expect(svc.invite('a@b.com')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.customer.create).not.toHaveBeenCalled();
  });

  it('lists customers as id/email', async () => {
    const { prisma } = makePrisma();
    prisma.customer.findMany.mockResolvedValue([{ id: 'c1', email: 'a@b.com' }]);
    const svc = new CustomerInviteService(prisma as unknown as PrismaService);

    expect(await svc.list()).toEqual([{ id: 'c1', email: 'a@b.com' }]);
  });
});
