import { Routes } from '@angular/router';
import { Auth } from './components/auth/auth';
import { SetupProfile } from './components/setup-profile/setup-profile';
import { Projects } from './components/projects/projects';
import { AdminAuth } from './components/admin-auth/admin-auth';
import { AdminDashboard } from './components/admin-dashboard/admin-dashboard';

export const routes: Routes = [
  { path: 'login', component: Auth },
  { path: 'setup-profile', component: SetupProfile },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Projects, data: { section: 'dashboard' } },
  { path: 'subscribe', component: Projects, data: { section: 'subscribe' } },
  { path: 'workspaces', component: Projects, data: { section: 'workspaces' } },
  { path: 'projects', component: Projects, data: { section: 'workspaces' } },
  { path: 'about', component: Projects, data: { section: 'about' } },
  { path: 'create-test', component: Projects, data: { section: 'create-test' } },
  { path: 'test', component: Projects, data: { section: 'test' } },
  { path: 'files', component: Projects, data: { section: 'files' } },
  { path: 'reports', component: Projects, data: { section: 'reports' } },
  { path: 'queue', component: Projects, data: { section: 'queue' } },
  { path: 'account', component: Projects, data: { section: 'account' } },
  { path: 'admin/login', component: AdminAuth },
  { path: 'admin/dashboard', component: AdminDashboard },
  { path: '**', redirectTo: 'dashboard' },
];
