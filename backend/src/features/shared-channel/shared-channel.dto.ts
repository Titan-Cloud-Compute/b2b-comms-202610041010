// SharedChannel DTOs
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PostApiChannelsRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}

export interface PostApiChannelsResponseDto {
  id: string;
  name: string;
}

export class PostApiChannelsIdMessagesRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;
}

export interface PostApiChannelsIdMessagesResponseDto {
  id: string;
  body: string;
  channelId: string;
}

export interface GetApiChannelsRequestDto {
}

export interface GetApiChannelsResponseDto {
  id: string;
  name: string;
}
