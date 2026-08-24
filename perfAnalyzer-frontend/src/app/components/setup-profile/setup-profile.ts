import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService, UserProfileUpdatePayload } from '../../api.service';

@Component({
  selector: 'app-setup-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup-profile.html',
  styleUrl: './setup-profile.css',
})
export class SetupProfile implements OnInit {
  firstName: string = '';
  lastName: string = '';
  phone: string = '';
  streetAddress: string = '';
  city: string = '';
  stateProvince: string = '';
  postalCode: string = '';
  country: string = 'United States';

  userEmail: string = '';
  isLoading: boolean = false;
  isSaving: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  countries: string[] = [
    'United States',
    'India',
    'United Kingdom',
    'Canada',
    'Australia',
    'Germany',
    'France',
    'Singapore',
    'Japan',
    'Brazil',
    'Other',
  ];

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('auth_token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    this.userEmail = localStorage.getItem('username') || '';
    const storedName = localStorage.getItem('full_name') || '';
    if (storedName) {
      const parts = storedName.trim().split(' ');
      this.firstName = parts[0] || '';
      this.lastName = parts.slice(1).join(' ') || '';
    }

    // Attempt to load any existing profile data
    this.isLoading = true;
    this.api.getUserProfile().subscribe({
      next: (profile) => {
        this.isLoading = false;
        if (profile) {
          if (profile.firstName) this.firstName = profile.firstName;
          if (profile.lastName) this.lastName = profile.lastName;
          if (profile.phone) this.phone = profile.phone;
          if (profile.address) {
            if (profile.address.street) this.streetAddress = profile.address.street;
            if (profile.address.city) this.city = profile.address.city;
            if (profile.address.state) this.stateProvince = profile.address.state;
            if (profile.address.postalCode) this.postalCode = profile.address.postalCode;
            if (profile.address.country) this.country = profile.address.country;
          }
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onSubmitProfile(event: Event): void {
    event.preventDefault();
    this.errorMessage = null;
    this.successMessage = null;

    if (!this.firstName.trim()) {
      this.errorMessage = 'Please enter your First Name.';
      return;
    }

    if (!this.phone.trim()) {
      this.errorMessage = 'Please enter your Phone Number.';
      return;
    }

    const payload: UserProfileUpdatePayload = {
      first_name: this.firstName.trim(),
      last_name: this.lastName.trim(),
      phone: this.phone.trim(),
      street_address: this.streetAddress.trim(),
      city: this.city.trim(),
      state_province: this.stateProvince.trim(),
      postal_code: this.postalCode.trim(),
      country: this.country.trim() || 'United States',
    };

    this.isSaving = true;
    this.api.updateUserProfile(payload).subscribe({
      next: (res) => {
        this.isSaving = false;
        const fullName = `${this.firstName.trim()} ${this.lastName.trim()}`.trim();
        if (fullName && typeof window !== 'undefined') {
          localStorage.setItem('full_name', fullName);
        }
        this.successMessage = 'Profile setup complete! Welcome to PerfAnalyzer.';
        this.cdr.detectChanges();
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 800);
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage =
          err.error?.detail || 'Failed to save profile details. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  onSkip(): void {
    this.router.navigate(['/dashboard']);
  }
}
