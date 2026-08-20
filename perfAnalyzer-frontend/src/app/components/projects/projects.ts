import { Component, OnInit, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { ApiService } from '../../api.service';

import { CreateTest } from '../create-test/create-test';
import { Dashboard } from '../dashboard/dashboard';
import { ReportsHistory } from '../reports-history/reports-history';
import { TestQueue } from '../test-queue/test-queue';
import { OverviewDashboard } from '../overview-dashboard/overview-dashboard';

@Component({
  selector: 'app-projects',
  imports: [
    CommonModule,
    FormsModule,
    UpperCasePipe,
    CreateTest,
    Dashboard,
    ReportsHistory,
    TestQueue,
    OverviewDashboard,
  ],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class Projects implements OnInit {
  // ── Navigation & Sidebar State ───────────────────────────────
  activeSection:
    | 'dashboard'
    | 'workspaces'
    | 'about'
    | 'create-test'
    | 'test'
    | 'files'
    | 'reports'
    | 'queue' = 'dashboard';
  get sidebarCollapsed(): boolean {
    return this.api.sidebarCollapsed();
  }
  set sidebarCollapsed(val: boolean) {
    this.api.sidebarCollapsed.set(val);
  }
  selectedWorkspaceId: number | null = null;

  // ── Data ────────────────────────────────────────────────────
  projects: any[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  searchQuery = '';

  // ── Create / Edit Modal ──────────────────────────────────────
  showFormModal = false;
  isEditMode = false;
  editingProject: any = null;
  formName = '';
  formDescription = '';
  formTags = '';
  formSaving = false;
  formError: string | null = null;

  // ── Delete Confirm Modal ─────────────────────────────────────
  showDeleteModal = false;
  deletingProject: any = null;
  deleteConfirming = false;

  // ── File Manager Drawer ──────────────────────────────────────
  showFileDrawer = false;
  drawerProject: any = null;
  activeDrawerTab: 'files' | 'reports' = 'files';
  drawerFiles: any[] = [];
  drawerReports: any[] = [];
  drawerLoading = false;
  drawerReportsLoading = false;
  drawerError: string | null = null;
  drawerReportsError: string | null = null;

  // Reports Pagination
  reportsPage = 1;
  reportsPerPage = 5;

  // File Upload State
  isDragOver = false;
  uploadQueue: {
    file: File;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
  }[] = [];

  isRefreshing = false;

  constructor(
    protected api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  ngOnInit() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }
    }

    this.resolveSectionFromUrl(this.router.url);

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        this.zone.run(() => {
          this.resolveSectionFromUrl(e.urlAfterRedirects || e.url);
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      });

    this.route.queryParams.subscribe((params) => {
      this.zone.run(() => {
        if (params['section']) {
          this.activeSection = params['section'];
        }
        if (params['projectId']) {
          this.selectedWorkspaceId = Number(params['projectId']);
          this.api.selectedProjectId.set(this.selectedWorkspaceId);
        }
        if (this.projects.length > 0) {
          const found = this.projects.find((p) => p.id === this.selectedWorkspaceId);
          if (found) {
            this.drawerProject = found;
          }
        }
        if (
          this.selectedWorkspaceId &&
          (this.activeSection === 'files' || this.activeSection === 'about')
        ) {
          this.loadDrawerFiles();
          this.loadDrawerReports();
        }
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    });

    this.loadProjects();
  }

  resolveSectionFromUrl(url: string) {
    const cleanUrl = url.split('?')[0].replace(/^\//, '');
    if (cleanUrl === 'dashboard' || cleanUrl === '') {
      this.activeSection = 'dashboard';
    } else if (cleanUrl === 'workspaces' || cleanUrl === 'projects') {
      this.activeSection = 'workspaces';
    } else if (cleanUrl === 'about') {
      this.activeSection = 'about';
    } else if (cleanUrl === 'create-test') {
      this.activeSection = 'create-test';
    } else if (cleanUrl === 'test') {
      this.activeSection = 'test';
    } else if (cleanUrl === 'files') {
      this.activeSection = 'files';
    } else if (cleanUrl === 'reports') {
      this.activeSection = 'reports';
    } else if (cleanUrl === 'queue') {
      this.activeSection = 'queue';
    }
    if (
      this.selectedWorkspaceId &&
      (this.activeSection === 'files' || this.activeSection === 'about')
    ) {
      this.loadDrawerFiles();
      this.loadDrawerReports();
    }
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  // ── Projects ─────────────────────────────────────────────────

  loadProjects(isBackground = false) {
    if (isBackground) {
      this.isRefreshing = true;
    } else {
      this.isLoading = true;
    }
    this.errorMessage = null;
    this.api.listProjects().subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.projects = data;
          this.isLoading = false;
          this.isRefreshing = false;

          if (this.selectedWorkspaceId) {
            const project = this.projects.find((p) => p.id === this.selectedWorkspaceId);
            if (project) {
              this.drawerProject = project;
              if (this.activeSection === 'files') {
                this.loadDrawerFiles();
              }
            }
          } else if (this.projects.length > 0) {
            this.selectedWorkspaceId = this.projects[0].id;
            this.drawerProject = this.projects[0];
            this.api.selectedProjectId.set(this.selectedWorkspaceId);
            if (this.activeSection === 'files') {
              this.loadDrawerFiles();
            }
          }

          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.errorMessage = 'Failed to load workspaces. Make sure the backend is running.';
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
    });
  }

  get filteredProjects() {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.projects;
    return this.projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.tags || '').toLowerCase().includes(q),
    );
  }

  get totalFileCount(): number {
    return this.projects.reduce((sum, p) => sum + (p.file_count || 0), 0);
  }

  // ── Create / Edit ────────────────────────────────────────────

  openCreateModal() {
    this.isEditMode = false;
    this.editingProject = null;
    this.formName = '';
    this.formDescription = '';
    this.formTags = '';
    this.formError = null;
    this.showFormModal = true;
  }

  openEditModal(project: any) {
    this.isEditMode = true;
    this.editingProject = project;
    this.formName = project.name;
    this.formDescription = project.description || '';
    this.formTags = project.tags || '';
    this.formError = null;
    this.showFormModal = true;
  }

  closeFormModal() {
    this.showFormModal = false;
  }

  saveProject() {
    if (!this.formName.trim()) {
      this.formError = 'Workspace name is required.';
      return;
    }
    this.formSaving = true;
    this.formError = null;

    if (this.isEditMode && this.editingProject) {
      this.api
        .updateProject(this.editingProject.id, this.formName, this.formDescription, this.formTags)
        .subscribe({
          next: () => {
            const idx = this.projects.findIndex((p) => p.id === this.editingProject.id);
            if (idx !== -1) {
              this.projects[idx] = {
                ...this.projects[idx],
                name: this.formName,
                description: this.formDescription,
                tags: this.formTags,
              };
              this.projects = [...this.projects];
            }
            this.formSaving = false;
            this.showFormModal = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.formError = err?.error?.detail || 'Failed to update workspace.';
            this.formSaving = false;
            this.cdr.detectChanges();
          },
        });
    } else {
      this.api.createProject(this.formName, this.formDescription, this.formTags).subscribe({
        next: (newProject) => {
          this.projects = [newProject, ...this.projects];
          this.formSaving = false;
          this.showFormModal = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.formError = err?.error?.detail || 'Failed to create workspace.';
          this.formSaving = false;
          this.cdr.detectChanges();
        },
      });
    }
  }

  // ── Delete ───────────────────────────────────────────────────

  openDeleteModal(project: any) {
    this.deletingProject = project;
    this.showDeleteModal = true;
    this.deleteConfirming = false;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.deletingProject = null;
  }

  confirmDelete() {
    if (!this.deletingProject) return;
    this.deleteConfirming = true;
    this.api.deleteProject(this.deletingProject.id).subscribe({
      next: () => {
        this.projects = this.projects.filter((p) => p.id !== this.deletingProject.id);
        this.deleteConfirming = false;
        this.showDeleteModal = false;
        if (this.drawerProject?.id === this.deletingProject.id) {
          this.showFileDrawer = false;
        }
        this.deletingProject = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.deleteConfirming = false;
        this.showDeleteModal = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── File Manager ─────────────────────────────────────────────

  openFileDrawer(project: any) {
    this.drawerProject = project;
    this.showFileDrawer = true;
    this.activeDrawerTab = 'files';
    this.drawerFiles = [];
    this.drawerReports = [];
    this.drawerError = null;
    this.drawerReportsError = null;
    this.uploadQueue = [];
    this.loadDrawerFiles();
  }

  closeFileDrawer() {
    this.showFileDrawer = false;
    this.drawerProject = null;
    this.uploadQueue = [];
  }

  setDrawerTab(tab: 'files' | 'reports') {
    this.activeDrawerTab = tab;
    if (tab === 'reports') {
      const project = this.drawerProject;
      this.closeFileDrawer();
      if (project) {
        this.selectWorkspace(project.id);
      }
      this.setSection('reports');
    } else {
      this.loadDrawerFiles();
    }
    this.cdr.detectChanges();
  }

  viewReports(project: any) {
    if (project) {
      this.selectWorkspace(project.id);
    }
    this.setSection('reports');
  }

  goToAbout(project: any) {
    if (!project) return;
    this.selectedWorkspaceId = project.id;
    this.drawerProject = project;
    this.api.selectedProjectId.set(project.id);
    this.activeSection = 'about';
    this.loadDrawerFiles();
    this.loadDrawerReports();
    this.router.navigate(['/about'], {
      queryParams: {
        projectId: project.id,
        projectName: project.name,
      },
    });
    this.cdr.detectChanges();
  }

  goToRunner(project: any) {
    this.selectedWorkspaceId = project.id;
    this.drawerProject = project;
    this.api.selectedProjectId.set(project.id);
    this.setSection('test');
  }

  toggleSidebar() {
    const next = !this.api.sidebarCollapsed();
    this.api.sidebarCollapsed.set(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(next));
    }
    this.cdr.detectChanges();
  }

  setSection(
    section:
      | 'dashboard'
      | 'workspaces'
      | 'about'
      | 'create-test'
      | 'test'
      | 'files'
      | 'reports'
      | 'queue',
  ) {
    this.activeSection = section;
    const isGlobal = section === 'dashboard' || section === 'workspaces';
    const targetPath = `/${section}`;

    if (isGlobal) {
      this.router.navigate([targetPath]);
    } else {
      this.router.navigate([targetPath], {
        queryParams: {
          projectId: this.selectedWorkspaceId,
          projectName: this.drawerProject?.name || null,
        },
      });
    }

    if (section === 'files' || section === 'about') {
      this.loadDrawerFiles();
      this.loadDrawerReports();
    }
    this.cdr.detectChanges();
  }

  getJmxFiles(): any[] {
    return this.drawerFiles.filter((f) => (f.name || '').toLowerCase().endsWith('.jmx'));
  }

  getDataFiles(): any[] {
    return this.drawerFiles.filter((f) => !(f.name || '').toLowerCase().endsWith('.jmx'));
  }

  selectWorkspace(projectId: number) {
    this.selectedWorkspaceId = projectId;
    const project = this.projects.find((p) => p.id === projectId);
    if (project) {
      this.drawerProject = project;
      this.api.selectedProjectId.set(projectId);
      if (this.activeSection === 'workspaces') {
        this.activeSection = 'about';
        this.router.navigate(['/about'], {
          queryParams: {
            projectId: projectId,
            projectName: project.name,
          },
          queryParamsHandling: 'merge',
        });
      } else {
        this.router.navigate([], {
          queryParams: {
            projectId: projectId,
            projectName: project.name,
          },
          queryParamsHandling: 'merge',
        });
      }
      if (this.activeSection === 'files' || this.activeSection === 'about') {
        this.loadDrawerFiles();
        this.loadDrawerReports();
      }
    }
    this.closeWorkspaceDropdown();
    this.cdr.detectChanges();
  }

  loadDrawerReports() {
    if (!this.drawerProject) return;
    const projectId = this.drawerProject.id;
    this.drawerReportsLoading = true;
    this.drawerReportsError = null;
    this.reportsPage = 1;
    this.api.listProjectReports(projectId).subscribe({
      next: (reports) => {
        if (this.drawerProject && this.drawerProject.id === projectId) {
          this.drawerReports = reports;
          this.drawerReportsLoading = false;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        if (this.drawerProject && this.drawerProject.id === projectId) {
          this.drawerReportsError = 'Failed to load reports.';
          this.drawerReportsLoading = false;
        }
        this.cdr.detectChanges();
      },
    });
  }

  get paginatedReports(): any[] {
    const start = (this.reportsPage - 1) * this.reportsPerPage;
    return this.drawerReports.slice(start, start + this.reportsPerPage);
  }

  get totalReportsPages(): number {
    return Math.ceil(this.drawerReports.length / this.reportsPerPage);
  }

  get reportsPageNumbers(): number[] {
    const pages = this.totalReportsPages;
    return Array.from({ length: pages }, (_, i) => i + 1);
  }

  setReportsPage(page: number) {
    if (page < 1 || page > this.totalReportsPages) return;
    this.reportsPage = page;
    this.cdr.detectChanges();
  }

  deleteDrawerReport(report: any) {
    if (!confirm(`Are you sure you want to delete report: ${report.test_name}?`)) return;
    if (!this.drawerProject) return;
    const projectId = this.drawerProject.id;
    this.api.deleteReport(report.test_name).subscribe({
      next: () => {
        if (this.drawerProject && this.drawerProject.id === projectId) {
          this.drawerReports = this.drawerReports.filter((r) => r.test_name !== report.test_name);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        alert('Failed to delete report. Please try again.');
        this.cdr.detectChanges();
      },
    });
  }

  loadDrawerFiles() {
    if (!this.drawerProject) return;
    const projectId = this.drawerProject.id;
    this.drawerLoading = true;
    this.api.listProjectFiles(projectId).subscribe({
      next: (files) => {
        if (this.drawerProject && this.drawerProject.id === projectId) {
          this.drawerFiles = files;
          this.drawerLoading = false;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        if (this.drawerProject && this.drawerProject.id === projectId) {
          this.drawerError = 'Failed to load files.';
          this.drawerLoading = false;
        }
        this.cdr.detectChanges();
      },
    });
  }

  deleteDrawerFile(file: any) {
    if (!this.drawerProject) return;
    const projectId = this.drawerProject.id;
    this.api.deleteProjectFile(projectId, file.id).subscribe({
      next: () => {
        if (this.drawerProject && this.drawerProject.id === projectId) {
          this.drawerFiles = this.drawerFiles.filter((f) => f.id !== file.id);
        }
        const idx = this.projects.findIndex((p) => p.id === projectId);
        if (idx !== -1 && this.projects[idx].file_count > 0) {
          this.projects[idx] = {
            ...this.projects[idx],
            file_count: this.projects[idx].file_count - 1,
          };
          this.projects = [...this.projects];
        }
        this.cdr.detectChanges();
      },
      error: () => {
        alert('Failed to delete file. Please try again.');
        this.cdr.detectChanges();
      },
    });
  }

  getFileDownloadUrl(file: any): string {
    if (!this.drawerProject) return '';
    return this.api.getProjectFileDownloadUrl(this.drawerProject.id, file.id);
  }

  // ── Drag & Drop Upload ────────────────────────────────────────

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    const files = Array.from(event.dataTransfer?.files || []);
    this.enqueueFiles(files);
  }

  onFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.enqueueFiles(files);
    input.value = '';
  }

  enqueueFiles(files: File[]) {
    if (!this.drawerProject) return;
    const entries = files.map((f) => ({ file: f, status: 'pending' as const }));
    this.uploadQueue = [...this.uploadQueue, ...entries];
    entries.forEach((entry) => this.uploadFile(entry));
  }

  uploadFile(entry: {
    file: File;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
  }) {
    if (!this.drawerProject) return;
    const projectId = this.drawerProject.id;
    entry.status = 'uploading';
    this.api.uploadProjectFile(projectId, entry.file).subscribe({
      next: (newFile) => {
        entry.status = 'done';
        if (this.drawerProject && this.drawerProject.id === projectId) {
          this.drawerFiles = [newFile, ...this.drawerFiles];
        }
        const idx = this.projects.findIndex((p) => p.id === projectId);
        if (idx !== -1) {
          this.projects[idx] = {
            ...this.projects[idx],
            file_count: (this.projects[idx].file_count || 0) + 1,
          };
          this.projects = [...this.projects];
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        entry.status = 'error';
        entry.error = err?.error?.detail || 'Upload failed.';
        this.cdr.detectChanges();
      },
    });
  }

  clearDoneUploads() {
    this.uploadQueue = this.uploadQueue.filter((e) => e.status !== 'done');
  }

  // ── Helpers ───────────────────────────────────────────────────

  getTagsArray(tags: string): string[] {
    if (!tags) return [];
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let val = bytes;
    let i = 0;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  getFileIcon(fileType: string): string {
    switch (fileType) {
      case 'jmx':
        return 'bi-file-earmark-code';
      case 'csv/jtl':
        return 'bi-file-earmark-spreadsheet';
      case 'yaml':
        return 'bi-file-earmark-text';
      case 'json':
        return 'bi-braces';
      case 'xml':
        return 'bi-code-slash';
      default:
        return 'bi-file-earmark';
    }
  }

  getFileIconColor(fileType: string): string {
    switch (fileType) {
      case 'jmx':
        return 'icon-jmx';
      case 'csv/jtl':
        return 'icon-csv';
      case 'yaml':
        return 'icon-yaml';
      case 'json':
        return 'icon-json';
      case 'xml':
        return 'icon-xml';
      default:
        return 'icon-other';
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showDeleteModal) this.closeDeleteModal();
    else if (this.showFormModal) this.closeFormModal();
    else if (this.showFileDrawer) this.closeFileDrawer();
  }

  workspaceDropdownOpen = false;

  toggleWorkspaceDropdown(event: Event) {
    event.stopPropagation();
    this.workspaceDropdownOpen = !this.workspaceDropdownOpen;
    this.cdr.detectChanges();
  }

  closeWorkspaceDropdown() {
    this.workspaceDropdownOpen = false;
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.closeWorkspaceDropdown();
  }

  getUsername(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('username') || 'Guest';
    }
    return 'Guest';
  }

  getFullName(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('full_name') || '';
    }
    return '';
  }

  getInitials(): string {
    const fullName = this.getFullName();
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    const email = this.getUsername();
    if (email === 'Guest') return 'G';
    return email.slice(0, 2).toUpperCase();
  }

  onLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('admin_auth_token');
      localStorage.removeItem('username');
      localStorage.removeItem('full_name');
      localStorage.removeItem('role');
      this.router.navigate(['/login']);
    }
  }
}
