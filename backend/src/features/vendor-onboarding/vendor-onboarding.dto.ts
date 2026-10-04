// VendorOnboarding DTOs
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateVendorProfileDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsEmail()
  contactEmail!: string;
}

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;
}

export interface PostApiVendorProfileResponseDto {
  id: string;
  companyName: string;
  contactEmail: string;
}

export interface PostApiVendorDocumentsResponseDto {
  id: string;
  filename: string;
  status: string;
}

export interface GetApiVendorDocumentsResponseDto {
  id: string;
  filename: string;
  status: string;
}
