import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-auth',
  imports: [FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css'
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

  constructor(private api: ApiService, private router: Router) {
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
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1000);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || err.message || 'Authentication failed.';
      }
    });
  }

  onSubmitRegister(event: Event) {
    event.preventDefault();
    this.clearMessages();

    if (!this.regUsername || !this.regPassword || !this.regConfirmPassword || !this.regFullName) {
      this.errorMessage = 'All registration fields are required.';
      return;
    }

    if (!this.isValidGmail(this.regUsername)) {
      this.errorMessage = 'Only valid Gmail addresses (@gmail.com) are allowed.';
      return;
    }

    if (this.regPassword !== this.regConfirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;
    this.api.registerUser(this.regUsername.trim().toLowerCase(), this.regPassword, this.regFullName.trim()).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = 'Account created successfully! You can now Sign In.';
        this.regUsername = '';
        this.regPassword = '';
        this.regConfirmPassword = '';
        this.regFullName = '';
        setTimeout(() => {
          this.toggleMode(true);
        }, 2000);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || err.message || 'Registration failed.';
      }
    });
  }
}
