import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, DashboardSummary } from '../../api.service';

@Component({
  selector: 'app-overview-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './overview-dashboard.html',
  styleUrl: './overview-dashboard.css',
})
export class OverviewDashboard implements OnInit, OnDestroy {
  private pollingTimer: any = null;
  loading = true;
  apiError = false;
  selectedTimeframe = 'All Time';
  selectedDateRange = 'All Time';

  // Chart Metric Toggles
  showUsers = true;
  showThroughput = true;
  showResponseTime = true;
  showErrorRate = true;

  // Manual Duration State
  showManualDateModal = false;
  manualStartDate = '';
  manualEndDate = '';

  summaryData: DashboardSummary = {
    kpis: {
      total_tests: 0,
      total_tests_trend: '0 in range',
      tests_run: 0,
      tests_run_trend: '0 completed',
      scheduled_tests: 0,
      scheduled_tests_sub: '0 active now',
      success_rate: 0,
      success_rate_trend: '0% rate',
      failed_tests: 0,
      failed_tests_trend: '0 failed',
    },
    recent_runs: [],
    active_tests: [],
    scheduled_tests: [],
    recent_reports: [],
    status_summary: {
      completed: 0,
      completed_pct: 0,
      running: 0,
      running_pct: 0,
      failed: 0,
      failed_pct: 0,
      scheduled: 0,
      scheduled_pct: 0,
      total_tests: 0,
    },
    performance_overview: [],
    performance_snapshot: {
      avg_response_time: 0,
      p95_response_time: 0,
      avg_throughput: 0,
      total_requests: 0,
      rt_series: [],
      tput_series: [],
    },
    timestamp: new Date().toISOString(),
  };

  // SVG Chart paths
  usersPath = '';
  throughputPath = '';
  rtPath = '';
  errorPath = '';
  rtSparklinePath = '';
  tputSparklinePath = '';

  // Donut chart
  completedDash = '0, 100';
  runningDash = '0, 100';
  failedDash = '0, 100';
  scheduledDash = '0, 100';

  activeActionMenuId: string | null = null;

  yAxisLabels = { top: '1000', midTop: '750', mid: '500', midLow: '250', bottom: '0' };

  constructor(
    protected api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }
      this.fetchData();
      // Poll every 15 seconds (not 4s — avoids spamming the server)
      this.pollingTimer = setInterval(() => this.fetchData(false), 15000);
    }
  }

  fetchData(showLoader = true): void {
    if (showLoader) this.loading = true;
    this.apiError = false;

    const startIso = this.manualStartDate
      ? new Date(this.manualStartDate).toISOString()
      : undefined;
    const endIso = this.manualEndDate ? new Date(this.manualEndDate).toISOString() : undefined;

    this.api.getDashboardSummary(undefined, this.selectedTimeframe, startIso, endIso).subscribe({
      next: (res) => {
        if (res) {
          this.summaryData = res;
          this.computeChartPaths();
          this.computeDonutDashArrays();
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Dashboard fetch error:', err);
        this.apiError = true;
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  toggleMetric(metric: string): void {
    if (metric === 'users') this.showUsers = !this.showUsers;
    if (metric === 'tput') this.showThroughput = !this.showThroughput;
    if (metric === 'rt') this.showResponseTime = !this.showResponseTime;
    if (metric === 'err') this.showErrorRate = !this.showErrorRate;
  }

  onTimeframeChange(tf: string): void {
    this.selectedTimeframe = tf;
    if (tf === 'Custom Range') {
      this.showManualDateModal = true;
    } else {
      this.fetchData(true);
    }
  }

  onDateRangeChange(rangeVal: string): void {
    this.selectedDateRange = rangeVal;
    this.selectedTimeframe = rangeVal;
    if (rangeVal === 'Custom Range') {
      this.showManualDateModal = true;
    } else {
      this.fetchData(true);
    }
  }

  applyManualDuration(): void {
    this.showManualDateModal = false;
    this.fetchData(true);
  }

  closeManualModal(): void {
    this.showManualDateModal = false;
  }

  computeDonutDashArrays(): void {
    const s = this.summaryData.status_summary;
    if (!s || s.total_tests === 0) {
      this.completedDash = '0, 100';
      this.runningDash = '0, 100';
      this.failedDash = '0, 100';
      this.scheduledDash = '0, 100';
      return;
    }
    const c = +(s.completed_pct || 0);
    const r = +(s.running_pct || 0);
    const f = +(s.failed_pct || 0);
    const sch = +(s.scheduled_pct || 0);

    this.completedDash = `${c.toFixed(1)}, ${(100 - c).toFixed(1)}`;
    this.runningDash = `${r.toFixed(1)}, ${(100 - r).toFixed(1)}`;
    this.failedDash = `${f.toFixed(1)}, ${(100 - f).toFixed(1)}`;
    this.scheduledDash = `${sch.toFixed(1)}, ${(100 - sch).toFixed(1)}`;
  }

  computeChartPaths(): void {
    const pts = this.summaryData.performance_overview || [];
    if (pts.length < 2) {
      this.usersPath = '';
      this.throughputPath = '';
      this.rtPath = '';
      this.errorPath = '';
      this.computeSparklines();
      return;
    }

    // SVG viewBox: 0 0 800 180 — chart area with padding
    const W = 800,
      H = 180;
    const padX = 40,
      padY = 15;
    const chartW = W - padX * 2; // 720
    const chartH = H - padY * 2; // 150

    const stepX = chartW / (pts.length - 1);

    // Independent scaling for each metric
    const rawMaxUsers = Math.max(...pts.map((p) => p.users || 0), 10);
    const rawMaxTput = Math.max(...pts.map((p) => p.throughput || 0), 10);
    const rawMaxRt = Math.max(...pts.map((p) => p.avg_rt || 0), 100);
    const rawMaxErr = Math.max(...pts.map((p) => p.error_rate || 0), 1);

    const maxUsers = Math.max(Math.ceil((rawMaxUsers * 1.2) / 10) * 10, 50);
    const maxTput = Math.max(Math.ceil((rawMaxTput * 1.2) / 10) * 10, 50);
    const maxRt = Math.max(Math.ceil((rawMaxRt * 1.2) / 100) * 100, 500);
    const maxErr = Math.max(Math.ceil(rawMaxErr * 1.2), 5);

    this.yAxisLabels = {
      top: `${maxRt}`,
      midTop: `${Math.round(maxRt * 0.75)}`,
      mid: `${Math.round(maxRt * 0.5)}`,
      midLow: `${Math.round(maxRt * 0.25)}`,
      bottom: '0',
    };

    const getY = (val: number, maxVal: number): number => {
      const n = Math.min(Math.max(val / maxVal, 0), 1);
      return H - padY - n * chartH;
    };

    const uPts: string[] = [],
      tPts: string[] = [],
      rPts: string[] = [],
      ePts: string[] = [];
    pts.forEach((p, idx) => {
      const x = padX + idx * stepX;
      uPts.push(`${x.toFixed(1)},${getY(p.users, maxUsers).toFixed(1)}`);
      tPts.push(`${x.toFixed(1)},${getY(p.throughput, maxTput).toFixed(1)}`);
      rPts.push(`${x.toFixed(1)},${getY(p.avg_rt, maxRt).toFixed(1)}`);
      ePts.push(`${x.toFixed(1)},${getY(p.error_rate, maxErr).toFixed(1)}`);
    });

    this.usersPath = uPts.join(' ');
    this.throughputPath = tPts.join(' ');
    this.rtPath = rPts.join(' ');
    this.errorPath = ePts.join(' ');

    this.computeSparklines();
  }

  computeSparklines(): void {
    const snap = this.summaryData.performance_snapshot;
    const rtVals = snap?.rt_series || [];
    const tputVals = snap?.tput_series || [];
    this.rtSparklinePath = this.generateSparkline(rtVals, 140, 32);
    this.tputSparklinePath = this.generateSparkline(tputVals, 140, 32);
  }

  generateSparkline(values: number[], w: number, h: number): string {
    if (!values || values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = w / (values.length - 1);
    return values
      .map((val, idx) => {
        const x = idx * step;
        const y = h - ((val - min) / range) * (h - 6) - 3;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  toggleActionMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.activeActionMenuId = this.activeActionMenuId === id ? null : id;
  }

  closeActionMenus(): void {
    this.activeActionMenuId = null;
  }

  onViewReport(testName: string): void {
    const url = this.api.getReportViewUrl(testName);
    window.open(url, '_blank');
  }

  onViewLogs(testName: string): void {
    this.router.navigate(['/queue']);
  }

  onRerunTest(testName: string): void {
    this.router.navigate(['/create-test']);
  }

  getStatusBadgeClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'running' || s === 'queued') return 'badge-running';
    if (s === 'success' || s === 'completed') return 'badge-success';
    if (s === 'failed' || s === 'error') return 'badge-failed';
    if (s === 'scheduled') return 'badge-scheduled';
    return 'bg-status-neutral';
  }

  ngOnDestroy(): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
  }
}
