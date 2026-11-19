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
      tag: 'Step 1 · Set Up Your Test',
      title: 'No scripts, no setup headaches — just paste a URL and go',
      description:
        "Setting up a performance test used to mean hours of XML configuration. With PerfAnalyzer, you paste in your website or API address, pick how many visitors you want to simulate, and hit run. That's it.",
      bullets: [
        'Paste any URL and your endpoints are found automatically — no manual mapping',
        'Use a simple slider to set how many users to simulate, from 10 to 100,000',
        'Adjust how gradually traffic ramps up so your server isn\'t hit all at once',
      ],
      route: '/create-test',
      screenshotFilename: 'create-test.png',
      imageSrc: '/screenshots/create-test.png',
      imageAlt: 'PerfAnalyzer Create Test Interface',
      reverseLayout: false,
    },
    {
      id: 'live-execution',
      tag: 'Step 2 · Watch It Run Live',
      title: 'See exactly how your app behaves the moment traffic hits',
      description:
        "Once your test starts, you don't stare at a spinner and wait. You watch live. Speed, errors, active users — everything updates in real time right in your browser. If something looks wrong, you can pause or stop the test instantly. No damage, no guesswork.",
      bullets: [
        'Live dashboard shows speed, active users, and errors as they happen',
        'Spot exactly when your server starts to slow down under heavy load',
        'Stop the test immediately with one click — your servers stay safe',
      ],
      route: '/queue',
      screenshotFilename: 'live-execution.png',
      imageSrc: '/screenshots/logs.png',
      imageAlt: 'PerfAnalyzer Live Test Execution Dashboard',
      reverseLayout: true,
    },
    {
      id: 'apm-tracing',
      tag: "Step 3 · Find What's Slow",
      title: "Know exactly which part of your app is the problem — not just that it's slow",
      description:
        "When your app slows down under pressure, 'it's slow' isn't good enough. PerfAnalyzer shows you where time is actually being spent — which database query, which service call, which endpoint. You get a clear view of your whole request path, so you fix the right thing the first time.",
      bullets: [
        'See a timeline of every request, broken down step by step',
        'Instantly spot slow database calls or third-party services dragging things down',
        "Understand your app's behaviour under load, not just in isolation",
      ],
      route: '/monitoring',
      screenshotFilename: 'apm-tracing.png',
      imageSrc: '/screenshots/monitoring.png',
      imageAlt: 'PerfAnalyzer Performance Monitoring and Tracing',
      reverseLayout: false,
    },
    {
      id: 'reports',
      tag: 'Step 4 · Share the Results',
      title: 'Reports your team, your clients, and your boss can actually read',
      description:
        "When the test finishes, your results are ready to share — no copy-pasting numbers, no manual charts. Download a clean, professional report that shows what was tested, how the app performed, and whether it passed your targets. Useful for internal reviews, client handoffs, or just keeping a record over time.",
      bullets: [
        'Clear pass/fail summary with response time breakdowns — easy for anyone to read',
        'Compare results across multiple test runs to track improvements over time',
        'Download as a PDF or as an interactive HTML file to share with anyone',
      ],
      route: '/reports',
      screenshotFilename: 'reports.png',
      imageSrc: '/screenshots/report.png',
      imageAlt: 'PerfAnalyzer Performance Reports',
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
      question: 'Do I need to know JMeter or write any scripts to get started?',
      answer:
        "Not at all. You just paste your website or API URL, choose how many users to simulate, and hit run. PerfAnalyzer handles all the scripting in the background. If you are an advanced user and already have a custom .jmx test file, you can upload that too — but it is completely optional.",
    },
    {
      question: 'Will running a load test break or slow down my live site?',
      answer:
        "Only if it is already at its limit — which is exactly what you want to find out. You are in full control: start with a small number of users, watch how your server responds in real time, and stop immediately with one click if anything looks off. We always recommend testing on a staging environment first if you want to be extra safe.",
    },
    {
      question: 'What exactly do I see while a test is running?',
      answer:
        "You get a live dashboard that updates every second — how many users are active, how fast your server is responding, how many requests are going through per second, and whether any errors are appearing. You do not need to refresh the page or wait for it to finish. Everything streams directly to your screen as it happens.",
    },
    {
      question: "How do I know what is actually causing slowness in my app?",
      answer:
        "PerfAnalyzer goes beyond just showing that something is slow. The monitoring view breaks down each request step by step — so you can see whether the delay is in your database, a third-party API call, or your own server logic. This means you spend time fixing the actual problem, not hunting for it.",
    },
    {
      question: 'Can I share results with my team or clients after a test?',
      answer:
        "Yes. When a test finishes, you get a full report you can download and share. It includes a clean summary of how the app performed, response time breakdowns, pass/fail results against your targets, and a full interactive HTML dashboard. No extra setup needed — just download and send.",
    },
    {
      question: 'How many users can I simulate at once?',
      answer:
        "The Free Tier lets you simulate up to 500 virtual users. The Professional plan goes up to 10,000, and Enterprise supports 100,000+ for large-scale stress testing. You can adjust the number at any time before running a test, and ramp them up gradually so your server is not hit all at once.",
    },
    {
      question: 'Is there a free plan? Do I need a credit card to sign up?',
      answer:
        "Yes, there is a free plan — and no credit card is required. The Free Tier gives you 30 test runs per month, up to 500 virtual users, and 3 project workspaces. It is a full working version of the product, not a limited trial. You can upgrade any time if you need more capacity.",
    },
    {
      question: 'Can I test APIs as well as websites?',
      answer:
        "Absolutely. PerfAnalyzer works with any HTTP or HTTPS target — REST APIs, GraphQL endpoints, web apps, or individual pages. You can test a single endpoint or a full user journey across multiple routes. Just paste the base URL and let the auto-discovery find your routes, or define them manually.",
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