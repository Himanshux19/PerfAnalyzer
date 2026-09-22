import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe, CurrencyPipe } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, DatePipe, RouterModule],
  templateUrl: './payment-success.html',
  styleUrl: './payment-success.css',
})
export class PaymentSuccess implements OnInit {
  paymentId = '';
  orderId = '';
  plan = 'pro';
  amount = 2499;
  currency = 'INR';
  paymentDate = new Date();
  renewalDate = new Date();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) {
    this.renewalDate.setDate(this.paymentDate.getDate() + 30);
  }

  ngOnInit() {
    // 1. Read query parameters or router navigation state
    this.route.queryParams.subscribe((params) => {
      if (params['payment_id']) {
        this.paymentId = params['payment_id'];
      }
      if (params['order_id']) {
        this.orderId = params['order_id'];
      }
      if (params['plan']) {
        this.plan = params['plan'];
      }
      if (params['amount']) {
        const parsed = parseFloat(params['amount']);
        if (!isNaN(parsed)) {
          this.amount = parsed;
        }
      }
      if (params['currency']) {
        this.currency = params['currency'];
      }
    });

    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      const state = nav.extras.state as any;
      if (state.payment_id) this.paymentId = state.payment_id;
      if (state.order_id) this.orderId = state.order_id;
      if (state.plan) this.plan = state.plan;
      if (state.amount) this.amount = state.amount;
      if (state.currency) this.currency = state.currency;
    }

    if (!this.paymentId) {
      this.paymentId = '—';
    }
    if (!this.orderId) {
      this.orderId = '—';
    }

    // 2. Notify global subscription updated subject so sidebar & navbar update immediately!
    this.api.notifySubscriptionUpdated();
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  goToWorkspaces() {
    this.router.navigate(['/workspaces']);
  }

  goToAccount() {
    this.router.navigate(['/account']);
  }
}
