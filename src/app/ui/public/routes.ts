import { Routes } from '@angular/router';
import { noAuthGuard } from '../../guards/auth-guard';

export const PublicRoutes: Routes = [
  {
    path: 'login',
    canActivate: [noAuthGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
];
