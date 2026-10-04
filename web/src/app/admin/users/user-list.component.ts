import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminUser } from './user.types';

/**
 * Presentational, sortable + filterable data-table of users across all firms.
 * Mirrors OrgListComponent: @Input data/state, @Output events back to the
 * coordinator, English labels. Purely presentational — no
 * data loading here.
 */
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="card">
      <div class="card-header">
        <h2>{{ 'Users' }}</h2>
        <div class="filter-group">
          <input
            type="search"
            class="filter-search"
            [ngModel]="search"
            (ngModelChange)="searchChange.emit($event)"
            [placeholder]="'Search name or email'"
            [attr.aria-label]="'Search users'" />
          <select [ngModel]="roleFilter" (ngModelChange)="roleFilterChange.emit($event)" class="filter-select">
            <option value="all">{{ 'All Roles' }}</option>
            <option value="ADMIN">{{ getLocalizedRole('ADMIN') }}</option>
            <option value="USER">{{ getLocalizedRole('USER') }}</option>
          </select>
          <button type="button" class="new-user-btn" (click)="createClicked.emit()">
            + {{ 'New User' }}
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table sortable-table">
          <thead>
            <tr>
              <th class="sortable-header" (click)="sortChanged.emit({field: 'name'})" [class.sorted]="sortField === 'name'">
                {{ 'Name' }}
                <span class="sort-indicator">{{ getSortIndicator('name') }}</span>
              </th>
              <th class="sortable-header" (click)="sortChanged.emit({field: 'email'})" [class.sorted]="sortField === 'email'">
                {{ 'Email' }}
                <span class="sort-indicator">{{ getSortIndicator('email') }}</span>
              </th>
              <th class="sortable-header" (click)="sortChanged.emit({field: 'role'})" [class.sorted]="sortField === 'role'">
                {{ 'Role' }}
                <span class="sort-indicator">{{ getSortIndicator('role') }}</span>
              </th>
              <th class="sortable-header" (click)="sortChanged.emit({field: 'firmName'})" [class.sorted]="sortField === 'firmName'">
                {{ 'Organization' }}
                <span class="sort-indicator">{{ getSortIndicator('firmName') }}</span>
              </th>
              <th class="sortable-header" (click)="sortChanged.emit({field: 'createdAt'})" [class.sorted]="sortField === 'createdAt'">
                {{ 'Created' }}
                <span class="sort-indicator">{{ getSortIndicator('createdAt') }}</span>
              </th>
              <th class="sortable-header" (click)="sortChanged.emit({field: 'lastConversationAt'})" [class.sorted]="sortField === 'lastConversationAt'">
                {{ 'Last Conversation' }}
                <span class="sort-indicator">{{ getSortIndicator('lastConversationAt') }}</span>
              </th>
              <th class="actions-header">{{ 'Actions' }}</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users; track user.id) {
              <tr class="clickable-row" (click)="userSelected.emit(user)">
                <td class="name-cell">{{ user.name || '—' }}</td>
                <td>{{ user.email }}</td>
                <td><span class="role-badge" [class]="user.role">{{ getLocalizedRole(user.role) }}</span></td>
                <td>{{ user.firmName || (isAdminRole(user.role) ? ('— (admin)') : '—') }}</td>
                <td>{{ user.createdAt }}</td>
                <td>{{ user.lastConversationAt || '—' }}</td>
                <td class="actions-cell">
                  <!-- Opens the deep-linkable confirm modal (?delete=<id>); the
                       coordinator owns the navigation and the API call. -->
                  <button type="button" class="delete-btn"
                          [attr.aria-label]="('Delete user ') + user.email"
                          (click)="$event.stopPropagation(); deleteRequested.emit(user)">
                    {{ 'Delete' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty-cell">{{ 'No users found' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="mobile-cards">
        @for (user of users; track user.id) {
          <div class="user-card" (click)="userSelected.emit(user)">
            <div class="card-top">
              <div class="card-names">
                <span class="name-en">{{ user.name || user.email }}</span>
                <span class="name-sub">{{ user.email }}</span>
              </div>
              <span class="role-badge" [class]="user.role">{{ getLocalizedRole(user.role) }}</span>
            </div>
            <div class="card-meta">
              <span>{{ user.firmName || (isAdminRole(user.role) ? ('admin') : '—') }}</span>
              <span>{{ 'since' }} {{ user.createdAt }}</span>
              <span>{{ ('Conv: ') + (user.lastConversationAt || '—') }}</span>
            </div>
            <div class="card-actions">
              <button type="button" class="delete-btn"
                      [attr.aria-label]="('Delete user ') + user.email"
                      (click)="$event.stopPropagation(); deleteRequested.emit(user)">
                {{ 'Delete' }}
              </button>
            </div>
          </div>
        } @empty {
          <div class="empty-cell">{{ 'No users found' }}</div>
        }
      </div>
    </section>
  `,
  styles: [`
    .card { background: var(--color-white); border-radius: var(--radius-lg); padding: var(--space-6); box-shadow: var(--shadow-card); margin-bottom: var(--space-7); }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); flex-wrap: wrap; gap: var(--space-4); }
    h2 { font-size: var(--font-size-lg); color: var(--color-text-primary); margin: 0; display: flex; align-items: center; gap: var(--space-2); }
    .filter-group { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }
    .filter-search { padding: var(--space-2) var(--space-4); font-size: var(--font-size-input); border: var(--border-width) solid var(--color-gray-300); border-radius: var(--radius-btn); min-height: var(--touch-target); background: var(--color-white); min-width: var(--filter-search-min-width); }
    .filter-select { padding: var(--space-2) var(--space-4); font-size: var(--font-size-input); border: var(--border-width) solid var(--color-gray-300); border-radius: var(--radius-btn); min-height: var(--touch-target); background: var(--color-white); }
    .new-user-btn { padding: var(--space-2) var(--space-4); font-size: var(--font-size-sm); font-weight: 600; color: var(--color-on-primary); background: var(--color-info); border: none; border-radius: var(--radius-btn); cursor: pointer; min-height: var(--touch-target); white-space: nowrap; }
    .new-user-btn:hover { background: var(--color-info-hover); }
    .table-container { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: var(--space-3-5) var(--space-4); text-align: left; border-bottom: var(--border-width) solid var(--color-border); }
    .data-table th { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); background: var(--color-neutral-50); }
    .sortable-table th.sortable-header { cursor: pointer; user-select: none; }
    .sortable-table th.sortable-header:hover { background: var(--color-neutral-200); }
    .sortable-table th.sortable-header.sorted { background: var(--color-primary-light); color: var(--color-primary); }
    .sort-indicator { margin-left: var(--space-1-5); font-size: var(--font-size-xs); opacity: 0.5; }
    .name-cell { font-weight: 500; color: var(--color-text-primary); }
    .clickable-row { cursor: pointer; transition: background 0.15s; }
    .clickable-row:hover { background: var(--color-primary-light); }
    .empty-cell { text-align: center; color: var(--color-text-secondary); padding: var(--space-6); }
    .role-badge { display: inline-flex; padding: var(--space-1) var(--space-2-5); border-radius: var(--radius-pill); font-size: var(--font-size-xs); font-weight: 600; white-space: nowrap; }
    .role-badge.ADMIN { background: var(--color-highlight-100); color: var(--color-highlight-700); }
    .role-badge.USER { background: var(--color-neutral-100); color: var(--color-text-secondary); }
    .mobile-cards { display: none; }
    .user-card { background: var(--color-neutral-50); border-radius: var(--radius-card); padding: var(--space-4); margin-bottom: var(--space-3); cursor: pointer; transition: all 0.15s; }
    .user-card:hover { background: var(--color-primary-light); }
    .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3); gap: var(--space-3); }
    .card-names { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .name-en { font-weight: 600; color: var(--color-text-primary); }
    .name-sub { font-size: var(--font-size-sm); color: var(--color-text-secondary); }
    .card-meta { display: flex; flex-wrap: wrap; gap: var(--space-3); font-size: var(--font-size-xs); color: var(--color-text-secondary); }
    .card-actions { display: flex; justify-content: flex-end; margin-top: var(--space-3); }
    .actions-header { white-space: nowrap; }
    .actions-cell { text-align: right; white-space: nowrap; }
    .delete-btn { padding: var(--space-1-5) var(--space-3-5); font-size: var(--font-size-sm); font-weight: 600; color: var(--color-error-700); background: var(--color-error-50); border: var(--border-width) solid var(--color-error-200); border-radius: var(--radius-btn); cursor: pointer; min-height: var(--touch-target-sm); }
    .delete-btn:hover { background: var(--color-error-100); }
    @media (max-width: 768px) { .table-container { display: none; } .mobile-cards { display: block; } }
  `]
})
export class UserListComponent {
  @Input() users: AdminUser[] = [];
  @Input() roleFilter = 'all';
  @Input() search = '';
  @Input() sortField = '';
  @Input() sortDirection: 'asc' | 'desc' = 'asc';

  @Output() userSelected = new EventEmitter<AdminUser>();
  @Output() roleFilterChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() sortChanged = new EventEmitter<{ field: string }>();
  @Output() createClicked = new EventEmitter<void>();
  /** Request the hard-delete confirm modal (`?delete=<id>`) for a row. */
  @Output() deleteRequested = new EventEmitter<AdminUser>();

  isAdminRole(role: string): boolean {
    return role === 'ADMIN';
  }

  getSortIndicator(field: string): string {
    if (this.sortField !== field) return '↕';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  getLocalizedRole(role: string): string {
    const labels: Record<string, string> = {
      'ADMIN': 'Admin',
      'USER': 'User',
    };
    return labels[role] || role;
  }
}
