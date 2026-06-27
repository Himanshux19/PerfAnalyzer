import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-test-config',
  templateUrl: './test-config.html',
  styleUrls: ['./test-config.css'],
  imports: [FormsModule, NgIf]
})
export class TestConfig {
  users = 0;
  rampUp = 0;
  duration = 0;

  jmxFile: File | null = null;
  csvFile: File | null = null;
  filesReady = false;
  configReady = false;

  uploadMode: 'none' | 'new-test' | 'existing-result' = 'none';

  @Output() filesSelected = new EventEmitter<{ jmxFile: File | null; csvFile: File | null; mode: 'none' | 'new-test' | 'existing-result' }>();
  @Output() configSubmitted = new EventEmitter<{ users: number; rampUp: number; duration: number }>();
  @Output() executionCompleted = new EventEmitter<void>();
  @Output() logsToggled = new EventEmitter<void>();
  @Output() reportToggled = new EventEmitter<void>();

  onJmxSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.jmxFile = input.files?.[0] ?? null;
    if (this.jmxFile) {
      this.csvFile = null;
    }
    this.updateUploadMode();
  }

  onCsvSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.csvFile = input.files?.[0] ?? null;
    if (this.csvFile) {
      this.jmxFile = null;
    }
    this.updateUploadMode();
  }

  deleteJmx() {
    this.jmxFile = null;
    this.updateUploadMode();
  }

  deleteCsv() {
    this.csvFile = null;
    this.updateUploadMode();
  }

  saveConfiguration() {
    this.configSubmitted.emit({ users: this.users, rampUp: this.rampUp, duration: this.duration });
    this.configReady = true;
    this.executionCompleted.emit();
  }

  analyzeExistingResult() {
    this.configReady = true;
    this.executionCompleted.emit();
  }

  showLogs() {
    this.logsToggled.emit();
  }

  showReport() {
    this.reportToggled.emit();
  }

  private updateUploadMode() {
    if (this.jmxFile) {
      this.uploadMode = 'new-test';
      this.filesReady = true;
    } else if (this.csvFile) {
      this.uploadMode = 'existing-result';
      this.filesReady = true;
    } else {
      this.uploadMode = 'none';
      this.filesReady = false;
    }

    this.filesSelected.emit({ jmxFile: this.jmxFile, csvFile: this.csvFile, mode: this.uploadMode });
  }
}