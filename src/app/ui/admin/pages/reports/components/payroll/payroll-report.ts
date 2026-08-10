import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  DeductionType,
  DeductionsByType,
  EmployeePayrollMonthly,
  EmployeePayrollSummary,
  deductionTypeLabel,
} from '../../../../../../models/employee.model';

// Reporte de nómina: costo por mes, detalle por empleado y de dónde salen los
// descuentos. Las tres vistas llegan ya agregadas desde la base.
@Component({
  selector: 'app-admin-reports-payroll',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './payroll-report.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayrollReportComponent {
  readonly summary = input<EmployeePayrollSummary[]>([]);
  readonly monthly = input<EmployeePayrollMonthly[]>([]);
  readonly byType = input<DeductionsByType[]>([]);
  readonly loading = input<boolean>(false);

  typeLabel(v: DeductionType): string {
    return deductionTypeLabel(v);
  }

  readonly totalNet = computed(() =>
    this.summary().reduce((s, r) => s + Number(r.total_net), 0),
  );

  readonly totalDeductions = computed(() =>
    this.summary().reduce((s, r) => s + Number(r.total_deductions), 0),
  );

  readonly totalPending = computed(() =>
    this.summary().reduce((s, r) => s + Number(r.pending_deductions), 0),
  );

  readonly activeCount = computed(() => this.summary().filter((r) => r.is_active).length);

  // Altura relativa de cada barra del gráfico mensual.
  readonly maxMonthlyNet = computed(() =>
    this.monthly().reduce((max, r) => Math.max(max, Number(r.total_net)), 0),
  );

  barHeight(value: number): number {
    const max = this.maxMonthlyNet();
    if (max === 0) return 4;
    return Math.max(4, (Number(value) / max) * 100);
  }

  // Los meses llegan del más reciente al más viejo; el gráfico se lee al revés.
  readonly monthlyChrono = computed(() => this.monthly().slice().reverse());
}
