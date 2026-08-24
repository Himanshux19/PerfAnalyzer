import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-auth',
  imports: [FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth {
  isLoginMode = true;
  isLoading = false;

  // Login bindings
  loginUsername = '';
  loginPassword = '';

  // Registration bindings
  regUsername = '';
  regPassword = '';
  regConfirmPassword = '';
  regFullName = '';

  // Form feedback alert states
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    // Skip login if already authenticated
    if (typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
      this.router.navigate(['/dashboard']);
    }
  }

  toggleMode(isLogin: boolean) {
    this.isLoginMode = isLogin;
    this.clearMessages();
  }

  clearMessages() {
    this.errorMessage = null;
    this.successMessage = null;
  }

  isValidGmail(email: string): boolean {
    const cleanEmail = email.trim().toLowerCase();
    return cleanEmail.endsWith('@gmail.com') && cleanEmail.length > 10;
  }

  onSubmitLogin(event: Event) {
    event.preventDefault();
    this.clearMessages();

    if (!this.loginUsername || !this.loginPassword) {
      this.errorMessage = 'Please enter both Gmail address and password.';
      return;
    }

    if (!this.isValidGmail(this.loginUsername)) {
      this.errorMessage = 'Only valid Gmail addresses (@gmail.com) are allowed.';
      return;
    }

    this.isLoading = true;
    this.api.loginUser(this.loginUsername.trim().toLowerCase(), this.loginPassword).subscribe({
      next: (res) => {
        this.isLoading = false;
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('username', res.username);
        localStorage.setItem('full_name', res.full_name || '');
        this.successMessage = 'Login successful! Redirecting...';
        this.cdr.detectChanges();
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 800);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || err.message || 'Authentication failed.';
        this.cdr.detectChanges();
      },
    });
  }

  onSubmitRegister(event: Event) {
    event.preventDefault();
    this.clearMessages();

    if (!this.regFullName.trim()) {
      this.errorMessage = 'Please enter your Full Name.';
      return;
    }

    if (!this.regUsername.trim()) {
      this.errorMessage = 'Please enter your Gmail address.';
      return;
    }

    if (!this.isValidGmail(this.regUsername)) {
      this.errorMessage = 'Only valid Gmail addresses (@gmail.com) are allowed.';
      return;
    }

    if (!this.regPassword) {
      this.errorMessage = 'Please create a password.';
      return;
    }

    if (this.regPassword.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long.';
      return;
    }

    if (this.regPassword !== this.regConfirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;
    this.api
      .registerUser(
        this.regUsername.trim().toLowerCase(),
        this.regPassword,
        this.regFullName.trim(),
      )
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          // Store session credentials automatically
          if (res.token) {
            localStorage.setItem('auth_token', res.token);
            localStorage.setItem('username', res.username || this.regUsername.trim().toLowerCase());
            localStorage.setItem('full_name', res.full_name || this.regFullName.trim());
            localStorage.setItem('role', res.role || 'user');
          }
          this.successMessage = 'Account created! Redirecting to complete your profile...';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.router.navigate(['/setup-profile']);
          }, 800);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.detail || err.message || 'Registration failed.';
          this.cdr.detectChanges();
        },
      });
  }
}
