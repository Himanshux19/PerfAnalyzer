import { Routes } from '@angular/router';
import { Auth } from './components/auth/auth';
import { CreateTest } from './components/create-test/create-test';
import { Dashboard } from './components/dashboard/dashboard';
import { ReportsHistory } from './components/reports-history/reports-history';
import { Projects } from './components/projects/projects';
import { AdminAuth } from './components/admin-auth/admin-auth';
import { AdminDashboard } from './components/admin-dashboard/admin-dashboard';

export const routes: Routes = [
  { path: 'login', component: Auth },
  { path: 'create-test', component: CreateTest },
  { path: 'test', component: Dashboard },
  { path: 'reports', component: ReportsHistory },
  { path: 'projects', component: Projects },
  { path: 'admin/login', component: AdminAuth },
  { path: 'admin/dashboard', component: AdminDashboard },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
