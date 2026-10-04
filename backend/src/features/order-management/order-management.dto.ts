// OrderManagement DTOs
import { z } from 'zod';

export const OrderItemInputSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

export const PostApiOrdersRequestSchema = z.object({
  vendorId: z.string().trim().min(1),
  items: z.array(OrderItemInputSchema).default([]),
});

export type PostApiOrdersRequestDto = z.infer<typeof PostApiOrdersRequestSchema>;

export interface PostApiOrdersResponseDto {
  id: string;
  status: string;
  customerId: string;
  vendorId: string;
}

export const PatchApiOrdersIdConfirmRequestSchema = z.object({
  estimatedDelivery: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v)), {
      message: 'estimatedDelivery must be a date (YYYY-MM-DD)',
    }),
});

export type PatchApiOrdersIdConfirmRequestDto = z.infer<typeof PatchApiOrdersIdConfirmRequestSchema>;

export interface PatchApiOrdersIdConfirmResponseDto {
  id: string;
  status: string;
  estimatedDelivery?: string;
}

export interface GetApiOrdersRequestDto {
}

export interface GetApiOrdersResponseDto {
  id: string;
  status: string;
  customerId: string;
  vendorId: string;
}

export interface VendorOptionDto {
  id: string;
  companyName: string;
}
