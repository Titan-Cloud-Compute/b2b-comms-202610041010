import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { InvoiceGenerationService } from './invoice-generation.service';
import {
  GetApiInvoicesIdDownloadResponseDto,
  PostApiInvoicesRequestDto,
  PostApiInvoicesResponseDto,
} from './invoice-generation.dto';

@ApiTags('invoice-generation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/invoices')
export class InvoiceGenerationController {
  constructor(private readonly invoicegeneration: InvoiceGenerationService) {}

  @Post()
  @Roles(UserRole.VENDOR)
  @HttpCode(HttpStatus.CREATED)
  async postApiInvoices(@Body() dto: PostApiInvoicesRequestDto): Promise<PostApiInvoicesResponseDto> {
    return this.invoicegeneration.create(dto);
  }

  @Get(':id/download')
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.ADMIN)
  async getApiInvoicesIdDownload(@Param('id') id: string): Promise<GetApiInvoicesIdDownloadResponseDto> {
    return this.invoicegeneration.download(id);
  }
}
