import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** Order / OrderItem shapes per the order-management contract. */
interface OrderItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  status: string;
  customerId?: string;
  vendorId?: string;
  estimatedDelivery?: string;
  items?: OrderItemInput[];
}

interface VendorOption {
  id: string;
  companyName: string;
}

export const CREATE_OUTCOME =
  'the order is stored with status "pending" and returns 201 with the created Order record';
export const CONFIRM_OUTCOME =
  'the order is updated to status "confirmed" and displays to the customer as confirmed';

const MOCK_VENDORS: VendorOption[] = [
  { id: '00000000-0000-4000-8000-000000000001', companyName: 'Acme Supplies' },
];

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '00000000-0000-4000-8000-' + Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
}

/** Register in-memory mocks for the order endpoints when running against MockApiClient. */
function registerOrderMocks(client: MockApiClient): void {
  const orders: Order[] = [];
  client.registerMock('GET', '/api/vendors', async () => MOCK_VENDORS);
  client.registerMock('GET', '/api/orders', async () => orders);
  client.registerMock('POST', '/api/orders', async (body: any) => {
    const order: Order = {
      id: uuid(),
      status: 'pending',
      customerId: '00000000-0000-4000-8000-000000000002',
      vendorId: body?.vendorId,
      items: body?.items ?? [],
    };
    orders.push(order);
    // MockApiClient matches exact paths, so register the confirm route per order.
    client.registerMock('PATCH', `/api/orders/${order.id}/confirm`, async (patch: any) => {
      order.status = 'confirmed';
      order.estimatedDelivery = patch?.estimatedDelivery;
      return { id: order.id, status: order.status };
    });
    return order;
  });
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="orders-screen">
      <h1>Orders</h1>

      <section data-testid="order-outcomes">
        <p data-testid="order-create-outcome">When you submit a purchase order, {{ createOutcome }}.</p>
        <p data-testid="order-confirm-outcome">When the vendor confirms with an estimated delivery date, {{ confirmOutcome }}.</p>
      </section>

      <form data-testid="order-create-form" (ngSubmit)="submitOrder()">
        <h2>New purchase order</h2>
        <label>
          Vendor
          <select name="vendorId" [(ngModel)]="vendorId" required>
            <option value="" disabled>Select a vendor</option>
            @for (v of vendors; track v.id) {
              <option [value]="v.id">{{ v.companyName }}</option>
            }
          </select>
        </label>

        @for (item of items; track $index) {
          <div data-testid="order-item-row">
            <input [name]="'description' + $index" [(ngModel)]="item.description" placeholder="Description" required />
            <input [name]="'quantity' + $index" type="number" min="1" [(ngModel)]="item.quantity" required />
            <input [name]="'unitPrice' + $index" type="number" min="0" step="0.01" [(ngModel)]="item.unitPrice" required />
            <button type="button" (click)="removeItem($index)" [disabled]="items.length === 1">Remove</button>
          </div>
        }
        <button type="button" data-testid="order-add-item" (click)="addItem()">Add item</button>
        <button type="submit" data-testid="order-submit" [disabled]="submitting">Submit order</button>
      </form>

      @if (message) {
        <p data-testid="order-message">{{ message }}</p>
      }
      @if (error) {
        <p data-testid="order-error" role="alert">{{ error }}</p>
      }

      <section data-testid="order-list">
        <h2>Orders</h2>
        @if (orders.length === 0) {
          <p>No orders yet.</p>
        }
        <ul>
          @for (o of orders; track o.id) {
            <li data-testid="order-row">
              <span>Order {{ o.id }}</span> —
              <span data-testid="order-status">{{ o.status }}</span>
              @if (o.estimatedDelivery) {
                <span> (estimated delivery {{ o.estimatedDelivery }})</span>
              }
              @if (o.status === 'pending') {
                <span data-testid="order-confirm">
                  <input type="date" [name]="'estimatedDelivery-' + o.id" [(ngModel)]="deliveryDates[o.id]" />
                  <button type="button" (click)="confirmOrder(o)" [disabled]="!deliveryDates[o.id]">Confirm</button>
                </span>
              }
            </li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class OrdersComponent implements OnInit {
  private api = inject(ApiClient);

  readonly createOutcome = CREATE_OUTCOME;
  readonly confirmOutcome = CONFIRM_OUTCOME;

  vendors: VendorOption[] = [];
  orders: Order[] = [];
  vendorId = '';
  items: OrderItemInput[] = [{ description: '', quantity: 1, unitPrice: 0 }];
  deliveryDates: Record<string, string> = {};
  submitting = false;
  message = '';
  error = '';

  async ngOnInit(): Promise<void> {
    if (this.api instanceof MockApiClient) {
      registerOrderMocks(this.api);
    }
    await Promise.all([this.loadVendors(), this.loadOrders()]);
  }

  async loadVendors(): Promise<void> {
    try {
      this.vendors = await this.api.get<VendorOption[]>('/api/vendors');
    } catch {
      this.vendors = [];
    }
  }

  async loadOrders(): Promise<void> {
    try {
      this.orders = await this.api.get<Order[]>('/api/orders');
    } catch (e) {
      this.orders = [];
    }
  }

  addItem(): void {
    this.items = [...this.items, { description: '', quantity: 1, unitPrice: 0 }];
  }

  removeItem(index: number): void {
    this.items = this.items.filter((_, i) => i !== index);
  }

  async submitOrder(): Promise<void> {
    this.error = '';
    this.message = '';
    if (!this.vendorId) {
      this.error = 'Select a vendor.';
      return;
    }
    this.submitting = true;
    try {
      const created = await this.api.post<Order>('/api/orders', {
        vendorId: this.vendorId,
        items: this.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
      });
      this.orders = [...this.orders.filter((o) => o.id !== created.id), created];
      this.message = `Order ${created.id} created with status "${created.status}".`;
      this.items = [{ description: '', quantity: 1, unitPrice: 0 }];
    } catch (e: any) {
      this.error = e?.message ?? 'Could not create order.';
    } finally {
      this.submitting = false;
    }
  }

  async confirmOrder(order: Order): Promise<void> {
    this.error = '';
    this.message = '';
    const estimatedDelivery = this.deliveryDates[order.id];
    if (!estimatedDelivery) return;
    try {
      const updated = await this.api.patch<Order>(`/api/orders/${order.id}/confirm`, { estimatedDelivery });
      this.orders = this.orders.map((o) =>
        o.id === order.id ? { ...o, ...updated, status: updated.status ?? 'confirmed', estimatedDelivery } : o,
      );
      this.message = `Order ${order.id} confirmed.`;
    } catch (e: any) {
      this.error = e?.message ?? 'Could not confirm order.';
    }
  }
}
