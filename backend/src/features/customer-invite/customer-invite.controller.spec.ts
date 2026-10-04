import 'reflect-metadata';
import { HttpStatus, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ZodError } from 'zod';
import { RolesGuard } from '../../auth/roles.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CustomerInviteController } from './customer-invite.controller';
import { CustomerInviteService } from './customer-invite.service';

describe('CustomerInviteController', () => {
  const proto = CustomerInviteController.prototype;

  it('is mounted at api/admin/customers and admin-guarded', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CustomerInviteController)).toBe('api/admin/customers');
    const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerInviteController);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('exposes POST invite with 201 and GET list', () => {
    expect(Reflect.getMetadata(PATH_METADATA, proto.postApiAdminCustomersInvite)).toBe('invite');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.postApiAdminCustomersInvite)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.postApiAdminCustomersInvite)).toBe(HttpStatus.CREATED);
    expect(Reflect.getMetadata(PATH_METADATA, proto.getApiAdminCustomers)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.getApiAdminCustomers)).toBe(RequestMethod.GET);
  });

  it('validates the email and delegates to the service', async () => {
    const svc = {
      invite: jest.fn().mockResolvedValue({ customerId: 'c1', email: 'a@b.com', invitationSent: true }),
      list: jest.fn().mockResolvedValue([]),
    };
    const ctrl = new CustomerInviteController(svc as unknown as CustomerInviteService);

    await expect(ctrl.postApiAdminCustomersInvite({ email: 'A@B.com' })).resolves.toEqual({
      customerId: 'c1', email: 'a@b.com', invitationSent: true,
    });
    expect(svc.invite).toHaveBeenCalledWith('a@b.com');
    await expect(ctrl.postApiAdminCustomersInvite({ email: 'not-an-email' })).rejects.toBeInstanceOf(ZodError);
    await expect(ctrl.getApiAdminCustomers()).resolves.toEqual([]);
  });
});
