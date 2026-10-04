import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import '../../auth/session.types';
import { NotificationPreferencesService } from './notification-preferences.service';
import type {
  GetApiNotificationsPreferencesResponseDto,
  PutApiNotificationsPreferencesRequestDto,
  PutApiNotificationsPreferencesResponseDto,
} from './notification-preferences.dto';

@ApiTags('notification-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER)
@Controller('api/notifications')
export class NotificationPreferencesController {
  constructor(private readonly notificationpreferences: NotificationPreferencesService) {}

  @Put('preferences')
  @HttpCode(200)
  async putApiNotificationsPreferences(
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    const userId = this.sessionUserId(req);
    const b = (body ?? {}) as Partial<PutApiNotificationsPreferencesRequestDto>;
    if (typeof b.orderAlerts !== 'boolean' || typeof b.messageAlerts !== 'boolean') {
      throw new BadRequestException('orderAlerts and messageAlerts must be booleans');
    }
    return this.notificationpreferences.upsert(userId, {
      orderAlerts: b.orderAlerts,
      messageAlerts: b.messageAlerts,
    });
  }

  @Get('preferences')
  async getApiNotificationsPreferences(
    @Req() req: Request,
  ): Promise<GetApiNotificationsPreferencesResponseDto> {
    return this.notificationpreferences.get(this.sessionUserId(req));
  }

  private sessionUserId(req: Request): string {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }
}
