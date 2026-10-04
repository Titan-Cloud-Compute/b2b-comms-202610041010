import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiChannelsResponseDto,
  PostApiChannelsIdMessagesResponseDto,
  PostApiChannelsResponseDto,
} from './shared-channel.dto';

@Injectable()
export class SharedChannelService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Channel', 'Message']);
  }

  private async vendorProfileFor(userId: string) {
    const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('vendor profile required');
    return profile;
  }

  async createChannel(userId: string, name: string): Promise<PostApiChannelsResponseDto> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new BadRequestException('name is required');
    const profile = await this.vendorProfileFor(userId);
    const channel = await this.model('Channel').create({
      data: { name: trimmed, vendorId: profile.id, vendorProfileId: profile.id },
    });
    return { id: channel.id, name: channel.name };
  }

  /**
   * Vendors see the channels they own; customers see every shared channel
   * (the shared data model declares no per-channel membership table).
   */
  async listChannels(userId: string, role: UserRole | string): Promise<GetApiChannelsResponseDto[]> {
    const where =
      role === UserRole.VENDOR ? { vendorProfileId: (await this.vendorProfileFor(userId)).id } : {};
    const channels = await this.model('Channel').findMany({ where, orderBy: { createdAt: 'desc' } });
    return channels.map((c) => ({ id: c.id, name: c.name }));
  }

  async createMessage(
    userId: string,
    role: UserRole | string,
    channelId: string,
    body: string,
  ): Promise<PostApiChannelsIdMessagesResponseDto> {
    const text = (body ?? '').trim();
    if (!text) throw new BadRequestException('body is required');
    const channel = await this.model('Channel').findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('channel not found');
    if (role === UserRole.VENDOR) {
      const profile = await this.vendorProfileFor(userId);
      if (profile.id !== channel.vendorProfileId) throw new ForbiddenException('not a member of this channel');
    }
    const message = await this.model('Message').create({
      data: { body: text, channelId: channel.id, senderId: userId },
    });
    return { id: message.id, body: message.body, channelId: message.channelId };
  }
}
