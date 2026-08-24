import { Component, OnInit, ChangeDetectorRef, NgZone, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, UserProfile, SubscriptionInfo } from '../../api.service';

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
export class Account implements OnInit {
  @Output() navigateSection = new EventEmitter<string>();

  activeTab: 'profile' | 'subscription' = 'profile';

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

    this.api.subscriptionUpdated$.subscribe((sub: any) => {
      this.zone.run(() => {
        this.loadSubscription();
        this.loadProfile();
        this.loadActivities();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    });
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

  setTab(tab: 'profile' | 'subscription') {
    this.activeTab = tab;
    this.clearAlerts();
    if (tab === 'subscription' && !this.subscription) {
      this.loadSubscription();
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isRemovingAvatar = false;
        this.avatarError = err.error?.detail || 'Failed to remove avatar.';
        this.cdr.detectChanges();
      },
    });
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

  /** Returns true for any paid active plan: starter, pro, enterprise */
  hasActivePlan(): boolean {
    if (!this.subscription) return false;
    const plan = (this.subscription.plan || '').toLowerCase();
    const status = (this.subscription.status || '').toLowerCase();
    return (plan === 'starter' || plan === 'pro' || plan === 'enterprise') && status === 'active';
  }

  /** Returns true only for FREE / no subscription */
  isFreeTier(): boolean {
    return !this.hasActivePlan();
  }

  isStarter(): boolean {
    if (!this.subscription || this.subscription.status !== 'active') return false;
    return (this.subscription.plan || '').toLowerCase() === 'starter';
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
    if (plan === 'starter') return 'Starter Tier';
    return 'Standard Free Tier';
  }

  getPlanDescription(): string {
    const plan = (this.subscription?.plan || '').toLowerCase();
    if (plan === 'pro')
      return 'High-capacity cloud load runner with scheduled test executions and automated alerting.';
    if (plan === 'enterprise')
      return 'Unlimited enterprise-grade infrastructure with priority support and dedicated SLA.';
    if (plan === 'starter')
      return 'Entry-level plan with expanded test quotas, additional workspaces, and basic storage.';
    return 'Community plan with basic test limits. Upgrade to unlock full platform capabilities.';
  }

  getPlanColorClass(): string {
    const plan = (this.subscription?.plan || '').toLowerCase();
    if (plan === 'enterprise') return 'plan-enterprise';
    if (plan === 'pro') return 'plan-pro';
    if (plan === 'starter') return 'plan-starter';
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
}
