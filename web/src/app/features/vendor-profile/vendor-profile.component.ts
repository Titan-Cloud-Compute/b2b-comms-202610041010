import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client';

/** Mirrors the VendorProfile / Document contract (POST/GET /api/vendor/*). */
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
        <p data-testid="vendor-profile-outcome">When you submit, the profile is stored and returns 201 with the created VendorProfile record.</p>
        <form data-testid="vendor-profile-form" (ngSubmit)="submitProfile()">
          <label>
            Company name
            <input name="companyName" type="text" required [(ngModel)]="companyName" />
          </label>
          <label>
            Contact email
            <input name="contactEmail" type="email" required [(ngModel)]="contactEmail" />
          </label>
          <button type="submit" [disabled]="savingProfile">Submit profile</button>
        </form>
        @if (profile) {
          <p data-testid="vendor-profile-saved">Saved profile for {{ profile.companyName }} ({{ profile.contactEmail }}).</p>
        }
        @if (profileError) {
          <p role="alert">{{ profileError }}</p>
        }
      </section>

      <section>
        <h2>Compliance documents</h2>
        <p data-testid="vendor-document-outcome">On upload, the document is stored with status "pending" and displays in the vendor document library.</p>
        <form data-testid="vendor-document-form" (ngSubmit)="uploadDocument()">
          <label>
            Filename
            <input name="filename" type="text" required [(ngModel)]="filename" />
          </label>
          <button type="submit" [disabled]="uploading">Upload document</button>
        </form>
        @if (documentError) {
          <p role="alert">{{ documentError }}</p>
        }

        <div data-testid="vendor-document-library">
          <h3>Document library</h3>
          @if (documents.length === 0) {
            <p>No documents uploaded yet.</p>
          } @else {
            <ul>
              @for (doc of documents; track doc.id) {
                <li data-testid="vendor-document-item">{{ doc.filename }} — {{ doc.status }}</li>
              }
            </ul>
          }
        </div>
      </section>
    </div>
  `,
})
export class VendorProfileComponent implements OnInit {
  private readonly api = inject(ApiClient);

  companyName = '';
  contactEmail = '';
  filename = '';
  profile: VendorProfile | null = null;
  documents: VendorDocument[] = [];
  savingProfile = false;
  uploading = false;
  profileError = '';
  documentError = '';

  ngOnInit(): void {
    void this.loadDocuments();
  }

  async loadDocuments(): Promise<void> {
    try {
      const docs = await this.api.get<VendorDocument[]>('/api/vendor/documents');
      this.documents = Array.isArray(docs) ? docs : [];
    } catch {
      this.documents = [];
    }
  }

  async submitProfile(): Promise<void> {
    if (!this.companyName.trim() || !this.contactEmail.trim()) {
      this.profileError = 'Company name and contact email are required.';
      return;
    }
    this.savingProfile = true;
    this.profileError = '';
    try {
      this.profile = await this.api.post<VendorProfile>('/api/vendor/profile', {
        companyName: this.companyName.trim(),
        contactEmail: this.contactEmail.trim(),
      });
    } catch (e) {
      this.profileError = e instanceof Error ? e.message : 'Could not save profile.';
    } finally {
      this.savingProfile = false;
    }
  }

  async uploadDocument(): Promise<void> {
    if (!this.filename.trim()) {
      this.documentError = 'Filename is required.';
      return;
    }
    this.uploading = true;
    this.documentError = '';
    try {
      await this.api.post<VendorDocument>('/api/vendor/documents', { filename: this.filename.trim() });
      this.filename = '';
      await this.loadDocuments();
    } catch (e) {
      this.documentError = e instanceof Error ? e.message : 'Could not upload document.';
    } finally {
      this.uploading = false;
    }
  }
}
