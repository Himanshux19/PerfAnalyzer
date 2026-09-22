import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, SubscriptionInfo, PaymentOrderResponse } from '../../api.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-subscribe',
  standalone: true,
  imports: [CommonModule, TitleCasePipe],
  templateUrl: './subscribe.html',
  styleUrl: './subscribe.css',
})
export class Subscribe implements OnInit, OnDestroy {
  subscription: SubscriptionInfo | null = null;
  isLoading = false;
  isProcessingPayment = false;
  noticeMessage = '';
  errorMessage = '';

  billingCycle: 'monthly' | 'yearly' = 'monthly';

  private subscriptionSub: Subscription | null = null;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadSubscription();

    this.subscriptionSub = this.api.subscriptionUpdated$.subscribe(() => {
      this.zone.run(() => {
        this.loadSubscription();
      });
    });
  }

  ngOnDestroy() {
    this.subscriptionSub?.unsubscribe();
    this.subscriptionSub = null;
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
    if (plan === 'free') {
      this.noticeMessage = 'You are already eligible for the free tier features!';
      setTimeout(() => {
        this.noticeMessage = '';
        this.cdr.detectChanges();
      }, 5000);
      return;
    }

    if (plan === 'enterprise') {
      this.onContactEnterprise();
      return;
    }

    // Pro Plan Payment Flow
    this.isProcessingPayment = true;
    this.errorMessage = '';
    this.noticeMessage = '';

    this.api.createPaymentOrder(plan, this.billingCycle).subscribe({
      next: (order: PaymentOrderResponse) => {
        this.startRazorpayCheckout(order);
      },
      error: (err) => {
        this.isProcessingPayment = false;
        this.errorMessage = err?.error?.detail || 'Failed to initialize payment gateway order. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  private startRazorpayCheckout(order: PaymentOrderResponse) {
    const RazorpayConstructor = (window as any).Razorpay;
    if (!RazorpayConstructor) {
      this.isProcessingPayment = false;
      this.errorMessage = 'Razorpay Checkout SDK is not loaded. Please check your internet connection.';
      this.cdr.detectChanges();
      return;
    }

    const options = {
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'PerfAnalyzer',
      description: `${order.plan.toUpperCase()} Plan Subscription`,
      image: '/favicon.ico',
      order_id: order.order_id,
      prefill: {
        name: localStorage.getItem('full_name') || '',
        email: localStorage.getItem('username') || '',
      },
      handler: (response: any) => {
        this.zone.run(() => {
          this.verifyAndProceed(
            response.razorpay_order_id || order.order_id,
            response.razorpay_payment_id,
            response.razorpay_signature,
            order.plan,
            order.amount / 100,
            order.currency
          );
        });
      },
      modal: {
        ondismiss: () => {
          this.zone.run(() => {
            this.isProcessingPayment = false;
            this.cdr.detectChanges();
          });
        },
      },
      theme: {
        color: '#2563eb',
      },
    };

    try {
      const rzpInstance = new RazorpayConstructor(options);
      rzpInstance.on('payment.failed', (failResp: any) => {
        this.zone.run(() => {
          this.handlePaymentFailure(
            order.order_id,
            failResp?.error?.metadata?.payment_id || '',
            failResp?.error?.code || 'PAYMENT_FAILED',
            failResp?.error?.description || 'The payment was declined.',
            order.plan
          );
        });
      });
      rzpInstance.open();
    } catch (err: any) {
      this.isProcessingPayment = false;
      this.errorMessage = `Failed to open Razorpay Checkout: ${err?.message || err}`;
      this.cdr.detectChanges();
    }
  }

  verifyAndProceed(
    orderId: string,
    paymentId: string,
    signature: string,
    plan: string,
    amount: number,
    currency: string
  ) {
    this.isProcessingPayment = true;
    this.api
      .verifyPayment({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        plan: plan,
      })
      .subscribe({
        next: () => {
          this.isProcessingPayment = false;
          // Notify app components to refresh active plan immediately
          this.api.notifySubscriptionUpdated();
          this.router.navigate(['/payment/success'], {
            queryParams: {
              payment_id: paymentId,
              order_id: orderId,
              plan: plan,
              amount: amount,
              currency: currency,
            },
          });
        },
        error: (err) => {
          this.isProcessingPayment = false;
          this.router.navigate(['/payment/failure'], {
            queryParams: {
              order_id: orderId,
              payment_id: paymentId,
              code: 'VERIFICATION_FAILED',
              description: err?.error?.detail || 'Payment signature verification failed.',
              plan: plan,
            },
          });
        },
      });
  }

  handlePaymentFailure(
    orderId: string,
    paymentId: string,
    code: string,
    description: string,
    plan: string
  ) {
    this.isProcessingPayment = false;
    this.api
      .reportPaymentFailure({
        order_id: orderId,
        payment_id: paymentId,
        code: code,
        description: description,
      })
      .subscribe({
        next: () => {
          this.router.navigate(['/payment/failure'], {
            queryParams: {
              order_id: orderId,
              payment_id: paymentId,
              code: code,
              description: description,
              plan: plan,
            },
          });
        },
        error: () => {
          this.router.navigate(['/payment/failure'], {
            queryParams: {
              order_id: orderId,
              payment_id: paymentId,
              code: code,
              description: description,
              plan: plan,
            },
          });
        },
      });
  }

  onContactEnterprise() {
    window.location.href = 'mailto:support@perfanalyzer.io?subject=Enterprise%20Plan%20Inquiry';
  }
}

