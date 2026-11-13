import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

interface MetricItem {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

interface CapabilityItem {
  icon: string;
  badge: string;
  title: string;
  description: string;
  bullets: string[];
}

interface FaqItem {
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
  activePreviewTab: 'discovery' | 'execution' | 'observability' | 'reports' = 'discovery';
  openFaqIndex: number | null = 0;

  metrics: MetricItem[] = [
    { label: 'Throughput Peak', value: '1,420 RPS', change: '+32% vs last run', positive: true },
    { label: 'Avg Latency (P50)', value: '38 ms', change: '-14ms optimized', positive: true },
    { label: 'Tail Latency (P99)', value: '112 ms', change: 'Zero spikes', positive: true },
    { label: 'Error Rate', value: '0.02%', change: '99.98% passed', positive: true },
  ];

  capabilities: CapabilityItem[] = [
    {
      icon: 'bi-compass-fill',
      badge: 'Auto-Discovery',
      title: 'Headless Crawler & Test Builder',
      description:
        'Point PerfAnalyzer at any URL or API base. The built-in Playwright & DOM discovery engine inspects interactive links, forms, and API routes to synthesize production-ready JMeter and Taurus test definitions.',
      bullets: [
        'Automatic parameter & cookie extraction',
        'Direct generation of .jmx XML & Taurus YAML',
        'Zero manual GUI scripting required',
      ],
    },
    {
      icon: 'bi-cpu-fill',
      badge: 'Dual Engine',
      title: 'Local Taurus & Distributed Jenkins',
      description:
        'Execute tests instantly on your local Taurus engine, or dispatch massive distributed stress scenarios across your dedicated Jenkins agent cluster with automated pipeline orchestration.',
      bullets: [
        'Bundled Apache JMeter 5.6.3 + Taurus CLI',
        'Declarative Jenkinsfile pipeline integration',
        'Enforced concurrency & virtual user quotas',
      ],
    },
    {
      icon: 'bi-broadcast-pin',
      badge: 'Live Streaming',
      title: 'Real-Time Telemetry & Console Logs',
      description:
        'Never wait for tests to complete before seeing what is happening. High-frequency WebSocket streams transmit live server responses, error rates, and console output directly to your browser.',
      bullets: [
        'Live throughput (RPS) and latency graphs',
        'Streaming execution logs in a terminal view',
        'Instant stop & abort safety controls',
      ],
    },
    {
      icon: 'bi-activity',
      badge: 'APM Observability',
      title: 'Deep OpenTelemetry & Uptrace Tracing',
      description:
        'Correlate artificial load spikes with actual backend bottleneck traces. Embedded OpenTelemetry instrumentation visualizes database queries, external HTTP calls, and slow internal methods.',
      bullets: [
        'End-to-end distributed trace waterfall',
        'Correlate HTTP 5xx errors to exact line of code',
        'Pre-configured instrumentation guides',
      ],
    },
    {
      icon: 'bi-folder-check',
      badge: 'Workspaces',
      title: 'Workspace Files & Artifact Management',
      description:
        'Group test scripts, CSV datasets, environment configs, and historical report archives within isolated project workspaces. Download full raw data or share interactive dashboards with your team.',
      bullets: [
        'Project-level data files & CSV parametrization',
        'Downloadable JMeter HTML dashboard archives',
        'Full historical test comparison & trends',
      ],
    },
    {
      icon: 'bi-calendar-check-fill',
      badge: 'Automation',
      title: 'Scheduled Regressions & Cron Jobs',
      description:
        'Integrate continuous performance validation into your engineering rhythm. Schedule load tests to execute automatically during off-peak hours and receive alerts when SLAs degrade.',
      bullets: [
        'Cron-based test scheduling (APScheduler)',
        'Automated SLA threshold validations',
        'Historical pass/fail trend tracking',
      ],
    },
  ];

  faqs: FaqItem[] = [
    {
      question: 'Do I need prior experience with Apache JMeter to use PerfAnalyzer?',
      answer:
        'Not at all. PerfAnalyzer was designed specifically to eliminate JMeter’s steep learning curve. The platform provides an automated crawler that discovers your API routes and web pages, generates standard test scenarios, and executes them with a single click. For veteran performance engineers, you can also import custom .jmx files directly.',
    },
    {
      question: 'How do you execute load without causing cloud provider lock-in?',
      answer:
        'PerfAnalyzer uses open-standard technologies under the hood: Apache JMeter 5.6.3 and Taurus bzt. You are never locked into a proprietary test format. You can export generated .jmx scripts, Taurus YAML configs, raw .jtl telemetry files, and self-contained HTML dashboards at any time.',
    },
    {
      question: 'What is the difference between Local and Jenkins execution?',
      answer:
        'Local execution runs directly on the bundled Taurus engine for rapid feedback, smoke tests, and scenario verification. When you need heavy load (thousands of virtual users) or want tests tied into your pull requests, PerfAnalyzer dispatches the job to your Jenkins pipeline agents automatically.',
    },
    {
      question: 'How does the APM and OpenTelemetry integration work?',
      answer:
        'PerfAnalyzer includes embedded OpenTelemetry instrumentation and an authenticated Uptrace proxy. When load tests run, you can inspect distributed traces to see exactly which database query, external microservice, or function call slowed down your response time.',
    },
    {
      question: 'Can I start using PerfAnalyzer for free?',
      answer:
        'Yes. The Free Tier includes 30 test runs per month, up to 500 virtual users, and 3 project workspaces with full dashboard analytics. No credit card is required to sign up and begin testing.',
    },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.isLoggedIn = !!localStorage.getItem('auth_token');
    }
  }

  setPreviewTab(tab: 'discovery' | 'execution' | 'observability' | 'reports'): void {
    this.activePreviewTab = tab;
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
