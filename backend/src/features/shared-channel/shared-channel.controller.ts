import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { CreateChannelSchema, PostMessageSchema } from './shared-channel.dto';
import { SharedChannelService } from './shared-channel.service';

@ApiTags('shared-channel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/channels')
export class SharedChannelController {
  constructor(private readonly sharedchannel: SharedChannelService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.VENDOR)
  async createChannel(@Req() req: Request, @Body() body: unknown) {
    const result = CreateChannelSchema.safeParse(body ?? {});
    if (!result.success) {
      throw new BadRequestException(result.error.message);
    }
    const userId = req.session!.userId;
    return this.sharedchannel.createChannel(userId, result.data.name);
  }

  @Get()
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER)
  async listChannels(@Req() req: Request) {
    const { userId, role } = req.session!;
    return this.sharedchannel.listChannels(userId, role);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER)
  async postMessage(@Req() req: Request, @Param('id') channelId: string, @Body() body: unknown) {
    const result = PostMessageSchema.safeParse(body ?? {});
    if (!result.success) {
      throw new BadRequestException(result.error.message);
    }
    const { userId, role } = req.session!;
    return this.sharedchannel.postMessage(userId, role, channelId, result.data.body);
  }
}
