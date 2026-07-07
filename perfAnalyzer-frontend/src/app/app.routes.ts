import { Routes } from '@angular/router';
import { Auth } from './components/auth/auth';
import { Dashboard } from './components/dashboard/dashboard';
import { ReportsHistory } from './components/reports-history/reports-history';
import { Projects } from './components/projects/projects';

export const routes: Routes = [
  { path: 'login', component: Auth },
  { path: 'test', component: Dashboard },
  { path: 'reports', component: ReportsHistory },
  { path: 'projects', component: Projects },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
