import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { Navbar } from '../navbar/navbar';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-projects',
  imports: [Navbar, FormsModule, UpperCasePipe],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class Projects implements OnInit {
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
  formError: string | null = null;
  formSaving = false;

  // ── Delete Confirmation ──────────────────────────────────────
  showDeleteModal = false;
  deletingProject: any = null;
  deleteConfirming = false;

  // ── File Manager Drawer ──────────────────────────────────────
  showFileDrawer = false;
  drawerProject: any = null;
  drawerFiles: any[] = [];
  drawerLoading = false;
  drawerError: string | null = null;

  // ── Upload State ─────────────────────────────────────────────
  isDragOver = false;
  uploadQueue: { file: File; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }[] = [];

  constructor(protected api: ApiService, private router: Router) {}

  ngOnInit() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }
    }
    this.loadProjects();
  }

  // ── Projects ─────────────────────────────────────────────────

  loadProjects() {
    this.isLoading = true;
    this.errorMessage = null;
    this.api.listProjects().subscribe({
      next: (data) => {
        this.projects = data;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load workspaces. Make sure the backend is running.';
        this.isLoading = false;
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
        (p.tags || '').toLowerCase().includes(q)
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
      this.api.updateProject(this.editingProject.id, this.formName, this.formDescription, this.formTags).subscribe({
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
        },
        error: (err) => {
          this.formError = err?.error?.detail || 'Failed to update workspace.';
          this.formSaving = false;
        },
      });
    } else {
      this.api.createProject(this.formName, this.formDescription, this.formTags).subscribe({
        next: (newProject) => {
          this.projects = [newProject, ...this.projects];
          this.formSaving = false;
          this.showFormModal = false;
        },
        error: (err) => {
          this.formError = err?.error?.detail || 'Failed to create workspace.';
          this.formSaving = false;
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
      },
      error: () => {
        this.deleteConfirming = false;
        this.showDeleteModal = false;
      },
    });
  }

  // ── File Manager ─────────────────────────────────────────────

  openFileDrawer(project: any) {
    this.drawerProject = project;
    this.showFileDrawer = true;
    this.drawerFiles = [];
    this.drawerError = null;
    this.uploadQueue = [];
    this.loadDrawerFiles();
  }

  closeFileDrawer() {
    this.showFileDrawer = false;
    this.drawerProject = null;
    this.uploadQueue = [];
  }

  loadDrawerFiles() {
    if (!this.drawerProject) return;
    this.drawerLoading = true;
    this.api.listProjectFiles(this.drawerProject.id).subscribe({
      next: (files) => {
        this.drawerFiles = files;
        this.drawerLoading = false;
      },
      error: () => {
        this.drawerError = 'Failed to load files.';
        this.drawerLoading = false;
      },
    });
  }

  deleteDrawerFile(file: any) {
    if (!this.drawerProject) return;
    this.api.deleteProjectFile(this.drawerProject.id, file.id).subscribe({
      next: () => {
        this.drawerFiles = this.drawerFiles.filter((f) => f.id !== file.id);
        const idx = this.projects.findIndex((p) => p.id === this.drawerProject.id);
        if (idx !== -1 && this.projects[idx].file_count > 0) {
          this.projects[idx] = { ...this.projects[idx], file_count: this.projects[idx].file_count - 1 };
          this.projects = [...this.projects];
        }
      },
      error: () => alert('Failed to delete file. Please try again.'),
    });
  }

  getFileDownloadUrl(file: any): string {
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

  uploadFile(entry: { file: File; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }) {
    entry.status = 'uploading';
    this.api.uploadProjectFile(this.drawerProject.id, entry.file).subscribe({
      next: (newFile) => {
        entry.status = 'done';
        this.drawerFiles = [newFile, ...this.drawerFiles];
        const idx = this.projects.findIndex((p) => p.id === this.drawerProject.id);
        if (idx !== -1) {
          this.projects[idx] = { ...this.projects[idx], file_count: (this.projects[idx].file_count || 0) + 1 };
          this.projects = [...this.projects];
        }
      },
      error: (err) => {
        entry.status = 'error';
        entry.error = err?.error?.detail || 'Upload failed.';
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
      case 'jmx': return 'bi-file-earmark-code';
      case 'csv/jtl': return 'bi-file-earmark-spreadsheet';
      case 'yaml': return 'bi-file-earmark-text';
      case 'json': return 'bi-braces';
      case 'xml': return 'bi-code-slash';
      default: return 'bi-file-earmark';
    }
  }

  getFileIconColor(fileType: string): string {
    switch (fileType) {
      case 'jmx': return 'icon-jmx';
      case 'csv/jtl': return 'icon-csv';
      case 'yaml': return 'icon-yaml';
      case 'json': return 'icon-json';
      case 'xml': return 'icon-xml';
      default: return 'icon-other';
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showDeleteModal) this.closeDeleteModal();
    else if (this.showFormModal) this.closeFormModal();
    else if (this.showFileDrawer) this.closeFileDrawer();
  }
}
