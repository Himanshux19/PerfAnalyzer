import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import {
  ApiService,
  MonitoringCatalogEntry,
  MonitoringIntegration,
  CreateMonitoringPayload,
  UpdateMonitoringPayload,
} from '../../api.service';

export const DEVICON_MAP: Record<string, string> = {
  'dotnet-sdk': 'devicon-dot-net-plain colored',
  'go-sdk': 'devicon-go-original-wordmark colored',
  'nodejs-sdk': 'devicon-nodejs-plain colored',
  'php-sdk': 'devicon-php-plain colored',
  'python-sdk': 'devicon-python-plain colored',
  'rust-sdk': 'devicon-rust-original colored',
  'opentelemetry-phoenix': 'devicon-phoenix-original colored',
  'opentelemetry-beego': 'devicon-go-original colored',
  'opentelemetry-echo': 'devicon-go-original colored',
  'go-gin': 'devicon-go-plain colored',
  'opentelemetry-go-zero': 'devicon-go-original colored',
  'opentelemetry-gorilla-mux': 'devicon-go-original colored',
  'opentelemetry-go-grpc': 'devicon-grpc-original colored',
  'opentelemetry-net-http': 'devicon-go-original colored',
  'opentelemetry-quarkus': 'devicon-quarkus-original colored',
  'java-spring-boot': 'devicon-spring-original colored',
  'nodejs-express': 'devicon-express-original',
  'opentelemetry-laravel': 'devicon-laravel-original colored',
  'opentelemetry-slim': 'devicon-php-plain colored',
  'opentelemetry-symfony': 'devicon-symfony-original colored',
  'opentelemetry-celery': 'devicon-python-plain colored',
  'python-django': 'devicon-django-plain colored',
  'opentelemetry-falcon': 'devicon-python-plain colored',
  'python-fastapi': 'devicon-fastapi-plain colored',
  'python-flask': 'devicon-flask-original colored',
  'opentelemetry-pyramid': 'devicon-python-plain colored',
  'ruby-rails': 'devicon-rails-plain colored',
  'opentelemetry-sinatra': 'devicon-ruby-plain colored',
  'opentelemetry-nestjs': 'devicon-nestjs-original colored',
  'opentelemetry-nextjs': 'devicon-nextjs-original colored',
  'opentelemetry-database-sql': 'devicon-go-original colored',
  'opentelemetry-ent': 'devicon-go-original colored',
  'opentelemetry-gorm': 'devicon-go-original colored',
  'opentelemetry-sqlalchemy': 'devicon-sqlalchemy-original colored',
  'opentelemetry-go-lambda': 'devicon-amazonwebservices-plain-wordmark colored',
  'opentelemetry-node-lambda': 'devicon-amazonwebservices-plain-wordmark colored',
  'collector-mysql': 'devicon-mysql-original colored',
  'collector-postgresql': 'devicon-postgresql-plain colored',
  'collector-redis': 'devicon-redis-plain colored',
  'opentelemetry-tomcat': 'devicon-tomcat-original colored',
  'opentelemetry-php-fpm': 'devicon-php-plain colored',
  'collector-docker': 'devicon-docker-plain colored',
  'collector-hostmetrics': 'devicon-linux-plain colored',
  'collector-kubernetes': 'devicon-kubernetes-plain colored',
  'collector-nginx': 'devicon-nginx-original colored',
  'collector-kafka': 'devicon-apachekafka-original colored',
  'collector-aws-cloudwatch': 'devicon-amazonwebservices-plain-wordmark colored',
  'opentelemetry-filelog-receiver': 'devicon-linux-plain colored',
  'opentelemetry-httpcheck': 'devicon-networkx-original colored',
  'opentelemetry-k8seventsreceiver': 'devicon-kubernetes-plain colored',
  'collector-prometheus': 'devicon-prometheus-original colored',
  'opentelemetry-rabbitmq': 'devicon-rabbitmq-original colored',
  'opentelemetry-syslog-receiver': 'devicon-linux-plain colored',
  'opentelemetry-logrus': 'devicon-go-original colored',
  'opentelemetry-slog': 'devicon-go-original colored',
  'opentelemetry-zap': 'devicon-go-original colored',
  'opentelemetry-log4j': 'devicon-java-plain colored',
  'opentelemetry-logback': 'devicon-java-plain colored',
  'opentelemetry-openai': 'devicon-python-plain colored',
  'opentelemetry-rag-observability': 'devicon-python-plain colored',
};

export const DEVICON_URLS: Record<string, string> = {
  'dotnet-sdk': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/dot-net/dot-net-original.svg',
  'go-sdk': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original-wordmark.svg',
  'nodejs-sdk': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg',
  'php-sdk': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg',
  'python-sdk': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
  'rust-sdk': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg',
  'opentelemetry-phoenix': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/phoenix/phoenix-original.svg',
  'opentelemetry-beego': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-echo': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'go-gin': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-go-zero': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-gorilla-mux': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-go-grpc': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/grpc/grpc-original.svg',
  'opentelemetry-net-http': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-quarkus': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/quarkus/quarkus-original.svg',
  'java-spring-boot': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/spring/spring-original.svg',
  'nodejs-express': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/express/express-original.svg',
  'opentelemetry-laravel': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/laravel/laravel-original.svg',
  'opentelemetry-slim': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg',
  'opentelemetry-symfony': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/symfony/symfony-original.svg',
  'opentelemetry-celery': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
  'python-django': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/django/django-plain.svg',
  'opentelemetry-falcon': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
  'python-fastapi': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/fastapi/fastapi-original.svg',
  'python-flask': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/flask/flask-original.svg',
  'opentelemetry-pyramid': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
  'ruby-rails': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rails/rails-plain.svg',
  'opentelemetry-sinatra': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ruby/ruby-original.svg',
  'opentelemetry-nestjs': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nestjs/nestjs-original.svg',
  'opentelemetry-nextjs': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg',
  'opentelemetry-database-sql': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-ent': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-gorm': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-sqlalchemy': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlalchemy/sqlalchemy-original.svg',
  'opentelemetry-go-lambda': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg',
  'opentelemetry-node-lambda': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg',
  'collector-mysql': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg',
  'collector-postgresql': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg',
  'collector-redis': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg',
  'opentelemetry-tomcat': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tomcat/tomcat-original.svg',
  'opentelemetry-php-fpm': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg',
  'collector-docker': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg',
  'collector-hostmetrics': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg',
  'collector-kubernetes': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kubernetes/kubernetes-plain.svg',
  'collector-nginx': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nginx/nginx-original.svg',
  'collector-kafka': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apachekafka/apachekafka-original.svg',
  'collector-aws-cloudwatch': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg',
  'opentelemetry-filelog-receiver': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg',
  'opentelemetry-httpcheck': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/networkx/networkx-original.svg',
  'opentelemetry-k8seventsreceiver': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kubernetes/kubernetes-plain.svg',
  'collector-prometheus': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/prometheus/prometheus-original.svg',
  'opentelemetry-rabbitmq': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rabbitmq/rabbitmq-original.svg',
  'opentelemetry-syslog-receiver': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg',
  'opentelemetry-logrus': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-slog': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-zap': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
  'opentelemetry-log4j': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg',
  'opentelemetry-logback': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg',
  'opentelemetry-openai': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
  'opentelemetry-rag-observability': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
};

export const TECH_ACCENTS: Record<string, { bg: string; border: string; glow: string }> = {
  'dotnet-sdk': { bg: '#f5f3ff', border: '#ddd6fe', glow: 'rgba(81, 43, 212, 0.15)' },
  'go-sdk': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'nodejs-sdk': { bg: '#f0fdf4', border: '#bbf7d0', glow: 'rgba(95, 160, 78, 0.15)' },
  'php-sdk': { bg: '#eef2ff', border: '#c7d2fe', glow: 'rgba(119, 123, 180, 0.15)' },
  'python-sdk': { bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(55, 118, 171, 0.15)' },
  'rust-sdk': { bg: '#fff7ed', border: '#ffedd5', glow: 'rgba(206, 65, 43, 0.15)' },
  'opentelemetry-phoenix': { bg: '#fdf2f8', border: '#fbcfe8', glow: 'rgba(236, 72, 153, 0.15)' },
  'opentelemetry-beego': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-echo': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'go-gin': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 129, 167, 0.15)' },
  'opentelemetry-go-zero': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-gorilla-mux': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-go-grpc': { bg: '#e0f2fe', border: '#bae6fd', glow: 'rgba(36, 150, 237, 0.15)' },
  'opentelemetry-net-http': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-quarkus': { bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(70, 153, 234, 0.15)' },
  'java-spring-boot': { bg: '#f0fdf4', border: '#bbf7d0', glow: 'rgba(109, 179, 63, 0.15)' },
  'nodejs-express': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(0, 0, 0, 0.12)' },
  'opentelemetry-laravel': { bg: '#fff1f2', border: '#fecdd3', glow: 'rgba(244, 63, 94, 0.15)' },
  'opentelemetry-slim': { bg: '#eef2ff', border: '#c7d2fe', glow: 'rgba(119, 123, 180, 0.15)' },
  'opentelemetry-symfony': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(0, 0, 0, 0.12)' },
  'opentelemetry-celery': { bg: '#f0fdf4', border: '#bbf7d0', glow: 'rgba(55, 118, 171, 0.15)' },
  'python-django': { bg: '#ebfbee', border: '#c3fad5', glow: 'rgba(9, 46, 32, 0.15)' },
  'opentelemetry-falcon': { bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(55, 118, 171, 0.15)' },
  'python-fastapi': { bg: '#e6fffa', border: '#b2f5ea', glow: 'rgba(0, 150, 136, 0.15)' },
  'python-flask': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(0, 0, 0, 0.1)' },
  'opentelemetry-pyramid': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(100, 116, 139, 0.15)' },
  'ruby-rails': { bg: '#fef2f2', border: '#fecaca', glow: 'rgba(204, 0, 0, 0.15)' },
  'opentelemetry-sinatra': { bg: '#fef2f2', border: '#fecaca', glow: 'rgba(204, 0, 0, 0.15)' },
  'opentelemetry-nestjs': { bg: '#fff1f2', border: '#fecdd3', glow: 'rgba(224, 35, 78, 0.15)' },
  'opentelemetry-nextjs': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(0, 0, 0, 0.15)' },
  'opentelemetry-database-sql': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-ent': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-gorm': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-sqlalchemy': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(215, 27, 27, 0.15)' },
  'opentelemetry-go-lambda': { bg: '#fffbeb', border: '#fef3c7', glow: 'rgba(255, 153, 0, 0.15)' },
  'opentelemetry-node-lambda': { bg: '#fffbeb', border: '#fef3c7', glow: 'rgba(255, 153, 0, 0.15)' },
  'collector-mysql': { bg: '#fffbeb', border: '#fef3c7', glow: 'rgba(242, 145, 17, 0.15)' },
  'collector-postgresql': { bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(51, 103, 145, 0.15)' },
  'collector-redis': { bg: '#fef2f2', border: '#fecaca', glow: 'rgba(220, 56, 45, 0.15)' },
  'opentelemetry-tomcat': { bg: '#fffbeb', border: '#fef3c7', glow: 'rgba(248, 152, 29, 0.15)' },
  'opentelemetry-php-fpm': { bg: '#eef2ff', border: '#c7d2fe', glow: 'rgba(119, 123, 180, 0.15)' },
  'collector-docker': { bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(36, 150, 237, 0.15)' },
  'collector-hostmetrics': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(71, 85, 105, 0.15)' },
  'collector-kubernetes': { bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(50, 108, 229, 0.15)' },
  'collector-nginx': { bg: '#f0fdf4', border: '#bbf7d0', glow: 'rgba(0, 150, 57, 0.15)' },
  'collector-kafka': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(35, 31, 32, 0.12)' },
  'collector-aws-cloudwatch': { bg: '#fffbeb', border: '#fef3c7', glow: 'rgba(255, 153, 0, 0.15)' },
  'opentelemetry-filelog-receiver': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(71, 85, 105, 0.15)' },
  'opentelemetry-httpcheck': { bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(37, 99, 235, 0.15)' },
  'opentelemetry-k8seventsreceiver': { bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(50, 108, 229, 0.15)' },
  'collector-prometheus': { bg: '#fff7ed', border: '#ffedd5', glow: 'rgba(230, 82, 44, 0.15)' },
  'opentelemetry-rabbitmq': { bg: '#fff7ed', border: '#ffedd5', glow: 'rgba(255, 102, 0, 0.15)' },
  'opentelemetry-syslog-receiver': { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(71, 85, 105, 0.15)' },
  'opentelemetry-logrus': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-slog': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-zap': { bg: '#e0f7fa', border: '#b2ebf2', glow: 'rgba(0, 173, 216, 0.15)' },
  'opentelemetry-log4j': { bg: '#fef2f2', border: '#fecaca', glow: 'rgba(231, 111, 81, 0.15)' },
  'opentelemetry-logback': { bg: '#fef2f2', border: '#fecaca', glow: 'rgba(231, 111, 81, 0.15)' },
  'opentelemetry-openai': { bg: '#f0fdf4', border: '#bbf7d0', glow: 'rgba(16, 163, 127, 0.15)' },
  'opentelemetry-rag-observability': { bg: '#f5f3ff', border: '#ddd6fe', glow: 'rgba(139, 92, 246, 0.15)' },
};

// ── Fallback SVG Logos ────────────────────────────────────────────────────────
export const FALLBACK_SVGS: Record<string, string> = {
  'category-languages': `<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  'category-frameworks': `<svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
  'category-receivers': `<svg viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>`,
  'category-infrastructure': `<svg viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`,
  'category-databases': `<svg viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`,
  'default': `<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
};

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './monitoring.html',
  styleUrl: './monitoring.css',
})
export class Monitoring implements OnInit {
  // Navigation & View State
  activeView: 'catalog' | 'detail' = 'catalog';
  activeCategory: string = 'all';
  searchQuery = '';

  // Catalog Data
  catalogItems: MonitoringCatalogEntry[] = [];
  selectedCatalogEntry: MonitoringCatalogEntry | null = null;
  catalogLoading = false;
  catalogError: string | null = null;

  // Interactive Live DSN Customizer in Detail Setup View
  customDsn = '';
  customServiceName = '';
  showCustomDsnText = false;

  // How to get DSN Guide Modal
  showDsnGuideModal = false;

  // Saved Monitors Data
  monitors: MonitoringIntegration[] = [];
  monitorsLoading = false;
  monitorsError: string | null = null;

  // Configure Modal State
  showConfigureModal = false;
  isEditingMonitor = false;
  editingMonitorId: number | null = null;
  formCatalogId = '';
  formMonitorName = '';
  formCategory = '';
  formLanguage = '';
  formFramework = '';
  formServiceName = '';
  formUptraceDsn = '';
  formDashboardUrl = '';
  formEnabled = true;
  formStatus = 'configuration_saved';
  formSaving = false;
  formError: string | null = null;
  showDsnText = false;

  // Delete Confirm Modal
  showDeleteModal = false;
  deletingMonitor: MonitoringIntegration | null = null;
  deleteSaving = false;

  // Waiting for Telemetry Modal
  showTelemetryGuideModal = false;
  telemetryGuideMonitor: MonitoringIntegration | null = null;

  // Monitoring Viewer (Iframe sandbox abstraction)
  activeViewerMonitor: MonitoringIntegration | null = null;
  viewerSafeUrl: SafeResourceUrl | null = null;
  viewerIframeError = false;

  // Copy Feedback state (tracks which snippet ID was copied)
  copiedSnippetKey: string | null = null;
  private copyTimeout: any = null;

  // Cached sanitized fallback SVGs
  private svgCache = new Map<string, SafeHtml>();

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.preloadFallbackSvgs();
    this.loadCatalog();
    this.loadMonitors();
  }

  // ── Preload Fallback SVGs ─────────────────────────────────────

  private preloadFallbackSvgs(): void {
    for (const [key, svg] of Object.entries(FALLBACK_SVGS)) {
      this.svgCache.set(key, this.sanitizer.bypassSecurityTrustHtml(svg));
    }
  }

  // ── Devicon & Icon Resolvers ─────────────────────────────────

  failedIcons = new Set<string>();

  onIconError(id?: string | null): void {
    if (id) {
      this.failedIcons.add(id.toLowerCase().trim());
      this.cdr.markForCheck();
    }
  }

  hasIconFailed(id?: string | null): boolean {
    if (!id) return true;
    return this.failedIcons.has(id.toLowerCase().trim());
  }

  getDeviconUrl(id?: string | null): string {
    if (!id) return '';
    const key = id.toLowerCase().trim();
    return DEVICON_URLS[key] || '';
  }

  getDeviconClass(id?: string | null): string {
    if (!id) return '';
    const key = id.toLowerCase().trim();
    return DEVICON_MAP[key] || '';
  }

  getTechAccent(id?: string | null): { bg: string; border: string; glow: string } {
    if (!id) return { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(0, 0, 0, 0.05)' };
    const key = id.toLowerCase().trim();
    return TECH_ACCENTS[key] || { bg: '#f8fafc', border: '#e2e8f0', glow: 'rgba(0, 0, 0, 0.05)' };
  }

  getFallbackSvg(category?: string): SafeHtml {
    if (category) {
      const catKey = `category-${category.toLowerCase().trim()}`;
      if (this.svgCache.has(catKey)) {
        return this.svgCache.get(catKey)!;
      }
    }
    return this.svgCache.get('default') || '';
  }

  // ── Dynamic Snippet Interpolation ────────────────────────────

  getInterpolatedContent(content?: string): string {
    if (!content) return '';
    let res = content;

    const dsn = this.customDsn && this.customDsn.trim()
      ? this.customDsn.trim()
      : 'https://<token>@uptrace.dev/<project_id>';

    const serviceName = this.customServiceName && this.customServiceName.trim()
      ? this.customServiceName.trim()
      : (this.selectedCatalogEntry?.framework
          ? `${this.selectedCatalogEntry.framework}-service`
          : (this.selectedCatalogEntry?.language ? `${this.selectedCatalogEntry.language}-app` : 'my-service'));

    // Replace DSN placeholders
    res = res.replace(/https:\/\/<token>@uptrace\.dev\/<project_id>/g, dsn);
    res = res.replace(/http:\/\/localhost:14318\/<project_id>/g, dsn);

    // Replace service name placeholders if customized
    if (this.customServiceName && this.customServiceName.trim()) {
      res = res.replace(/fastapi-backend/g, serviceName);
      res = res.replace(/django-app/g, serviceName);
      res = res.replace(/flask-app/g, serviceName);
      res = res.replace(/my-service/g, serviceName);
      res = res.replace(/express-api/g, serviceName);
      res = res.replace(/spring-service/g, serviceName);
    }

    return res;
  }

  getInterpolatedVariableValue(originalValue: string, varName: string): string {
    if (varName === 'UPTRACE_DSN' && this.customDsn && this.customDsn.trim()) {
      return this.customDsn.trim();
    }
    if (varName === 'OTEL_SERVICE_NAME' && this.customServiceName && this.customServiceName.trim()) {
      return this.customServiceName.trim();
    }
    return originalValue;
  }

  getEnvVariablesSnippet(variables?: Array<{ name: string; value: string; description?: string }>): string {
    if (!variables || variables.length === 0) return '';
    return variables
      .map((v) => `${v.name}=${this.getInterpolatedVariableValue(v.value, v.name)}`)
      .join('\n');
  }

  getExportCommandsSnippet(variables?: Array<{ name: string; value: string; description?: string }>): string {
    if (!variables || variables.length === 0) return '';
    return variables
      .map((v) => `export ${v.name}="${this.getInterpolatedVariableValue(v.value, v.name)}"`)
      .join('\n');
  }

  // ── DSN Helper Guide Modal ───────────────────────────────────

  openDsnGuideModal(event?: Event): void {
    if (event) event.stopPropagation();
    this.showDsnGuideModal = true;
    this.cdr.detectChanges();
  }

  closeDsnGuideModal(): void {
    this.showDsnGuideModal = false;
  }

  // ── Catalog Methods ──────────────────────────────────────────

  loadCatalog(): void {
    this.catalogLoading = true;
    this.catalogError = null;
    this.api.getCatalog().subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.catalogItems = data || [];
          this.catalogLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.catalogError = 'Failed to load integrations catalog. Make sure the backend is running.';
          this.catalogLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
    });
  }

  get filteredCatalog(): MonitoringCatalogEntry[] {
    let list = this.catalogItems;
    if (this.activeCategory !== 'all') {
      list = list.filter((item) => (item.category || '').toLowerCase() === this.activeCategory);
    }
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.displayName.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.language && item.language.toLowerCase().includes(q)) ||
          (item.framework && item.framework.toLowerCase().includes(q)) ||
          (item.subcategory && item.subcategory.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q)),
      );
    }
    return list;
  }

  getCategoryCount(cat: string): number {
    if (cat === 'all') return this.catalogItems.length;
    return this.catalogItems.filter((i) => (i.category || '').toLowerCase() === cat.toLowerCase()).length;
  }

  selectCategory(cat: string): void {
    this.activeCategory = cat;
    this.cdr.detectChanges();
  }

  openIntegrationDetail(entry: MonitoringCatalogEntry): void {
    this.selectedCatalogEntry = entry;
    this.customServiceName = entry.framework
      ? `${entry.framework}-service`
      : entry.language
        ? `${entry.language}-app`
        : 'my-service';
    this.activeView = 'detail';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.cdr.detectChanges();
  }

  backToCatalog(): void {
    this.activeView = 'catalog';
    this.selectedCatalogEntry = null;
    this.cdr.detectChanges();
  }

  // ── Saved Monitors Management ────────────────────────────────

  loadMonitors(): void {
    this.monitorsLoading = true;
    this.monitorsError = null;
    this.api.getMonitoringIntegrations().subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.monitors = data || [];
          this.monitorsLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.monitorsError = 'Failed to load saved monitors.';
          this.monitorsLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
    });
  }

  toggleMonitor(monitor: MonitoringIntegration, event: Event): void {
    event.stopPropagation();
    const newEnabled = !monitor.enabled;
    const newStatus = newEnabled ? 'configuration_saved' : 'disabled';

    // Optimistic update
    monitor.enabled = newEnabled;
    monitor.status = newStatus;

    if (!newEnabled && this.activeViewerMonitor?.id === monitor.id) {
      this.closeViewer();
    }

    this.api.patchMonitoringStatus(monitor.id, { enabled: newEnabled, status: newStatus }).subscribe({
      next: (updated) => {
        monitor.enabled = updated.enabled;
        monitor.status = updated.status;
        this.cdr.detectChanges();
      },
      error: () => {
        // Revert on error
        monitor.enabled = !newEnabled;
        monitor.status = monitor.enabled ? 'configuration_saved' : 'disabled';
        alert('Failed to update monitor state.');
        this.cdr.detectChanges();
      },
    });
  }

  // ── Configure Modal Flow ─────────────────────────────────────

  openConfigureModal(entry?: MonitoringCatalogEntry): void {
    this.isEditingMonitor = false;
    this.editingMonitorId = null;
    this.formError = null;
    this.showDsnText = false;

    const sourceEntry = entry || this.selectedCatalogEntry || this.catalogItems[0];
    if (sourceEntry) {
      this.formCatalogId = sourceEntry.id;
      this.formMonitorName = `${sourceEntry.displayName} Monitor`;
      this.formCategory = sourceEntry.category;
      this.formLanguage = sourceEntry.language || '';
      this.formFramework = sourceEntry.framework || '';
      this.formServiceName = this.customServiceName || (sourceEntry.framework
        ? `${sourceEntry.framework}-service`
        : sourceEntry.language
          ? `${sourceEntry.language}-app`
          : 'my-service');
      this.formDashboardUrl = 'https://app.uptrace.dev';
      this.formUptraceDsn = this.customDsn || '';
    } else {
      this.formCatalogId = '';
      this.formMonitorName = '';
      this.formCategory = 'frameworks';
      this.formLanguage = '';
      this.formFramework = '';
      this.formServiceName = '';
      this.formDashboardUrl = 'https://app.uptrace.dev';
      this.formUptraceDsn = '';
    }

    this.formEnabled = true;
    this.formStatus = 'configuration_saved';
    this.showConfigureModal = true;
    this.cdr.detectChanges();
  }

  onModalCatalogChange(): void {
    const found = this.catalogItems.find((c) => c.id === this.formCatalogId);
    if (found) {
      this.formCategory = found.category;
      this.formLanguage = found.language || '';
      this.formFramework = found.framework || '';
      if (!this.formMonitorName || this.formMonitorName.endsWith('Monitor')) {
        this.formMonitorName = `${found.displayName} Monitor`;
      }
      if (!this.formServiceName) {
        this.formServiceName = this.customServiceName || (found.framework
          ? `${found.framework}-service`
          : found.language
            ? `${found.language}-app`
            : 'my-service');
      }
      this.cdr.detectChanges();
    }
  }

  openEditModal(monitor: MonitoringIntegration, event?: Event): void {
    if (event) event.stopPropagation();
    this.isEditingMonitor = true;
    this.editingMonitorId = monitor.id;
    this.formCatalogId = monitor.catalogIntegrationId;
    this.formMonitorName = monitor.name;
    this.formCategory = monitor.category;
    this.formLanguage = monitor.language || '';
    this.formFramework = monitor.framework || '';
    this.formServiceName = monitor.serviceName || '';
    this.formDashboardUrl = monitor.dashboardUrl || 'https://app.uptrace.dev';
    this.formUptraceDsn = '';
    this.formEnabled = monitor.enabled;
    this.formStatus = monitor.status;
    this.formError = null;
    this.showDsnText = false;
    this.showConfigureModal = true;
    this.cdr.detectChanges();
  }

  closeConfigureModal(): void {
    this.showConfigureModal = false;
    this.formError = null;
  }

  saveConfigureMonitor(): void {
    if (!this.formMonitorName.trim()) {
      this.formError = 'Monitor name is required.';
      return;
    }

    if (!this.isEditingMonitor) {
      if (!this.formUptraceDsn || !this.formUptraceDsn.trim()) {
        this.formError = 'Uptrace DSN is required. Monitoring cannot be configured without a valid project DSN.';
        return;
      }
      const dsn = this.formUptraceDsn.trim();
      if ((!dsn.startsWith('http://') && !dsn.startsWith('https://')) || !dsn.includes('@')) {
        this.formError = 'Invalid DSN format. Expected: https://<token>@uptrace.dev/<project_id>';
        return;
      }
    } else if (this.formUptraceDsn && this.formUptraceDsn.trim()) {
      const dsn = this.formUptraceDsn.trim();
      if ((!dsn.startsWith('http://') && !dsn.startsWith('https://')) || !dsn.includes('@')) {
        this.formError = 'Invalid DSN format. Expected: https://<token>@uptrace.dev/<project_id>';
        return;
      }
    }

    this.formSaving = true;
    this.formError = null;

    if (this.isEditingMonitor && this.editingMonitorId) {
      const updatePayload: UpdateMonitoringPayload = {
        name: this.formMonitorName.trim(),
        serviceName: this.formServiceName.trim(),
        dashboardUrl: this.formDashboardUrl.trim(),
        enabled: this.formEnabled,
        status: this.formStatus,
      };
      if (this.formUptraceDsn && this.formUptraceDsn.trim()) {
        updatePayload.uptraceDsn = this.formUptraceDsn.trim();
      }

      this.api.updateMonitoringIntegration(this.editingMonitorId, updatePayload).subscribe({
        next: (updated) => {
          this.zone.run(() => {
            const idx = this.monitors.findIndex((m) => m.id === this.editingMonitorId);
            if (idx !== -1) {
              this.monitors[idx] = updated;
              this.monitors = [...this.monitors];
            }
            this.formSaving = false;
            this.showConfigureModal = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.formError = err?.error?.detail || 'Failed to update monitor configuration.';
            this.formSaving = false;
            this.cdr.detectChanges();
          });
        },
      });
    } else {
      const createPayload: CreateMonitoringPayload = {
        catalogIntegrationId: this.formCatalogId,
        name: this.formMonitorName.trim(),
        category: this.formCategory,
        language: this.formLanguage,
        framework: this.formFramework,
        serviceName: this.formServiceName.trim(),
        uptraceDsn: this.formUptraceDsn.trim(),
        dashboardUrl: this.formDashboardUrl.trim() || 'https://app.uptrace.dev',
        enabled: this.formEnabled,
        status: 'configuration_saved',
      };

      this.api.createMonitoringIntegration(createPayload).subscribe({
        next: (newMonitor) => {
          this.zone.run(() => {
            this.monitors = [newMonitor, ...this.monitors];
            this.formSaving = false;
            this.showConfigureModal = false;
            this.openTelemetryGuide(newMonitor);
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.formError = err?.error?.detail || 'Failed to save monitor configuration.';
            this.formSaving = false;
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  // ── Delete Monitor Flow ──────────────────────────────────────

  openDeleteModal(monitor: MonitoringIntegration, event?: Event): void {
    if (event) event.stopPropagation();
    this.deletingMonitor = monitor;
    this.showDeleteModal = true;
    this.deleteSaving = false;
    this.cdr.detectChanges();
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deletingMonitor = null;
  }

  confirmDeleteMonitor(): void {
    if (!this.deletingMonitor) return;
    const targetId = this.deletingMonitor.id;
    this.deleteSaving = true;

    this.api.deleteMonitoringIntegration(targetId).subscribe({
      next: () => {
        this.zone.run(() => {
          this.monitors = this.monitors.filter((m) => m.id !== targetId);
          if (this.activeViewerMonitor?.id === targetId) {
            this.closeViewer();
          }
          this.deleteSaving = false;
          this.showDeleteModal = false;
          this.deletingMonitor = null;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.deleteSaving = false;
          alert('Failed to delete monitor. Please try again.');
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ── Open Setup From Saved Monitor ────────────────────────────

  openMonitorSetupGuide(monitor: MonitoringIntegration, event?: Event): void {
    if (event) event.stopPropagation();
    if (!monitor.enabled) return;
    const entry = this.catalogItems.find((i) => i.id === monitor.catalogIntegrationId);
    if (entry) {
      this.selectedCatalogEntry = entry;
      this.customServiceName = monitor.serviceName || '';
      this.activeView = 'detail';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.api.getCatalogEntry(monitor.catalogIntegrationId).subscribe({
        next: (item) => {
          this.selectedCatalogEntry = item;
          this.customServiceName = monitor.serviceName || '';
          this.activeView = 'detail';
          window.scrollTo({ top: 0, behavior: 'smooth' });
          this.cdr.detectChanges();
        },
        error: () => {
          alert('Could not find catalog setup guide for this integration.');
        },
      });
    }
    this.cdr.detectChanges();
  }

  // ── Telemetry Waiting Modal ──────────────────────────────────

  openTelemetryGuide(monitor: MonitoringIntegration, event?: Event): void {
    if (event) event.stopPropagation();
    if (!monitor.enabled) return;
    this.telemetryGuideMonitor = monitor;
    this.showTelemetryGuideModal = true;
    this.cdr.detectChanges();
  }

  closeTelemetryGuide(): void {
    this.showTelemetryGuideModal = false;
    this.telemetryGuideMonitor = null;
  }

  // ── Uptrace External Links & Viewer ─────────────────────────

  openUptrace(url?: string | null, event?: Event): void {
    if (event) event.stopPropagation();
    const targetUrl = url && url.trim() ? url.trim() : 'https://app.uptrace.dev';
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  openDocUrl(url: string, event?: Event): void {
    if (event) event.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  toggleLiveViewer(monitor: MonitoringIntegration, event?: Event): void {
    if (event) event.stopPropagation();
    if (!monitor.enabled) {
      if (this.activeViewerMonitor?.id === monitor.id) {
        this.closeViewer();
      }
      return;
    }
    if (this.activeViewerMonitor?.id === monitor.id) {
      this.closeViewer();
      return;
    }
    this.activeViewerMonitor = monitor;
    this.viewerIframeError = false;
    const url = monitor.dashboardUrl || 'https://app.uptrace.dev';
    this.viewerSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.cdr.detectChanges();
  }

  closeViewer(): void {
    this.activeViewerMonitor = null;
    this.viewerSafeUrl = null;
    this.viewerIframeError = false;
    this.cdr.detectChanges();
  }

  onIframeError(): void {
    this.viewerIframeError = true;
    this.cdr.detectChanges();
  }

  // ── Copy to Clipboard ────────────────────────────────────────

  copyToClipboard(text: string | undefined, key: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.zone.run(() => {
          this.copiedSnippetKey = key;
          if (this.copyTimeout) clearTimeout(this.copyTimeout);
          this.copyTimeout = setTimeout(() => {
            this.zone.run(() => {
              this.copiedSnippetKey = null;
              this.cdr.detectChanges();
            });
          }, 2500);
          this.cdr.detectChanges();
        });
      });
    }
  }

  isCopied(key: string): boolean {
    return this.copiedSnippetKey === key;
  }

  // ── Status, Signal & Type Helpers ────────────────────────────

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'configuration_saved':
        return 'status-badge-saved';
      case 'waiting_for_telemetry':
        return 'status-badge-waiting';
      case 'telemetry_detected':
        return 'status-badge-connected';
      case 'disabled':
        return 'status-badge-disabled';
      default:
        return 'status-badge-saved';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'configuration_saved':
        return 'Configured';
      case 'waiting_for_telemetry':
        return 'Waiting for Telemetry';
      case 'telemetry_detected':
        return 'Receiving Telemetry';
      case 'disabled':
        return 'Disabled';
      default:
        return 'Configured';
    }
  }

  getStatusIcon(status: string, enabled: boolean): string {
    if (!enabled) return 'bi-pause-circle';
    switch (status) {
      case 'configuration_saved':
        return 'bi-check-circle-fill';
      case 'waiting_for_telemetry':
        return 'bi-hourglass-split';
      case 'telemetry_detected':
        return 'bi-broadcast';
      case 'disabled':
        return 'bi-pause-circle';
      default:
        return 'bi-check-circle-fill';
    }
  }

  getSignalBadgeClass(signal: string): string {
    switch (signal.toLowerCase()) {
      case 'traces':
        return 'badge-signal-traces';
      case 'metrics':
        return 'badge-signal-metrics';
      case 'logs':
        return 'badge-signal-logs';
      default:
        return 'badge-signal-other';
    }
  }

  getSignalIcon(signal: string): string {
    switch (signal.toLowerCase()) {
      case 'traces':
        return 'bi-diagram-3';
      case 'metrics':
        return 'bi-graph-up';
      case 'logs':
        return 'bi-journal-text';
      default:
        return 'bi-activity';
    }
  }

  getTypeLabel(type: string): string {
    return type === 'collector' ? 'Collector' : 'SDK';
  }

  getTypeBadgeClass(type: string): string {
    return type === 'collector' ? 'type-badge-collector' : 'type-badge-sdk';
  }

  getCategoryLabel(category: string): string {
    switch (category?.toLowerCase()) {
      case 'languages':
        return 'Language';
      case 'frameworks':
        return 'Framework';
      case 'receivers':
        return 'Receiver';
      case 'infrastructure':
        return 'Infrastructure';
      case 'databases':
        return 'Database';
      case 'libraries':
        return 'Library / ORM';
      case 'logging':
        return 'Logging';
      case 'ai':
        return 'AI & LLM';
      case 'serverless':
        return 'Serverless';
      default:
        return category || '';
    }
  }

  getCategoryIcon(category: string): string {
    switch (category?.toLowerCase()) {
      case 'languages':
        return 'bi-code-slash';
      case 'frameworks':
        return 'bi-layers';
      case 'receivers':
        return 'bi-reception-4';
      case 'infrastructure':
        return 'bi-server';
      case 'databases':
        return 'bi-database';
      case 'libraries':
        return 'bi-collection';
      case 'logging':
        return 'bi-journal-text';
      case 'ai':
        return 'bi-cpu';
      case 'serverless':
        return 'bi-lightning-charge';
      default:
        return 'bi-box';
    }
  }

  getStepTypeIcon(type: string): string {
    switch (type) {
      case 'command':
        return 'bi-terminal-fill';
      case 'code':
        return 'bi-file-earmark-code-fill';
      case 'environment':
        return 'bi-sliders';
      case 'verification':
        return 'bi-check2-all';
      case 'config':
        return 'bi-gear-fill';
      case 'troubleshooting':
        return 'bi-wrench-adjustable';
      default:
        return 'bi-file-earmark-text';
    }
  }

  getStepTypeLabel(type: string): string {
    switch (type) {
      case 'command':
        return 'Terminal';
      case 'code':
        return 'Code';
      case 'environment':
        return 'Environment';
      case 'verification':
        return 'Verify';
      case 'config':
        return 'Config';
      default:
        return type;
    }
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }
}
