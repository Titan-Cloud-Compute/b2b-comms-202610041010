import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** AuditEntry as returned by GET /api/admin/audit-log. */
export interface AuditEntry {
  id: string;
  action: string;
  userId: string;
  createdAt: string;
}

/** Response of POST /api/admin/audit-log. */
export interface CreatedAuditEntry {
  id: string;
  action: string;
  createdAt: string;
}

const AUDIT_LOG_PATH = '/api/admin/audit-log';

/** Register in-memory mocks for this feature's endpoints when running against MockApiClient. */
function registerAuditLogMocks(api: ApiClient): void {
  if (!(api instanceof MockApiClient)) return;
  const store: AuditEntry[] = [];
  api.registerMock('GET', AUDIT_LOG_PATH, async () => [...store]);
  api.registerMock('POST', AUDIT_LOG_PATH, async (body) => {
    const b = (body ?? {}) as { action?: string; userId?: string };
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      action: b.action ?? '',
      userId: b.userId ?? '',
      createdAt: new Date().toISOString(),
    };
    store.push(entry);
    return { id: entry.id, action: entry.action, createdAt: entry.createdAt };
  });
}

function sortChronologically(entries: AuditEntry[]): AuditEntry[] {
  return [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

@Component({
  selector: 'app-admin-audit-log',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="page" data-testid="admin-audit-log-screen">
      <h1>Audit Log</h1>
      <p data-testid="audit-log-list-outcome">a list of AuditEntry records is displayed in chronological order returns 200</p>

      @if (loading()) {
        <p data-testid="audit-log-loading">Loading audit entries…</p>
      } @else if (error()) {
        <p data-testid="audit-log-error" role="alert">{{ error() }}</p>
      } @else if (entries().length === 0) {
        <p data-testid="audit-log-empty">No audit entries recorded yet.</p>
      } @else {
        <table data-testid="audit-log-list">
          <thead>
            <tr><th>Action</th><th>User</th><th>Created</th></tr>
          </thead>
          <tbody>
            @for (entry of entries(); track entry.id) {
              <tr data-testid="audit-log-row">
                <td>{{ entry.action }}</td>
                <td>{{ entry.userId }}</td>
                <td>{{ entry.createdAt | date: 'medium' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }

      <h2>Record entry</h2>
      <p data-testid="audit-log-create-outcome">the AuditEntry is stored and returns 201 with the created record</p>
      <form data-testid="audit-log-form" (ngSubmit)="record()">
        <label>Action <input name="action" [(ngModel)]="action" required /></label>
        <label>User id <input name="userId" [(ngModel)]="userId" required /></label>
        <button type="submit" [disabled]="saving() || !action || !userId">Record</button>
      </form>
      @if (created(); as c) {
        <p data-testid="audit-log-created">Recorded {{ c.action }} ({{ c.id }}) at {{ c.createdAt | date: 'medium' }}</p>
      }
      @if (saveError()) {
        <p data-testid="audit-log-save-error" role="alert">{{ saveError() }}</p>
      }
    </div>
  `,
})
export class AdminAuditLogComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly entries = signal<AuditEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly created = signal<CreatedAuditEntry | null>(null);

  action = '';
  userId = '';

  constructor() {
    registerAuditLogMocks(this.api);
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.api.get<AuditEntry[]>(AUDIT_LOG_PATH);
      this.entries.set(sortChronologically(Array.isArray(res) ? res : []));
    } catch {
      this.error.set('Could not load the audit log.');
    } finally {
      this.loading.set(false);
    }
  }

  async record(): Promise<void> {
    if (!this.action || !this.userId) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const res = await this.api.post<CreatedAuditEntry>(AUDIT_LOG_PATH, {
        action: this.action,
        userId: this.userId,
      });
      this.created.set(res);
      this.action = '';
      this.userId = '';
      await this.load();
    } catch {
      this.saveError.set('Could not record the audit entry.');
    } finally {
      this.saving.set(false);
    }
  }
}
