import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/auth.service';
import { AdminApi } from '../../shared/api/admin-api.service';

interface OverviewStats {
  registeredFirms: number;
  documentsProcessed: number;
  analysesCompleted: number;
  chatSessions: number;
}

interface Organization {
  id: string;
  name: string;
  nameBg: string;
  userCount: number;
  documentCount: number;
  conversationCount: number;
  lastActivity: string;
  status: 'active' | 'pending' | 'inactive';
  modulesCompleted?: number;
}

interface AnalyticsSummary {
  totalFirms: number;
  firmsWithDocumentsPct: number;
  firmsWithDiagnosticPct: number;
  firmsWithIntakePct: number;
  avgModulesCompleted: number;
  firmsActiveLast14DaysPct: number;
  firmsReturnedPct: number;
  keywordsComingSoon: boolean;
}

type AdminTab = 'overview' | 'conversations' | 'documents' | 'doctypes' | 'modules' | 'connections' | 'app-settings' | 'research-chat';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-overview.component.html',
  styles: [`
    .stats-section { margin-bottom: var(--space-7); }

    /* Analytics panel */
    .analytics-panel { background: var(--color-white); border-radius: var(--radius-lg); padding: var(--space-6); box-shadow: var(--shadow-card); margin-bottom: var(--space-6); }
    .panel-title { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); margin: 0 0 var(--space-5); }
    .analytics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--grid-min-sm), 1fr)); gap: var(--space-4); }
    .analytics-card { display: flex; align-items: center; gap: var(--space-3-5); padding: var(--space-4); background: var(--color-neutral-50); border-radius: var(--radius-card); }
    .analytics-card.disabled { opacity: 0.5; }
    /* KPI tiles drill down into the admin Reports console — keep them looking
       like the original cards while reading as interactive controls. */
    .analytics-card.clickable { cursor: pointer; text-decoration: none; color: inherit; border: var(--border-width) solid transparent; transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease; }
    .analytics-card.clickable:hover { box-shadow: var(--shadow-hover); transform: translateY(-1px); border-color: var(--color-border); }
    .analytics-card.clickable:focus-visible { outline: var(--focus-ring-width) solid var(--color-primary); outline-offset: var(--focus-ring-width); }
    .ac-icon { width: var(--space-8); height: var(--space-8); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ac-blue { background: var(--color-info-100); color: var(--color-info-700); }
    .ac-purple { background: var(--color-highlight-100); color: var(--color-highlight-600); }
    .ac-green { background: var(--color-success-100); color: var(--color-success-600); }
    .ac-amber { background: var(--color-warning-100); color: var(--color-warning-600); }
    .ac-teal { background: var(--color-accent-100); color: var(--color-accent-600); }
    .ac-indigo { background: var(--color-highlight-100); color: var(--color-highlight-700); }
    .ac-gray { background: var(--color-neutral-100); color: var(--color-neutral-400); }
    .ac-content { display: flex; flex-direction: column; }
    .ac-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-text-primary); }
    .ac-value.ac-soon { color: var(--color-neutral-400); }
    .ac-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-700); }
    .ac-desc { font-size: var(--font-size-xs); color: var(--color-gray-400); }
    .coming-soon { color: var(--color-warning-600); font-weight: 600; }

    /* Filter bar */
    .filter-bar { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); margin-bottom: var(--space-4); flex-wrap: wrap; }
    .filter-controls { display: flex; gap: var(--space-3); align-items: flex-end; flex-wrap: wrap; }
    .filter-group { display: flex; flex-direction: column; gap: var(--space-1); }
    .filter-group label { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: var(--letter-spacing-xs); }
    .filter-group select { border: var(--border-width) solid var(--color-neutral-200); border-radius: var(--radius-btn); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); color: var(--color-text-primary); background: var(--color-white); cursor: pointer; outline: none; }
    .filter-group select:focus { border-color: var(--color-primary); }
    .btn-clear { background: none; border: none; color: var(--color-error-600); font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; padding: var(--space-2); text-decoration: underline; }
    .export-group { display: flex; align-items: center; }
    .export-dropdown { position: relative; }
    .btn-export { display: inline-flex; align-items: center; gap: var(--space-1-5); background: var(--color-primary); color: var(--color-on-primary); border: none; border-radius: var(--radius-btn); padding: var(--space-2) var(--space-4); font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; }
    .btn-export:hover { background: var(--color-primary-600); }
    .export-menu { position: absolute; right: 0; top: calc(100% + var(--space-1)); background: var(--color-white); border: var(--border-width) solid var(--color-neutral-200); border-radius: var(--radius-md); box-shadow: var(--shadow-popup); min-width: var(--grid-min-sm); z-index: 100; overflow: hidden; }
    .export-menu button { display: block; width: 100%; text-align: left; padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--color-gray-700); background: none; border: none; cursor: pointer; }
    .export-menu button:hover { background: var(--color-neutral-50); }

    /* Original styles */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--grid-min-md), 1fr)); gap: var(--space-4); }
    .stat-card { background: var(--color-white); border-radius: var(--radius-card); padding: var(--space-5); display: flex; align-items: center; gap: var(--space-4); box-shadow: var(--shadow-card); border: none; text-align: left; cursor: pointer; }
    .stat-card.clickable { cursor: pointer; transition: all 0.2s ease; border: var(--focus-ring-width) solid transparent; position: relative; }
    .stat-card.clickable:hover { transform: translateY(-2px); box-shadow: var(--shadow-hover-lg); border-color: var(--color-on-primary-muted); }
    .stat-card.clickable:active { transform: scale(0.98); }
    .stat-icon { width: var(--space-9); height: var(--space-9); border-radius: var(--radius-card); display: flex; align-items: center; justify-content: center; }
    .stat-icon.firms { background: var(--color-info-100); color: var(--color-primary); }
    .stat-icon.docs { background: var(--color-success-100); color: var(--color-success-800); }
    .stat-icon.analyses { background: var(--color-highlight-50); color: var(--color-highlight-700); }
    .stat-icon.chats { background: var(--color-warning-100); color: var(--color-warning-800); }
    .stat-content { display: flex; flex-direction: column; }
    .stat-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-text-primary); }
    .stat-label { font-size: var(--font-size-sm); color: var(--color-text-secondary); }
    .stat-action { position: absolute; bottom: var(--space-3); right: var(--space-4); font-size: var(--font-size-xs); color: var(--color-primary); font-weight: 600; opacity: 0; transition: opacity 0.2s; }
    .stat-card.clickable:hover .stat-action { opacity: 1; }
    .attention-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--grid-min-lg), 1fr)); gap: var(--space-6); margin-top: var(--space-6); }
    .card { background: var(--color-white); border-radius: var(--radius-lg); padding: var(--space-6); box-shadow: var(--shadow-card); margin-bottom: var(--space-7); }
    .attention-card { background: var(--color-white); border-radius: var(--radius-lg); padding: var(--space-6); box-shadow: var(--shadow-card); margin-bottom: 0; }
    .attention-card h3 { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-lg); color: var(--color-text-primary); margin: 0 0 var(--space-4) 0; }
    .attention-list { display: flex; flex-direction: column; gap: var(--space-2); }
    .attention-item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) var(--space-4); background: var(--color-neutral-50); border-radius: var(--radius-md); transition: all 0.15s; }
    .attention-item.clickable-row:hover { background: var(--color-primary-light); cursor: pointer; }
    .attention-info { display: flex; flex-direction: column; }
    .attention-name { font-weight: 600; color: var(--color-text-primary); font-size: var(--font-size-md); }
    .attention-detail { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
    .attention-stat { display: flex; flex-direction: column; align-items: flex-end; }
    .attention-stat.warning .attention-value { color: var(--color-error-600); }
    .attention-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); }
    .attention-label { font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase; }
    @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr; } .attention-grid { grid-template-columns: 1fr; } .analytics-grid { grid-template-columns: 1fr 1fr; } .filter-bar { flex-direction: column; align-items: flex-start; } }
  `]
})
export class AdminOverviewComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  private adminApi = inject(AdminApi);

  statsLoaded = signal(false);
  overviewStats = signal<OverviewStats>({ registeredFirms: 0, documentsProcessed: 0, analysesCompleted: 0, chatSessions: 0 });
  stats = computed<OverviewStats>(() => this.overviewStats());

  organizations = signal<Organization[]>([]);
  learningModules = signal<Array<{id: string; isActive: boolean}>>([]);
  analyticsSummary = signal<AnalyticsSummary | null>(null);

  orgsWithModulesData: Array<Organization & { modulesCompleted: number }> = [];

  // Filter state
  filterMissingDocs = '';
  filterInactiveDays = '';
  filterModuleCompletion = '';
  exportMenuOpen = false;

  ngOnInit() {
    void this.loadStats();
    void this.loadOrganizations();
    void this.loadAnalyticsSummary();
  }

  private async loadAnalyticsSummary() {
    try {
      const summary = await this.adminApi.getAnalyticsSummary();
      this.analyticsSummary.set(summary);
    } catch (e) {
      console.warn('analytics summary failed', e);
    }
  }

  async applyFilters() {
    try {
      const filters: { missingDocs?: boolean; inactiveDays?: number; moduleCompletion?: number } = {};
      if (this.filterMissingDocs === 'true') filters.missingDocs = true;
      if (this.filterInactiveDays) filters.inactiveDays = parseInt(this.filterInactiveDays, 10);
      if (this.filterModuleCompletion === '0') filters.moduleCompletion = 0;

      const firms = await this.adminApi.getAnalyticsFirms(filters);
      const orgs: Organization[] = firms.map((f) => ({
        id: f.firmId,
        name: f.firmName,
        nameBg: f.firmName,
        userCount: 0,
        documentCount: f.documentCount,
        conversationCount: f.messageCount,
        lastActivity: (f.createdAt ?? '').slice(0, 10),
        lastConversationAt: '',
        status: (f.intakeComplete ? 'active' : 'pending') as 'active' | 'pending' | 'inactive',
      }));
      this.organizations.set(orgs);
    } catch (e) {
      console.error('Filter failed', e);
    }
  }

  clearFilters() {
    this.filterMissingDocs = '';
    this.filterInactiveDays = '';
    this.filterModuleCompletion = '';
    void this.loadOrganizations();
  }

  downloadExport(anonymized: boolean) {
    this.exportMenuOpen = false;
    const url = this.adminApi.analyticsExportUrl(anonymized);
    window.open(url, '_blank');
  }

  private async loadStats() {
    try {
      const users = await this.adminApi.listUsers();
      this.overviewStats.set({
        registeredFirms: users?.length ?? 0,
        documentsProcessed: 0,
        analysesCompleted: 0,
        chatSessions: 0,
      });
    } catch (e) {
      console.error('admin overview loadStats failed', e);
    } finally { this.statsLoaded.set(true); }
  }

  private async loadOrganizations() {
    // No firm API — organizations list is empty in this template.
    this.organizations.set([]);
    this.orgsWithModulesData = [];
  }

  orgsWithFewestDocuments = () => {
    return [...this.organizations()].sort((a, b) => a.documentCount - b.documentCount).slice(0, 5);
  };

  orgsWithFewestModules = () => {
    return [...this.orgsWithModulesData].sort((a, b) => (a.modulesCompleted || 0) - (b.modulesCompleted || 0)).slice(0, 5);
  };

  totalModulesCount = () => this.learningModules().filter(m => m.isActive).length;

  /** KPI tiles link into /admin/reports/<metric>; keep the shared tab state in sync. */
  openReports() {
    this.auth.setAdminTab('reports');
  }

  /**
   * Formatted KPI value for a summary tile. The tiles render (and stay
   * clickable) even when the summary endpoint has not answered yet or failed,
   * in which case the value shows an em dash instead of the panel vanishing.
   */
  metricValue(field: keyof AnalyticsSummary): string {
    const summary = this.analyticsSummary();
    const value = summary ? summary[field] : null;
    if (value === null || value === undefined || typeof value !== 'number') return '—';
    return `${value}%`;
  }

  navigateToTab(tab: AdminTab) {
    const routeMap: Record<AdminTab, string> = {
      'overview': '/admin/overview',
      'conversations': '/admin/conversations',
      'documents': '/admin/organizations',
      'doctypes': '/admin/doctypes',
      'modules': '/admin/modules',
      'connections': '/admin/app-settings',
      'app-settings': '/admin/app-settings',
      'research-chat': '/admin/research-chat'
    };
    this.auth.setAdminTab(tab);
    this.router.navigate([routeMap[tab]]);
  }

  // "Documents Processed" card → Doc Types tab, Firm Uploads view (all docs from all orgs)
  navigateToDocuments() {
    this.auth.setAdminTab('doctypes');
    this.router.navigate(['/admin/doctypes'], { queryParams: { view: 'uploads' } });
  }

  goToOrgDocuments(org: Organization) {
    this.auth.setAdminTab('documents');
    this.router.navigate(['/admin/organizations'], { queryParams: { orgId: org.id } });
  }

  goToOrgModules(org: any) {
    this.auth.setAdminTab('documents');
    this.router.navigate(['/admin/organizations'], { queryParams: { orgId: org.id } });
  }
}
