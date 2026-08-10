import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ClientPurchaseSummary,
  ClientRegistrationsMonthly,
} from '../../../../../../models/client.model';

type ClientReportFilter = 'all' | 'buyers' | 'no-purchase' | 'with-nit';

// Reporte de clientes: cartera, facturación por cliente y altas por mes.
@Component({
  selector: 'app-admin-reports-clients',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './clients-report.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsReportComponent {
  readonly summary = input<ClientPurchaseSummary[]>([]);
  readonly monthly = input<ClientRegistrationsMonthly[]>([]);
  readonly loading = input<boolean>(false);

  readonly filter = signal<ClientReportFilter>('all');
  readonly search = signal('');

  readonly totalSpent = computed(() =>
    this.summary().reduce((s, r) => s + Number(r.total_spent), 0),
  );

  readonly totalOrders = computed(() =>
    this.summary().reduce((s, r) => s + Number(r.orders_count), 0),
  );

  // Ticket promedio de la cartera entera, no el promedio de promedios: dividir
  // los promedios por cliente daría más peso a quien compró una sola vez.
  readonly avgTicket = computed(() => {
    const orders = this.totalOrders();
    return orders === 0 ? 0 : this.totalSpent() / orders;
  });

  readonly counts = computed(() => {
    const list = this.summary();
    return {
      all: list.length,
      buyers: list.filter((r) => r.orders_count > 0).length,
      noPurchase: list.filter((r) => r.orders_count === 0).length,
      withNit: list.filter((r) => !!r.nit).length,
    };
  });

  readonly filtered = computed<ClientPurchaseSummary[]>(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    let list = this.summary().slice();

    if (f === 'buyers') list = list.filter((r) => r.orders_count > 0);
    else if (f === 'no-purchase') list = list.filter((r) => r.orders_count === 0);
    else if (f === 'with-nit') list = list.filter((r) => !!r.nit);

    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.ci.toLowerCase().includes(q) ||
          (r.nit ?? '').toLowerCase().includes(q) ||
          (r.business_name ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  });

  readonly maxMonthly = computed(() =>
    this.monthly().reduce((max, r) => Math.max(max, Number(r.clients_count)), 0),
  );

  barHeight(value: number): number {
    const max = this.maxMonthly();
    if (max === 0) return 4;
    return Math.max(4, (Number(value) / max) * 100);
  }

  readonly monthlyChrono = computed(() => this.monthly().slice().reverse());

  setFilter(f: ClientReportFilter): void { this.filter.set(f); }
  setSearch(v: string): void { this.search.set(v); }
}
