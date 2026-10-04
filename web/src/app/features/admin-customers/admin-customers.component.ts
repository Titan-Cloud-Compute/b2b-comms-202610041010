import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, ApiError, ConflictError, MockApiClient } from '../../shared/api/api-client';

// Types mirror the customer-invite contract (no @contracts/customer-invite module exists yet).
export interface InviteCustomerRequest { email: string; }
export interface InviteCustomerResponse { customerId: string; email: string; invitationSent: boolean; }
export interface CustomerListItem { id: string; email: string; }

const INVITE_PATH = '/api/admin/customers/invite';
const LIST_PATH = '/api/admin/customers';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="admin-customers-screen">
      <h1>Customer Management</h1>

      <section>
        <h2>Invite a customer</h2>
        <form data-testid="customer-invite-form" (ngSubmit)="invite()">
          <label for="customer-invite-email">Customer email</label>
          <input id="customer-invite-email" type="email" name="email" required
                 [(ngModel)]="email" placeholder="buyer@corp.example.com" />
          <button type="submit" [disabled]="submitting || !email">Send invitation</button>
        </form>
        @if (successMessage) {
          <p data-testid="customer-invite-success" role="status">{{ successMessage }}</p>
        }
        @if (errorMessage) {
          <p data-testid="customer-invite-error" role="alert">{{ errorMessage }}</p>
        }
      </section>

      <section data-testid="customer-invite-outcomes">
        <h2>What happens when you invite</h2>
        <ul>
          <li>New email: a Customer record is created and returns 201 with invitationSent true.</li>
          <li>Existing email: the response returns 409 error indicating the customer already exists.</li>
        </ul>
      </section>

      <section>
        <h2>Customers</h2>
        @if (customers.length === 0) {
          <p data-testid="customer-list-empty">No customers yet.</p>
        } @else {
          <ul data-testid="customer-list">
            @for (c of customers; track c.id) {
              <li>{{ c.email }}</li>
            }
          </ul>
        }
      </section>
    </div>
  `,
})
export class AdminCustomersComponent implements OnInit {
  private readonly api = inject(ApiClient);

  email = '';
  submitting = false;
  successMessage = '';
  errorMessage = '';
  customers: CustomerListItem[] = [];

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerCustomerInviteMocks(this.api);
    }
  }

  ngOnInit(): void {
    void this.loadCustomers();
  }

  async loadCustomers(): Promise<void> {
    try {
      const list = await this.api.get<CustomerListItem[]>(LIST_PATH);
      this.customers = Array.isArray(list) ? list : [];
    } catch {
      this.customers = [];
    }
  }

  async invite(): Promise<void> {
    const email = this.email.trim();
    if (!email) return;
    this.submitting = true;
    this.successMessage = '';
    this.errorMessage = '';
    try {
      const body: InviteCustomerRequest = { email };
      const res = await this.api.post<InviteCustomerResponse>(INVITE_PATH, body);
      if (res && res.invitationSent) {
        this.successMessage = `Invitation sent to ${res.email ?? email}.`;
      } else {
        this.successMessage = `Customer ${email} created.`;
      }
      this.email = '';
      await this.loadCustomers();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        this.errorMessage = `A customer with email ${email} already exists.`;
      } else {
        this.errorMessage = (err as Error)?.message || 'Failed to send invitation.';
      }
    } finally {
      this.submitting = false;
    }
  }
}

const mockCustomers: CustomerListItem[] = [];
let mocksRegistered = false;

function registerCustomerInviteMocks(client: MockApiClient): void {
  if (mocksRegistered) return;
  mocksRegistered = true;
  client.registerMock<CustomerListItem[]>('GET', LIST_PATH, async () => [...mockCustomers]);
  client.registerMock<InviteCustomerResponse>('POST', INVITE_PATH, async (body) => {
    const email = String((body as InviteCustomerRequest)?.email ?? '').trim().toLowerCase();
    if (mockCustomers.some((c) => c.email === email)) {
      throw new ConflictError('Customer already exists');
    }
    const id = `mock-${mockCustomers.length + 1}`;
    mockCustomers.push({ id, email });
    return { customerId: id, email, invitationSent: true };
  });
}
