import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiAdminAuditLogResponseDto,
  PostApiAdminAuditLogRequestDto,
  PostApiAdminAuditLogResponseDto,
} from './audit-log.dto';

@Injectable()
export class AuditLogService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['AuditEntry'] as const);
  }

  /** All AuditEntry records in chronological order (oldest first). */
  async list(): Promise<GetApiAdminAuditLogResponseDto[]> {
    const rows = await this.model('AuditEntry').findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, userId: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Store a new AuditEntry and return the created record. */
  async create(dto: PostApiAdminAuditLogRequestDto): Promise<PostApiAdminAuditLogResponseDto> {
    const row = await this.model('AuditEntry').create({
      data: { action: dto.action, userId: dto.userId },
      select: { id: true, action: true, createdAt: true },
    });
    return { id: row.id, action: row.action, createdAt: row.createdAt.toISOString() };
  }
}
