import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

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
  windowed_rps?: number;
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

  selectedProjectId = signal<number | null>(null);
  selectedProjectFileId = signal<number | null>(null);

  users = signal<number | null>(0);
  concurrency = signal<number | null>(10);
  rampUp = signal<number | null>(10);
  loopCount = signal<number | null>(1);
  duration = signal<number | null>(60);
  scheduler = signal<boolean>(false);
  elapsedSeconds = signal<number>(0);

  // Execution state & console output logs
  testStatus = signal<'idle' | 'running' | 'success' | 'error'>('idle');
  terminalLogs = signal<any[]>([]);

  activeTestName = signal<string | null>(null);

  // Real-time parsed metrics from bzt.log
  runnerRps = signal<string>('0 RPS');
  runnerPeakRps = signal<string>('peak 0');
  runnerAvgRps = signal<string>('0 RPS');
  totalRequests = signal<number>(0);
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

  runTest(
    jmxFilename: string,
    threads: number,
    rampUp: number,
    duration: number,
    projectId?: number | null,
    projectFileId?: number | null
  ): Observable<RunTestResponse> {
    const formData = new FormData();
    formData.append('jmx_filename', jmxFilename);
    formData.append('threads', threads.toString());
    formData.append('ramp_up', rampUp.toString());
    formData.append('duration', duration.toString());
    
    const username = (typeof window !== 'undefined' && localStorage.getItem('username')) || 'Guest';
    formData.append('username', username);

    if (projectId) {
      formData.append('project_id', projectId.toString());
    }
    if (projectFileId) {
      formData.append('project_file_id', projectFileId.toString());
    }
    
    return this.http.post<RunTestResponse>(`${this.baseUrl}/run-test`, formData);
  }


  getTestStatus(testName: string): Observable<TestStatusResponse> {
    return this.http.get<TestStatusResponse>(`${this.baseUrl}/test-status/${testName}`);
  }

  getResultsDownloadUrl(testName: string): string {
    return `${this.baseUrl}/download-results/${testName}`;
  }

  getReportViewUrl(testName: string): string {
    return `${this.baseUrl}/reports/${testName}/HTML_Report/index.html`;
  }

  listReports(sync = false): Observable<any[]> {
    const username = (typeof window !== 'undefined' && localStorage.getItem('username')) || '';
    const url = `${this.baseUrl}/list-reports?username=${encodeURIComponent(username)}${sync ? '&sync=true' : ''}`;
    return this.http.get<any[]>(url);
  }

  deleteReport(testName: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/delete-report/${testName}`);
  }

  // ── Project Management ──────────────────────────────────────

  listProjects(): Observable<any[]> {
    const username = (typeof window !== 'undefined' && localStorage.getItem('username')) || '';
    return this.http.get<any[]>(`${this.baseUrl}/projects?username=${encodeURIComponent(username)}`);
  }

  createProject(name: string, description: string, tags: string): Observable<any> {
    const username = (typeof window !== 'undefined' && localStorage.getItem('username')) || '';
    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', description);
    fd.append('tags', tags);
    fd.append('username', username);
    return this.http.post<any>(`${this.baseUrl}/projects`, fd);
  }

  updateProject(id: number, name: string, description: string, tags: string): Observable<any> {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', description);
    fd.append('tags', tags);
    return this.http.put<any>(`${this.baseUrl}/projects/${id}`, fd);
  }

  deleteProject(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/projects/${id}`);
  }

  listProjectFiles(projectId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/projects/${projectId}/files`);
  }

  uploadProjectFile(projectId: number, file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<any>(`${this.baseUrl}/projects/${projectId}/upload`, fd);
  }

  deleteProjectFile(projectId: number, fileId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/projects/${projectId}/files/${fileId}`);
  }

  getProjectFileDownloadUrl(projectId: number, fileId: number): string {
    return `${this.baseUrl}/projects/${projectId}/files/${fileId}/download`;
  }


  registerUser(username: string, password: string, fullName: string = ''): Observable<any> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('full_name', fullName);
    return this.http.post<any>(`${this.baseUrl}/register`, formData);
  }

  loginUser(username: string, password: string): Observable<any> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    return this.http.post<any>(`${this.baseUrl}/login`, formData);
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
