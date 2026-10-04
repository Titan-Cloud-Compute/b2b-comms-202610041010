import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiNotificationsPreferencesResponseDto,
  PutApiNotificationsPreferencesRequestDto,
  PutApiNotificationsPreferencesResponseDto,
} from './notification-preferences.dto';

export const DEFAULT_NOTIFICATION_PREFERENCES = { orderAlerts: true, messageAlerts: true } as const;

@Injectable()
export class NotificationPreferencesService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['NotificationPreference']);
  }

  async get(userId: string): Promise<GetApiNotificationsPreferencesResponseDto> {
    const row = await this.model('NotificationPreference').findUnique({ where: { userId } });
    if (!row) return { userId, ...DEFAULT_NOTIFICATION_PREFERENCES };
    return { userId: row.userId, orderAlerts: row.orderAlerts, messageAlerts: row.messageAlerts };
  }

  async upsert(
    userId: string,
    dto: PutApiNotificationsPreferencesRequestDto,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    const data = { orderAlerts: dto.orderAlerts, messageAlerts: dto.messageAlerts };
    const row = await this.model('NotificationPreference').upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return { userId: row.userId, orderAlerts: row.orderAlerts, messageAlerts: row.messageAlerts };
  }
}
