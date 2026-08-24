import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard implements OnInit {
  users: any[] = [];
  deletedUsers: any[] = [];
  deletionRequests: any[] = [];
  activeAdminTab: 'users' | 'deleted-users' | 'deletion-requests' = 'users';
  searchQuery: string = '';
  tierFilter: 'all' | 'free' | 'starter' | 'pro' | 'enterprise' = 'all';
  statusFilter: 'all' | 'active' | 'suspended' = 'all';

  isLoading: boolean = false;
  isLoadingDeletedUsers: boolean = false;
  isLoadingDeletionRequests: boolean = false;
  isUpdating: number | null = null;
  isChangingPlan: number | null = null;
  isProcessingDeletion: number | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Selected User Modal
  showUserModal: boolean = false;
  selectedUser: any = null;

  analytics: any = {
    total_users: 0,
    active_users: 0,
    suspended_users: 0,
    free_users: 0,
    starter_users: 0,
    pro_users: 0,
    enterprise_users: 0,
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
  perPage = 8;

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
      this.loadDeletedUsers();
      this.loadAnalytics();
      this.loadDeletionRequests();
    }
  }

  get currentAdminUsername(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('username') || 'admin';
    }
    return 'admin';
  }

  loadAnalytics() {
    this.api.superadminGetAnalytics().subscribe({
      next: (data) => {
        this.analytics = { ...this.analytics, ...data };
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

  onFilterChange() {
    this.page = 1;
    this.cdr.detectChanges();
  }

  filteredUsers() {
    let list = this.users;

    // Search query filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.full_name && u.full_name.toLowerCase().includes(q)) ||
          (u.phone && u.phone.toLowerCase().includes(q)),
      );
    }

    // Tier filter
    if (this.tierFilter !== 'all') {
      list = list.filter((u) => (u.subscription?.plan || 'free').toLowerCase() === this.tierFilter);
    }

    // Status filter
    if (this.statusFilter !== 'all') {
      list = list.filter((u) => u.status === this.statusFilter);
    }

    return list;
  }

  get paginatedUsers(): any[] {
    const start = (this.page - 1) * this.perPage;
    return this.filteredUsers().slice(start, start + this.perPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredUsers().length / this.perPage) || 1;
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

  getInitials(fullName: string, email: string): string {
    if (fullName && fullName.trim()) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  }

  // ── User Details Modal ───────────────────────────────────────

  openUserDetails(user: any) {
    this.selectedUser = user;
    this.showUserModal = true;
    this.cdr.detectChanges();
  }

  closeUserDetails() {
    this.showUserModal = false;
    this.selectedUser = null;
    this.cdr.detectChanges();
  }

  // ── Subscription Tier Management ─────────────────────────────

  onChangeSubscriptionPlan(user: any, newPlan: string) {
    this.isChangingPlan = user.id;
    this.api.superadminUpdateUserSubscription(user.id, newPlan).subscribe({
      next: (res) => {
        const newStatus = newPlan === 'free' ? 'none' : 'active';
        // Update user in list
        if (!user.subscription) {
          user.subscription = { plan: newPlan, status: newStatus };
        } else {
          user.subscription.plan = newPlan;
          user.subscription.status = newStatus;
        }
        // Also update selectedUser in modal if it's the same user
        if (this.selectedUser && this.selectedUser.id === user.id) {
          if (!this.selectedUser.subscription) {
            this.selectedUser.subscription = { plan: newPlan, status: newStatus };
          } else {
            this.selectedUser.subscription.plan = newPlan;
            this.selectedUser.subscription.status = newStatus;
          }
        }
        this.isChangingPlan = null;
        this.successMessage =
          res.message || `User subscription updated to ${newPlan.toUpperCase()}.`;
        this.loadAnalytics();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMessage = null;
          this.cdr.detectChanges();
        }, 3500);
      },
      error: (err) => {
        this.isChangingPlan = null;
        this.errorMessage = err.error?.detail || 'Failed to update subscription tier.';
        this.cdr.detectChanges();
        setTimeout(() => {
          this.errorMessage = null;
          this.cdr.detectChanges();
        }, 4000);
      },
    });
  }

  // ── User Status & Deletion ───────────────────────────────────

  onDeleteUser(user: any) {
    if (this.isCurrentUser(user.username)) {
      alert('You cannot delete yourself!');
      return;
    }

    if (
      confirm(
        `Are you sure you want to permanently delete user "${user.full_name || user.username}"? This will terminate their active sessions and wipe all associated workspaces.`,
      )
    ) {
      this.api.superadminDeleteUser(user.id).subscribe({
        next: () => {
          this.users = this.users.filter((u) => u.id !== user.id);
          this.successMessage = 'User deleted successfully.';
          this.loadAnalytics();
          this.loadDeletedUsers();
          if (this.showUserModal && this.selectedUser?.id === user.id) {
            this.closeUserDetails();
          }
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
        this.successMessage = `User account is now ${newStatus.toUpperCase()}.`;
        this.loadAnalytics();
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
      'User ID',
      'Full Name',
      'Email / Username',
      'Phone',
      'Role',
      'Account Status',
      'Subscription Tier',
      'Subscription Status',
      'Registration Date',
      'Last Login',
      'Workspaces',
      'Files Uploaded',
      'Test Runs',
      'Street Address',
      'City',
      'Country',
    ];

    const rows = this.filteredUsers().map((u) => [
      u.id,
      u.full_name || '',
      u.username,
      u.phone || '',
      u.role || 'user',
      u.status || 'active',
      (u.subscription?.plan || 'free').toUpperCase(),
      u.subscription?.status || 'none',
      u.created_at || '',
      u.last_login_at || '',
      u.workspace_count || 0,
      u.file_count || 0,
      u.run_count || 0,
      u.address?.street || '',
      u.address?.city || '',
      u.address?.country || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      'download',
      `perfanalyzer_users_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Deletion Request Moderation Methods ──────────────────────

  loadDeletionRequests() {
    this.isLoadingDeletionRequests = true;
    this.api.superadminGetDeletionRequests().subscribe({
      next: (data) => {
        this.deletionRequests = data;
        this.isLoadingDeletionRequests = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingDeletionRequests = false;
        console.error('Failed to load deletion requests:', err);
      },
    });
  }

  approveDeletion(req: any) {
    if (
      !confirm(
        `Are you sure you want to approve the deletion request and permanently delete user "${req.username}"? This will terminate all active sessions immediately.`,
      )
    ) {
      return;
    }

    this.isProcessingDeletion = req.id;
    this.api.superadminApproveDeletionRequest(req.id).subscribe({
      next: (res) => {
        this.isProcessingDeletion = null;
        this.successMessage = res.message || `User account "${req.username}" successfully deleted.`;
        this.loadDeletionRequests();
        this.loadUsers();
        this.loadDeletedUsers();
        this.loadAnalytics();
        setTimeout(() => {
          this.successMessage = null;
          this.cdr.detectChanges();
        }, 4000);
      },
      error: (err) => {
        this.isProcessingDeletion = null;
        this.errorMessage = err.error?.detail || 'Failed to approve deletion request.';
        this.cdr.detectChanges();
      },
    });
  }

  rejectDeletion(req: any) {
    if (!confirm(`Are you sure you want to reject the deletion request for "${req.username}"?`)) {
      return;
    }

    this.isProcessingDeletion = req.id;
    this.api.superadminRejectDeletionRequest(req.id).subscribe({
      next: (res) => {
        this.isProcessingDeletion = null;
        this.successMessage = res.message || 'Deletion request rejected.';
        this.loadDeletionRequests();
        setTimeout(() => {
          this.successMessage = null;
          this.cdr.detectChanges();
        }, 4000);
      },
      error: (err) => {
        this.isProcessingDeletion = null;
        this.errorMessage = err.error?.detail || 'Failed to reject deletion request.';
        this.cdr.detectChanges();
      },
    });
  }

  loadDeletedUsers() {
    this.isLoadingDeletedUsers = true;
    this.api.superadminGetDeletedUsers().subscribe({
      next: (data) => {
        this.deletedUsers = data;
        this.isLoadingDeletedUsers = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingDeletedUsers = false;
        console.error('Failed to load deleted users:', err);
      },
    });
  }

  onLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_auth_token');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      this.router.navigate(['/admin/login']);
    }
  }
}
