import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

export interface ShowcaseSection {
  id: string;
  tag: string;
  title: string;
  description: string;
  bullets: string[];
  route: string;
  screenshotFilename: string;
  imageSrc: string; // e.g. '/screenshots/create-test.png'
  imageAlt: string;
  reverseLayout: boolean; // Alternates left/right on desktop
}

export interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-showcase',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './showcase.html',
  styleUrl: './showcase.css',
})
export class Showcase implements OnInit {
  isLoggedIn = false;
  openFaqIndex: number | null = 0;

  // ── Hero Screenshot (User's real screenshot!) ──────────────────────
  heroScreenshot = {
    imageSrc: '/screenshots/dashboard.png', // Already in public/screenshots/dashboard.png
    route: '/dashboard',
    title: 'PerfAnalyzer Real-Time Overview Dashboard',
    filename: 'dashboard.png',
  };

  // ── Product Walkthrough Video ──────────────────────────────────────
  productVideo = {
    videoSrc: '/screenshots/demo-video.mp4', // Place file in public/screenshots/demo-video.mp4 or set YouTube/Vimeo embed
    filename: 'demo-video.mp4',
    title: 'Video Walkthrough',
    description: 'Shows the full workflow: Creating a test, simulating live user traffic, and exporting executive reports.',
    targetFlow: 'Full Journey: /create-test → /queue → /reports',
  };

  // ── Alternating Feature Showcase Sections (Screenshots) ────────────
  featureSections: ShowcaseSection[] = [
    {
      id: 'create-test',
      tag: '1. Test Authoring & Auto-Discovery',
      title: 'Auto-Discover Endpoints & Build Scenarios in Minutes',
      description:
        'Stop writing tedious JMeter XML scripts by hand. Simply paste your website URL or API base. PerfAnalyzer automatically crawls pages, discovers API routes, extracts parameters, and compiles ready-to-run scenarios.',
      bullets: [
        'Automatic route discovery & parameter extraction',
        'Intuitive slider to set virtual users (from 10 up to 100,000+ users)',
        'Configure ramp-up, hold duration, and CSV test datasets with zero coding',
      ],
      route: '/create-test',
      screenshotFilename: 'create-test.png',
      imageSrc: '/screenshots/create-test.png',
      imageAlt: 'PerfAnalyzer Create Test and Scenario Builder Interface',
      reverseLayout: false,
    },
    {
      id: 'live-execution',
      tag: '2. Real-Time Load Execution',
      title: 'Watch Live Traffic & Latency Meters in Real Time',
      description:
        'Execute tests on the bundled Taurus engine or dispatch massive distributed runs to your Jenkins agent cluster. WebSocket streams transmit live server throughput (RPS), response times, and console logs directly to your screen.',
      bullets: [
        'Live throughput (RPS), active virtual users, and latency gauges',
        'Real-time P95 & P99 latency percentile threshold tracking',
        'Instant emergency stop and pause controls for 100% server safety',
      ],
      route: '/queue',
      screenshotFilename: 'live-execution.png',
      imageSrc: '/screenshots/logs.png', // Set to '/screenshots/live-execution.png' once provided
      imageAlt: 'PerfAnalyzer Live Test Execution and Queue Streaming',
      reverseLayout: true,
    },
    {
      id: 'apm-tracing',
      tag: '3. APM & Observability',
      title: 'Pinpoint Exact Database & Backend Bottlenecks',
      description:
        'Don’t wonder why an API route slowed down under load. Built-in OpenTelemetry instrumentation correlates artificial traffic surges with backend traces, pinpointing slow database queries, microservices, and compute bottlenecks.',
      bullets: [
        'Visual distributed trace waterfalls for slow transactions',
        'Isolate slow database queries and external third-party API calls',
        'Zero blind spots between load tests and application performance',
      ],
      route: '/monitoring',
      screenshotFilename: 'apm-tracing.png',
      imageSrc: '/screenshots/monitoring.png', 
      imageAlt: 'PerfAnalyzer OpenTelemetry APM Tracing and Diagnostics',
      reverseLayout: false,
    },
    {
      id: 'reports',
      tag: '4. Executive & Technical Reports',
      title: 'Client-Ready Reports & Shareable HTML Dashboards',
      description:
        'Every completed test automatically generates presentation-ready analytics. Download self-contained interactive JMeter HTML dashboards or executive PDF summaries to prove application resilience to clients and stakeholders.',
      bullets: [
        'Clear SLA pass/fail validation summaries and response percentiles',
        'Historical trend comparison across multiple test runs',
        'One-click download of raw .jtl telemetry files and HTML report bundles',
      ],
      route: '/reports',
      screenshotFilename: 'reports.png',
      imageSrc: '/screenshots/report.png', 
      imageAlt: 'PerfAnalyzer Performance Reports and Historical Analytics',
      reverseLayout: true,
    },
  ];

  // ── Pricing Plans ──────────────────────────────────────────────────
  plans = [
    {
      name: 'Free Tier',
      price: '$0',
      period: '/ month',
      description: 'Ideal for individual developers, side projects, and small API smoke tests.',
      featured: false,
      badge: 'Free Forever',
      features: [
        '30 Test Runs / month',
        'Up to 500 Virtual Users',
        '3 Project Workspaces',
        '1 GB Artifact Storage',
        'Local Taurus Execution Engine',
        'Live WebSocket Metric Streaming',
      ],
      ctaText: 'Start for Free',
      ctaMode: 'signup',
    },
    {
      name: 'Professional',
      price: '$29',
      period: '/ month',
      description: 'For growing teams and SaaS applications preparing for critical traffic.',
      featured: true,
      badge: 'Most Popular',
      features: [
        '100 Test Runs / month',
        'Up to 10,000 Virtual Users',
        'Unlimited Project Workspaces',
        '10 GB Artifact Storage',
        'Automated Scheduled Tests (Cron)',
        'PDF & Interactive HTML Reports',
        'Priority Technical Support',
      ],
      ctaText: 'Upgrade to Pro',
      ctaMode: 'signup',
    },
    {
      name: 'Enterprise',
      price: '$49',
      period: '/ month',
      description: 'For organizations with high-volume load requirements and dedicated CI/CD.',
      featured: false,
      badge: 'High Scale',
      features: [
        'Unlimited Test Runs',
        '100,000+ Virtual Users',
        'Dedicated Jenkins Agent Cluster',
        'Full OpenTelemetry APM Suite',
        'Custom SLAs & Dedicated Onboarding',
        'Organization Multi-Tenant Control',
      ],
      ctaText: 'Contact Enterprise',
      ctaMode: 'signup',
    },
  ];

  // ── FAQs ───────────────────────────────────────────────────────────
  faqs: FaqItem[] = [
    {
      question: 'Do I need prior experience with Apache JMeter to use PerfAnalyzer?',
      answer:
        'No. PerfAnalyzer eliminates JMeter’s steep learning curve. You simply enter your website or API address, choose how many visitors to simulate, and launch. The platform auto-generates standard test scenarios and displays results in clear, visual graphs. Advanced users can also upload custom .jmx files directly.',
    },
    {
      question: 'Can running load tests harm or crash my live website?',
      answer:
        'You have full control over the test volume and ramp-up rate. You can start small (e.g. 50 or 100 users) and observe the live response speed in real time. If your servers begin to struggle, click the instant Stop button at any moment. We also recommend testing on staging environments whenever possible.',
    },
    {
      question: 'How does real-time streaming work?',
      answer:
        'PerfAnalyzer uses high-frequency WebSockets to stream latency, throughput (requests per second), active thread counts, and console output directly from the test engine to your browser without needing page refreshes.',
    },
    {
      question: 'Can I download reports to send to clients or leadership?',
      answer:
        'Yes! Every test generates complete, downloadable artifacts including raw .jtl files, executive PDF summaries, and interactive self-contained JMeter HTML dashboard bundles.',
    },
    {
      question: 'Is there a free version to try out?',
      answer:
        'Yes. The Free Tier includes 30 test runs per month, up to 500 virtual users, and 3 project workspaces. No credit card is required to sign up.',
    },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.isLoggedIn = !!localStorage.getItem('auth_token');
    }
  }

  toggleFaq(index: number): void {
    this.openFaqIndex = this.openFaqIndex === index ? null : index;
  }

  scrollTo(sectionId: string): void {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  goToSignIn(): void {
    this.router.navigate(['/login']);
  }

  goToSignUp(): void {
    this.router.navigate(['/login'], { queryParams: { mode: 'signup' } });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
