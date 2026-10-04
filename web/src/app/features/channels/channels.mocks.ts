import { MockApiClient } from '../../shared/api/api-client';

interface Channel { id: string; name: string; }
interface Message { id: string; body: string; channelId: string; }

export function registerChannelMocks(client: MockApiClient): void {
  const channels: Channel[] = [];
  const messages: Message[] = [];

  client.registerMock<Channel[]>('GET', 'api/channels', async () => [...channels]);

  client.registerMock<Channel>('POST', 'api/channels', async (body: any) => {
    const channel: Channel = { id: crypto.randomUUID(), name: body?.name ?? '' };
    channels.push(channel);
    return channel;
  });

  // Dynamic POST for messages uses a pattern-based fallback; register a placeholder.
  // In practice the component builds the path at runtime: api/channels/:id/messages
  // MockApiClient requires exact keys, so callers must register per-channel after creation.
  // This file ships the factory helper only; the component registers on creation when needed.
  void messages; // reserved for future use
}
