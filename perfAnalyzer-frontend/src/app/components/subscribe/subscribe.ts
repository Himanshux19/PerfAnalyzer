import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, SubscriptionInfo } from '../../api.service';

@Component({
  selector: 'app-subscribe',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscribe.html',
  styleUrl: './subscribe.css',
})
export class Subscribe implements OnInit {
  subscription: SubscriptionInfo | null = null;
  isLoading = false;
  noticeMessage = '';

  billingCycle: 'monthly' | 'yearly' = 'monthly';

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadSubscription();

    this.api.subscriptionUpdated$.subscribe(() => {
      this.loadSubscription();
    });
  }

  loadSubscription() {
    this.isLoading = true;
    this.api.getSubscription().subscribe({
      next: (data) => {
        this.subscription = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  getCurrentPlan(): string {
    if (!this.subscription || this.subscription.status !== 'active') {
      return 'free';
    }
    return (this.subscription.plan || 'free').toLowerCase();
  }

  onSubscribe(plan: string) {
    this.noticeMessage = `Subscription tiers are managed by the administrator. Contact your admin or support to activate the ${plan.toUpperCase()} plan!`;
    setTimeout(() => {
      this.noticeMessage = '';
      this.cdr.detectChanges();
    }, 6000);
  }

  onContactEnterprise() {
    window.location.href = 'mailto:support@perfanalyzer.io?subject=Enterprise%20Plan%20Inquiry';
  }
}
