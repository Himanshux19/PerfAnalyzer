import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Navbar } from '../navbar/navbar';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-reports-history',
  imports: [Navbar, FormsModule],
  templateUrl: './reports-history.html',
  styleUrl: './reports-history.css'
})
export class ReportsHistory implements OnInit {
  reports: any[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  isRefreshing: boolean = false;
  errorMessage: string | null = null;

  constructor(protected api: ApiService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Session Guard check
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }
    }
    this.loadReports();
  }

  loadReports(sync = false) {
    if (sync) {
      this.isRefreshing = true;
    } else {
      this.isLoading = true;
    }
    this.errorMessage = null;
    this.api.listReports(sync).subscribe({
      next: (data) => {
        this.reports = data;
        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load reports:', err);
        this.errorMessage = 'Failed to load historical reports. Please make sure the backend is running.';
        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      }
    });
  }

  filteredReports() {
    if (!this.searchQuery.trim()) {
      return this.reports;
    }
    const q = this.searchQuery.toLowerCase().trim();
    return this.reports.filter(r => r.test_name.toLowerCase().includes(q));
  }

  onDeleteReport(testName: string) {
    if (confirm(`Are you sure you want to delete the report for test: ${testName}?`)) {
      this.api.deleteReport(testName).subscribe({
        next: () => {
          this.reports = this.reports.filter(r => r.test_name !== testName);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to delete report:', err);
          alert('Failed to delete report. Please try again.');
          this.cdr.detectChanges();
        }
      });
    }
  }

  getSuccessCount() {
    return this.reports.filter(r => r.status === 'success').length;
  }

  getFailedCount() {
    return this.reports.filter(r => r.status === 'failed' || r.status === 'error').length;
  }
}
