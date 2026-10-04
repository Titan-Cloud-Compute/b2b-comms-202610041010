import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SharedChannelService } from './shared-channel.service';

describe('SharedChannelService', () => {
  const profile = { id: 'vp-1', userId: 'vendor-user' };
  let prisma: any;
  let service: SharedChannelService;

  beforeEach(() => {
    prisma = {
      vendorProfile: { findUnique: jest.fn(async ({ where }: any) => (where.userId === profile.userId ? profile : null)) },
      channel: {
        create: jest.fn(async ({ data }: any) => ({ id: 'ch-1', ...data })),
        findMany: jest.fn(async () => [{ id: 'ch-1', name: 'General', vendorProfileId: 'vp-1' }]),
        findUnique: jest.fn(async () => ({ id: 'ch-1', name: 'General', vendorProfileId: 'vp-1' })),
      },
      message: { create: jest.fn(async ({ data }: any) => ({ id: 'm-1', ...data })) },
    };
    service = new SharedChannelService(prisma as unknown as PrismaService);
  });

  it('creates a channel owned by the vendor profile', async () => {
    await expect(service.createChannel('vendor-user', 'General')).resolves.toEqual({ id: 'ch-1', name: 'General' });
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { name: 'General', vendorId: 'vp-1', vendorProfileId: 'vp-1' },
    });
  });

  it('rejects channel creation without a vendor profile', async () => {
    await expect(service.createChannel('other', 'General')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists channels for vendors and customers', async () => {
    await expect(service.listChannels('vendor-user', 'VENDOR')).resolves.toEqual([{ id: 'ch-1', name: 'General' }]);
    await expect(service.listChannels('cust-user', 'CUSTOMER')).resolves.toEqual([{ id: 'ch-1', name: 'General' }]);
  });

  it('stores a customer message with the session user as sender', async () => {
    await expect(service.createMessage('cust-user', 'CUSTOMER', 'ch-1', 'Hello')).resolves.toEqual({
      id: 'm-1',
      body: 'Hello',
      channelId: 'ch-1',
    });
    expect(prisma.message.create).toHaveBeenCalledWith({ data: { body: 'Hello', channelId: 'ch-1', senderId: 'cust-user' } });
  });
});
