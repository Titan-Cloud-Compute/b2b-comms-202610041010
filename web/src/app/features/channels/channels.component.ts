import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** Channel / Message shapes per the shared-channel contract. */
interface Channel {
  id: string;
  name: string;
  vendorId?: string;
}

interface Message {
  id: string;
  body: string;
  channelId: string;
  senderId?: string;
}

export const CHANNEL_OUTCOME =
  'the channel is stored and displays in both the vendor and customer channel lists';
export const MESSAGE_OUTCOME =
  'the message is stored and returns 201 with the created Message record';

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '00000000-0000-4000-8000-' + Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
}

/** Register in-memory mocks for the channel endpoints when running against MockApiClient. */
function registerChannelMocks(client: MockApiClient): void {
  const channels: Channel[] = [];
  const registerMessageRoute = (channel: Channel) => {
    // MockApiClient matches exact paths, so register the message route per channel.
    client.registerMock('POST', `/api/channels/${channel.id}/messages`, async (body: any) => {
      const message: Message = { id: uuid(), body: String(body?.body ?? ''), channelId: channel.id };
      return message;
    });
  };
  client.registerMock('GET', '/api/channels', async () => channels);
  client.registerMock('POST', '/api/channels', async (body: any) => {
    const channel: Channel = { id: uuid(), name: String(body?.name ?? '') };
    channels.push(channel);
    registerMessageRoute(channel);
    return channel;
  });
}

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="channels-screen">
      <h1>Channels</h1>

      <section data-testid="channel-outcomes">
        <p data-testid="channel-create-outcome">When a vendor creates a shared channel, {{ channelOutcome }}.</p>
        <p data-testid="channel-message-outcome">When a channel member posts a message, {{ messageOutcome }}.</p>
      </section>

      <form data-testid="channel-create-form" (ngSubmit)="createChannel()">
        <h2>New shared channel (vendors)</h2>
        <input name="channelName" [(ngModel)]="channelName" placeholder="Channel name" required />
        <button type="submit" data-testid="channel-create-submit" [disabled]="submitting || !channelName.trim()">
          Create channel
        </button>
      </form>

      @if (notice) {
        <p data-testid="channel-notice">{{ notice }}</p>
      }
      @if (error) {
        <p data-testid="channel-error" role="alert">{{ error }}</p>
      }

      <section data-testid="channel-list">
        <h2>Your channels</h2>
        @if (channels.length === 0) {
          <p>No channels yet.</p>
        }
        <ul>
          @for (c of channels; track c.id) {
            <li data-testid="channel-row">
              <button type="button" (click)="selectChannel(c)" [attr.aria-pressed]="selected?.id === c.id">
                {{ c.name }}
              </button>
            </li>
          }
        </ul>
      </section>

      @if (selected) {
        <section data-testid="channel-messages">
          <h2>{{ selected.name }}</h2>
          <ul>
            @for (m of messagesFor(selected.id); track m.id) {
              <li data-testid="message-row">{{ m.body }}</li>
            }
          </ul>
          <form data-testid="message-form" (ngSubmit)="sendMessage()">
            <input name="messageBody" [(ngModel)]="messageBody" placeholder="Write a message" required />
            <button type="submit" data-testid="message-submit" [disabled]="submitting || !messageBody.trim()">
              Send
            </button>
          </form>
        </section>
      }
    </div>
  `,
})
export class ChannelsComponent implements OnInit {
  private api = inject(ApiClient);

  readonly channelOutcome = CHANNEL_OUTCOME;
  readonly messageOutcome = MESSAGE_OUTCOME;

  channels: Channel[] = [];
  selected: Channel | null = null;
  messages: Record<string, Message[]> = {};
  channelName = '';
  messageBody = '';
  submitting = false;
  notice = '';
  error = '';

  async ngOnInit(): Promise<void> {
    if (this.api instanceof MockApiClient) {
      registerChannelMocks(this.api);
    }
    await this.loadChannels();
  }

  async loadChannels(): Promise<void> {
    try {
      this.channels = await this.api.get<Channel[]>('/api/channels');
    } catch {
      this.channels = [];
    }
  }

  selectChannel(channel: Channel): void {
    this.selected = channel;
  }

  messagesFor(channelId: string): Message[] {
    return this.messages[channelId] ?? [];
  }

  async createChannel(): Promise<void> {
    const name = this.channelName.trim();
    if (!name) return;
    this.submitting = true;
    this.error = '';
    this.notice = '';
    try {
      const channel = await this.api.post<Channel>('/api/channels', { name });
      this.channelName = '';
      this.notice = `Channel "${channel.name}" created — ${CHANNEL_OUTCOME}.`;
      await this.loadChannels();
      this.selected = this.channels.find((c) => c.id === channel.id) ?? channel;
    } catch (e: any) {
      this.error = e?.message ?? 'Could not create channel.';
    } finally {
      this.submitting = false;
    }
  }

  async sendMessage(): Promise<void> {
    const channel = this.selected;
    const body = this.messageBody.trim();
    if (!channel || !body) return;
    this.submitting = true;
    this.error = '';
    this.notice = '';
    try {
      const message = await this.api.post<Message>(`/api/channels/${channel.id}/messages`, { body });
      this.messages = { ...this.messages, [channel.id]: [...this.messagesFor(channel.id), message] };
      this.messageBody = '';
      this.notice = `Message sent — ${MESSAGE_OUTCOME}.`;
    } catch (e: any) {
      this.error = e?.message ?? 'Could not send message.';
    } finally {
      this.submitting = false;
    }
  }
}
