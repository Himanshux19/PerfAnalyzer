import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';

@Component({
  selector: 'app-payment-failure',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payment-failure.html',
  styleUrl: './payment-failure.css',
})
export class PaymentFailure implements OnInit {
  orderId = '';
  paymentId = '';
  errorCode = '';
  errorMessage = 'Your payment could not be processed at this time.';
  plan = 'pro';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['order_id']) {
        this.orderId = params['order_id'];
      }
      if (params['payment_id']) {
        this.paymentId = params['payment_id'];
      }
      if (params['code']) {
        this.errorCode = params['code'];
      }
      if (params['reason'] || params['description']) {
        this.errorMessage = params['description'] || params['reason'];
      }
      if (params['plan']) {
        this.plan = params['plan'];
      }
    });

    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      const state = nav.extras.state as any;
      if (state.order_id) this.orderId = state.order_id;
      if (state.payment_id) this.paymentId = state.payment_id;
      if (state.code) this.errorCode = state.code;
      if (state.description || state.reason) this.errorMessage = state.description || state.reason;
      if (state.plan) this.plan = state.plan;
    }
  }

  retryPayment() {
    this.router.navigate(['/subscribe']);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  contactSupport() {
    window.location.href = `mailto:support@perfanalyzer.io?subject=Payment%20Issue%20Order%20${this.orderId || 'Unknown'}`;
  }
}
