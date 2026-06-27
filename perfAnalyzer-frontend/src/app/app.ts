import { Component, signal } from '@angular/core';
import { Logs } from './components/logs/logs';
import { Navbar } from './components/navbar/navbar';
import { Reports } from './components/reports/reports';
import { TestConfig } from './components/test-config/test-config';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [Logs, Navbar, Reports, TestConfig, FormsModule, NgIf],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('perfAnalyzer-frontend');

  filesSummary = '';
  configSummary = '';
  currentMode: 'none' | 'new-test' | 'existing-result' = 'none';
  logsVisible = false;
  reportsVisible = false;
  executionReady = false;
  logsText = '';
  reportText = '';

  onFilesSelected(event: { jmxFile: File | null; csvFile: File | null; mode: 'none' | 'new-test' | 'existing-result' }) {
    const jmxName = event.jmxFile?.name ?? 'No JMX file';
    const csvName = event.csvFile?.name ?? 'No CSV file';

    this.currentMode = event.mode;
    this.filesSummary = `Files ready: ${jmxName} and ${csvName}.`;
    this.logsText = event.mode === 'existing-result'
      ? `[INFO] Loaded existing CSV result: ${csvName}.`
      : `[INFO] Loaded ${jmxName} and ${csvName}.`;
    this.reportText = event.mode === 'existing-result'
      ? `Existing result loaded from ${csvName}. Click Show Report to generate the summary.`
      : 'No report generated yet.';
    this.executionReady = false;
    this.logsVisible = false;
    this.reportsVisible = false;
    this.configSummary = event.mode === 'new-test'
      ? 'Configuration required because a JMX file was uploaded.'
      : event.mode === 'existing-result'
        ? 'No configuration needed for an existing CSV result file.'
        : 'Upload a JMX or CSV file to get started.';
  }

  onConfigSubmitted(config: { users: number; rampUp: number; duration: number }) {
    this.configSummary = `Configuration ready: ${config.users} users, ${config.rampUp}s ramp-up, ${config.duration}s duration.`;
    this.logsText = `[INFO] Starting simulated run for ${config.users} users.\n[INFO] Ramp-up set to ${config.rampUp}s.\n[INFO] Duration set to ${config.duration}s.`;
    this.reportText = `Performance summary\n- Users: ${config.users}\n- Ramp-up: ${config.rampUp}s\n- Duration: ${config.duration}s\n- Files: ${this.filesSummary}`;
    this.executionReady = true;
    this.logsVisible = false;
    this.reportsVisible = false;
  }

  onExecutionCompleted() {
    if (this.currentMode === 'existing-result') {
      this.logsText = `[INFO] Existing CSV result processed successfully.`;
      this.reportText = `Generated performance summary from existing result.\n- Source: existing CSV\n- Files: ${this.filesSummary}`;
    }

    this.executionReady = true;
    this.logsVisible = false;
    this.reportsVisible = false;
  }

  toggleLogsPanel() {
    if (!this.executionReady) {
      return;
    }

    this.logsVisible = !this.logsVisible;
    this.reportsVisible = false;
  }

  toggleReportPanel() {
    if (!this.executionReady) {
      return;
    }

    this.reportsVisible = !this.reportsVisible;
    this.logsVisible = false;
  }
}
