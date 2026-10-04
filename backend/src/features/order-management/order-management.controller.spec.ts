import 'reflect-metadata';
import { HttpStatus, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { ZodError } from 'zod';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ROLES_KEY, RolesGuard } from '../../auth/roles.guard';
import { OrderManagementController } from './order-management.controller';
import { OrderManagementService } from './order-management.service';

describe('OrderManagementController', () => {
  const proto = OrderManagementController.prototype;

  it('is mounted at api/orders and guarded', () => {
    expect(Reflect.getMetadata(PATH_METADATA, OrderManagementController)).toBe('api/orders');
    expect(Reflect.getMetadata(GUARDS_METADATA, OrderManagementController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, RolesGuard]),
    );
    expect(Reflect.getMetadata(ROLES_KEY, OrderManagementController)).toBeUndefined();
  });

  it('exposes POST /, PATCH :id/confirm and GET / with per-route roles', () => {
    expect(Reflect.getMetadata(PATH_METADATA, proto.postApiOrders)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.postApiOrders)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.postApiOrders)).toBe(HttpStatus.CREATED);
    expect(Reflect.getMetadata(ROLES_KEY, proto.postApiOrders)).toEqual(['CUSTOMER']);

    expect(Reflect.getMetadata(PATH_METADATA, proto.patchApiOrdersIdConfirm)).toBe(':id/confirm');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.patchApiOrdersIdConfirm)).toBe(RequestMethod.PATCH);
    expect(Reflect.getMetadata(ROLES_KEY, proto.patchApiOrdersIdConfirm)).toEqual(
      expect.arrayContaining(['VENDOR', 'ADMIN']),
    );

    expect(Reflect.getMetadata(PATH_METADATA, proto.getApiOrders)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.getApiOrders)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(ROLES_KEY, proto.getApiOrders)).toEqual(
      expect.arrayContaining(['CUSTOMER', 'VENDOR', 'ADMIN']),
    );
  });

  it('binds handlers to the session user and validates input', async () => {
    const svc = {
      create: jest.fn().mockResolvedValue({ id: 'o1', status: 'pending', customerId: 'c1', vendorId: 'v1' }),
      confirm: jest.fn().mockResolvedValue({ id: 'o1', status: 'confirmed' }),
      list: jest.fn().mockResolvedValue([]),
      listVendors: jest.fn().mockResolvedValue([]),
    };
    const ctrl = new OrderManagementController(svc as unknown as OrderManagementService);
    const customerReq = { session: { userId: 'u1', role: 'CUSTOMER', firmId: null } } as unknown as Request;
    const vendorReq = { session: { userId: 'vu', role: 'VENDOR', firmId: null } } as unknown as Request;

    await expect(ctrl.postApiOrders(customerReq, { vendorId: 'v1' })).resolves.toMatchObject({ status: 'pending' });
    expect(svc.create).toHaveBeenCalledWith({ userId: 'u1', role: 'CUSTOMER' }, { vendorId: 'v1', items: [] });
    await expect(ctrl.postApiOrders(customerReq, {})).rejects.toBeInstanceOf(ZodError);

    await expect(
      ctrl.patchApiOrdersIdConfirm(vendorReq, 'o1', { estimatedDelivery: '2026-10-20' }),
    ).resolves.toEqual({ id: 'o1', status: 'confirmed' });
    expect(svc.confirm).toHaveBeenCalledWith({ userId: 'vu', role: 'VENDOR' }, 'o1', { estimatedDelivery: '2026-10-20' });
    await expect(
      ctrl.patchApiOrdersIdConfirm(vendorReq, 'o1', { estimatedDelivery: 'soon' }),
    ).rejects.toBeInstanceOf(ZodError);

    await expect(ctrl.getApiOrders(vendorReq)).resolves.toEqual([]);
    expect(svc.list).toHaveBeenCalledWith({ userId: 'vu', role: 'VENDOR' });
  });
});
