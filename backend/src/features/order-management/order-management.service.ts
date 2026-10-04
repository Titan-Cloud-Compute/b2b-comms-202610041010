import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiOrdersResponseDto,
  PatchApiOrdersIdConfirmRequestDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersRequestDto,
  PostApiOrdersResponseDto,
  VendorOptionDto,
} from './order-management.dto';

export interface OrderActor {
  userId: string;
  role: UserRole;
}

@Injectable()
export class OrderManagementService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Order', 'OrderItem', 'Customer', 'VendorProfile'] as const);
  }

  /** Customer places a purchase order — stored as "pending" with its items. */
  async create(actor: OrderActor, dto: PostApiOrdersRequestDto): Promise<PostApiOrdersResponseDto> {
    const customer = await this.model('Customer').findUnique({ where: { userId: actor.userId } });
    if (!customer) throw new ForbiddenException('no customer profile for this user');
    const vendor = await this.model('VendorProfile').findUnique({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException('vendor not found');

    const order = await this.model('Order').create({
      data: {
        status: 'pending',
        customerId: customer.id,
        vendorId: vendor.id,
        orderItems: {
          create: (dto.items ?? []).map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
    });
    return { id: order.id, status: order.status, customerId: order.customerId, vendorId: order.vendorId };
  }

  /** Vendor (or admin) confirms a pending order. */
  async confirm(
    actor: OrderActor,
    id: string,
    dto: PatchApiOrdersIdConfirmRequestDto,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    const order = await this.model('Order').findUnique({ where: { id } });
    if (!order) throw new NotFoundException('order not found');
    if (actor.role !== 'ADMIN') {
      const vendor = await this.model('VendorProfile').findUnique({ where: { userId: actor.userId } });
      if (!vendor || vendor.id !== order.vendorId) throw new ForbiddenException('not your order');
    }
    const updated = await this.model('Order').update({ where: { id }, data: { status: 'confirmed' } });
    return { id: updated.id, status: updated.status, estimatedDelivery: dto.estimatedDelivery };
  }

  /** Role-scoped order list. */
  async list(actor: OrderActor): Promise<GetApiOrdersResponseDto[]> {
    let where: { customerId?: string; vendorId?: string } | undefined;
    if (actor.role === 'CUSTOMER') {
      const customer = await this.model('Customer').findUnique({ where: { userId: actor.userId } });
      if (!customer) return [];
      where = { customerId: customer.id };
    } else if (actor.role === 'VENDOR') {
      const vendor = await this.model('VendorProfile').findUnique({ where: { userId: actor.userId } });
      if (!vendor) return [];
      where = { vendorId: vendor.id };
    } else if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
      return [];
    }
    const orders = await this.model('Order').findMany({ where, orderBy: { createdAt: 'desc' } });
    return orders.map((o) => ({ id: o.id, status: o.status, customerId: o.customerId, vendorId: o.vendorId }));
  }

  /** Vendors a customer can order from. */
  async listVendors(): Promise<VendorOptionDto[]> {
    const vendors = await this.model('VendorProfile').findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
    });
    return vendors.map((v) => ({ id: v.id, companyName: v.companyName }));
  }
}
