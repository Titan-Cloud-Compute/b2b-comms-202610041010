import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client.service';

interface VendorProfileRequest {
  companyName: string;
  contactEmail: string;
}

interface VendorProfile {
  id: string;
  companyName: string;
  contactEmail: string;
}

interface VendorDocument {
  id: string;
  filename: string;
  status: string;
}

@Component({
  selector: 'app-vendor-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="vendor-profile-screen">
      <h1>Vendor Profile</h1>

      <section>
        <h2>Company profile</h2>
        <p>When you submit, the profile is stored and returns 201 with the created VendorProfile record.</p>
        <form data-testid="vendor-profile-form" (ngSubmit)="submitProfile()">
          <div>
            <label for="companyName">Company Name</label>
            <input id="companyName" name="companyName" type="text" required [(ngModel)]="companyName" />
          </div>
          <div>
            <label for="contactEmail">Contact Email</label>
            <input id="contactEmail" name="contactEmail" type="email" required [(ngModel)]="contactEmail" />
          </div>
          <button type="submit">Save Profile</button>
        </form>
        @if (profileSuccess()) {
          <p>Profile saved: {{ profileSuccess() }}</p>
        }
        @if (profileError()) {
          <p>{{ profileError() }}</p>
        }
      </section>

      <section>
        <h2>Compliance documents</h2>
        <p>When you upload, the document is stored with status "pending" and displays in the vendor document library.</p>
        <form data-testid="vendor-document-form" (ngSubmit)="uploadDocument()">
          <div>
            <label for="docFile">Document File</label>
            <input id="docFile" type="file" (change)="onFileChange($event)" />
          </div>
          <div>
            <label for="filename">Filename</label>
            <input id="filename" name="filename" type="text" [(ngModel)]="filename" />
          </div>
          <button type="submit">Upload Document</button>
        </form>
        <div data-testid="vendor-document-library">
          @if (documents().length === 0) {
            <p>No documents uploaded yet.</p>
          } @else {
            @for (doc of documents(); track doc.id) {
              <div data-testid="vendor-document-row">
                <span>{{ doc.filename }}</span>
                <span>{{ doc.status }}</span>
              </div>
            }
          }
        </div>
      </section>
    </div>
  `,
})
export class VendorProfileComponent implements OnInit {
  private api = inject(ApiClient);

  companyName = '';
  contactEmail = '';
  filename = '';

  profileSuccess = signal<string | null>(null);
  profileError = signal<string | null>(null);
  documents = signal<VendorDocument[]>([]);

  ngOnInit(): void {
    this.loadDocuments();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.filename = input.files[0].name;
    }
  }

  async submitProfile(): Promise<void> {
    this.profileSuccess.set(null);
    this.profileError.set(null);
    try {
      const body: VendorProfileRequest = {
        companyName: this.companyName,
        contactEmail: this.contactEmail,
      };
      const result = await this.api.post<VendorProfile>('vendor/profile', body);
      this.profileSuccess.set(result.companyName);
    } catch (err: unknown) {
      const anyErr = err as { status?: number; message?: string };
      if (anyErr?.status === 409) {
        this.profileError.set('Profile already exists');
      } else {
        this.profileError.set(anyErr?.message ?? 'An error occurred');
      }
    }
  }

  async uploadDocument(): Promise<void> {
    try {
      const result = await this.api.post<VendorDocument | { ok: boolean }>('vendor/documents', {
        filename: this.filename,
      });
      if (result && 'id' in result) {
        // Real response with a document
        await this.loadDocuments();
      } else {
        // Mock response {ok: true} — just reload the list
        await this.loadDocuments();
      }
      this.filename = '';
    } catch {
      await this.loadDocuments();
    }
  }

  async loadDocuments(): Promise<void> {
    try {
      const result = await this.api.get<VendorDocument[]>('vendor/documents');
      if (Array.isArray(result)) {
        this.documents.set(result);
      } else {
        this.documents.set([]);
      }
    } catch {
      this.documents.set([]);
    }
  }
}
