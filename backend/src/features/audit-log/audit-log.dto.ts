// AuditLog DTOs
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export interface GetApiAdminAuditLogRequestDto {
}

export interface GetApiAdminAuditLogResponseDto {
  id: string;
  action: string;
  userId: string;
  createdAt: string;
}

export class PostApiAdminAuditLogRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  action!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId!: string;
}

export interface PostApiAdminAuditLogResponseDto {
  id: string;
  action: string;
  createdAt: string;
}
