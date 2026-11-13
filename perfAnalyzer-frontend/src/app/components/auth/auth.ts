import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-auth',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnInit {
  isLoginMode = true;
  authSubView: 'default' | 'forgot' | 'reset' = 'default';
  isLoading = false;

  // Login bindings
  loginUsername = '';
  loginPassword = '';

  // Registration bindings
  regUsername = '';
  regPassword = '';
  regConfirmPassword = '';
  regFullName = '';

  // Forgot & Reset Password bindings
  forgotEmail = '';
  generatedResetLink: string | null = null;
  generatedResetToken: string | null = null;
  linkCopied = false;

  resetToken = '';
  resetAccountEmail = '';
  resetNewPassword = '';
  resetConfirmPassword = '';

  // Form feedback alert states
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const tokenParam = params['token'] || params['reset_token'];
      if (tokenParam) {
        this.openResetWithToken(tokenParam);
        return;
      }

      // Automatically switch to Sign Up if mode=signup or on /signup / /register route
      const mode = params['mode'] || params['tab'];
      if (
        mode === 'signup' ||
        mode === 'register' ||
        this.router.url.includes('signup') ||
        this.router.url.includes('register')
      ) {
        this.isLoginMode = false;
      } else if (mode === 'login' || mode === 'signin') {
        this.isLoginMode = true;
      }

      // Skip login if already authenticated and not resetting password
      if (typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  toggleMode(isLogin: boolean) {
    this.isLoginMode = isLogin;
    this.authSubView = 'default';
    this.generatedResetLink = null;
    this.generatedResetToken = null;
    this.clearMessages();
  }

  openForgotPassword() {
    this.authSubView = 'forgot';
    this.forgotEmail = this.loginUsername || '';
    this.generatedResetLink = null;
    this.generatedResetToken = null;
    this.linkCopied = false;
    this.clearMessages();
  }

  backToLogin() {
    this.authSubView = 'default';
    this.isLoginMode = true;
    this.generatedResetLink = null;
    this.generatedResetToken = null;
    this.clearMessages();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  openResetWithToken(token: string) {
    this.authSubView = 'reset';
    this.resetToken = token;
    this.resetNewPassword = '';
    this.resetConfirmPassword = '';
    this.clearMessages();
    this.isLoading = true;

    this.api.verifyResetToken(token).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.resetAccountEmail = res.username;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || 'Invalid or expired password reset link.';
        this.cdr.detectChanges();
      },
    });
  }

  onSubmitForgotPassword(event: Event) {
    event.preventDefault();
    this.clearMessages();
    this.generatedResetLink = null;
    this.generatedResetToken = null;
    this.linkCopied = false;

    if (!this.forgotEmail.trim()) {
      this.errorMessage = 'Please enter your registered Gmail address.';
      return;
    }

    if (!this.isValidGmail(this.forgotEmail)) {
      this.errorMessage = 'Only valid Gmail addresses (@gmail.com) are allowed.';
      return;
    }

    this.isLoading = true;
    this.api.forgotPassword(this.forgotEmail.trim().toLowerCase()).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.generatedResetLink = null;
        this.generatedResetToken = res.token;
        this.successMessage =
          res.message || `A password reset link has been sent to ${this.forgotEmail.trim()}. Please check your email inbox.`;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err.error?.detail || err.message || 'Could not process password reset request.';
        this.cdr.detectChanges();
      },
    });
  }

  copyResetLink(silent = false) {
    if (!this.generatedResetLink || typeof navigator === 'undefined') return;
    navigator.clipboard?.writeText(this.generatedResetLink).then(() => {
      this.linkCopied = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.linkCopied = false;
        this.cdr.detectChanges();
      }, 3000);
    }).catch(() => {
      if (!silent) {
        this.errorMessage = 'Failed to copy to clipboard automatically. Please select and copy the link manually.';
        this.cdr.detectChanges();
      }
    });
  }

  proceedToResetDirectly() {
    if (!this.generatedResetToken) return;
    this.router.navigate(['/reset-password'], { queryParams: { token: this.generatedResetToken } });
  }

  onSubmitResetPassword(event: Event) {
    event.preventDefault();
    this.clearMessages();

    if (!this.resetToken) {
      this.errorMessage = 'Missing password reset token.';
      return;
    }

    if (!this.resetNewPassword) {
      this.errorMessage = 'Please enter a new password.';
      return;
    }

    if (this.resetNewPassword.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long.';
      return;
    }

    if (this.resetNewPassword !== this.resetConfirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;
    this.api.resetPassword(this.resetToken, this.resetNewPassword).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.loginUsername = res.username || this.resetAccountEmail || this.loginUsername;
        this.loginPassword = '';
        this.authSubView = 'default';
        this.isLoginMode = true;
        this.successMessage = res.message || 'Password updated! Please sign in with your new password.';
        this.router.navigate(['/login'], { replaceUrl: true });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || err.message || 'Failed to reset password.';
        this.cdr.detectChanges();
      },
    });
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
