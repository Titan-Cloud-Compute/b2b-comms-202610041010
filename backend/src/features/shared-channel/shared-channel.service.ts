import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelResponseDto, MessageResponseDto } from './shared-channel.dto';

@Injectable()
export class SharedChannelService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Channel', 'Message', 'VendorProfile']);
  }

  async createChannel(userId: string, name: string): Promise<ChannelResponseDto> {
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('vendor profile not found');
    }
    const channel = await this.model('Channel').create({
      data: { name, vendorId: profile.id, vendorProfileId: profile.id },
    });
    return { id: channel.id, name: channel.name };
  }

  async listChannels(userId: string, role: UserRole): Promise<ChannelResponseDto[]> {
    if (role === UserRole.VENDOR) {
      const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
      if (!profile) {
        return [];
      }
      const channels = await this.model('Channel').findMany({
        where: { vendorId: profile.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true },
      });
      return channels;
    }
    // CUSTOMER: all channels
    const channels = await this.model('Channel').findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });
    return channels;
  }

  async postMessage(
    userId: string,
    role: UserRole,
    channelId: string,
    body: string,
  ): Promise<MessageResponseDto> {
    const channel = await this.model('Channel').findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('channel not found');
    }
    if (role === UserRole.VENDOR) {
      const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
      if (!profile || profile.id !== channel.vendorId) {
        throw new ForbiddenException('vendor does not own this channel');
      }
    }
    const message = await this.model('Message').create({
      data: { body, channelId, senderId: userId },
    });
    return { id: message.id, body: message.body, channelId: message.channelId };
  }
}
