import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../services/auth/auth.service';
import { ReportQueryService } from '../../../../services/report/query.service';
import { OrderQueryService } from '../../../../services/order/query.service';
import { DailyIncome } from '../../../../models/daily-income.model';
import { OrderWithDetails, orderPrimaryLabel, orderPrimaryType } from '../../../../models/order.model';
import { ActiveMembership } from '../../../../models/active-membership.model';
import { LowStockProduct } from '../../../../models/low-stock-product.model';

@Component({
  selector: 'app-caja-home',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CajaHomeComponent {
  private readonly reportQuery = inject(ReportQueryService);
  private readonly orderQuery = inject(OrderQueryService);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly daily = signal<DailyIncome[]>([]);
  readonly recentOrders = signal<OrderWithDetails[]>([]);
  readonly activeMemberships = signal<ActiveMembership[]>([]);
  readonly lowStock = signal<LowStockProduct[]>([]);
  readonly now = signal(new Date());

  readonly isGym = computed(() => this.auth.businessType() === 'gym');

  readonly expiringSoon = computed(() =>
    this.activeMemberships()
      .filter((m) => m.days_left <= 7)
      .sort((a, b) => a.days_left - b.days_left)
      .slice(0, 5),
  );
  readonly criticalStock = computed(() => this.lowStock().slice(0, 5));

  readonly primaryLabel = orderPrimaryLabel;
  readonly primaryType = orderPrimaryType;

  private readonly today = new Date().toISOString().slice(0, 10);

  readonly todayProductTotal = computed(() =>
    this.daily()
      .filter((d) => d.day === this.today && d.type === 'product')
      .reduce((s, d) => s + Number(d.total), 0),
  );

  readonly todayMembershipTotal = computed(() =>
    this.daily()
      .filter((d) => d.day === this.today && d.type === 'membership')
      .reduce((s, d) => s + Number(d.total), 0),
  );

  readonly todayTotal = computed(() => this.todayProductTotal() + this.todayMembershipTotal());

  readonly todayTransactions = computed(() =>
    this.daily().filter((d) => d.day === this.today).reduce((s, d) => s + d.transactions, 0),
  );

  private readonly yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  readonly yesterdayTotal = computed(() =>
    this.daily()
      .filter((d) => d.day === this.yesterday)
      .reduce((s, d) => s + Number(d.total), 0),
  );

  readonly dayOverDay = computed<number | null>(() => {
    const yest = this.yesterdayTotal();
    if (yest === 0) return null;
    return ((this.todayTotal() - yest) / yest) * 100;
  });

  readonly productPct = computed(() => {
    const total = this.todayTotal();
    if (total === 0) return 0;
    return (this.todayProductTotal() / total) * 100;
  });

  readonly latestOrders = computed(() => this.recentOrders().slice(0, 8));

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const tasks: Promise<void>[] = [
        this.reportQuery.listDailyIncome(7).then((v) => this.daily.set(v)),
        this.orderQuery.listOrders(20).then((v) => this.recentOrders.set(v)),
        this.reportQuery.listLowStockProducts().then((v) => this.lowStock.set(v)),
      ];
      if (this.isGym()) {
        tasks.push(this.reportQuery.listActiveMemberships().then((v) => this.activeMemberships.set(v)));
      }
      await Promise.all(tasks);
    } catch (err) {
      console.error('Error cargando dashboard caja', err);
    } finally {
      this.loading.set(false);
    }
  }
}
