import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard implements OnInit {
  users: any[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  isUpdating: number | null = null; // Stores userId when updating role
  errorMessage: string | null = null;
  successMessage: string | null = null;
  analytics: any = {
    total_users: 0,
    total_workspaces: 0,
    workspaces_this_week: 0,
    workspaces_this_month: 0,
    total_files: 0,
    files_this_week: 0,
    files_this_month: 0,
    total_test_runs: 0,
  };

  // Pagination
  page = 1;
  perPage = 10;

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_auth_token');
      if (!token) {
        this.router.navigate(['/admin/login']);
        return;
      }
      this.loadUsers();
      this.loadAnalytics();
    }
  }

  loadAnalytics() {
    this.api.superadminGetAnalytics().subscribe({
      next: (data) => {
        this.analytics = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load analytics:', err);
      },
    });
  }

  isCurrentUser(username: string): boolean {
    if (typeof window !== 'undefined') {
      return username === localStorage.getItem('username');
    }
    return false;
  }

  loadUsers() {
    this.isLoading = true;
    this.errorMessage = null;
    this.api.superadminListUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load users:', err);
        this.errorMessage =
          err.error?.detail ||
          'Failed to load users list. Make sure you are authenticated as Super Admin.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onSearchQueryChange() {
    this.page = 1;
    this.cdr.detectChanges();
  }

  filteredUsers() {
    if (!this.searchQuery.trim()) {
      return this.users;
    }
    const q = this.searchQuery.toLowerCase().trim();
    return this.users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)),
    );
  }

  get paginatedUsers(): any[] {
    const start = (this.page - 1) * this.perPage;
    return this.filteredUsers().slice(start, start + this.perPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredUsers().length / this.perPage);
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

  onDeleteUser(user: any) {
    if (this.isCurrentUser(user.username)) {
      alert('You cannot delete yourself!');
      return;
    }

    if (confirm(`Are you sure you want to delete user "${user.full_name || user.username}"?`)) {
      this.api.superadminDeleteUser(user.id).subscribe({
        next: () => {
          this.users = this.users.filter((u) => u.id !== user.id);
          this.successMessage = 'User deleted successfully.';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          console.error('Failed to delete user:', err);
          alert(err.error?.detail || 'Failed to delete user.');
          this.cdr.detectChanges();
        },
      });
    }
  }

  onChangeRole(user: any, newRole: string) {
    if (this.isCurrentUser(user.username)) {
      alert('You cannot change your own role!');
      return;
    }

    this.isUpdating = user.id;
    this.api.superadminUpdateUserRole(user.id, newRole).subscribe({
      next: () => {
        user.role = newRole;
        this.isUpdating = null;
        this.successMessage = `User role updated to ${newRole}.`;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMessage = null;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err) => {
        console.error('Failed to update role:', err);
        alert(err.error?.detail || 'Failed to update user role.');
        this.isUpdating = null;
        this.cdr.detectChanges();
      },
    });
  }

  onToggleStatus(user: any) {
    if (this.isCurrentUser(user.username)) {
      alert('You cannot suspend yourself!');
      return;
    }

    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    this.isUpdating = user.id;
    this.api.superadminUpdateUserStatus(user.id, newStatus).subscribe({
      next: () => {
        user.status = newStatus;
        this.isUpdating = null;
        this.successMessage = `User account is now ${newStatus}.`;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMessage = null;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err) => {
        console.error('Failed to toggle status:', err);
        alert(err.error?.detail || 'Failed to update user status.');
        this.isUpdating = null;
        this.cdr.detectChanges();
      },
    });
  }

  exportToCSV() {
    if (this.users.length === 0) {
      alert('No user data to export.');
      return;
    }

    const headers = [
      'ID',
      'Full Name',
      'Email/Username',
      'Role',
      'Status',
      'Registration Date',
      'Workspaces',
      'Files',
      'Runs',
    ];
    const rows = this.users.map((u) => [
      u.id,
      u.full_name || 'No name',
      u.username,
      u.role || 'user',
      u.status || 'active',
      u.created_at || '',
      u.workspace_count || 0,
      u.file_count || 0,
      u.run_count || 0,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'users_list.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
