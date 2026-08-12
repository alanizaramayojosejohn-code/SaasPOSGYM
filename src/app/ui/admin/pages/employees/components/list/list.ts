import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  Employee,
  EmployeePayrollSummary,
  SalaryType,
  salaryTypeLabel,
} from '../../../../../../models/employee.model';
import { initials } from '../../../../../../utilities/initials';

type EmployeeFilter = 'all' | 'active' | 'inactive' | 'with-pending';
type EmployeeSort = 'name' | 'salary-desc' | 'hire-date' | 'pending-desc';

@Component({
  selector: 'app-admin-employees-list',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesListComponent {
  readonly employees = input.required<Employee[]>();
  // Resumen de nómina indexado por employee_id, para mostrar totales en la fila.
  readonly summary = input<Record<string, EmployeePayrollSummary>>({});
  readonly loading = input<boolean>(false);

  readonly edit = output<Employee>();
  readonly remove = output<Employee>();
  readonly toggleActive = output<Employee>();
  readonly openPayroll = output<Employee>();

  readonly search = signal('');
  readonly filter = signal<EmployeeFilter>('all');
  readonly sort = signal<EmployeeSort>('name');
  readonly sortMenuOpen = signal(false);

  typeLabel(v: SalaryType): string {
    return salaryTypeLabel(v);
  }

  readonly initials = initials;

  pending(id: string): number {
    return Number(this.summary()[id]?.pending_deductions ?? 0);
  }

  totalNet(id: string): number {
    return Number(this.summary()[id]?.total_net ?? 0);
  }

  lastPayment(id: string): string | null {
    return this.summary()[id]?.last_payment_on ?? null;
  }

  readonly counts = computed(() => {
    const list = this.employees();
    return {
      all: list.length,
      active: list.filter((e) => e.is_active).length,
      inactive: list.filter((e) => !e.is_active).length,
      withPending: list.filter((e) => this.pending(e.id) > 0).length,
    };
  });

  // Costo mensual comprometido: suma del sueldo base de los que están en planilla.
  readonly monthlyPayroll = computed(() =>
    this.employees()
      .filter((e) => e.is_active && e.salary_type === 'monthly')
      .reduce((sum, e) => sum + Number(e.base_salary), 0),
  );

  readonly filteredSorted = computed<Employee[]>(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    const s = this.sort();
    let list = this.employees().slice();

    if (f === 'active') list = list.filter((e) => e.is_active);
    else if (f === 'inactive') list = list.filter((e) => !e.is_active);
    else if (f === 'with-pending') list = list.filter((e) => this.pending(e.id) > 0);

    if (q) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.ci.toLowerCase().includes(q) ||
          (e.position ?? '').toLowerCase().includes(q) ||
          (e.phone ?? '').toLowerCase().includes(q) ||
          (e.email ?? '').toLowerCase().includes(q),
      );
    }

    if (s === 'salary-desc') list.sort((a, b) => Number(b.base_salary) - Number(a.base_salary));
    else if (s === 'hire-date') list.sort((a, b) => b.hire_date.localeCompare(a.hire_date));
    else if (s === 'pending-desc') list.sort((a, b) => this.pending(b.id) - this.pending(a.id));
    else list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
  });

  readonly sortLabel = computed(() => {
    switch (this.sort()) {
      case 'salary-desc': return 'Sueldo descendente';
      case 'hire-date': return 'Ingreso reciente';
      case 'pending-desc': return 'Más descuentos pendientes';
      default: return 'Nombre A→Z';
    }
  });

  setSearch(v: string): void { this.search.set(v); }
  setFilter(f: EmployeeFilter): void { this.filter.set(f); }
  setSort(s: EmployeeSort): void {
    this.sort.set(s);
    this.sortMenuOpen.set(false);
  }
  toggleSortMenu(): void { this.sortMenuOpen.update((v) => !v); }
}
