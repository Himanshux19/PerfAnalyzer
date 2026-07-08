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

  // Pagination
  page = 1;
  perPage = 7;

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
    this.page = 1; // Reset to page 1 on reload
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

  onSearchQueryChange() {
    this.page = 1;
    this.cdr.detectChanges();
  }

  filteredReports() {
    if (!this.searchQuery.trim()) {
      return this.reports;
    }
    const q = this.searchQuery.toLowerCase().trim();
    return this.reports.filter(r => r.test_name.toLowerCase().includes(q));
  }

  get paginatedReports(): any[] {
    const start = (this.page - 1) * this.perPage;
    return this.filteredReports().slice(start, start + this.perPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredReports().length / this.perPage);
  }

  get pageNumbers(): number[] {
    const pages = this.totalPages;
    return Array.from({ length: pages }, (_, i) => i + 1);
  }

  setPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.page = page;
    this.cdr.detectChanges();
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
