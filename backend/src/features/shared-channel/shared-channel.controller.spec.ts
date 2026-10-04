import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  RequestMethod,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ROLES_KEY, RolesGuard } from '../../auth/roles.guard';
import { SharedChannelController } from './shared-channel.controller';
import { SharedChannelService } from './shared-channel.service';

// ---- helpers ----------------------------------------------------------------

function makeService(overrides: Partial<{
  createChannel: jest.Mock;
  listChannels: jest.Mock;
  postMessage: jest.Mock;
}> = {}): SharedChannelService {
  return {
    createChannel: jest.fn().mockResolvedValue({ id: 'ch1', name: 'General' }),
    listChannels: jest.fn().mockResolvedValue([{ id: 'ch1', name: 'General' }]),
    postMessage: jest.fn().mockResolvedValue({ id: 'msg1', body: 'Hello', channelId: 'ch1' }),
    ...overrides,
  } as unknown as SharedChannelService;
}

function makeRequest(userId: string, role: UserRole) {
  return { session: { userId, role } } as any;
}

const proto = SharedChannelController.prototype;

// ---- metadata tests ---------------------------------------------------------

describe('SharedChannelController — metadata', () => {
  it('is mounted at api/channels', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SharedChannelController)).toBe('api/channels');
  });

  it('is guarded by JwtAuthGuard and RolesGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SharedChannelController);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('POST / — createChannel — is mounted at empty path, HTTP POST, 201', () => {
    expect(Reflect.getMetadata(PATH_METADATA, proto.createChannel)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.createChannel)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.createChannel)).toBe(HttpStatus.CREATED);
  });

  it('POST / — createChannel — requires VENDOR role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, proto.createChannel);
    expect(roles).toEqual(expect.arrayContaining([UserRole.VENDOR]));
  });

  it('GET / — listChannels — is mounted at empty path, HTTP GET', () => {
    expect(Reflect.getMetadata(PATH_METADATA, proto.listChannels)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.listChannels)).toBe(RequestMethod.GET);
  });

  it('GET / — listChannels — allows VENDOR and CUSTOMER roles', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, proto.listChannels);
    expect(roles).toEqual(expect.arrayContaining([UserRole.VENDOR, UserRole.CUSTOMER]));
  });

  it('POST :id/messages — postMessage — is mounted at :id/messages, HTTP POST, 201', () => {
    expect(Reflect.getMetadata(PATH_METADATA, proto.postMessage)).toBe(':id/messages');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.postMessage)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.postMessage)).toBe(HttpStatus.CREATED);
  });

  it('POST :id/messages — postMessage — allows VENDOR and CUSTOMER roles', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, proto.postMessage);
    expect(roles).toEqual(expect.arrayContaining([UserRole.VENDOR, UserRole.CUSTOMER]));
  });
});

// ---- behaviour tests --------------------------------------------------------

describe('SharedChannelController — createChannel', () => {
  it('delegates valid name to service and returns {id,name}', async () => {
    const svc = makeService();
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user1', UserRole.VENDOR);

    const result = await ctrl.createChannel(req, { name: 'Sales' });
    expect(result).toEqual({ id: 'ch1', name: 'General' });
    expect(svc.createChannel).toHaveBeenCalledWith('user1', 'Sales');
  });

  it('throws BadRequestException for empty name', async () => {
    const svc = makeService();
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user1', UserRole.VENDOR);

    await expect(ctrl.createChannel(req, { name: '' })).rejects.toBeInstanceOf(BadRequestException);
    expect(svc.createChannel).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when body has no name', async () => {
    const svc = makeService();
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user1', UserRole.VENDOR);

    await expect(ctrl.createChannel(req, {})).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SharedChannelController — listChannels', () => {
  it('returns channels for VENDOR', async () => {
    const svc = makeService();
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user1', UserRole.VENDOR);

    const result = await ctrl.listChannels(req);
    expect(result).toEqual([{ id: 'ch1', name: 'General' }]);
    expect(svc.listChannels).toHaveBeenCalledWith('user1', UserRole.VENDOR);
  });

  it('returns channels for CUSTOMER', async () => {
    const svc = makeService();
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user2', UserRole.CUSTOMER);

    await ctrl.listChannels(req);
    expect(svc.listChannels).toHaveBeenCalledWith('user2', UserRole.CUSTOMER);
  });
});

describe('SharedChannelController — postMessage', () => {
  it('delegates valid body to service and returns {id,body,channelId}', async () => {
    const svc = makeService();
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user1', UserRole.CUSTOMER);

    const result = await ctrl.postMessage(req, 'ch1', { body: 'Hello' });
    expect(result).toEqual({ id: 'msg1', body: 'Hello', channelId: 'ch1' });
    expect(svc.postMessage).toHaveBeenCalledWith('user1', UserRole.CUSTOMER, 'ch1', 'Hello');
  });

  it('throws BadRequestException for empty body', async () => {
    const svc = makeService();
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user1', UserRole.CUSTOMER);

    await expect(ctrl.postMessage(req, 'ch1', { body: '' })).rejects.toBeInstanceOf(BadRequestException);
    expect(svc.postMessage).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when body field is missing', async () => {
    const svc = makeService();
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user1', UserRole.CUSTOMER);

    await expect(ctrl.postMessage(req, 'ch1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('propagates NotFoundException when channel not found', async () => {
    const svc = makeService({
      postMessage: jest.fn().mockRejectedValue(new NotFoundException('channel not found')),
    });
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user1', UserRole.CUSTOMER);

    await expect(ctrl.postMessage(req, 'unknown', { body: 'Hi' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propagates ForbiddenException when vendor does not own channel', async () => {
    const svc = makeService({
      postMessage: jest.fn().mockRejectedValue(new ForbiddenException('vendor does not own this channel')),
    });
    const ctrl = new SharedChannelController(svc);
    const req = makeRequest('user1', UserRole.VENDOR);

    await expect(ctrl.postMessage(req, 'ch-other', { body: 'Hi' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ---- service unit tests (fake Prisma) ---------------------------------------

describe('SharedChannelService — unit', () => {
  function makePrisma(overrides: Record<string, Partial<{
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  }>> = {}) {
    const channelDelegate = {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'ch1', name: 'General', vendorId: 'vp1', createdAt: new Date() }),
      ...overrides['Channel'],
    };
    const messageDelegate = {
      create: jest.fn().mockResolvedValue({ id: 'msg1', body: 'Hello', channelId: 'ch1', senderId: 'u1' }),
      ...overrides['Message'],
    };
    const vendorProfileDelegate = {
      findUnique: jest.fn().mockResolvedValue({ id: 'vp1', userId: 'u1' }),
      ...overrides['VendorProfile'],
    };
    return {
      channel: channelDelegate,
      message: messageDelegate,
      vendorProfile: vendorProfileDelegate,
    };
  }

  it('createChannel returns {id,name}', async () => {
    const prisma = makePrisma();
    const { SharedChannelService: Svc } = require('./shared-channel.service');
    const svc = new Svc(prisma);

    const result = await svc.createChannel('u1', 'General');
    expect(result).toEqual({ id: 'ch1', name: 'General' });
    expect(prisma.vendorProfile.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.channel.create).toHaveBeenCalledWith({ data: { name: 'General', vendorId: 'vp1', vendorProfileId: 'vp1' } });
  });

  it('createChannel throws NotFoundException when vendor profile missing', async () => {
    const prisma = makePrisma({ VendorProfile: { findUnique: jest.fn().mockResolvedValue(null) } });
    const { SharedChannelService: Svc } = require('./shared-channel.service');
    const svc = new Svc(prisma);

    await expect(svc.createChannel('u-no-profile', 'test')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listChannels returns vendor own channels', async () => {
    const ownChannels = [{ id: 'ch1', name: 'General' }];
    const prisma = makePrisma({ Channel: { findMany: jest.fn().mockResolvedValue(ownChannels) } });
    const { SharedChannelService: Svc } = require('./shared-channel.service');
    const svc = new Svc(prisma);

    const result = await svc.listChannels('u1', UserRole.VENDOR);
    expect(result).toEqual(ownChannels);
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorId: 'vp1' } }),
    );
  });

  it('listChannels returns all channels for CUSTOMER', async () => {
    const allChannels = [{ id: 'ch1', name: 'General' }, { id: 'ch2', name: 'Support' }];
    const prisma = makePrisma({ Channel: { findMany: jest.fn().mockResolvedValue(allChannels) } });
    const { SharedChannelService: Svc } = require('./shared-channel.service');
    const svc = new Svc(prisma);

    const result = await svc.listChannels('u2', UserRole.CUSTOMER);
    expect(result).toEqual(allChannels);
    // no where filter for customer
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ where: expect.anything() }),
    );
  });

  it('postMessage creates message when channel exists', async () => {
    const channelMock = { id: 'ch1', name: 'General', vendorId: 'vp1' };
    const prisma = makePrisma({
      Channel: { findUnique: jest.fn().mockResolvedValue(channelMock) },
    });
    const { SharedChannelService: Svc } = require('./shared-channel.service');
    const svc = new Svc(prisma);

    const result = await svc.postMessage('u1', UserRole.CUSTOMER, 'ch1', 'Hello');
    expect(result).toEqual({ id: 'msg1', body: 'Hello', channelId: 'ch1' });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { body: 'Hello', channelId: 'ch1', senderId: 'u1' },
    });
  });

  it('postMessage throws NotFoundException for unknown channel', async () => {
    const prisma = makePrisma({
      Channel: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const { SharedChannelService: Svc } = require('./shared-channel.service');
    const svc = new Svc(prisma);

    await expect(svc.postMessage('u1', UserRole.CUSTOMER, 'unknown', 'Hi')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('postMessage throws ForbiddenException when VENDOR does not own channel', async () => {
    const channelMock = { id: 'ch1', name: 'General', vendorId: 'vp-other' };
    const prisma = makePrisma({
      Channel: { findUnique: jest.fn().mockResolvedValue(channelMock) },
      // vendor profile has id vp1, channel has vendorId vp-other
    });
    const { SharedChannelService: Svc } = require('./shared-channel.service');
    const svc = new Svc(prisma);

    await expect(svc.postMessage('u1', UserRole.VENDOR, 'ch1', 'Hi')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
