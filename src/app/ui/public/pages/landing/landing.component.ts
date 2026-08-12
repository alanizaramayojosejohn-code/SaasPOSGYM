import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Plan, PlanFeature } from '../../../../models/plan.model';
import { AuthService } from '../../../../services/auth/auth.service';
import { PlanService } from '../../../../services/plan/plan.service';
import { ThemeService } from '../../../../services/theme/theme.service';
import { CountUpDirective } from './count-up.directive';
import { RevealDirective } from './reveal.directive';

interface Capability {
  title: string;
  body: string;
  icon: string;
  /** Módulo del plan que lo habilita. null = incluido en todos. */
  feature: PlanFeature | null;
}

/**
 * Precios de reserva.
 *
 * El catálogo real vive en la tabla `plans` y se lee al cargar. Estos valores
 * se pintan mientras llega la respuesta, para que la sección de precios no
 * aparezca vacía ni salte de alto. Si alguna vez la consulta falla, la página
 * sigue mostrando una lista coherente en vez de un hueco.
 * Deben coincidir con el seed de 20260811000000.
 */
const FALLBACK_PLANS: Plan[] = [
  {
    code: 'basic', name: 'Básico',
    description: 'Punto de venta, inventario y clientes. Para el negocio que recién ordena su operación.',
    price_monthly: 149, price_yearly: 1490,
    max_users: 2, max_clients: 150, max_products: 300,
    features: [], sort_order: 1, is_active: true,
  },
  {
    code: 'pro', name: 'Profesional',
    description: 'Suma membresías, compras e imágenes de producto. Para el negocio que ya creció.',
    price_monthly: 299, price_yearly: 2990,
    max_users: 4, max_clients: null, max_products: null,
    features: ['memberships', 'purchases', 'product_images', 'client_reports'],
    sort_order: 2, is_active: true,
  },
  {
    code: 'full', name: 'Completo',
    description: 'Todo, incluida la nómina del personal. Sin límite de usuarios.',
    price_monthly: 499, price_yearly: 4990,
    max_users: null, max_clients: null, max_products: null,
    features: ['memberships', 'purchases', 'product_images', 'client_reports', 'employees', 'payroll_reports'],
    sort_order: 3, is_active: true,
  },
];

@Component({
  selector: 'app-landing',
  imports: [CurrencyPipe, RouterLink, RevealDirective, CountUpDirective],
  templateUrl: './landing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  private readonly plans = inject(PlanService);
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  readonly billing = signal<'monthly' | 'yearly'>('monthly');
  readonly openFaq = signal<number | null>(0);
  readonly year = new Date().getFullYear();

  // El catálogo real pisa al de reserva en cuanto llega.
  readonly catalog = computed(() => {
    const loaded = this.plans.catalog();
    return loaded.length > 0 ? loaded : FALLBACK_PLANS;
  });

  /** A dónde manda el botón principal según haya sesión o no. */
  readonly primaryCta = computed(() => {
    if (!this.auth.isAuthenticated()) return { label: 'Ingresar', link: '/login' };
    switch (this.auth.role()) {
      case 'super_admin': return { label: 'Ir a mi panel', link: '/saas' };
      case 'admin': return { label: 'Ir a mi panel', link: '/admin' };
      case 'caja': return { label: 'Ir a caja', link: '/caja' };
      default: return { label: 'Ingresar', link: '/login' };
    }
  });

  readonly capabilities: Capability[] = [
    {
      title: 'Punto de venta con escáner',
      body: 'Pasas el lector por el código de barras y el producto cae al carrito. Efectivo, tarjeta o QR, con vuelto calculado y factura lista para imprimir.',
      feature: null,
      icon: 'M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14',
    },
    {
      title: 'Inventario que cuadra',
      body: 'SKU, código de barras, categorías, unidades de venta e imágenes. El stock baja solo con cada venta y te avisa antes de quedarte sin nada.',
      feature: null,
      icon: 'm7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
    },
    {
      title: 'Clientes con CI y NIT',
      body: 'Registras a la persona con su CI y a quién se le factura con su NIT y razón social. El NIT sale impreso en la factura.',
      feature: null,
      icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87',
    },
    {
      title: 'Membresías y asistencia',
      body: 'Planes por días o por sesiones, vencimientos al día y control de ingreso del cliente. Sabes quién está por vencer antes de que se vaya.',
      feature: 'memberships',
      icon: 'M2 5h20v14H2zM2 10h20',
    },
    {
      title: 'Compras y proveedores',
      body: 'Órdenes de compra, llegadas de mercadería y proveedores. Lo que recibes entra al stock sin que tengas que cargarlo dos veces.',
      feature: 'purchases',
      icon: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
    },
    {
      title: 'Sueldos y descuentos',
      body: 'Cargas adelantos y faltas durante el mes y liquidas con un clic. El neto lo calcula el sistema, no tu calculadora.',
      feature: 'employees',
      icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    },
  ];

  readonly faqs: { q: string; a: string }[] = [
    {
      q: '¿Necesito instalar algo?',
      a: 'No. Funciona en el navegador de cualquier computadora, tablet o celular. Solo necesitas internet y tu usuario.',
    },
    {
      q: '¿Qué pasa con mis datos si dejo de pagar?',
      a: 'Nada se borra. El sistema pasa a solo lectura: sigues consultando tu historial, tus clientes y tus reportes. Cuando regularizas, vuelves a operar donde lo dejaste.',
    },
    {
      q: '¿Cómo pago la suscripción?',
      a: 'Por QR Simple o transferencia bancaria. Registramos tu comprobante y el sistema extiende tu período automáticamente. Si pagas antes de que venza, no pierdes los días que te quedaban.',
    },
    {
      q: '¿Sirve si no tengo gimnasio?',
      a: 'Sí. El sistema se configura como POS o como gimnasio. En modo POS no aparecen membresías ni asistencia, y trabajas solo con productos, ventas e inventario.',
    },
    {
      q: '¿Puedo cambiar de plan después?',
      a: 'Cuando quieras. Al subir, los módulos nuevos se habilitan de inmediato y no pierdes nada de lo que ya cargaste.',
    },
    {
      q: '¿Me ayudan a cargar mis productos?',
      a: 'Sí. La implementación inicial incluye migrar tu catálogo y tus clientes desde tu cuaderno o tu Excel, y capacitar a tu equipo.',
    },
  ];

  constructor() {
    // El catálogo es público desde la migración 20260811010000, así que la
    // landing muestra siempre el precio vigente sin volver a desplegar.
    void this.plans.loadCatalog();
  }

  setBilling(v: 'monthly' | 'yearly'): void {
    this.billing.set(v);
  }

  toggleFaq(i: number): void {
    this.openFaq.update((current) => (current === i ? null : i));
  }

  /** Precio a mostrar según el conmutador. El anual se divide para comparar peras con peras. */
  displayPrice(plan: Plan): number {
    if (this.billing() === 'monthly') return Number(plan.price_monthly);
    return plan.price_yearly ? Number(plan.price_yearly) / 12 : Number(plan.price_monthly);
  }

  yearlySaving(plan: Plan): number | null {
    if (!plan.price_yearly) return null;
    const full = Number(plan.price_monthly) * 12;
    const saved = full - Number(plan.price_yearly);
    return saved > 0 ? saved : null;
  }

  limitLabel(value: number | null, singular: string, plural: string): string {
    if (value === null) return `${plural} ilimitados`;
    return `${value} ${value === 1 ? singular : plural}`;
  }

  hasFeature(plan: Plan, feature: PlanFeature): boolean {
    return plan.features.includes(feature);
  }

  /** El plan del medio es el que se recomienda: es el que resuelve el caso típico. */
  isFeatured(plan: Plan): boolean {
    return plan.code === 'pro';
  }

  /** Mueve el halo de la card siguiendo al cursor. */
  onSpotlight(event: MouseEvent): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    el.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }
}
