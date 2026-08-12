import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../services/auth/auth.service';
import { BusinessQueryService } from '../../../../services/business/query.service';
import { Business } from '../../../../models/business.model';
import { DEFAULT_COLORS } from '../../../../services/theme/theme.presets';

@Component({
  selector: 'app-saas-home',
  imports: [DatePipe, RouterLink],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaasHomeComponent {
  private readonly businessQuery = inject(BusinessQueryService);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly businesses = signal<Business[]>([]);
  readonly now = signal(new Date());

  readonly total = computed(() => this.businesses().length);
  readonly gymCount = computed(() => this.businesses().filter((b) => b.type === 'gym').length);
  readonly posCount = computed(() => this.businesses().filter((b) => b.type === 'pos').length);

  // Negocios creados en los ultimos 30 dias.
  readonly recentCount = computed(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return this.businesses().filter((b) => new Date(b.created_at) >= cutoff).length;
  });

  // Distribucion para la barra apilada: % de gym sobre total.
  readonly gymPct = computed(() => {
    const t = this.total();
    if (t === 0) return 0;
    return (this.gymCount() / t) * 100;
  });

  // Top 5 negocios mas recientes (listBusinesses ya viene ordenado desc).
  readonly latestBusinesses = computed(() => this.businesses().slice(0, 5));

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.businesses.set(await this.businessQuery.listBusinesses());
    } catch (err) {
      console.error('Error cargando dashboard SaaS', err);
    } finally {
      this.loading.set(false);
    }
  }

  color1(business: Business): string {
    return business.theme?.color1 ?? DEFAULT_COLORS.color1;
  }

  color2(business: Business): string {
    return business.theme?.color2 ?? DEFAULT_COLORS.color2;
  }
}
