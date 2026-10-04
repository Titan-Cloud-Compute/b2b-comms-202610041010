// InvoiceGeneration DTOs
import { IsNumber, IsString, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PostApiInvoicesRequestDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

export interface PostApiInvoicesResponseDto {
  id: string;
  orderId: string;
  amount: number;
}

export interface GetApiInvoicesIdDownloadResponseDto {
  id: string;
  downloadUrl: string;
}
