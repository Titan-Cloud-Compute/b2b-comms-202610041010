import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentDto, CreateVendorProfileDto } from './vendor-onboarding.dto';

@Injectable()
export class VendorOnboardingService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['VendorProfile', 'Document'] as const);
  }

  async createProfile(userId: string, dto: CreateVendorProfileDto) {
    const existing = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('vendor profile already exists');
    }
    const profile = await this.model('VendorProfile').create({
      data: { companyName: dto.companyName, contactEmail: dto.contactEmail, userId },
    });
    return { id: profile.id, companyName: profile.companyName, contactEmail: profile.contactEmail };
  }

  async addDocument(userId: string, dto: CreateDocumentDto) {
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('create your vendor profile first');
    }
    const doc = await this.model('Document').create({
      data: { filename: dto.filename, status: 'pending', vendorProfileId: profile.id },
    });
    return { id: doc.id, filename: doc.filename, status: doc.status };
  }

  async listDocuments(userId: string) {
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) {
      return [];
    }
    const docs = await this.model('Document').findMany({
      where: { vendorProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({ id: d.id, filename: d.filename, status: d.status }));
  }
}
