import { Routes } from '@angular/router';

export const AdminRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'profile',
    loadComponent: () =>
      import('../shared/profile-page/component').then((m) => m.ProfilePageComponent),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.AdminHomeComponent),
  },
  {
    path: 'clients',
    loadComponent: () =>
      import('./pages/clients/container/component').then(
        (m) => m.AdminClientsContainerComponent,
      ),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./pages/products/container/component').then(
        (m) => m.AdminProductsContainerComponent,
      ),
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./pages/categories/container/component').then(
        (m) => m.AdminCategoriesContainerComponent,
      ),
  },
  {
    path: 'membership-plans',
    loadComponent: () =>
      import('./pages/membership-plans/container/component').then(
        (m) => m.AdminMembershipPlansContainerComponent,
      ),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./pages/users/container/component').then(
        (m) => m.AdminUsersContainerComponent,
      ),
  },
  {
    path: 'employees',
    loadComponent: () =>
      import('./pages/employees/container/component').then(
        (m) => m.AdminEmployeesContainerComponent,
      ),
  },
  {
    path: 'purchases',
    loadComponent: () =>
      import('./pages/purchases/container/component').then(
        (m) => m.PurchasesDashboardComponent,
      ),
  },
  {
    path: 'purchases/suppliers',
    loadComponent: () =>
      import('./pages/purchases/suppliers/component').then(
        (m) => m.PurchasesSuppliersComponent,
      ),
  },
  {
    path: 'purchases/acquisitions/new',
    loadComponent: () =>
      import('./pages/purchases/acquisitions/new/component').then(
        (m) => m.NewAcquisitionComponent,
      ),
  },
  {
    path: 'purchases/orders/new',
    loadComponent: () =>
      import('./pages/purchases/orders/new/component').then(
        (m) => m.NewPurchaseOrderComponent,
      ),
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./pages/reports/container/component').then(
        (m) => m.AdminReportsContainerComponent,
      ),
  },
  {
    path: 'sales',
    loadComponent: () =>
      import('../caja/pages/sales/container/component').then(
        (m) => m.CajaSalesContainerComponent,
      ),
  },
  {
    path: 'sales/new',
    loadComponent: () =>
      import('../caja/pages/sales/new/component').then(
        (m) => m.CajaSalesNewComponent,
      ),
  },
  {
    path: 'attendance',
    loadComponent: () =>
      import('../caja/pages/attendance/container/component').then(
        (m) => m.CajaAttendanceContainerComponent,
      ),
  },
];
