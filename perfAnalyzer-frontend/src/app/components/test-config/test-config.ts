import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-test-config',
  templateUrl: './test-config.html',
  styleUrls: ['./test-config.css'],
  imports: [FormsModule, UpperCasePipe]
})
export class TestConfig implements OnInit {
  // Modes: 'workspace' or 'direct'
  configMode: 'workspace' | 'direct' = 'workspace';

  // Workspace selection
  workspaces: any[] = [];
  selectedWorkspaceId: number | null = null;
  workspaceFiles: any[] = [];
  selectedFileId: number | null = null;
  isLoadingWorkspaces = false;
  isLoadingFiles = false;

  constructor(protected api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadWorkspaces();
  }

  loadWorkspaces() {
    this.isLoadingWorkspaces = true;
    this.api.listProjects().subscribe({
      next: (data) => {
        this.workspaces = data;
        this.isLoadingWorkspaces = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load workspaces:', err);
        this.isLoadingWorkspaces = false;
        this.cdr.detectChanges();
      }
    });
  }

  onWorkspaceChange() {
    this.selectedFileId = null;
    this.workspaceFiles = [];
    
    // Reset API state
    this.api.selectedProjectId.set(this.selectedWorkspaceId);
    this.api.selectedProjectFileId.set(null);
    this.clearFileStates();

    if (this.selectedWorkspaceId) {
      this.loadWorkspaceFiles(this.selectedWorkspaceId);
    }
  }

  loadWorkspaceFiles(workspaceId: number) {
    this.isLoadingFiles = true;
    this.api.listProjectFiles(workspaceId).subscribe({
      next: (files) => {
        this.workspaceFiles = files;
        this.isLoadingFiles = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load files:', err);
        this.isLoadingFiles = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFileChange() {
    if (!this.selectedFileId) {
      this.api.selectedProjectFileId.set(null);
      this.clearFileStates();
      return;
    }

    const file = this.workspaceFiles.find(f => f.id === Number(this.selectedFileId));
    if (!file) return;

    this.api.selectedProjectFileId.set(file.id);

    const filename = file.filename.toLowerCase();
    const isJmx = filename.endsWith('.jmx');
    const isYaml = filename.endsWith('.yaml') || filename.endsWith('.yml');

    if (isJmx || isYaml) {
      const label = isYaml ? 'YAML' : 'JMX';
      this.api.csvFileName.set(null);
      this.api.csvServerName.set(null);
      this.api.csvUploadStatus.set('idle');

      this.api.jmxFileName.set(file.filename);
      this.api.jmxFileSize.set(this.formatSize(file.file_size));
      this.api.jmxServerName.set(file.filename);
      this.api.jmxUploadStatus.set('success');
      this.api.addLog(`Selected ${label} script from workspace: ${file.filename}`, 'success');
    } else {
      this.api.jmxFileName.set(null);
      this.api.jmxServerName.set(null);
      this.api.jmxUploadStatus.set('idle');

      this.api.csvFileName.set(file.filename);
      this.api.csvFileSize.set(this.formatSize(file.file_size));
      this.api.csvServerName.set(file.filename);
      this.api.csvUploadStatus.set('success');
      this.api.addLog(`Selected CSV dataset from workspace: ${file.filename}`, 'success');
    }
  }

  setMode(mode: 'workspace' | 'direct') {
    this.configMode = mode;
    this.selectedWorkspaceId = null;
    this.selectedFileId = null;
    this.workspaceFiles = [];
    this.api.selectedProjectId.set(null);
    this.api.selectedProjectFileId.set(null);
    this.clearFileStates();
  }

  clearFileStates() {
    this.api.jmxFileName.set(null);
    this.api.jmxServerName.set(null);
    this.api.jmxUploadStatus.set('idle');
    this.api.csvFileName.set(null);
    this.api.csvServerName.set(null);
    this.api.csvUploadStatus.set('idle');
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const filename = file.name.toLowerCase();
    
    if (filename.endsWith('.jmx') || filename.endsWith('.yaml') || filename.endsWith('.yml')) {
      const isYaml = filename.endsWith('.yaml') || filename.endsWith('.yml');
      const label = isYaml ? 'YAML' : 'JMX';
      this.api.csvFileName.set(null);
      this.api.csvServerName.set(null);
      this.api.csvUploadStatus.set('idle');

      this.api.jmxFileName.set(file.name);
      this.api.jmxFileSize.set(`${(file.size / 1024).toFixed(0)} KB`);
      this.api.jmxUploadStatus.set('uploading');
      this.api.addLog(`Uploading ${label} script: ${file.name}...`, 'system');

      this.api.uploadJmxFile(file).subscribe({
        next: (res) => {
          this.api.jmxServerName.set(res.filename);
          this.api.jmxUploadStatus.set('success');
          this.api.addLog(`${label} uploaded successfully. Saved as ${res.filename} on server.`, 'success');
        },
        error: (err) => {
          this.api.jmxUploadStatus.set('error');
          const errorMsg = err.error?.detail || err.message || 'Connection error';
          this.api.addLog(`${label} upload failed: ${errorMsg}`, 'error');
        }
      });

    } else if (filename.endsWith('.csv')) {
      this.api.jmxFileName.set(null);
      this.api.jmxServerName.set(null);
      this.api.jmxUploadStatus.set('idle');

      this.api.csvFileName.set(file.name);
      this.api.csvFileSize.set(`${(file.size / 1024).toFixed(0)} KB`);
      this.api.csvUploadStatus.set('uploading');
      this.api.addLog(`Uploading CSV data file: ${file.name}...`, 'system');

      this.api.uploadCsvFile(file).subscribe({
        next: (res) => {
          this.api.csvServerName.set(res.filename);
          this.api.csvUploadStatus.set('success');
          this.api.addLog(`CSV uploaded successfully. Saved as ${res.filename} on server.`, 'success');
        },
        error: (err) => {
          this.api.csvUploadStatus.set('error');
          const errorMsg = err.error?.detail || err.message || 'Connection error';
          this.api.addLog(`CSV upload failed: ${errorMsg}`, 'error');
        }
      });
    } else {
      this.api.addLog('Error: Only .jmx, .csv, .yaml, and .yml files are supported.', 'error');
    }
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
}