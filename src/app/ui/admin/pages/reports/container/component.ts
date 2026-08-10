import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActiveMembership } from '../../../../../models/active-membership.model';
import {
  ClientPurchaseSummary,
  ClientRegistrationsMonthly,
} from '../../../../../models/client.model';
import { DailyIncome } from '../../../../../models/daily-income.model';
import {
  DeductionsByType,
  EmployeePayrollMonthly,
  EmployeePayrollSummary,
} from '../../../../../models/employee.model';
import { LowStockProduct } from '../../../../../models/low-stock-product.model';
import { MonthlyIncome } from '../../../../../models/monthly-income.model';
import { AuthService } from '../../../../../services/auth/auth.service';
import { ClientQueryService } from '../../../../../services/client/query.service';
import { EmployeeQueryService } from '../../../../../services/employee/query.service';
import { ReportQueryService } from '../../../../../services/report/query.service';
import { ActiveMembershipsCardComponent } from '../components/active-memberships/active-memberships';
import { ClientsReportComponent } from '../components/clients/clients-report';
import { DailyIncomeCardComponent } from '../components/daily-income/daily-income';
import { LowStockCardComponent } from '../components/low-stock/low-stock';
import { MonthlyIncomeCardComponent } from '../components/monthly-income/monthly-income';
import { PayrollReportComponent } from '../components/payroll/payroll-report';

type ReportTab = 'sales' | 'clients' | 'payroll';

@Component({
  selector: 'app-admin-reports',
  imports: [
    MonthlyIncomeCardComponent,
    DailyIncomeCardComponent,
    ActiveMembershipsCardComponent,
    LowStockCardComponent,
    ClientsReportComponent,
    PayrollReportComponent,
  ],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportsContainerComponent {
  private readonly reports = inject(ReportQueryService);
  private readonly clientQuery = inject(ClientQueryService);
  private readonly employeeQuery = inject(EmployeeQueryService);
  private readonly auth = inject(AuthService);

  readonly monthly = signal<MonthlyIncome[]>([]);
  readonly daily = signal<DailyIncome[]>([]);
  readonly active = signal<ActiveMembership[]>([]);
  readonly lowStock = signal<LowStockProduct[]>([]);

  readonly clientSummary = signal<ClientPurchaseSummary[]>([]);
  readonly clientMonthly = signal<ClientRegistrationsMonthly[]>([]);

  readonly payrollSummary = signal<EmployeePayrollSummary[]>([]);
  readonly payrollMonthly = signal<EmployeePayrollMonthly[]>([]);
  readonly deductionsByType = signal<DeductionsByType[]>([]);

  readonly loading = signal(false);
  readonly isGym = computed(() => this.auth.businessType() === 'gym');

  // Las tres secciones se cargan juntas al entrar y las pestañas solo cambian
  // qué se muestra: el volumen es chico (vistas ya agregadas en la base) y así
  // cambiar de pestaña es instantáneo.
  readonly tab = signal<ReportTab>('sales');

  setTab(t: ReportTab): void {
    this.tab.set(t);
  }

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const tasks: Promise<unknown>[] = [
        this.reports.listMonthlyIncome().then((v) => this.monthly.set(v)),
        this.reports.listDailyIncome().then((v) => this.daily.set(v)),
        this.reports.listLowStockProducts().then((v) => this.lowStock.set(v)),
        this.clientQuery.listPurchaseSummary().then((v) => this.clientSummary.set(v)),
        this.clientQuery.listRegistrationsMonthly().then((v) => this.clientMonthly.set(v)),
        this.employeeQuery.listPayrollSummary().then((v) => this.payrollSummary.set(v)),
        this.employeeQuery.listPayrollMonthly().then((v) => this.payrollMonthly.set(v)),
        this.employeeQuery.listDeductionsByType().then((v) => this.deductionsByType.set(v)),
      ];
      if (this.isGym()) {
        tasks.push(
          this.reports.listActiveMemberships().then((v) => this.active.set(v)),
        );
      }
      await Promise.all(tasks);
    } catch (err: unknown) {
      console.error('Error cargando reports', err);
    } finally {
      this.loading.set(false);
    }
  }
}
