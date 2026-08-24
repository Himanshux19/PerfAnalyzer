import { ApplicationConfig, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpErrorResponse } from '@angular/common/http';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { ApiService } from './api.service';
import { catchError, throwError } from 'rxjs';

export const authInterceptor = (req: any, next: any) => {
  const api = inject(ApiService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        const detail = error.error?.detail || '';
        const isAuthUrl =
          req.url.includes('/login') ||
          req.url.includes('/register') ||
          req.url.includes('/superadmin/login');
        if (
          !isAuthUrl &&
          (detail.includes('suspended') ||
            detail.includes('deleted') ||
            detail.includes('Token') ||
            detail.includes('authorization') ||
            error.status === 401)
        ) {
          const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
          if (role !== 'superadmin') {
            api.handleForcedLogout(detail || 'Your session has been terminated.');
          }
        }
      }
      return throwError(() => error);
    }),
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
