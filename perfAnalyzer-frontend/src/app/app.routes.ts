import { Routes } from '@angular/router';
import { Auth } from './components/auth/auth';
import { Dashboard } from './components/dashboard/dashboard';

export const routes: Routes = [
  { path: 'login', component: Auth },
  { path: 'dashboard', component: Dashboard },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
