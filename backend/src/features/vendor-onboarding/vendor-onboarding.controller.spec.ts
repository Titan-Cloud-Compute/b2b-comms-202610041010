import 'reflect-metadata';
import { CanActivate, ExecutionContext, Injectable, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as express from 'express';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { VendorOnboardingController } from './vendor-onboarding.controller';
import { VendorOnboardingService } from './vendor-onboarding.service';

// ---------------------------------------------------------------------------
// Fake JWT guard — reads role and userId from request headers so tests can
// simulate any session without a real JWT.
// ---------------------------------------------------------------------------

@Injectable()
class FakeJwtAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const role = req.headers['x-test-role'] as string;
    const userId = (req.headers['x-test-user'] as string) ?? 'test-user-id';
    req.session = { userId, role, firmId: null };
    return true;
  }
}

// ---------------------------------------------------------------------------
// In-memory Prisma fake — mimics vendorProfile and document delegates
// ---------------------------------------------------------------------------

function makeFakePrisma() {
  const vendorProfiles = new Map<string, any>();
  const documents: any[] = [];

  return {
    vendorProfiles,
    documents,
    vendorProfile: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.userId !== undefined) return vendorProfiles.get(where.userId) ?? null;
        if (where.id !== undefined) {
          return [...vendorProfiles.values()].find((p) => p.id === where.id) ?? null;
        }
        return null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const profile = { id: `vp-${vendorProfiles.size + 1}`, ...data, createdAt: new Date() };
        vendorProfiles.set(data.userId, profile);
        return profile;
      }),
    },
    document: {
      create: jest.fn(async ({ data }: any) => {
        const doc = { id: `doc-${documents.length + 1}`, ...data, createdAt: new Date() };
        documents.push(doc);
        return doc;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return documents.filter((d) => d.vendorProfileId === where.vendorProfileId);
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VendorOnboardingController (supertest)', () => {
  let app: INestApplication;
  let fakePrisma: ReturnType<typeof makeFakePrisma>;

  beforeEach(async () => {
    fakePrisma = makeFakePrisma();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorOnboardingController],
      providers: [
        VendorOnboardingService,
        { provide: PrismaService, useValue: fakePrisma },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeJwtAuthGuard)
      .compile();

    app = module.createNestApplication();
    app.use(express.json());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('VENDOR: POST /api/vendor/profile → 201 with {id, companyName, contactEmail}', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendor/profile')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'user-1')
      .send({ companyName: 'Acme Corp', contactEmail: 'contact@acme.com' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      companyName: 'Acme Corp',
      contactEmail: 'contact@acme.com',
    });
  });

  it('VENDOR: second POST /api/vendor/profile with same user → 409', async () => {
    await request(app.getHttpServer())
      .post('/api/vendor/profile')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'user-1')
      .send({ companyName: 'Acme Corp', contactEmail: 'contact@acme.com' });

    const res = await request(app.getHttpServer())
      .post('/api/vendor/profile')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'user-1')
      .send({ companyName: 'Acme Corp', contactEmail: 'contact@acme.com' });

    expect(res.status).toBe(409);
  });

  it('VENDOR: POST /api/vendor/documents without a profile → 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendor/documents')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'no-profile-user')
      .send({ filename: 'doc.pdf' });

    expect(res.status).toBe(404);
  });

  it('VENDOR: POST /api/vendor/documents → 201 with status "pending"', async () => {
    await request(app.getHttpServer())
      .post('/api/vendor/profile')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'user-2')
      .send({ companyName: 'Vendor Co', contactEmail: 'v@vendor.com' });

    const res = await request(app.getHttpServer())
      .post('/api/vendor/documents')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'user-2')
      .send({ filename: 'compliance.pdf' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      filename: 'compliance.pdf',
      status: 'pending',
    });
  });

  it('VENDOR: GET /api/vendor/documents → array containing the uploaded document', async () => {
    await request(app.getHttpServer())
      .post('/api/vendor/profile')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'user-3')
      .send({ companyName: 'List Co', contactEmail: 'list@co.com' });

    await request(app.getHttpServer())
      .post('/api/vendor/documents')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'user-3')
      .send({ filename: 'cert.pdf' });

    const res = await request(app.getHttpServer())
      .get('/api/vendor/documents')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'user-3');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      filename: 'cert.pdf',
      status: 'pending',
    });
  });

  it('USER role → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendor/profile')
      .set('x-test-role', 'USER')
      .set('x-test-user', 'user-x')
      .send({ companyName: 'Some Corp', contactEmail: 'u@x.com' });

    expect(res.status).toBe(403);
  });

  it('missing companyName → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendor/profile')
      .set('x-test-role', 'VENDOR')
      .set('x-test-user', 'user-4')
      .send({ contactEmail: 'no-name@x.com' });

    expect(res.status).toBe(400);
  });
});
