import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../services/auth/auth.service';
import { PlanService } from '../../../../services/plan/plan.service';
import { ReportQueryService } from '../../../../services/report/query.service';
import { ClientQueryService } from '../../../../services/client/query.service';
import { AttendanceQueryService } from '../../../../services/attendance/query.service';
import { PurchasesService } from '../../../../services/purchases/purchases.service';
import { ActiveMembership } from '../../../../models/active-membership.model';
import { DailyIncome } from '../../../../models/daily-income.model';
import { LowStockProduct } from '../../../../models/low-stock-product.model';
import { MonthlyIncome } from '../../../../models/monthly-income.model';
import { Client } from '../../../../models/client.model';
import { PaymentMethod, PAYMENT_METHOD_LABEL } from '../../../../models/order.model';
import { initials } from '../../../../utilities/initials';
import { PlanStatusCardComponent } from '../../../shared/plan-status-card.component';

interface DailyAggregate {
  day: string;
  product: number;
  membership: number;
  total: number;
  transactions: number;
}

interface RevenueCategory {
  category: string;
  total: number;
  type: 'product' | 'membership';
}

export interface DonutSegment {
  category: string;
  total: number;
  type: 'product' | 'membership';
  percentage: number;
  dashArray: string;
  dashOffset: number;
}

interface RecentMember {
  id: string;
  name: string;
  ci: string;
  plan: string | null;
  isActive: boolean;
  createdAt: string;
  lastVisit: string | null;
}

@Component({
  selector: 'app-admin-home',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, PlanStatusCardComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHomeComponent {
  private readonly reportQuery = inject(ReportQueryService);
  private readonly clientQuery = inject(ClientQueryService);
  private readonly attendanceQuery = inject(AttendanceQueryService);
  private readonly purchasesService = inject(PurchasesService);
  protected readonly auth = inject(AuthService);
  protected readonly plans = inject(PlanService);

  readonly loading = signal(true);
  readonly daily = signal<DailyIncome[]>([]);
  readonly monthly = signal<MonthlyIncome[]>([]);
  readonly active = signal<ActiveMembership[]>([]);
  readonly lowStock = signal<LowStockProduct[]>([]);
  readonly recentClients = signal<Client[]>([]);
  readonly revenueByCategory = signal<RevenueCategory[]>([]);
  readonly lastVisitMap = signal<Map<string, string>>(new Map());
  readonly attendanceByDay = signal<{ day: string; count: number }[]>([]);
  readonly paymentMethodBreakdown = signal<{ method: PaymentMethod; total: number; count: number }[]>([]);
  readonly acquisitionsMonthTotal = signal(0);
  readonly pendingPurchaseOrdersCount = signal(0);
  readonly now = signal(new Date());
  readonly isGym = computed(() => this.auth.businessType() === 'gym');

  // ── KPIs ──────────────────────────────────────────────────────────────────

  readonly currentMonthIncome = computed(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return this.monthly()
      .filter((m) => m.month.startsWith(ym))
      .reduce((s, m) => s + Number(m.total), 0);
  });

  readonly monthOverMonth = computed<number | null>(() => {
    const now = new Date();
    const thisYM = now.toISOString().slice(0, 7);
    const prev = new Date(now);
    prev.setMonth(prev.getMonth() - 1);
    const prevYM = prev.toISOString().slice(0, 7);
    const sumOf = (ym: string) =>
      this.monthly().filter((m) => m.month.startsWith(ym)).reduce((s, m) => s + Number(m.total), 0);
    const cur = sumOf(thisYM);
    const before = sumOf(prevYM);
    if (before === 0) return null;
    return ((cur - before) / before) * 100;
  });

  readonly activeCount = computed(() => this.active().length);
  readonly expiringSoonCount = computed(() => this.active().filter((m) => m.days_left <= 7).length);
  readonly lowStockCount = computed(() => this.lowStock().length);
  readonly outOfStockCount = computed(() => this.lowStock().filter((p) => p.stock === 0).length);

  // ── Bar chart (POS) ───────────────────────────────────────────────────────

  readonly dailyAggregates = computed<DailyAggregate[]>(() => {
    const map = new Map<string, DailyAggregate>();
    for (const row of this.daily()) {
      const cur = map.get(row.day) ?? { day: row.day, product: 0, membership: 0, total: 0, transactions: 0 };
      if (row.type === 'product') cur.product += Number(row.total);
      else cur.membership += Number(row.total);
      cur.total += Number(row.total);
      cur.transactions += row.transactions;
      map.set(row.day, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  });

  readonly maxDailyTotal = computed(() =>
    this.dailyAggregates().reduce((mx, d) => Math.max(mx, d.total), 0),
  );

  readonly expiringMemberships = computed(() => this.active().slice(0, 5));
  readonly criticalStock = computed(() => this.lowStock().slice(0, 5));

  // ── Asistencias por día (GYM) ────────────────────────────────────────────

  readonly maxAttendance = computed(() =>
    this.attendanceByDay().reduce((mx, r) => Math.max(mx, r.count), 0),
  );

  attendanceBarHeight(count: number): number {
    const max = this.maxAttendance();
    if (max === 0) return 4;
    return Math.max(4, (count / max) * 100);
  }

  // ── Métodos de pago del mes (GYM) ────────────────────────────────────────

  readonly paymentMethodLabel = PAYMENT_METHOD_LABEL;
  readonly paymentMethodTotal = computed(() =>
    this.paymentMethodBreakdown().reduce((s, m) => s + m.total, 0),
  );

  paymentMethodPct(total: number): number {
    const sum = this.paymentMethodTotal();
    if (sum === 0) return 0;
    return (total / sum) * 100;
  }

  // Mismo esquema fijo de color que app-method-badge (efectivo=verde,
  // tarjeta/transferencia=celeste de marca, QR/cheque=plata) — no depende
  // del negocio.
  paymentMethodBarClass(method: PaymentMethod): string {
    if (method === 'cash') return 'bg-success';
    if (method === 'qr') return 'bg-silver';
    return 'bg-brand';
  }

  // ── Donut (GYM) ───────────────────────────────────────────────────────────

  readonly DONUT_R = 75;
  readonly DONUT_C = 2 * Math.PI * this.DONUT_R;
  // Un solo tono (accent del negocio) con opacidad decreciente por segmento —
  // "un color de acento dominante, con moderación": nunca reparte 8 colores
  // distintos, solo varía la intensidad del mismo tono.
  readonly DONUT_OPACITIES = [1, 0.76, 0.56, 0.42, 0.3, 0.22, 0.15, 0.1];

  readonly donutTotal = computed(() =>
    this.revenueByCategory().reduce((s, c) => s + c.total, 0),
  );

  readonly donutSegments = computed<DonutSegment[]>(() => {
    const cats = this.revenueByCategory();
    const total = this.donutTotal();
    if (total === 0) return [];
    let offset = 0;
    return cats.map((cat) => {
      const pct = cat.total / total;
      const len = pct * this.DONUT_C;
      const seg: DonutSegment = {
        ...cat,
        percentage: pct,
        dashArray: `${len.toFixed(2)} ${this.DONUT_C.toFixed(2)}`,
        dashOffset: -offset,
      };
      offset += len;
      return seg;
    });
  });

  readonly donutProducts = computed(() =>
    this.revenueByCategory().filter((c) => c.type === 'product'),
  );

  readonly donutMemberships = computed(() =>
    this.revenueByCategory().filter((c) => c.type === 'membership'),
  );

  // ── Recent members table (GYM) ────────────────────────────────────────────

  readonly recentMembers = computed<RecentMember[]>(() => {
    const clients = this.recentClients();
    const memberships = this.active();
    const visits = this.lastVisitMap();
    return clients.map((c) => {
      const m = memberships.find((a) => a.client_id === c.id);
      return {
        id: c.id,
        name: c.name,
        ci: c.ci,
        plan: m?.plan_name ?? null,
        isActive: !!m,
        createdAt: c.created_at,
        lastVisit: visits.get(c.id) ?? null,
      };
    });
  });

  // ── Sparkline (7 bars from daily income) ─────────────────────────────────

  readonly sparklineBars = computed<number[]>(() => {
    const agg = this.dailyAggregates().slice(-7);
    const max = agg.reduce((m, d) => Math.max(m, d.total), 0);
    if (max === 0) return [4, 6, 5, 8, 7, 10, 9];
    return agg.map((d) => Math.max(4, Math.round((d.total / max) * 22)));
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const gym = this.isGym();
      const tasks: Promise<void>[] = [
        this.reportQuery.listDailyIncome(7).then((v) => this.daily.set(v)),
        this.reportQuery.listMonthlyIncome(2).then((v) => this.monthly.set(v)),
        this.reportQuery.listActiveMemberships().then((v) => this.active.set(v)),
        this.reportQuery.listLowStockProducts().then((v) => this.lowStock.set(v)),
      ];
      if (gym) {
        tasks.push(
          this.clientQuery.listClients().then(async (clients) => {
            const recent = clients.slice(0, 5);
            this.recentClients.set(recent);
            const map = await this.attendanceQuery.lastVisitByClientIds(recent.map((c) => c.id));
            this.lastVisitMap.set(map);
          }),
          this.reportQuery.listRevenueByCategoryThisMonth().then((v) => this.revenueByCategory.set(v)),
          this.attendanceQuery.countByDay(7).then((v) => this.attendanceByDay.set(v)),
          this.reportQuery.listRevenueByPaymentMethodThisMonth().then((v) => this.paymentMethodBreakdown.set(v)),
        );
      } else if (this.plans.hasFeature('purchases')) {
        const ym = new Date().toISOString().slice(0, 7);
        tasks.push(
          this.purchasesService.listAcquisitions(50).then((v) => {
            this.acquisitionsMonthTotal.set(
              v.filter((a) => a.acquired_at.startsWith(ym)).reduce((s, a) => s + Number(a.total_cost), 0),
            );
          }),
          this.purchasesService.listPurchaseOrders('pending').then((v) => this.pendingPurchaseOrdersCount.set(v.length)),
        );
      }
      await Promise.all(tasks);
    } catch (err) {
      console.error('Error cargando dashboard admin', err);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  barHeight(value: number): number {
    const max = this.maxDailyTotal();
    if (max === 0) return 4;
    return Math.max(4, (value / max) * 100);
  }

  daysLeftClass(days: number): string {
    if (days <= 3) return 'text-danger';
    if (days <= 7) return 'text-warning';
    return 'text-foreground-muted';
  }

  readonly initials = initials;

  segmentOpacity(i: number): number {
    return this.DONUT_OPACITIES[Math.min(i, this.DONUT_OPACITIES.length - 1)];
  }

  formatLastVisit(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diffDays === 0) return `Hoy · ${d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return 'Ayer';
    return `Hace ${diffDays} días`;
  }
}
