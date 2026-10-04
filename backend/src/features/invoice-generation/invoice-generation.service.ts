import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../lib/integrations/minio.service';
import {
  GetApiInvoicesIdDownloadResponseDto,
  PostApiInvoicesRequestDto,
  PostApiInvoicesResponseDto,
} from './invoice-generation.dto';

export const invoiceObjectKey = (id: string): string => `invoices/${id}.txt`;

@Injectable()
export class InvoiceGenerationService extends FeatureService {
  constructor(
    prisma: PrismaService,
    private readonly minio: MinioService,
  ) {
    super(prisma, ['Invoice', 'Order'] as const);
  }

  async create(dto: PostApiInvoicesRequestDto): Promise<PostApiInvoicesResponseDto> {
    const order = await this.model('Order').findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('order not found');
    if (String(order.status).toLowerCase() !== 'confirmed') {
      throw new BadRequestException('order is not confirmed');
    }
    const existing = await this.model('Invoice').findUnique({ where: { orderId: dto.orderId } });
    if (existing) throw new ConflictException('invoice already exists for this order');

    const invoice = await this.model('Invoice').create({
      data: { orderId: dto.orderId, amount: dto.amount },
    });

    const body = Buffer.from(
      `INVOICE ${invoice.id}\nOrder: ${invoice.orderId}\nAmount: ${invoice.amount.toFixed(2)}\nIssued: ${invoice.createdAt.toISOString()}\n`,
      'utf8',
    );
    await this.minio.putObject(invoiceObjectKey(invoice.id), body, body.length, 'text/plain');

    return { id: invoice.id, orderId: invoice.orderId, amount: invoice.amount };
  }

  async download(id: string): Promise<GetApiInvoicesIdDownloadResponseDto> {
    const invoice = await this.model('Invoice').findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('invoice not found');
    const downloadUrl = await this.minio.getSignedUrl(invoiceObjectKey(invoice.id));
    return { id: invoice.id, downloadUrl };
  }
}
