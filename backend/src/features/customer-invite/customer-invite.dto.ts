// CustomerInvite DTOs
import { z } from 'zod';

export const PostApiAdminCustomersInviteRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export type PostApiAdminCustomersInviteRequestDto = z.infer<typeof PostApiAdminCustomersInviteRequestSchema>;

export interface PostApiAdminCustomersInviteResponseDto {
  customerId: string;
  email: string;
  invitationSent: boolean;
}

export interface GetApiAdminCustomersRequestDto {
}

export interface GetApiAdminCustomersResponseDto {
  id: string;
  email: string;
}
