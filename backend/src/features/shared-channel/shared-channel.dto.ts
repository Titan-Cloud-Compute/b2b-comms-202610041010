// SharedChannel DTOs
import { z } from 'zod';

export const CreateChannelSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateChannelDto = z.infer<typeof CreateChannelSchema>;

export const PostMessageSchema = z.object({
  body: z.string().trim().min(1),
});

export type PostMessageDto = z.infer<typeof PostMessageSchema>;

export interface ChannelResponseDto {
  id: string;
  name: string;
}

export interface MessageResponseDto {
  id: string;
  body: string;
  channelId: string;
}
