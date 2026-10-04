import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { OrderActor, OrderManagementService } from './order-management.service';
import {
  GetApiOrdersResponseDto,
  PatchApiOrdersIdConfirmRequestSchema,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersRequestSchema,
  PostApiOrdersResponseDto,
  VendorOptionDto,
} from './order-management.dto';

const ALL_ROLES: UserRole[] = [
  UserRole.CUSTOMER,
  UserRole.VENDOR,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.USER,
];

function actorOf(req: Request): OrderActor {
  const s = req.session;
  if (!s) throw new UnauthorizedException('not authenticated');
  return { userId: s.userId, role: s.role };
}

@ApiTags('order-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/orders')
export class OrderManagementController {
  constructor(private readonly ordermanagement: OrderManagementService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CUSTOMER)
  async postApiOrders(@Req() req: Request, @Body() body: unknown): Promise<PostApiOrdersResponseDto> {
    const dto = PostApiOrdersRequestSchema.parse(body ?? {});
    return this.ordermanagement.create(actorOf(req), dto);
  }

  @Get('vendors')
  @Roles(...ALL_ROLES)
  async getApiOrdersVendors(): Promise<VendorOptionDto[]> {
    return this.ordermanagement.listVendors();
  }

  @Patch(':id/confirm')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async patchApiOrdersIdConfirm(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    const dto = PatchApiOrdersIdConfirmRequestSchema.parse(body ?? {});
    return this.ordermanagement.confirm(actorOf(req), id, dto);
  }

  @Get()
  @Roles(...ALL_ROLES)
  async getApiOrders(@Req() req: Request): Promise<GetApiOrdersResponseDto[]> {
    return this.ordermanagement.list(actorOf(req));
  }
}
