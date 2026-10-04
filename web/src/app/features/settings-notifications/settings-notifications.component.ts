import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiClient } from '../../shared/api/api-client.service';

/** Mirrors the GET/PUT /api/notifications/preferences response contract. */
interface NotificationPreferenceRecord {
  userId: string;
  orderAlerts: boolean;
  messageAlerts: boolean;
}

const PREFERENCES_PATH = 'notifications/preferences';

@Component({
  selector: 'app-settings-notifications',
  standalone: true,
  imports: [],
  template: `
    <div class="page" data-testid="settings-notifications-screen">
      <h1>Notification Settings</h1>

      <form (submit)="$event.preventDefault(); save()">
        <label>
          <input
            type="checkbox"
            data-testid="order-alerts-toggle"
            [checked]="orderAlerts()"
            (change)="orderAlerts.set($any($event.target).checked)"
          />
          Order alerts
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="message-alerts-toggle"
            [checked]="messageAlerts()"
            (change)="messageAlerts.set($any($event.target).checked)"
          />
          Message alerts
        </label>

        <ul data-testid="notification-preferences-help">
          <li [class.active]="orderAlerts() || messageAlerts()">
            Saving with any alert on: the preferences are updated and returns 200 with the stored NotificationPreference record.
          </li>
          <li [class.active]="!orderAlerts() && !messageAlerts()">
            Saving with every alert off: the preferences are updated with both alert fields stored as false.
          </li>
        </ul>

        <button type="submit" data-testid="save-notification-preferences" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </form>

      @if (status()) {
        <p role="status" data-testid="notification-preferences-status">{{ status() }}</p>
      }
      @if (error()) {
        <p role="alert" data-testid="notification-preferences-error">{{ error() }}</p>
      }
      @if (stored(); as rec) {
        <dl data-testid="notification-preferences-stored">
          <dt>Order alerts</dt><dd data-testid="stored-order-alerts">{{ rec.orderAlerts }}</dd>
          <dt>Message alerts</dt><dd data-testid="stored-message-alerts">{{ rec.messageAlerts }}</dd>
        </dl>
      }
    </div>
  `,
})
export class SettingsNotificationsComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly orderAlerts = signal(true);
  readonly messageAlerts = signal(true);
  readonly stored = signal<NotificationPreferenceRecord | null>(null);
  readonly saving = signal(false);
  readonly status = signal('');
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const rec = await this.api.get<unknown>(PREFERENCES_PATH);
      if (this.isRecord(rec)) {
        this.apply(rec);
      }
    } catch {
      // No stored preferences yet (or backend unavailable) — keep defaults.
    }
  }

  async save(): Promise<void> {
    const body = { orderAlerts: this.orderAlerts(), messageAlerts: this.messageAlerts() };
    this.saving.set(true);
    this.error.set('');
    this.status.set('');
    try {
      const rec = await this.api.put<unknown>(PREFERENCES_PATH, body);
      this.apply(this.isRecord(rec) ? rec : { userId: this.stored()?.userId ?? '', ...body });
      const saved = this.stored()!;
      this.status.set(
        !saved.orderAlerts && !saved.messageAlerts
          ? 'Preferences saved: both alert fields stored as false.'
          : 'Preferences saved.',
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not save preferences.');
    } finally {
      this.saving.set(false);
    }
  }

  private apply(rec: NotificationPreferenceRecord): void {
    this.stored.set(rec);
    this.orderAlerts.set(rec.orderAlerts);
    this.messageAlerts.set(rec.messageAlerts);
  }

  private isRecord(v: unknown): v is NotificationPreferenceRecord {
    return (
      !!v &&
      typeof v === 'object' &&
      typeof (v as NotificationPreferenceRecord).orderAlerts === 'boolean' &&
      typeof (v as NotificationPreferenceRecord).messageAlerts === 'boolean'
    );
  }
}
