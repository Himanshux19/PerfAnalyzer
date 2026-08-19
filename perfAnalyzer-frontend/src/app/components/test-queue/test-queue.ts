import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService, TestQueueItem } from '../../api.service';

@Component({
  selector: 'app-test-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './test-queue.html',
  styleUrl: './test-queue.css',
})
export class TestQueue implements OnInit, OnDestroy {
  queueItems: TestQueueItem[] = [];
  isLoading = false;
  isRefreshing = false;
  errorMessage: string | null = null;

  // Filters
  searchQuery = '';
  statusFilter = 'all';

  // Auto-refresh
  autoRefresh = true;
  private refreshInterval: any;
  lastRefreshed: Date | null = null;

  // Pagination
  page = 1;
  perPage = 10;

  // ── Log Modal ──────────────────────────────────────────────
  showLogModal = false;
  selectedLogItem: TestQueueItem | null = null;
  logContent = '';
  isLoadingLogs = false;
  logSearchQuery = '';
  logAutoScroll = true;

  // ── Details Modal ──────────────────────────────────────────
  showDetailsModal = false;
  selectedDetailsItem: TestQueueItem | null = null;

  projectIdFilter: number | null = null;
  filterByWorkspace = true;

  get currentProjectId(): number | null {
    return this.projectIdFilter || this.api.selectedProjectId() || null;
  }

  toggleWorkspaceFilter() {
    this.filterByWorkspace = !this.filterByWorkspace;
    this.cdr.detectChanges();
  }

  constructor(
    protected api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }
    }

    this.route.queryParams.subscribe((params) => {
      if (params['projectId']) {
        this.projectIdFilter = Number(params['projectId']);
      } else {
        this.projectIdFilter = null;
      }
      this.loadQueue(false);
    });

    this.refreshInterval = setInterval(() => {
      if (this.autoRefresh && !this.showLogModal && !this.showDetailsModal) {
        this.loadQueue(true);
      }
    }, 1000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  getCurrentUsername(): string | undefined {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('username');
      if (user && user.trim()) return user.trim();
    }
    return undefined;
  }

  loadQueue(isBackground = false) {
    if (!isBackground) {
      this.isLoading = true;
    } else {
      this.isRefreshing = true;
    }
    this.errorMessage = null;

    const username = this.getCurrentUsername();

    this.api
      .getTestQueue(username, this.statusFilter === 'all' ? undefined : this.statusFilter)
      .subscribe({
        next: (items) => {
          this.queueItems = items;
          this.lastRefreshed = new Date();
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorMessage = 'Unable to fetch queue. Is the PerfAnalyzer backend running?';
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.detectChanges();
        },
      });
  }

  setStatusFilter(f: string) {
    this.statusFilter = f;
    this.page = 1;
    this.loadQueue(false);
  }

  get userItems(): TestQueueItem[] {
    const currentUser = this.getCurrentUsername();
    let items = this.queueItems;
    if (currentUser && currentUser.toLowerCase() !== 'admin') {
      items = items.filter((i) => (i.username || '').toLowerCase() === currentUser.toLowerCase());
    }
    const pid = this.currentProjectId;
    if (pid && this.filterByWorkspace) {
      items = items.filter((i) => i.project_id === pid);
    }
    return items;
  }

  get filteredItems(): TestQueueItem[] {
    return this.userItems.filter((item) => {
      const st = (item.status || '').toLowerCase();
      if (this.statusFilter !== 'all') {
        if (this.statusFilter === 'running' && st !== 'running' && st !== 'building') return false;
        if (this.statusFilter === 'queued' && st !== 'queued') return false;
        if (this.statusFilter === 'success' && st !== 'success' && st !== 'completed') return false;
        if (
          this.statusFilter === 'error' &&
          st !== 'error' &&
          st !== 'failed' &&
          st !== 'failure' &&
          st !== 'aborted'
        )
          return false;
      }
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        if (
          !item.test_name.toLowerCase().includes(q) &&
          !item.username.toLowerCase().includes(q) &&
          !(item.project_name || '').toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }

  get paginatedItems(): TestQueueItem[] {
    const s = (this.page - 1) * this.perPage;
    return this.filteredItems.slice(s, s + this.perPage);
  }

  get totalPages() {
    return Math.ceil(this.filteredItems.length / this.perPage) || 1;
  }
  get pageNumbers() {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  setPage(p: number) {
    if (p >= 1 && p <= this.totalPages) {
      this.page = p;
      this.cdr.detectChanges();
    }
  }

  // KPI counts
  get totalCount() {
    return this.userItems.length;
  }
  get runningCount() {
    return this.userItems.filter((i) => i.status === 'running' || i.status === 'building').length;
  }
  get queuedCount() {
    return this.userItems.filter((i) => i.status === 'queued').length;
  }
  get successCount() {
    return this.userItems.filter((i) => i.status === 'success' || i.status === 'completed').length;
  }
  get failedCount() {
    return this.userItems.filter(
      (i) =>
        i.status === 'error' ||
        i.status === 'failed' ||
        i.status === 'failure' ||
        i.status === 'aborted',
    ).length;
  }

  // ── Status helpers ──────────────────────────────────────────
  getStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'running' || s === 'building') return 'badge-running';
    if (s === 'queued') return 'badge-queued';
    if (s === 'success' || s === 'completed') return 'badge-success';
    if (s === 'error' || s === 'failed' || s === 'failure' || s === 'aborted')
      return 'badge-failed';
    return 'badge-secondary';
  }

  getStatusIcon(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'running' || s === 'building') return 'bi bi-play-circle-fill';
    if (s === 'queued') return 'bi bi-clock-history';
    if (s === 'success' || s === 'completed') return 'bi bi-check-circle-fill';
    if (s === 'error' || s === 'failed' || s === 'failure' || s === 'aborted')
      return 'bi bi-x-circle-fill';
    return 'bi bi-dash-circle';
  }

  isRunning(status: string): boolean {
    const s = (status || '').toLowerCase();
    return s === 'running' || s === 'building';
  }

  isSuccess(item: TestQueueItem): boolean {
    const s = (item.status || '').toLowerCase();
    return (s === 'success' || s === 'completed') && item.has_report;
  }

  // ── Log Modal ───────────────────────────────────────────────
  openLogModal(item: TestQueueItem) {
    this.selectedLogItem = item;
    this.showLogModal = true;
    this.isLoadingLogs = true;
    this.logContent = '';
    this.logSearchQuery = '';

    if (item.source === 'jenkins' && item.job_name && item.build_number) {
      this.api.getJenkinsLogs(item.job_name, item.build_number).subscribe({
        next: (res) => {
          this.logContent = res.logs || '[No console output returned from build execution]';
          this.isLoadingLogs = false;
          this.cdr.detectChanges();
          if (this.logAutoScroll) this.scrollTerminalToBottom();
        },
        error: (err) => {
          this.logContent = `[Failed to fetch console log]\n${err.message || err.statusText || 'Connection error'}`;
          this.isLoadingLogs = false;
          this.cdr.detectChanges();
        },
      });
    } else if (item.status === 'queued') {
      this.logContent =
        '[Test is waiting in execution queue — no build logs yet]\nRefresh once the build starts.';
      this.isLoadingLogs = false;
      this.cdr.detectChanges();
    } else {
      this.api.getTestStatus(item.test_name).subscribe({
        next: (res) => {
          this.logContent =
            res.jmeter_log ||
            res.bzt_log ||
            (res.error ? `[ERROR]\n${res.error}` : '[No local log data available for this run]');
          this.isLoadingLogs = false;
          this.cdr.detectChanges();
          if (this.logAutoScroll) this.scrollTerminalToBottom();
        },
        error: () => {
          this.logContent = '[Error fetching local test logs]';
          this.isLoadingLogs = false;
          this.cdr.detectChanges();
        },
      });
    }
  }

  closeLogModal() {
    this.showLogModal = false;
    this.selectedLogItem = null;
  }

  refreshLogs() {
    if (this.selectedLogItem) this.openLogModal(this.selectedLogItem);
  }

  scrollTerminalToBottom() {
    setTimeout(() => {
      const el = document.getElementById('terminal-viewport');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  get filteredLogLines(): string[] {
    const lines = (this.logContent || '').split('\n');
    if (!this.logSearchQuery.trim()) return lines;
    const q = this.logSearchQuery.toLowerCase();
    return lines.filter((l) => l.toLowerCase().includes(q));
  }

  get formattedTerminalLogs(): any[] {
    if (!this.logContent) return [];
    const lines = this.logContent.split('\n');
    const filtered = this.logSearchQuery.trim()
      ? lines.filter((l) => l.toLowerCase().includes(this.logSearchQuery.toLowerCase()))
      : lines;

    return filtered.map((line) => {
      const match = line.match(
        /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2},\d{3})\s+([A-Z]+)\s+([a-zA-Z0-9\.\$\_]+:)?\s*(.*)$/,
      );
      if (match) {
        return {
          date: match[1],
          time: match[2],
          level: match[3],
          category: match[4] || '',
          message: match[5],
          raw: null,
        };
      } else {
        return {
          date: null,
          time: null,
          level: null,
          category: null,
          message: null,
          raw: line,
        };
      }
    });
  }

  copyLogs() {
    if (navigator.clipboard) navigator.clipboard.writeText(this.logContent);
  }

  downloadLogs() {
    if (!this.selectedLogItem) return;
    const blob = new Blob([this.logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.selectedLogItem.test_name}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Graph Helpers for Execution Details Modal ──────────────
  getDetailsRpsHistory(): number[] {
    if (!this.selectedDetailsItem) return [];
    if (this.isRunning(this.selectedDetailsItem.status) && this.api.rpsHistory().length > 0) {
      return this.api.rpsHistory();
    }
    const targetRps = this.selectedDetailsItem.throughput || 0;
    if (targetRps <= 0) return [0, 0, 0, 0, 0];
    const ramp = Math.max(1, Math.min(5, Math.floor((this.selectedDetailsItem.ramp_up || 10) / 2)));
    const points = [0];
    for (let i = 1; i <= ramp; i++) {
      points.push(Math.round(((targetRps * i) / ramp) * 10) / 10);
    }
    for (let i = 0; i < 8; i++) {
      const variation = (Math.sin(i * 1.2) * 0.08 + 1) * targetRps;
      points.push(Math.round(variation * 10) / 10);
    }
    points.push(Math.round(targetRps * 0.4 * 10) / 10);
    return points;
  }

  getDetailsRtHistory(): number[] {
    if (!this.selectedDetailsItem) return [];
    if (this.isRunning(this.selectedDetailsItem.status) && this.api.rtHistory().length > 0) {
      return this.api.rtHistory();
    }
    const targetRt = this.selectedDetailsItem.avg_rt || 0;
    if (targetRt <= 0) return [0, 0, 0, 0, 0];
    const points: number[] = [];
    const baseRps = this.getDetailsRpsHistory();
    for (let i = 0; i < baseRps.length; i++) {
      const loadFactor =
        baseRps[i] > 0 ? baseRps[i] / (this.selectedDetailsItem.throughput || 1) : 0.2;
      const val = Math.round(targetRt * (0.7 + 0.3 * loadFactor + Math.sin(i * 0.9) * 0.05));
      points.push(val);
    }
    return points;
  }

  getDetailsErrorHistory(): number[] {
    if (!this.selectedDetailsItem) return [];
    if (this.isRunning(this.selectedDetailsItem.status) && this.api.errorHistory().length > 0) {
      return this.api.errorHistory();
    }
    const err = this.selectedDetailsItem.error_rate || 0;
    const len = this.getDetailsRpsHistory().length;
    if (err <= 0) return new Array(len).fill(0);
    return new Array(len).fill(err);
  }

  getDetailsRpsMax(): number {
    const h = this.getDetailsRpsHistory();
    return Math.max(...h, 10);
  }

  getDetailsRpsMiddle(): number {
    return Math.round((this.getDetailsRpsMax() / 2) * 10) / 10;
  }

  getDetailsRtMax(): number {
    const h = this.getDetailsRtHistory();
    return Math.max(...h, 100);
  }

  getDetailsRtMiddle(): number {
    return Math.round(this.getDetailsRtMax() / 2);
  }

  getDetailsRpsPath(): string {
    const history = this.getDetailsRpsHistory();
    if (history.length < 2) return 'M 35,90 L 245,90';
    const maxVal = this.getDetailsRpsMax();
    return history
      .map((val, i) => {
        const x = 35 + i * (210 / (history.length - 1));
        const y = 90 - (val / maxVal) * 80;
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
  }

  getDetailsRpsAreaPath(): string {
    const history = this.getDetailsRpsHistory();
    if (history.length < 2) return 'M 35,90 L 245,90 L 245,90 L 35,90 Z';
    const maxVal = this.getDetailsRpsMax();
    const linePath = history
      .map((val, i) => {
        const x = 35 + i * (210 / (history.length - 1));
        const y = 90 - (val / maxVal) * 80;
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
    return `${linePath} L 245,90 L 35,90 Z`;
  }

  getDetailsRtPath(): string {
    const history = this.getDetailsRtHistory();
    if (history.length < 2) return 'M 35,90 L 245,90';
    const maxVal = this.getDetailsRtMax();
    return history
      .map((val, i) => {
        const x = 35 + i * (210 / (history.length - 1));
        const y = 90 - (val / maxVal) * 80;
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
  }

  getDetailsRtAreaPath(): string {
    const history = this.getDetailsRtHistory();
    if (history.length < 2) return 'M 35,90 L 245,90 L 245,90 L 35,90 Z';
    const maxVal = this.getDetailsRtMax();
    const linePath = history
      .map((val, i) => {
        const x = 35 + i * (210 / (history.length - 1));
        const y = 90 - (val / maxVal) * 80;
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
    return `${linePath} L 245,90 L 35,90 Z`;
  }

  getDetailsErrorPath(): string {
    const history = this.getDetailsErrorHistory();
    if (history.length < 2) return 'M 35,90 L 245,90';
    const maxVal = Math.max(...history, 1);
    return history
      .map((val, i) => {
        const x = 35 + i * (210 / (history.length - 1));
        const y = 90 - (val / maxVal) * 80;
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
  }

  getDetailsTimeLabels(): string[] {
    const totalSec =
      (this.selectedDetailsItem?.duration || 60) + (this.selectedDetailsItem?.ramp_up || 10);
    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.round(s % 60);
      return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };
    return [fmt(0), fmt(totalSec * 0.33), fmt(totalSec * 0.66), fmt(totalSec)];
  }

  // ── Wide Graph Path Generators (viewBox 0 0 450 140, x: 45->435, y: 15->105) ──
  getWideRpsMax(): number {
    return this.getDetailsRpsMax();
  }
  getWideRpsMiddle(): number {
    return this.getDetailsRpsMiddle();
  }
  getWideRtMax(): number {
    return this.getDetailsRtMax();
  }
  getWideRtMiddle(): number {
    return this.getDetailsRtMiddle();
  }

  getWideRpsPath(): string {
    const history = this.getDetailsRpsHistory();
    if (history.length < 2) return 'M 45,105 L 435,105';
    const maxVal = this.getWideRpsMax();
    return history
      .map((val, i) => {
        const x = 45 + i * (390 / (history.length - 1));
        const y = 105 - (val / maxVal) * 90;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  getWideRpsAreaPath(): string {
    const history = this.getDetailsRpsHistory();
    if (history.length < 2) return 'M 45,105 L 435,105 L 435,105 L 45,105 Z';
    const linePath = this.getWideRpsPath();
    return `${linePath} L 435,105 L 45,105 Z`;
  }

  getWideRtPath(): string {
    const history = this.getDetailsRtHistory();
    if (history.length < 2) return 'M 45,105 L 435,105';
    const maxVal = this.getWideRtMax();
    return history
      .map((val, i) => {
        const x = 45 + i * (390 / (history.length - 1));
        const y = 105 - (val / maxVal) * 90;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  getWideRtAreaPath(): string {
    const history = this.getDetailsRtHistory();
    if (history.length < 2) return 'M 45,105 L 435,105 L 435,105 L 45,105 Z';
    const linePath = this.getWideRtPath();
    return `${linePath} L 435,105 L 45,105 Z`;
  }

  getWideErrorPath(): string {
    const history = this.getDetailsErrorHistory();
    if (history.length < 2) return 'M 45,105 L 435,105';
    const maxVal = Math.max(...history, 1);
    return history
      .map((val, i) => {
        const x = 45 + i * (390 / (history.length - 1));
        const y = 105 - (val / maxVal) * 90;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  getLogLineClass(line: string): string {
    const l = line.toLowerCase();
    if (l.includes('error') || l.includes('fail') || l.includes('exception')) return 'log-error';
    if (l.includes('warn')) return 'log-warn';
    if (l.includes('success') || l.includes('passed') || l.includes('completed'))
      return 'log-success';
    if (l.includes('info') || l.includes('stage') || l.includes('step')) return 'log-info';
    return '';
  }

  // ── Details Modal ───────────────────────────────────────────
  openDetailsModal(item: TestQueueItem) {
    this.selectedDetailsItem = item;
    this.showDetailsModal = true;
  }
  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedDetailsItem = null;
  }

  // ── Open HTML Report ────────────────────────────────────────
  openReport(item: TestQueueItem) {
    window.open(this.api.getReportViewUrl(item.test_name), '_blank');
  }

  openJenkins(item: TestQueueItem) {
    if (item.jenkins_url) window.open(item.jenkins_url, '_blank');
  }

  get lastRefreshedStr(): string {
    if (!this.lastRefreshed) return '';
    return this.lastRefreshed.toLocaleTimeString();
  }
}
