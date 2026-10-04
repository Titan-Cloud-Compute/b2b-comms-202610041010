import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { SharedChannelService } from './shared-channel.service';
import {
  GetApiChannelsResponseDto,
  PostApiChannelsIdMessagesRequestDto,
  PostApiChannelsIdMessagesResponseDto,
  PostApiChannelsRequestDto,
  PostApiChannelsResponseDto,
} from './shared-channel.dto';

@ApiTags('shared-channel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR, UserRole.CUSTOMER)
@Controller('api/channels')
export class SharedChannelController {
  constructor(private readonly sharedchannel: SharedChannelService) {}

  @Post()
  @Roles(UserRole.VENDOR)
  @HttpCode(HttpStatus.CREATED)
  async postApiChannels(
    @Req() req: Request,
    @Body() body: PostApiChannelsRequestDto,
  ): Promise<PostApiChannelsResponseDto> {
    return this.sharedchannel.createChannel(req.session!.userId, body.name);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  async postApiChannelsIdMessages(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: PostApiChannelsIdMessagesRequestDto,
  ): Promise<PostApiChannelsIdMessagesResponseDto> {
    const { userId, role } = req.session!;
    return this.sharedchannel.createMessage(userId, role, id, body.body);
  }

  @Get()
  async getApiChannels(@Req() req: Request): Promise<GetApiChannelsResponseDto[]> {
    const { userId, role } = req.session!;
    return this.sharedchannel.listChannels(userId, role);
  }
}
