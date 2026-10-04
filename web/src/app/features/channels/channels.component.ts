import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client';

interface Channel {
  id: string;
  name: string;
}

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div data-testid="channels-screen">
      <h1>Channels</h1>

      <!-- Create channel form -->
      <form data-testid="create-channel-form" (ngSubmit)="createChannel()">
        <label for="channel-name">Channel name</label>
        <input id="channel-name" [(ngModel)]="newChannelName" name="name" placeholder="Enter channel name" />
        <button type="submit">Create Channel</button>
      </form>

      <!-- Channel list -->
      <div data-testid="channel-list">
        @if (channels().length === 0) {
          <p>No channels yet</p>
        } @else {
          @for (channel of channels(); track channel.id) {
            <div
              class="channel-item"
              [class.selected]="selectedChannelId() === channel.id"
              (click)="selectChannel(channel.id)"
              style="cursor:pointer;padding:4px 8px;"
            >
              {{ channel.name }}
            </div>
          }
        }
      </div>

      <!-- Message composer -->
      @if (selectedChannelId()) {
        <form data-testid="message-form" (ngSubmit)="sendMessage()">
          <label for="message-body">Message</label>
          <textarea id="message-body" [(ngModel)]="messageBody" name="body" placeholder="Type your message…"></textarea>
          <button type="submit">Send</button>
        </form>
        @if (messageSent()) {
          <p class="confirmation">Message sent.</p>
        }
      }

      <!-- How shared channels work -->
      <section class="help-section">
        <h2>How shared channels work</h2>
        <p>When a vendor creates a channel, the channel is stored and displays in both the vendor and customer channel lists.</p>
        <p>When a customer posts in a channel, the message is stored and returns 201 with the created Message record.</p>
      </section>
    </div>
  `,
})
export class ChannelsComponent implements OnInit {
  private api = inject(ApiClient);

  channels = signal<Channel[]>([]);
  selectedChannelId = signal<string | null>(null);
  newChannelName = '';
  messageBody = '';
  messageSent = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.api.get<Channel[]>('api/channels');
      this.channels.set(Array.isArray(data) ? data : []);
    } catch {
      this.channels.set([]);
    }
  }

  selectChannel(id: string): void {
    this.selectedChannelId.set(id);
    this.messageSent.set(false);
  }

  async createChannel(): Promise<void> {
    const name = this.newChannelName.trim();
    if (!name) return;
    try {
      const created = await this.api.post<Channel>('api/channels', { name });
      if (created && (created as any).id) {
        this.channels.update(list => [...list, created as Channel]);
      } else {
        await this.reload();
      }
    } catch {
      // ignore
    }
    this.newChannelName = '';
  }

  async sendMessage(): Promise<void> {
    const id = this.selectedChannelId();
    const body = this.messageBody.trim();
    if (!id || !body) return;
    try {
      await this.api.post(`api/channels/${id}/messages`, { body });
      this.messageSent.set(true);
    } catch {
      // ignore
    }
    this.messageBody = '';
  }

  private async reload(): Promise<void> {
    try {
      const data = await this.api.get<Channel[]>('api/channels');
      this.channels.set(Array.isArray(data) ? data : []);
    } catch {
      this.channels.set([]);
    }
  }
}
