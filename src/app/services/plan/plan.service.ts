import { computed, inject, Injectable, signal } from '@angular/core';
import { MyPlanUsage, Plan, PlanFeature } from '../../models/plan.model';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Plan vigente del negocio del usuario, en señales, para que el menú, los
 * guards y los carteles de la app reaccionen sin volver a consultar.
 *
 * Todo lo que hay acá es para la EXPERIENCIA, no para la seguridad. Los
 * límites reales los aplican los triggers de la base (migración
 * 20260811000000): esconder un botón no impide que alguien llame a la API.
 * Si esta capa y la base discrepan, manda la base.
 */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly client = inject(SupabaseService).client;

  readonly usage = signal<MyPlanUsage | null>(null);
  readonly catalog = signal<Plan[]>([]);
  readonly loading = signal(false);

  readonly planName = computed(() => this.usage()?.plan_name ?? null);
  readonly status = computed(() => this.usage()?.subscription_status ?? null);

  /** Si no hay dato todavía, se asume que puede escribir para no bloquear la UI de arranque. */
  readonly canWrite = computed(() => this.usage()?.can_write ?? true);

  readonly daysLeft = computed(() => this.usage()?.days_left ?? null);

  readonly isTrialing = computed(() => this.usage()?.subscription_status === 'trialing');

  /** Avisar cuando quedan 7 días o menos, que es cuando el aviso todavía sirve. */
  readonly showExpiryWarning = computed(() => {
    const u = this.usage();
    if (!u || !u.can_write) return false;
    return u.days_left !== null && u.days_left <= 7;
  });

  /** Solo lectura: la suscripción venció y la base rechaza cualquier escritura. */
  readonly isReadOnly = computed(() => {
    const u = this.usage();
    return u !== null && !u.can_write;
  });

  hasFeature(feature: PlanFeature): boolean {
    const u = this.usage();
    // Sin datos cargados no se esconde nada: es preferible mostrar un módulo de
    // más un instante que parpadear el menú en cada carga.
    if (!u) return true;
    return u.features.includes(feature);
  }

  // ---------------------------------------------------------------- Cupos

  /** Devuelve el consumo de un recurso, o null si el plan es ilimitado. */
  quota(resource: 'users' | 'clients' | 'products'): { used: number; max: number } | null {
    const u = this.usage();
    if (!u) return null;
    const max = resource === 'users' ? u.max_users
      : resource === 'clients' ? u.max_clients
      : u.max_products;
    if (max === null) return null;
    const used = resource === 'users' ? u.users_count
      : resource === 'clients' ? u.clients_count
      : u.products_count;
    return { used, max };
  }

  atLimit(resource: 'users' | 'clients' | 'products'): boolean {
    const q = this.quota(resource);
    return q !== null && q.used >= q.max;
  }

  // --------------------------------------------------------------- Carga

  /**
   * Carga el plan del negocio actual. La vista `my_plan_usage` está filtrada
   * por RLS, así que devuelve una sola fila (ninguna para el super_admin, que
   * no pertenece a un negocio).
   */
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.client
        .from('my_plan_usage')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      this.usage.set((data as MyPlanUsage | null) ?? null);
    } catch (err) {
      console.error('Error cargando el plan del negocio', err);
      this.usage.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async loadCatalog(): Promise<void> {
    const { data, error } = await this.client
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Error cargando el catálogo de planes', error);
      return;
    }
    this.catalog.set((data ?? []) as Plan[]);
  }

  reset(): void {
    this.usage.set(null);
  }
}
