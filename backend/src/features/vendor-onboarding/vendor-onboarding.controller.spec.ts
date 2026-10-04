import { PATH_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { VendorOnboardingController } from './vendor-onboarding.controller';
import { VendorOnboardingService } from './vendor-onboarding.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  const profiles: Array<{ id: string; companyName: string; contactEmail: string; userId: string }> = [];
  const docs: Array<{ id: string; filename: string; status: string; vendorProfileId: string; createdAt: Date }> = [];
  return {
    vendorProfile: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const existing = profiles.find((p) => p.userId === where.userId);
        if (existing) return Object.assign(existing, update);
        const p = { id: `vp-${profiles.length + 1}`, ...create };
        profiles.push(p);
        return p;
      }),
      findUnique: jest.fn(async ({ where }) => profiles.find((p) => p.userId === where.userId) ?? null),
    },
    document: {
      create: jest.fn(async ({ data }) => {
        const d = { id: `doc-${docs.length + 1}`, createdAt: new Date(), ...data };
        docs.push(d);
        return d;
      }),
      findMany: jest.fn(async ({ where }) => docs.filter((d) => d.vendorProfileId === where.vendorProfileId)),
    },
  };
}

describe('VendorOnboardingController', () => {
  let controller: VendorOnboardingController;
  const req = { session: { userId: 'user-1', role: 'VENDOR', firmId: null } } as unknown as Request;

  beforeEach(() => {
    const service = new VendorOnboardingService(makePrisma() as unknown as PrismaService);
    controller = new VendorOnboardingController(service);
  });

  it('is routed at api/vendor', () => {
    expect(Reflect.getMetadata(PATH_METADATA, VendorOnboardingController)).toBe('api/vendor');
  });

  it('stores the profile for the session user and returns it', async () => {
    const res = await controller.postApiVendorProfile(req, { companyName: 'Acme', contactEmail: 'a@acme.example.com' });
    expect(res).toEqual({ id: 'vp-1', companyName: 'Acme', contactEmail: 'a@acme.example.com' });
  });

  it('stores an uploaded document as pending and lists it in the library', async () => {
    await controller.postApiVendorProfile(req, { companyName: 'Acme', contactEmail: 'a@acme.example.com' });
    const doc = await controller.postApiVendorDocuments(req, { filename: 'w9.pdf' });
    expect(doc).toEqual({ id: 'doc-1', filename: 'w9.pdf', status: 'pending' });
    const list = await controller.getApiVendorDocuments(req);
    expect(list).toEqual([{ id: 'doc-1', filename: 'w9.pdf', status: 'pending' }]);
  });

  it('rejects document upload before a profile exists', async () => {
    await expect(controller.postApiVendorDocuments(req, { filename: 'w9.pdf' })).rejects.toThrow();
  });

  it('rejects a profile with missing fields', async () => {
    await expect(controller.postApiVendorProfile(req, { companyName: '', contactEmail: '' })).rejects.toThrow();
  });
});
