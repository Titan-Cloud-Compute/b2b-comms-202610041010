import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** Contract: POST /api/invoices */
export interface CreateInvoiceRequest { orderId: string; amount: number; }
export interface InvoiceResponse { id: string; orderId: string; amount: number; }
/** Contract: GET /api/invoices/:id/download */
export interface InvoiceDownloadResponse { id: string; downloadUrl: string; }

interface OrderOption { id: string; status: string; }

function registerInvoiceMocks(client: MockApiClient): void {
  // GET /api/orders belongs to order-management; only our endpoints are mocked.
  client.registerMock<InvoiceResponse>('POST', '/api/invoices', async (body) => {
    const req = body as CreateInvoiceRequest;
    return { id: crypto.randomUUID(), orderId: req.orderId, amount: Number(req.amount) };
  });
  // Download paths are dynamic; MockApiClient keys by exact path, so the
  // component registers each id's download handler after creation.
  (client as any).__invoiceMocks = true;
}

@Component({
  selector: 'app-invoice-generation',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page" data-testid="invoices-screen">
      <h1>Invoices</h1>

      <form data-testid="invoice-generate-form" (ngSubmit)="generate()">
        <h2>Generate invoice</h2>
        <p data-testid="invoice-generate-caption">the invoice is created and returns 201 with the invoice id available for download</p>
        <label>
          Confirmed order
          <input name="orderId" data-testid="invoice-order-id" list="invoice-orders" [(ngModel)]="orderId" required />
          <datalist id="invoice-orders">
            @for (o of orders; track o.id) { <option [value]="o.id">{{ o.status }}</option> }
          </datalist>
        </label>
        <label>
          Amount
          <input name="amount" type="number" step="0.01" min="0" data-testid="invoice-amount" [(ngModel)]="amount" required />
        </label>
        <button type="submit" data-testid="invoice-generate-submit" [disabled]="busy || !orderId || amount === null">Generate</button>
        @if (created) {
          <p data-testid="invoice-created">
            Invoice <code data-testid="invoice-created-id">{{ created.id }}</code> created for order {{ created.orderId }} ({{ created.amount }})
            <button type="button" data-testid="invoice-created-download" (click)="downloadId = created.id; download()">Download</button>
          </p>
        }
      </form>

      <form data-testid="invoice-download-form" (ngSubmit)="download()">
        <h2>Download invoice</h2>
        <p data-testid="invoice-download-caption">the response returns 200 with a downloadUrl pointing to the stored invoice</p>
        <label>
          Invoice id
          <input name="invoiceId" data-testid="invoice-download-id" [(ngModel)]="downloadId" required />
        </label>
        <button type="submit" data-testid="invoice-download-submit" [disabled]="busy || !downloadId">Get download link</button>
        @if (downloaded) {
          <p data-testid="invoice-download-result">
            <a [href]="downloaded.downloadUrl" target="_blank" rel="noopener" data-testid="invoice-download-link">{{ downloaded.downloadUrl }}</a>
          </p>
        }
      </form>

      @if (error) { <p role="alert" data-testid="invoice-error">{{ error }}</p> }
    </section>
  `,
})
export class InvoiceGenerationComponent implements OnInit {
  private readonly api = inject(ApiClient);

  orders: OrderOption[] = [];
  orderId = '';
  amount: number | null = null;
  downloadId = '';
  created: InvoiceResponse | null = null;
  downloaded: InvoiceDownloadResponse | null = null;
  error = '';
  busy = false;

  constructor() {
    if (this.api instanceof MockApiClient && !(this.api as any).__invoiceMocks) {
      registerInvoiceMocks(this.api);
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const list = await this.api.get<OrderOption[]>('/api/orders');
      this.orders = Array.isArray(list)
        ? list.filter(o => String(o?.status ?? '').toLowerCase() === 'confirmed')
        : [];
    } catch {
      this.orders = [];
    }
  }

  async generate(): Promise<void> {
    if (!this.orderId || this.amount === null) return;
    this.busy = true;
    this.error = '';
    try {
      const body: CreateInvoiceRequest = { orderId: this.orderId, amount: Number(this.amount) };
      this.created = await this.api.post<InvoiceResponse>('/api/invoices', body);
      if (this.created?.id) {
        this.downloadId = this.created.id;
        this.registerDownloadMock(this.created.id);
      }
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to generate invoice';
    } finally {
      this.busy = false;
    }
  }

  async download(): Promise<void> {
    if (!this.downloadId) return;
    this.busy = true;
    this.error = '';
    try {
      const id = encodeURIComponent(this.downloadId);
      this.downloaded = await this.api.get<InvoiceDownloadResponse>(`/api/invoices/${id}/download`);
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to fetch download link';
    } finally {
      this.busy = false;
    }
  }

  private registerDownloadMock(id: string): void {
    if (!(this.api instanceof MockApiClient)) return;
    this.api.registerMock<InvoiceDownloadResponse>(
      'GET',
      `/api/invoices/${encodeURIComponent(id)}/download`,
      async () => ({ id, downloadUrl: `https://storage.mock/invoices/${id}.pdf` }),
    );
  }
}
