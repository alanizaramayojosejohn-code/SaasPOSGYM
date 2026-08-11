import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PlanFeature } from '../models/plan.model';
import { AuthService } from '../services/auth/auth.service';
import { PlanService } from '../services/plan/plan.service';

// Sólo autenticados.
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).isAuthenticated() ? true : router.parseUrl('/login');
};

// Sólo NO autenticados (login, recover password). Si ya está logueado,
// redirige al home según rol.
export const noAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  switch (auth.role()) {
    case 'super_admin': return router.parseUrl('/saas');
    case 'admin':       return router.parseUrl('/admin');
    case 'caja':        return router.parseUrl('/caja');
    default:            return router.parseUrl('/login');
  }
};

// super_admin del SaaS. NO incluye a admin de negocio.
export const superAdminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).role() === 'super_admin'
    ? true
    : router.parseUrl('/login');
};

// admin de negocio. super_admin NO entra (no pertenece a un business).
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).role() === 'admin'
    ? true
    : router.parseUrl('/login');
};

// caja del negocio. admin también puede usar todo lo de caja.
export const cajaGuard: CanActivateFn = () => {
  const role = inject(AuthService).role();
  const router = inject(Router);
  return role === 'caja' || role === 'admin'
    ? true
    : router.parseUrl('/login');
};

// Módulo incluido en el plan del negocio. Es una guarda de NAVEGACIÓN, no de
// seguridad: quien escriba la URL a mano llega a una pantalla vacía, y quien
// llame a la API directamente choca con los triggers de la base, que son los
// que de verdad aplican el límite.
export function planFeatureGuard(feature: PlanFeature): CanActivateFn {
  return () => {
    const plans = inject(PlanService);
    const router = inject(Router);
    return plans.hasFeature(feature) ? true : router.parseUrl('/admin/plan');
  };
}
