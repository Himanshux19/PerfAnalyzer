import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-admin-auth',
  imports: [FormsModule],
  templateUrl: './admin-auth.html',
  styleUrl: './admin-auth.css'
})
export class AdminAuth {
  isLoading = false;

  // Login bindings
  loginUsername = '';
  loginPassword = '';

  // Form feedback alert states
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(private api: ApiService, private router: Router, private cdr: ChangeDetectorRef) {
    // Skip login if already authenticated as admin
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth_token')) {
      this.router.navigate(['/admin/dashboard']);
    }
  }

  clearMessages() {
    this.errorMessage = null;
    this.successMessage = null;
  }

  onSubmitLogin(event: Event) {
    event.preventDefault();
    this.clearMessages();

    if (!this.loginUsername || !this.loginPassword) {
      this.errorMessage = 'Please enter both username and password.';
      return;
    }

    this.isLoading = true;
    this.api.superadminLogin(this.loginUsername.trim().toLowerCase(), this.loginPassword).subscribe({
      next: (res) => {
        this.isLoading = false;
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('admin_auth_token', res.token);
        localStorage.setItem('username', res.username);
        localStorage.setItem('full_name', res.full_name || '');
        localStorage.setItem('role', 'superadmin');
        this.successMessage = 'Super Admin login successful! Redirecting...';
        this.cdr.detectChanges();
        setTimeout(() => {
          this.router.navigate(['/admin/dashboard']);
        }, 1000);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || err.message || 'Super Admin authentication failed.';
        this.cdr.detectChanges();
      }
    });
  }
}
