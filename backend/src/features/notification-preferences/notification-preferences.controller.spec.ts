import 'reflect-metadata';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { NotificationPreferencesController } from './notification-preferences.controller';
import type { NotificationPreferencesService } from './notification-preferences.service';

function makeController() {
  const service = { get: jest.fn(), upsert: jest.fn() };
  const ctrl = new NotificationPreferencesController(service as unknown as NotificationPreferencesService);
  return { ctrl, service };
}

const req = { session: { userId: 'u1', role: 'USER', firmId: null } } as unknown as Request;

describe('NotificationPreferencesController', () => {
  it('is mounted at /api/notifications/preferences', () => {
    expect(Reflect.getMetadata(PATH_METADATA, NotificationPreferencesController)).toBe('api/notifications');
    const proto = NotificationPreferencesController.prototype;
    expect(Reflect.getMetadata(PATH_METADATA, proto.putApiNotificationsPreferences)).toBe('preferences');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.putApiNotificationsPreferences)).toBe(RequestMethod.PUT);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.putApiNotificationsPreferences)).toBe(200);
    expect(Reflect.getMetadata(PATH_METADATA, proto.getApiNotificationsPreferences)).toBe('preferences');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.getApiNotificationsPreferences)).toBe(RequestMethod.GET);
  });

  it('GET reads preferences for the session user', async () => {
    const { ctrl, service } = makeController();
    service.get.mockResolvedValue({ userId: 'u1', orderAlerts: true, messageAlerts: true });
    await expect(ctrl.getApiNotificationsPreferences(req)).resolves.toEqual({ userId: 'u1', orderAlerts: true, messageAlerts: true });
    expect(service.get).toHaveBeenCalledWith('u1');
  });

  it('PUT upserts for the session user and returns the stored record', async () => {
    const { ctrl, service } = makeController();
    service.upsert.mockResolvedValue({ userId: 'u1', orderAlerts: false, messageAlerts: false });
    const res = await ctrl.putApiNotificationsPreferences(req, { orderAlerts: false, messageAlerts: false, userId: 'evil' });
    expect(service.upsert).toHaveBeenCalledWith('u1', { orderAlerts: false, messageAlerts: false });
    expect(res).toEqual({ userId: 'u1', orderAlerts: false, messageAlerts: false });
  });

  it('PUT rejects non-boolean fields with 400', async () => {
    const { ctrl, service } = makeController();
    await expect(ctrl.putApiNotificationsPreferences(req, { orderAlerts: 'yes', messageAlerts: false })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsert).not.toHaveBeenCalled();
  });
});
