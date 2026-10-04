import { NotificationPreferencesService } from './notification-preferences.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService() {
  const delegate = { findUnique: jest.fn(), upsert: jest.fn() };
  const prisma = { notificationPreference: delegate } as unknown as PrismaService;
  return { service: new NotificationPreferencesService(prisma), delegate };
}

describe('NotificationPreferencesService', () => {
  it('returns defaults (true/true) when no row exists', async () => {
    const { service, delegate } = makeService();
    delegate.findUnique.mockResolvedValue(null);
    await expect(service.get('u1')).resolves.toEqual({ userId: 'u1', orderAlerts: true, messageAlerts: true });
    expect(delegate.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('returns the stored row', async () => {
    const { service, delegate } = makeService();
    delegate.findUnique.mockResolvedValue({ id: 'x', userId: 'u1', orderAlerts: false, messageAlerts: true });
    await expect(service.get('u1')).resolves.toEqual({ userId: 'u1', orderAlerts: false, messageAlerts: true });
  });

  it('upserts per user and returns the stored record (both false)', async () => {
    const { service, delegate } = makeService();
    delegate.upsert.mockResolvedValue({ id: 'x', userId: 'u1', orderAlerts: false, messageAlerts: false });
    const res = await service.upsert('u1', { orderAlerts: false, messageAlerts: false });
    expect(delegate.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', orderAlerts: false, messageAlerts: false },
      update: { orderAlerts: false, messageAlerts: false },
    });
    expect(res).toEqual({ userId: 'u1', orderAlerts: false, messageAlerts: false });
  });
});
