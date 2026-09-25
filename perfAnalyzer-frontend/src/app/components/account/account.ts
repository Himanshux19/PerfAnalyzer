import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, UserProfile, SubscriptionInfo, PaymentRecord } from '../../api.service';
import { Subscription } from 'rxjs';

// ── Country & Dial-Code Data ──────────────────────────────────────────────────
export interface CountryOption {
  name: string;
  code: string; // ISO 3166-1 alpha-2
  dialCode: string; // e.g. "+91"
  flag: string; // emoji flag
}

export const COUNTRIES: CountryOption[] = [
  { name: 'Afghanistan', code: 'AF', dialCode: '+93', flag: '🇦🇫' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩' },
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦' },
  { name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪' },
  { name: 'Ghana', code: 'GH', dialCode: '+233', flag: '🇬🇭' },
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩' },
  { name: 'Iran', code: 'IR', dialCode: '+98', flag: '🇮🇷' },
  { name: 'Iraq', code: 'IQ', dialCode: '+964', flag: '🇮🇶' },
  { name: 'Israel', code: 'IL', dialCode: '+972', flag: '🇮🇱' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬' },
  { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰' },
  { name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭' },
  { name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹' },
  { name: 'Romania', code: 'RO', dialCode: '+40', flag: '🇷🇴' },
  { name: 'Russia', code: 'RU', dialCode: '+7', flag: '🇷🇺' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦' },
  { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸' },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94', flag: '🇱🇰' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭' },
  { name: 'Thailand', code: 'TH', dialCode: '+66', flag: '🇹🇭' },
  { name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷' },
  { name: 'Ukraine', code: 'UA', dialCode: '+380', flag: '🇺🇦' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸' },
  { name: 'Vietnam', code: 'VN', dialCode: '+84', flag: '🇻🇳' },
  { name: 'Other', code: 'XX', dialCode: '', flag: '🌍' },
];

// ── State Data Per Country ────────────────────────────────────────────────────
const STATES_BY_COUNTRY: Record<string, string[]> = {
  US: [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Louisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Michigan',
    'Minnesota',
    'Mississippi',
    'Missouri',
    'Montana',
    'Nebraska',
    'Nevada',
    'New Hampshire',
    'New Jersey',
    'New Mexico',
    'New York',
    'North Carolina',
    'North Dakota',
    'Ohio',
    'Oklahoma',
    'Oregon',
    'Pennsylvania',
    'Rhode Island',
    'South Carolina',
    'South Dakota',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Washington',
    'West Virginia',
    'Wisconsin',
    'Wyoming',
    'Washington D.C.',
  ],
  IN: [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    'Andaman and Nicobar Islands',
    'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Jammu and Kashmir',
    'Ladakh',
    'Lakshadweep',
    'Puducherry',
  ],
  GB: [
    'England',
    'Scotland',
    'Wales',
    'Northern Ireland',
    'Greater London',
    'West Midlands',
    'Greater Manchester',
    'Yorkshire',
    'Lancashire',
    'Merseyside',
    'Tyne and Wear',
    'West Yorkshire',
  ],
  CA: [
    'Alberta',
    'British Columbia',
    'Manitoba',
    'New Brunswick',
    'Newfoundland and Labrador',
    'Northwest Territories',
    'Nova Scotia',
    'Nunavut',
    'Ontario',
    'Prince Edward Island',
    'Quebec',
    'Saskatchewan',
    'Yukon',
  ],
  AU: [
    'Australian Capital Territory',
    'New South Wales',
    'Northern Territory',
    'Queensland',
    'South Australia',
    'Tasmania',
    'Victoria',
    'Western Australia',
  ],
  DE: [
    'Baden-Württemberg',
    'Bavaria',
    'Berlin',
    'Brandenburg',
    'Bremen',
    'Hamburg',
    'Hesse',
    'Lower Saxony',
    'Mecklenburg-Vorpommern',
    'North Rhine-Westphalia',
    'Rhineland-Palatinate',
    'Saarland',
    'Saxony',
    'Saxony-Anhalt',
    'Schleswig-Holstein',
    'Thuringia',
  ],
  SG: ['Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region'],
  AE: ['Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain'],
  PK: [
    'Balochistan',
    'Khyber Pakhtunkhwa',
    'Punjab',
    'Sindh',
    'Azad Kashmir',
    'Gilgit-Baltistan',
    'Islamabad Capital Territory',
  ],
  BD: ['Barisal', 'Chittagong', 'Dhaka', 'Khulna', 'Mymensingh', 'Rajshahi', 'Rangpur', 'Sylhet'],
};

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account implements OnInit, OnDestroy {
  @Output() navigateSection = new EventEmitter<string>();
  private subscriptionSub: Subscription | null = null;

  activeTab: 'profile' | 'subscription' | 'transactions' = 'profile';

  // ── Country / Dial-Code Data ───────────────────────────────────
  readonly countries: CountryOption[] = COUNTRIES;

  // ── Profile State ─────────────────────────────────────────────
  profile: UserProfile | null = null;
  isLoadingProfile = false;
  isEditingProfile = false;
  isSavingProfile = false;
  profileSuccessMsg = '';
  profileErrorMsg = '';

  // Form Fields
  formFirstName = '';
  formLastName = '';
  formPhoneCode = '+91'; // dial-code prefix (e.g. "+91")
  formPhone = ''; // number only (without dial code)
  formStreet = '';
  formCity = '';
  formState = '';
  formPostalCode = '';
  formCountry = 'India';

  // ── Avatar State ──────────────────────────────────────────────
  isUploadingAvatar = false;
  isRemovingAvatar = false;
  avatarSuccess = '';
  avatarError = '';
  avatarCacheBuster = Date.now();

  // ── Security / Password State ─────────────────────────────────
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  isChangingPassword = false;
  passwordSuccessMsg = '';
  passwordErrorMsg = '';
  passwordStrength: 'none' | 'weak' | 'fair' | 'good' | 'strong' = 'none';

  // ── Deletion Request State ────────────────────────────────────
  showDeleteModal = false;
  deleteReason = 'no_longer_needed';
  deleteNotes = '';
  isSubmittingDelete = false;
  deleteSuccessMsg = '';
  deleteErrorMsg = '';
  hasPendingDeletion = false;

  // ── Subscription State ────────────────────────────────────────
  subscription: SubscriptionInfo | null = null;
  isLoadingSubscription = false;

  // ── Recent Activities State ──────────────────────────────────
  activities: any[] = [];
  isLoadingActivities = false;

  // ── Billing & Transactions State ──────────────────────────────
  transactions: PaymentRecord[] = [];
  isLoadingTransactions = false;
  transactionFilter: 'all' | 'success' | 'failed' = 'all';
  searchQuery = '';
  selectedTransaction: PaymentRecord | null = null;
  showReceiptModal = false;
  copySuccessMsg = '';

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  ngOnInit() {
    this.loadProfile();
    this.loadSubscription();
    this.loadActivities();

    this.subscriptionSub = this.api.subscriptionUpdated$.subscribe((sub: any) => {
      this.zone.run(() => {
        this.loadSubscription();
        this.loadProfile();
        this.loadActivities();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    });
  }

  ngOnDestroy() {
    this.subscriptionSub?.unsubscribe();
    this.subscriptionSub = null;
  }

  loadActivities() {
    this.isLoadingActivities = true;
    this.api.getUserActivities().subscribe({
      next: (data) => {
        this.activities = data || [];
        this.isLoadingActivities = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingActivities = false;
        this.cdr.detectChanges();
      },
    });
  }

  setTab(tab: 'profile' | 'subscription' | 'transactions') {
    this.activeTab = tab;
    this.clearAlerts();
    if (tab === 'subscription' && !this.subscription) {
      this.loadSubscription();
    }
    if (tab === 'transactions') {
      this.loadTransactions();
    }
  }

  clearAlerts() {
    this.profileSuccessMsg = '';
    this.profileErrorMsg = '';
    this.avatarSuccess = '';
    this.avatarError = '';
    this.passwordSuccessMsg = '';
    this.passwordErrorMsg = '';
  }

  // ── State List (Dynamic based on Country) ─────────────────────
  get statesForCountry(): string[] {
    const country = COUNTRIES.find((c) => c.name === this.formCountry);
    if (!country || country.code === 'XX') return [];
    return STATES_BY_COUNTRY[country.code] || [];
  }

  get hasStateLookup(): boolean {
    const country = COUNTRIES.find((c) => c.name === this.formCountry);
    if (!country || country.code === 'XX') return false;
    return !!STATES_BY_COUNTRY[country.code];
  }

  onCountryChange() {
    // Reset state when country changes
    this.formState = '';
    // Set default dial code based on selected country
    const country = COUNTRIES.find((c) => c.name === this.formCountry);
    if (country && country.dialCode) {
      this.formPhoneCode = country.dialCode;
    }
  }

  // ── Dial-Code Label Helper ─────────────────────────────────────
  getDialCodeLabel(dialCode: string): string {
    const country = COUNTRIES.find((c) => c.dialCode === dialCode && c.code !== 'XX');
    return country ? `${country.flag} ${country.dialCode}` : dialCode;
  }

  // ── Profile Methods ───────────────────────────────────────────
  loadProfile() {
    this.isLoadingProfile = true;
    this.api.getUserProfile().subscribe({
      next: (data) => {
        this.profile = data;
        this.hasPendingDeletion = data.deletionRequestPending;
        this.populateForm();
        this.isLoadingProfile = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingProfile = false;
        this.profileErrorMsg = err.error?.detail || 'Failed to load user profile.';
        this.cdr.detectChanges();
      },
    });
  }

  populateForm() {
    if (!this.profile) return;
    this.formFirstName = this.profile.firstName || '';
    this.formLastName = this.profile.lastName || '';

    // Split stored phone into dial-code + number
    const storedPhone: string = this.profile.phone || '';
    const matched = COUNTRIES.find((c) => c.dialCode && storedPhone.startsWith(c.dialCode));
    if (matched) {
      this.formPhoneCode = matched.dialCode;
      this.formPhone = storedPhone.slice(matched.dialCode.length).trim();
    } else {
      // If starts with +, try to parse generically
      const plusMatch = storedPhone.match(/^(\+\d{1,4})\s?(.*)$/);
      if (plusMatch) {
        this.formPhoneCode = plusMatch[1];
        this.formPhone = plusMatch[2].trim();
      } else {
        this.formPhoneCode = '+91';
        this.formPhone = storedPhone;
      }
    }

    this.formStreet = this.profile.address?.street || '';
    this.formCity = this.profile.address?.city || '';
    this.formState = this.profile.address?.state || '';
    this.formPostalCode = this.profile.address?.postalCode || '';
    this.formCountry = this.profile.address?.country || 'India';
  }

  toggleEditProfile() {
    this.isEditingProfile = !this.isEditingProfile;
    if (this.isEditingProfile) {
      this.populateForm();
    }
    this.clearAlerts();
  }

  cancelEditProfile() {
    this.isEditingProfile = false;
    this.populateForm();
    this.clearAlerts();
  }

  saveProfile() {
    this.isSavingProfile = true;
    this.profileSuccessMsg = '';
    this.profileErrorMsg = '';

    // Combine dial-code + phone number
    const fullPhone = this.formPhone.trim()
      ? `${this.formPhoneCode}${this.formPhone.trim().replace(/^0+/, '')}`
      : '';

    const payload = {
      first_name: this.formFirstName.trim(),
      last_name: this.formLastName.trim(),
      phone: fullPhone,
      street_address: this.formStreet.trim(),
      city: this.formCity.trim(),
      state_province: this.formState.trim(),
      postal_code: this.formPostalCode.trim(),
      country: this.formCountry.trim(),
    };

    this.api.updateUserProfile(payload).subscribe({
      next: (res) => {
        this.isSavingProfile = false;
        this.isEditingProfile = false;
        this.profileSuccessMsg = res.message || 'Profile updated successfully.';
        if (typeof window !== 'undefined' && res.fullName) {
          localStorage.setItem('full_name', res.fullName);
        }
        this.loadProfile();
      },
      error: (err) => {
        this.isSavingProfile = false;
        this.profileErrorMsg = err.error?.detail || 'Failed to update profile.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Avatar Methods ────────────────────────────────────────────
  triggerAvatarUpload() {
    const fileInput = document.getElementById('avatarFileInput') as HTMLInputElement;
    if (fileInput) fileInput.click();
  }

  onAvatarFileSelected(event: any) {
    const file: File = event.target.files?.[0];
    if (!file) return;

    // Check size <= 2MB
    if (file.size > 2 * 1024 * 1024) {
      this.avatarError = 'Image size must be 2 MB or less.';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.avatarError = 'Please upload a valid JPEG, PNG, or WEBP image.';
      return;
    }

    this.isUploadingAvatar = true;
    this.avatarError = '';
    this.avatarSuccess = '';

    this.api.uploadAvatar(file).subscribe({
      next: (res) => {
        this.isUploadingAvatar = false;
        this.avatarSuccess = 'Avatar updated successfully.';
        this.avatarCacheBuster = Date.now();
        if (this.profile) {
          this.profile.hasAvatar = true;
          this.profile.avatarUrl = `/api/users/avatar/${this.profile.username}`;
        }
        this.api.avatarUpdated$.next({ hasAvatar: true, timestamp: this.avatarCacheBuster });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isUploadingAvatar = false;
        this.avatarError = err.error?.detail || 'Failed to upload avatar.';
        this.cdr.detectChanges();
      },
    });
  }

  removeAvatar() {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;
    this.isRemovingAvatar = true;
    this.avatarError = '';
    this.avatarSuccess = '';

    this.api.deleteAvatar().subscribe({
      next: () => {
        this.isRemovingAvatar = false;
        this.avatarSuccess = 'Profile photo removed.';
        if (this.profile) {
          this.profile.hasAvatar = false;
          this.profile.avatarUrl = null;
        }
        this.api.avatarUpdated$.next({ hasAvatar: false, timestamp: Date.now() });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isRemovingAvatar = false;
        this.avatarError = err.error?.detail || 'Failed to remove avatar.';
        this.cdr.detectChanges();
      },
    });
  }

  onAvatarError() {
    if (this.profile) {
      this.profile.hasAvatar = false;
      this.cdr.detectChanges();
    }
  }

  getAvatarUrl(): string {
    if (!this.profile || !this.profile.hasAvatar) return '';
    return `${this.api.getAvatarUrl(this.profile.username)}?t=${this.avatarCacheBuster}`;
  }

  getInitials(): string {
    if (this.profile) {
      const fn = (this.profile.firstName || '').trim();
      const ln = (this.profile.lastName || '').trim();
      if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
      if (fn) return fn.slice(0, 2).toUpperCase();
      if (this.profile.fullName) {
        const parts = this.profile.fullName.trim().split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return this.profile.fullName.slice(0, 2).toUpperCase();
      }
      if (this.profile.username) return this.profile.username.slice(0, 2).toUpperCase();
    }
    return 'PA';
  }

  getAvatarBgColor(): string {
    const str = this.profile?.username || 'user';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 42%)`;
  }

  // ── Password / Security Methods ───────────────────────────────
  checkPasswordStrength() {
    const pw = this.newPassword;
    if (!pw) {
      this.passwordStrength = 'none';
      return;
    }
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) this.passwordStrength = 'weak';
    else if (score === 2) this.passwordStrength = 'fair';
    else if (score === 3) this.passwordStrength = 'good';
    else this.passwordStrength = 'strong';
  }

  changePassword() {
    this.passwordSuccessMsg = '';
    this.passwordErrorMsg = '';

    if (!this.currentPassword) {
      this.passwordErrorMsg = 'Please enter your current password.';
      return;
    }
    if (this.newPassword.length < 6) {
      this.passwordErrorMsg = 'New password must be at least 6 characters long.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordErrorMsg = 'New passwords do not match.';
      return;
    }

    this.isChangingPassword = true;
    this.api
      .changePassword({
        current_password: this.currentPassword,
        new_password: this.newPassword,
      })
      .subscribe({
        next: (res) => {
          this.isChangingPassword = false;
          this.passwordSuccessMsg = res.message || 'Password updated successfully!';
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.passwordStrength = 'none';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isChangingPassword = false;
          this.passwordErrorMsg = err.error?.detail || 'Failed to change password.';
          this.cdr.detectChanges();
        },
      });
  }

  // ── Deletion Request Methods ──────────────────────────────────
  openDeleteModal() {
    this.deleteErrorMsg = '';
    this.deleteSuccessMsg = '';
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
  }

  submitDeletionRequest() {
    this.isSubmittingDelete = true;
    this.deleteErrorMsg = '';
    this.deleteSuccessMsg = '';

    this.api
      .submitDeletionRequest({
        reason: this.deleteReason,
        notes: this.deleteNotes.trim(),
      })
      .subscribe({
        next: (res) => {
          this.isSubmittingDelete = false;
          this.showDeleteModal = false;
          this.hasPendingDeletion = true;
          this.profileSuccessMsg =
            res.message || 'Account deletion request submitted. An administrator will review it.';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isSubmittingDelete = false;
          this.deleteErrorMsg = err.error?.detail || 'Failed to submit deletion request.';
          this.cdr.detectChanges();
        },
      });
  }

  // ── Subscription Methods ──────────────────────────────────────
  loadSubscription() {
    this.isLoadingSubscription = true;
    this.api.getSubscription().subscribe({
      next: (data) => {
        this.subscription = data;
        this.isLoadingSubscription = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingSubscription = false;
        this.cdr.detectChanges();
      },
    });
  }

  /** Returns true for any paid active plan: pro, enterprise */
  hasActivePlan(): boolean {
    if (!this.subscription) return false;
    const plan = (this.subscription.plan || '').toLowerCase();
    const status = (this.subscription.status || '').toLowerCase();
    return (plan === 'pro' || plan === 'enterprise') && status === 'active';
  }

  /** Returns true only for FREE / no subscription */
  isFreeTier(): boolean {
    return !this.hasActivePlan();
  }

  isProOrEnterprise(): boolean {
    if (!this.subscription || this.subscription.status !== 'active') return false;
    const plan = (this.subscription.plan || '').toLowerCase();
    return plan === 'pro' || plan === 'enterprise';
  }

  getPlanLabel(): string {
    const plan = (this.subscription?.plan || '').toLowerCase();
    if (plan === 'pro') return 'Professional Tier';
    if (plan === 'enterprise') return 'Enterprise Tier';
    return 'Standard Free Tier';
  }

  getPlanDescription(): string {
    const plan = (this.subscription?.plan || '').toLowerCase();
    if (plan === 'pro')
      return 'High-capacity cloud load runner with scheduled test executions and automated alerting.';
    if (plan === 'enterprise')
      return 'Unlimited enterprise-grade infrastructure with priority support and dedicated SLA.';
    return 'Community plan with basic test limits. Upgrade to unlock full platform capabilities.';
  }

  getPlanColorClass(): string {
    const plan = (this.subscription?.plan || '').toLowerCase();
    if (plan === 'enterprise') return 'plan-enterprise';
    if (plan === 'pro') return 'plan-pro';
    return 'plan-free';
  }

  getUsagePercent(used: number, limit: number): number {
    if (!limit || limit <= 0) return 0;
    const pct = Math.round((used / limit) * 100);
    return Math.min(pct, 100);
  }

  getProgressBarColor(pct: number): string {
    if (pct >= 90) return '#ef4444'; // red
    if (pct >= 75) return '#f59e0b'; // amber
    return '#3b82f6'; // blue
  }

  navigateToSubscribe() {
    this.navigateSection.emit('subscribe');
    this.router.navigate(['/subscribe']);
  }

  // ── Transaction History Methods ───────────────────────────────

  loadTransactions() {
    this.isLoadingTransactions = true;
    this.api.getPaymentHistory().subscribe({
      next: (data) => {
        this.transactions = data || [];
        this.isLoadingTransactions = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingTransactions = false;
        this.cdr.detectChanges();
      },
    });
  }

  getFilteredTransactions(): PaymentRecord[] {
    return this.transactions.filter((tx) => {
      // Status filter
      if (this.transactionFilter === 'success' && tx.status !== 'success') {
        return false;
      }
      if (this.transactionFilter === 'failed' && tx.status !== 'failed') {
        return false;
      }
      // Search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase().trim();
        const matchesOrder = tx.orderId?.toLowerCase().includes(query);
        const matchesPay = tx.paymentId?.toLowerCase().includes(query);
        const matchesPlan = tx.plan?.toLowerCase().includes(query);
        return matchesOrder || matchesPay || matchesPlan;
      }
      return true;
    });
  }

  getTotalSpent(): number {
    return this.transactions
      .filter((t) => t.status === 'success')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }

  getSuccessCount(): number {
    return this.transactions.filter((t) => t.status === 'success').length;
  }

  viewReceipt(tx: PaymentRecord) {
    this.selectedTransaction = tx;
    this.showReceiptModal = true;
  }

  closeReceiptModal() {
    this.showReceiptModal = false;
    this.selectedTransaction = null;
  }

  downloadReceiptPdf() {
    const tx = this.selectedTransaction;
    if (!tx) return;

    const currencySymbol = tx.currency === 'INR' ? '₹' : '$';
    const amount = (tx.amount || 0).toFixed(2);
    const date = new Date(tx.createdAt);
    const dateFormatted = date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    const timeFormatted = date.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    const invoiceNumber = `INV-${tx.id.toString().padStart(6, '0')}`;
    const planLabel = (tx.plan || 'Free').charAt(0).toUpperCase() + (tx.plan || 'free').slice(1);
    const statusLabel = tx.status === 'success' ? 'PAID & VERIFIED' : tx.status === 'failed' ? 'PAYMENT FAILED' : 'PENDING';
    const statusColor = tx.status === 'success' ? '#15803d' : tx.status === 'failed' ? '#dc2626' : '#b45309';
    const statusBg = tx.status === 'success' ? '#dcfce7' : tx.status === 'failed' ? '#fee2e2' : '#fef9c3';
    const userEmail = this.profile?.email || '';
    const userName = [this.profile?.firstName, this.profile?.lastName].filter(Boolean).join(' ') || 'Customer';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${invoiceNumber} – PerfAnalyzer</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #1e293b;
      background: #fff;
      padding: 48px;
      max-width: 700px;
      margin: 0 auto;
    }
    /* Header */
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 36px;
      padding-bottom: 24px;
      border-bottom: 2px solid #e2e8f0;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-tagline {
      font-size: 11px;
      color: #64748b;
      margin-top: 3px;
    }
    .invoice-meta { text-align: right; }
    .invoice-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
    }
    .invoice-number {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .invoice-date {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }
    /* Status stamp */
    .status-stamp {
      display: inline-block;
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      background: ${statusBg};
      color: ${statusColor};
      border: 1.5px solid ${statusColor}33;
      margin-top: 8px;
    }
    /* Parties */
    .parties {
      display: flex;
      gap: 40px;
      margin-bottom: 32px;
    }
    .party { flex: 1; }
    .party-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .party-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .party-detail {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 3px;
      line-height: 1.6;
    }
    /* Line items table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
    }
    thead tr {
      background: #f8fafc;
    }
    th {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th.right { text-align: right; }
    th.center { text-align: center; }
    td {
      padding: 14px;
      font-size: 12.5px;
      color: #334155;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    td.right { text-align: right; }
    td.center { text-align: center; }
    .item-desc { font-weight: 600; color: #0f172a; }
    .item-sub { font-size: 11px; color: #94a3b8; margin-top: 3px; font-weight: 400; }
    /* Totals */
    .totals-section {
      margin-top: 0;
      border-top: 2px solid #e2e8f0;
    }
    .totals-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 48px;
      padding: 9px 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-row:last-child { border-bottom: none; }
    .totals-label {
      font-size: 12px;
      color: #64748b;
      min-width: 100px;
      text-align: right;
    }
    .totals-value {
      font-size: 12.5px;
      font-weight: 600;
      color: #334155;
      min-width: 80px;
      text-align: right;
    }
    .totals-row.grand {
      background: #f8fafc;
      border-radius: 6px;
      margin: 4px 0;
    }
    .totals-row.grand .totals-label {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .totals-row.grand .totals-value {
      font-size: 16px;
      font-weight: 800;
      color: ${tx.status === 'success' ? '#15803d' : '#dc2626'};
    }
    /* References */
    .references {
      margin-top: 28px;
      padding: 16px 18px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .ref-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin-bottom: 10px;
    }
    .ref-row {
      display: flex;
      gap: 12px;
      margin-bottom: 6px;
      align-items: baseline;
    }
    .ref-row:last-child { margin-bottom: 0; }
    .ref-key {
      font-size: 11px;
      color: #64748b;
      min-width: 120px;
      flex-shrink: 0;
    }
    .ref-val {
      font-size: 11px;
      font-family: 'Courier New', Courier, monospace;
      color: #334155;
      font-weight: 600;
      word-break: break-all;
    }
    /* Footer */
    .invoice-footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-note {
      font-size: 10.5px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .footer-secure {
      font-size: 10px;
      color: #94a3b8;
      text-align: right;
    }
    .footer-secure strong { color: #64748b; }
    @media print {
      body { padding: 32px; }
      @page { margin: 0.5in; size: A4; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="invoice-header">
    <div>
      <div class="brand-name">PerfAnalyzer</div>
      <div class="brand-tagline">Automated Load &amp; Performance Testing Platform</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">Invoice</div>
      <div class="invoice-number">${invoiceNumber}</div>
      <div class="invoice-date">${dateFormatted} &nbsp;·&nbsp; ${timeFormatted}</div>
      <div class="status-stamp">${statusLabel}</div>
    </div>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">PerfAnalyzer</div>
      <div class="party-detail">Load Testing SaaS Platform<br/>support@perfanalyzer.io</div>
    </div>
    <div class="party">
      <div class="party-label">Billed To</div>
      <div class="party-name">${userName}</div>
      <div class="party-detail">${userEmail}</div>
    </div>
  </div>

  <!-- Line Items -->
  <table>
    <thead>
      <tr>
        <th style="width:55%">Description</th>
        <th class="center" style="width:15%">Qty</th>
        <th class="right" style="width:15%">Unit Price</th>
        <th class="right" style="width:15%">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div class="item-desc">PerfAnalyzer ${planLabel} Plan — Monthly Subscription</div>
          <div class="item-sub">Full Platform Access · Cloud Test Runner · ${dateFormatted}</div>
        </td>
        <td class="center">1</td>
        <td class="right">${currencySymbol}${amount}</td>
        <td class="right">${currencySymbol}${amount}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-section">
    <div class="totals-row">
      <span class="totals-label">Subtotal</span>
      <span class="totals-value">${currencySymbol}${amount}</span>
    </div>
    <div class="totals-row">
      <span class="totals-label">Tax / GST</span>
      <span class="totals-value">Inclusive</span>
    </div>
    <div class="totals-row grand">
      <span class="totals-label">Total ${tx.status === 'success' ? 'Paid' : 'Amount'}</span>
      <span class="totals-value">${currencySymbol}${amount}</span>
    </div>
  </div>

  <!-- Reference Numbers -->
  <div class="references">
    <div class="ref-title">Payment References</div>
    <div class="ref-row">
      <span class="ref-key">Order ID</span>
      <span class="ref-val">${tx.orderId || '—'}</span>
    </div>
    <div class="ref-row">
      <span class="ref-key">Payment ID</span>
      <span class="ref-val">${tx.paymentId || '—'}</span>
    </div>
    <div class="ref-row">
      <span class="ref-key">Invoice Number</span>
      <span class="ref-val">${invoiceNumber}</span>
    </div>
    <div class="ref-row">
      <span class="ref-key">Payment Gateway</span>
      <span class="ref-val">Razorpay</span>
    </div>
  </div>

  <!-- Footer -->
  <div class="invoice-footer">
    <div class="footer-note">
      Thank you for using PerfAnalyzer.<br/>
      This is a system-generated invoice and does not require a signature.
    </div>
    <div class="footer-secure">
      <strong>Secured by Razorpay</strong><br/>
    </div>
  </div>

</body>
</html>`;

    // Open in hidden iframe, trigger print dialog (Save as PDF)
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 500);
    }
  }

  copyToClipboard(text: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      this.copySuccessMsg = 'Copied to clipboard!';
      setTimeout(() => {
        this.copySuccessMsg = '';
        this.cdr.detectChanges();
      }, 2000);
    }
  }
}
