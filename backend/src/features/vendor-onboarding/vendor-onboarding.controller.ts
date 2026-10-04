import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { VendorOnboardingService } from './vendor-onboarding.service';
import {
  GetApiVendorDocumentsResponseDto,
  PostApiVendorDocumentsRequestDto,
  PostApiVendorDocumentsResponseDto,
  PostApiVendorProfileRequestDto,
  PostApiVendorProfileResponseDto,
} from './vendor-onboarding.dto';

function sessionUserId(req: Request): string {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedException();
  return userId;
}

@ApiTags('vendor-onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@Controller('api/vendor')
export class VendorOnboardingController {
  constructor(private readonly vendoronboarding: VendorOnboardingService) {}

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  async postApiVendorProfile(
    @Req() req: Request,
    @Body() body: PostApiVendorProfileRequestDto,
  ): Promise<PostApiVendorProfileResponseDto> {
    return this.vendoronboarding.upsertProfile(sessionUserId(req), body);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  async postApiVendorDocuments(
    @Req() req: Request,
    @Body() body: PostApiVendorDocumentsRequestDto,
  ): Promise<PostApiVendorDocumentsResponseDto> {
    return this.vendoronboarding.createDocument(sessionUserId(req), body);
  }

  @Get('documents')
  async getApiVendorDocuments(@Req() req: Request): Promise<GetApiVendorDocumentsResponseDto[]> {
    return this.vendoronboarding.listDocuments(sessionUserId(req));
  }
}
