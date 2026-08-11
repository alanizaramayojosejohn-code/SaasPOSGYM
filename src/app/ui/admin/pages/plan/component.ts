import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  FEATURE_LABELS,
  PlanFeature,
  STATUS_LABELS,
  SubscriptionPayment,
} from '../../../../models/plan.model';
import { PlanService } from '../../../../services/plan/plan.service';
import { SubscriptionService } from '../../../../services/plan/subscription.service';

@Component({
  selector: 'app-admin-plan',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPlanContainerComponent {
  protected readonly plans = inject(PlanService);
  private readonly subscriptions = inject(SubscriptionService);

  readonly payments = signal<SubscriptionPayment[]>([]);
  readonly loading = signal(false);

  readonly allFeatures = Object.keys(FEATURE_LABELS) as PlanFeature[];

  featureLabel(f: PlanFeature): string {
    return FEATURE_LABELS[f];
  }

  statusLabel(): string {
    const s = this.plans.status();
    return s ? STATUS_LABELS[s] : '—';
  }

  has(f: PlanFeature): boolean {
    return this.plans.usage()?.features.includes(f) ?? false;
  }

  // Barra de consumo. Sin tope devuelve null y la UI muestra "ilimitado".
  usagePercent(resource: 'users' | 'clients' | 'products'): number | null {
    const q = this.plans.quota(resource);
    if (!q) return null;
    return Math.min(100, Math.round((q.used / q.max) * 100));
  }

  quota(resource: 'users' | 'clients' | 'products') {
    return this.plans.quota(resource);
  }

  used(resource: 'users' | 'clients' | 'products'): number {
    const u = this.plans.usage();
    if (!u) return 0;
    return resource === 'users' ? u.users_count
      : resource === 'clients' ? u.clients_count
      : u.products_count;
  }

  // Planes del catálogo que ofrecen algo más que el actual.
  readonly upgrades = computed(() => {
    const current = this.plans.usage()?.plan_code;
    const catalog = this.plans.catalog();
    const currentIndex = catalog.findIndex((p) => p.code === current);
    return currentIndex < 0 ? catalog : catalog.slice(currentIndex + 1);
  });

  constructor() {
    void this.plans.loadCatalog();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      await this.plans.load();
      this.payments.set(await this.subscriptions.listMyPayments());
    } catch (err) {
      console.error('Error cargando la información del plan', err);
    } finally {
      this.loading.set(false);
    }
  }
}
