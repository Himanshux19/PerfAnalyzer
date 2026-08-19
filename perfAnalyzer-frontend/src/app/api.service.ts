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

export interface TestQueueItem {
  id: string;
  source: 'local' | 'jenkins';
  test_name: string;
  job_name?: string;
  username: string;
  concurrency: number;
  ramp_up: number;
  duration: number;
  throughput: number;
  avg_rt: number;
  error_rate: number;
  status: 'running' | 'success' | 'error' | 'queued' | 'completed' | string;
  error_message: string;
  created_at: string;
  project_id?: number | null;
  project_name?: string;
  has_report: boolean;
  build_number?: number | null;
  jenkins_url?: string | null;
}

export interface JenkinsConfig {
  url: string;
  username: string;
  api_token: string;
  enabled: boolean;
}

export interface DashboardSummary {
  kpis: {
    total_tests: number;
    total_tests_trend: string;
    tests_run: number;
    tests_run_trend: string;
    scheduled_tests: number;
    scheduled_tests_sub: string;
    success_rate: number;
    success_rate_trend: string;
    failed_tests: number;
    failed_tests_trend: string;
  };
  recent_runs: Array<{
    id: string;
    test_name: string;
    status: string;
    users: number;
    started_at: string;
    duration: string;
    workspace: string;
    throughput?: number;
    avg_rt?: number;
    error_rate?: number;
  }>;
  active_tests: Array<{
    id: string;
    test_name: string;
    workspace: string;
    users: number;
    duration: string;
    status: string;
    progress: number;
  }>;
  scheduled_tests: Array<{
    id: string;
    test_name: string;
    workspace: string;
    schedule: string;
    next_run: string;
    status: string;
  }>;
  recent_reports: Array<{
    test_name: string;
    created_at: string;
    workspace: string;
    size: string;
    type: string;
    download_url: string;
    view_url: string;
  }>;
  status_summary: {
    completed: number;
    completed_pct: number;
    running: number;
    running_pct: number;
    failed: number;
    failed_pct: number;
    scheduled: number;
    scheduled_pct: number;
    total_tests: number;
  };
  performance_overview: Array<{
    time: string;
    users: number;
    throughput: number;
    avg_rt: number;
    error_rate: number;
  }>;
  performance_snapshot: {
    avg_response_time: number;
    p95_response_time?: number;
    p99_response_time?: number;
    avg_throughput: number;
    total_requests?: number;
    rt_series: number[];
    tput_series: number[];
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('theme');
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark-theme');
    }
  }

  // Shared variables using Angular Signals
  sidebarCollapsed = signal<boolean>(
    typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') === 'true' : false,
  );

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
    projectFileId?: number | null,
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
    return this.http.get<any[]>(
      `${this.baseUrl}/projects?username=${encodeURIComponent(username)}`,
    );
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

  listProjectReports(projectId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/projects/${projectId}/reports`);
  }

  createTest(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/create-test`, payload);
  }

  getGeneratedTestDownloadUrl(filename: string): string {
    return `${this.baseUrl}/generated_tests/${filename}`;
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

  superadminRegister(username: string, password: string, fullName: string = ''): Observable<any> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('full_name', fullName);
    return this.http.post<any>(`${this.baseUrl}/superadmin/register`, formData);
  }

  superadminLogin(username: string, password: string): Observable<any> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    return this.http.post<any>(`${this.baseUrl}/superadmin/login`, formData);
  }

  private getAdminHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_auth_token') : null;
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  superadminListUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/superadmin/users`, this.getAdminHeaders());
  }

  superadminDeleteUser(userId: number): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrl}/superadmin/users/${userId}`,
      this.getAdminHeaders(),
    );
  }

  superadminUpdateUserRole(userId: number, role: string): Observable<any> {
    const formData = new FormData();
    formData.append('role', role);
    return this.http.put<any>(
      `${this.baseUrl}/superadmin/users/${userId}/role`,
      formData,
      this.getAdminHeaders(),
    );
  }

  superadminUpdateUserStatus(userId: number, status: string): Observable<any> {
    const formData = new FormData();
    formData.append('status', status);
    return this.http.put<any>(
      `${this.baseUrl}/superadmin/users/${userId}/status`,
      formData,
      this.getAdminHeaders(),
    );
  }

  superadminGetAnalytics(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/superadmin/analytics`, this.getAdminHeaders());
  }

  // ── Unified Queue & Jenkins REST API ───────────────────────

  getTestQueue(username?: string, statusFilter?: string): Observable<TestQueueItem[]> {
    let url = `${this.baseUrl}/test-queue?`;
    if (username) url += `username=${encodeURIComponent(username)}&`;
    if (statusFilter) url += `status_filter=${encodeURIComponent(statusFilter)}`;
    return this.http.get<TestQueueItem[]>(url);
  }

  getJenkinsLogs(jobName: string, buildNumber: number): Observable<{ logs: string }> {
    return this.http.get<{ logs: string }>(
      `${this.baseUrl}/api/jenkins/logs/${encodeURIComponent(jobName)}/${buildNumber}`,
    );
  }

  getJenkinsConfig(): Observable<JenkinsConfig> {
    return this.http.get<JenkinsConfig>(`${this.baseUrl}/api/jenkins/config`);
  }

  saveJenkinsConfig(
    url: string,
    username: string,
    apiToken: string,
    enabled: boolean = true,
  ): Observable<any> {
    const fd = new FormData();
    fd.append('url', url);
    fd.append('username', username);
    fd.append('api_token', apiToken);
    fd.append('enabled', enabled ? 'true' : 'false');
    return this.http.post<any>(`${this.baseUrl}/api/jenkins/config`, fd);
  }

  testJenkinsConnection(url: string, username: string, apiToken: string): Observable<any> {
    const fd = new FormData();
    fd.append('url', url);
    fd.append('username', username);
    fd.append('api_token', apiToken);
    return this.http.post<any>(`${this.baseUrl}/api/jenkins/test-connection`, fd);
  }

  getDashboardSummary(
    username?: string,
    range: string = 'Last 1 Hour',
    startDate?: string,
    endDate?: string,
  ): Observable<DashboardSummary> {
    const user =
      username || (typeof window !== 'undefined' ? localStorage.getItem('username') || '' : '');
    let url = `${this.baseUrl}/dashboard/summary?username=${encodeURIComponent(user)}&range=${encodeURIComponent(range)}`;
    if (startDate && endDate) {
      url += `&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    }
    return this.http.get<DashboardSummary>(url);
  }

  // Helpers to add log messages to terminal console
  addLog(text: string, type: 'system' | 'success' | 'error' = 'system') {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
    this.terminalLogs.update((logs) => [...logs, { time: timeStr, text, type }]);
  }

  clearLogs() {
    this.terminalLogs.set([]);
  }
}
