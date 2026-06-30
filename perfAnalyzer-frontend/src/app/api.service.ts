import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UploadResponse {
  message: string;
  filename: string;
  path: string;
}

export interface RunTestResponse {
  message: string;
  test_name: string;
}

export interface GenerateHtmlResponse {
  message: string;
  report_folder: string;
}

export interface TestStatusResponse {
  status: string;
  error: string;
  jmeter_log: string;
  bzt_log: string;
  throughput?: number;
  avg_rt?: number;
  error_rate?: number;
  active_users?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) {}

  // Shared variables using Angular Signals
  jmxFileName = signal<string | null>(null);
  jmxServerName = signal<string | null>(null);
  jmxFileSize = signal<string | null>(null);
  jmxUploadStatus = signal<'idle' | 'uploading' | 'success' | 'error'>('idle');

  csvFileName = signal<string | null>(null);
  csvServerName = signal<string | null>(null);
  csvFileSize = signal<string | null>(null);
  csvUploadStatus = signal<'idle' | 'uploading' | 'success' | 'error'>('idle');

  users = signal<number | null>(0);
  rampUp = signal<number | null>(0);
  loopCount = signal<number | null>(0);
  duration = signal<number | null>(0);
  scheduler = signal<boolean>(false);

  // Execution state & console output logs
  testStatus = signal<'idle' | 'running' | 'success' | 'error'>('idle');
  terminalLogs = signal<any[]>([]);

  // Real-time parsed metrics from bzt.log
  runnerRps = signal<string>('0 RPS');
  runnerPeakRps = signal<string>('peak 0');
  runnerAvgRt = signal<string>('0 ms');
  runnerErrorRate = signal<string>('0.0%');

  // Histories for bottom graphs
  rpsHistory = signal<number[]>([]);
  rtHistory = signal<number[]>([]);
  errorHistory = signal<number[]>([]);

  // API Methods
  uploadJmxFile(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${this.baseUrl}/upload/jmx`, formData);
  }

  uploadCsvFile(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${this.baseUrl}/upload/csv`, formData);
  }

  runTest(jmxFilename: string, threads: number, rampUp: number, duration: number): Observable<RunTestResponse> {
    const formData = new FormData();
    formData.append('jmx_filename', jmxFilename);
    formData.append('threads', threads.toString());
    formData.append('ramp_up', rampUp.toString());
    formData.append('duration', duration.toString());
    return this.http.post<RunTestResponse>(`${this.baseUrl}/run-test`, formData);
  }

  getTestStatus(testName: string): Observable<TestStatusResponse> {
    return this.http.get<TestStatusResponse>(`${this.baseUrl}/test-status/${testName}`);
  }

  generateHtml(csvFilename: string): Observable<GenerateHtmlResponse> {
    const formData = new FormData();
    formData.append('csv_filename', csvFilename);
    return this.http.post<GenerateHtmlResponse>(`${this.baseUrl}/generate-html`, formData);
  }

  // Helpers to add log messages to terminal console
  addLog(text: string, type: 'system' | 'success' | 'error' = 'system') {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
    this.terminalLogs.update(logs => [...logs, { time: timeStr, text, type }]);
  }

  clearLogs() {
    this.terminalLogs.set([]);
  }
}
