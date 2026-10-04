import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { CreateDocumentDto, CreateVendorProfileDto } from './vendor-onboarding.dto';
import { VendorOnboardingService } from './vendor-onboarding.service';

@ApiTags('vendor-onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@Controller('api/vendor')
export class VendorOnboardingController {
  constructor(private readonly vendoronboarding: VendorOnboardingService) {}

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async postApiVendorProfile(
    @Req() req: Request,
    @Body() dto: CreateVendorProfileDto,
  ) {
    return this.vendoronboarding.createProfile(req.session!.userId, dto);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async postApiVendorDocuments(
    @Req() req: Request,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.vendoronboarding.addDocument(req.session!.userId, dto);
  }

  @Get('documents')
  async getApiVendorDocuments(@Req() req: Request) {
    return this.vendoronboarding.listDocuments(req.session!.userId);
  }
}
