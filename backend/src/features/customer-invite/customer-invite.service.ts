import { ConflictException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiAdminCustomersResponseDto,
  PostApiAdminCustomersInviteResponseDto,
} from './customer-invite.dto';

export const CUSTOMER_ALREADY_EXISTS = 'customer already exists';

@Injectable()
export class CustomerInviteService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Customer', 'User']);
  }

  /** Find-or-create the User (role CUSTOMER) and create the Customer in one transaction. */
  async invite(rawEmail: string): Promise<PostApiAdminCustomersInviteResponseDto> {
    const email = rawEmail.trim().toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictException(CUSTOMER_ALREADY_EXISTS);
      }
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({ data: { email, role: UserRole.CUSTOMER } });
      }
      const customer = await tx.customer.create({ data: { email, userId: user.id } });
      return { customerId: customer.id, email: customer.email, invitationSent: true };
    });
  }

  async list(): Promise<GetApiAdminCustomersResponseDto[]> {
    return this.model('Customer').findMany({
      select: { id: true, email: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
