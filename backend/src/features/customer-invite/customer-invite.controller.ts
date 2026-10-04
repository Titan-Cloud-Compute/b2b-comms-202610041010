import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { CustomerInviteService } from './customer-invite.service';
import {
  GetApiAdminCustomersResponseDto,
  PostApiAdminCustomersInviteRequestSchema,
  PostApiAdminCustomersInviteResponseDto,
} from './customer-invite.dto';

@ApiTags('customer-invite')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin/customers')
export class CustomerInviteController {
  constructor(private readonly customerinvite: CustomerInviteService) {}

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async postApiAdminCustomersInvite(@Body() body: unknown): Promise<PostApiAdminCustomersInviteResponseDto> {
    const dto = PostApiAdminCustomersInviteRequestSchema.parse(body ?? {});
    return this.customerinvite.invite(dto.email);
  }

  @Get()
  async getApiAdminCustomers(): Promise<GetApiAdminCustomersResponseDto[]> {
    return this.customerinvite.list();
  }
}
