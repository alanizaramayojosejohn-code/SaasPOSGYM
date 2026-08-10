import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  Employee,
  EmployeeDeduction,
  EmployeePayment,
  EmployeePayrollSummary,
  salaryTypeLabel,
} from '../../../../../models/employee.model';
import { Profile } from '../../../../../models/profile.model';
import {
  CreateDeductionInput,
  CreateEmployeeInput,
  EmployeeService,
  RegisterPaymentInput,
} from '../../../../../services/employee/employee.service';
import { EmployeeQueryService } from '../../../../../services/employee/query.service';
import { ProfileQueryService } from '../../../../../services/profile/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { ModalShellComponent } from '../../../../shared/modal-shell.component';
import { EmployeesFormComponent } from '../components/form/form';
import { EmployeesListComponent } from '../components/list/list';
import { EmployeePayrollComponent } from '../components/payroll/payroll';

@Component({
  selector: 'app-admin-employees',
  imports: [
    EmployeesListComponent,
    EmployeesFormComponent,
    EmployeePayrollComponent,
    ModalShellComponent,
    ConfirmDeleteModalComponent,
  ],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEmployeesContainerComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly employeeQuery = inject(EmployeeQueryService);
  private readonly profileQuery = inject(ProfileQueryService);

  readonly employees = signal<Employee[]>([]);
  readonly profiles = signal<Profile[]>([]);
  readonly summary = signal<EmployeePayrollSummary[]>([]);
  readonly loading = signal(false);

  // El listado busca por id, así que se indexa una vez en vez de recorrer.
  readonly summaryById = computed<Record<string, EmployeePayrollSummary>>(() => {
    const map: Record<string, EmployeePayrollSummary> = {};
    for (const row of this.summary()) map[row.employee_id] = row;
    return map;
  });

  // ------------------------------------------------------------ Formulario

  readonly formState = signal<null | 'create' | Employee>(null);
  readonly editing = computed<Employee | null>(() => {
    const s = this.formState();
    return s && s !== 'create' ? s : null;
  });
  readonly showForm = computed(() => this.formState() !== null);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  // --------------------------------------------------------------- Nómina

  readonly payrollFor = signal<Employee | null>(null);
  readonly deductions = signal<EmployeeDeduction[]>([]);
  readonly payments = signal<EmployeePayment[]>([]);
  readonly payrollLoading = signal(false);
  readonly payrollSubmitting = signal(false);
  readonly payrollError = signal<string | null>(null);

  // -------------------------------------------------------------- Borrado

  readonly deleting = signal<Employee | null>(null);
  readonly deletingError = signal<string | null>(null);
  readonly deletingSubmitting = signal(false);

  readonly deletingInitials = computed(() => {
    const e = this.deleting();
    if (!e) return null;
    const parts = e.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });

  readonly deletingSublabel = computed(() => {
    const e = this.deleting();
    if (!e) return null;
    const position = e.position ?? 'Sin cargo';
    return `${position} · CI ${e.ci} · ${salaryTypeLabel(e.salary_type)}`;
  });

  readonly deletingSalary = computed(() => {
    const e = this.deleting();
    return e ? `Bs ${Number(e.base_salary).toFixed(2)}` : null;
  });

  constructor() {
    void this.refresh();
    void this.loadProfiles();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [employees, summary] = await Promise.all([
        this.employeeQuery.listEmployees(),
        this.employeeQuery.listPayrollSummary(),
      ]);
      this.employees.set(employees);
      this.summary.set(summary);
    } catch (err: unknown) {
      this.actionError.set(errorMessage(err, 'Error al cargar empleados'));
    } finally {
      this.loading.set(false);
    }
  }

  // Solo cuentas del panel que todavía no estén enlazadas a otro empleado.
  async loadProfiles(): Promise<void> {
    try {
      this.profiles.set(await this.profileQuery.listBusinessUsers());
    } catch (err: unknown) {
      console.error('Error listando cuentas del panel', err);
    }
  }

  readonly availableProfiles = computed(() => {
    const takenBy = new Map<string, string>();
    for (const e of this.employees()) {
      if (e.profile_id) takenBy.set(e.profile_id, e.id);
    }
    const editingId = this.editing()?.id;
    return this.profiles().filter(
      (p) => !takenBy.has(p.id) || takenBy.get(p.id) === editingId,
    );
  });

  // ------------------------------------------------------------ Formulario

  openCreate(): void {
    this.formState.set('create');
    this.formError.set(null);
  }

  openEdit(employee: Employee): void {
    this.formState.set(employee);
    this.formError.set(null);
  }

  closeForm(): void {
    this.formState.set(null);
    this.formError.set(null);
  }

  async handleSubmit(input: CreateEmployeeInput): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    const editing = this.editing();
    try {
      if (editing) {
        await this.employeeService.updateEmployee(editing.id, input);
      } else {
        await this.employeeService.createEmployee(input);
      }
      this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(
        errorMessage(err, editing ? 'Error al guardar empleado' : 'Error al crear empleado'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  async handleToggleActive(employee: Employee): Promise<void> {
    const next = !employee.is_active;
    this.actionError.set(null);
    this.employees.update((list) =>
      list.map((e) => (e.id === employee.id ? { ...e, is_active: next } : e)),
    );
    try {
      await this.employeeService.setEmployeeActive(employee.id, next);
    } catch (err: unknown) {
      this.employees.update((list) =>
        list.map((e) => (e.id === employee.id ? { ...e, is_active: employee.is_active } : e)),
      );
      this.actionError.set(
        errorMessage(err, next ? 'Error al reincorporar' : 'Error al dar de baja'),
      );
    }
  }

  // --------------------------------------------------------------- Nómina

  async openPayroll(employee: Employee): Promise<void> {
    this.payrollFor.set(employee);
    this.payrollError.set(null);
    await this.loadPayroll(employee.id);
  }

  closePayroll(): void {
    if (this.payrollSubmitting()) return;
    this.payrollFor.set(null);
    this.payrollError.set(null);
    this.deductions.set([]);
    this.payments.set([]);
  }

  private async loadPayroll(employeeId: string): Promise<void> {
    this.payrollLoading.set(true);
    try {
      const [deductions, payments] = await Promise.all([
        this.employeeQuery.listDeductions(employeeId),
        this.employeeQuery.listPayments(employeeId),
      ]);
      this.deductions.set(deductions);
      this.payments.set(payments);
    } catch (err: unknown) {
      this.payrollError.set(errorMessage(err, 'Error al cargar la nómina'));
    } finally {
      this.payrollLoading.set(false);
    }
  }

  async handleAddDeduction(input: CreateDeductionInput): Promise<void> {
    this.payrollSubmitting.set(true);
    this.payrollError.set(null);
    try {
      await this.employeeService.createDeduction(input);
      await this.loadPayroll(input.employee_id);
      // El total pendiente que muestra el listado sale del resumen.
      this.summary.set(await this.employeeQuery.listPayrollSummary());
    } catch (err: unknown) {
      this.payrollError.set(errorMessage(err, 'Error al agregar el descuento'));
    } finally {
      this.payrollSubmitting.set(false);
    }
  }

  async handleRemoveDeduction(deduction: EmployeeDeduction): Promise<void> {
    this.payrollSubmitting.set(true);
    this.payrollError.set(null);
    try {
      await this.employeeService.deleteDeduction(deduction.id);
      await this.loadPayroll(deduction.employee_id);
      this.summary.set(await this.employeeQuery.listPayrollSummary());
    } catch (err: unknown) {
      this.payrollError.set(errorMessage(err, 'Error al quitar el descuento'));
    } finally {
      this.payrollSubmitting.set(false);
    }
  }

  async handleRegisterPayment(input: RegisterPaymentInput): Promise<void> {
    this.payrollSubmitting.set(true);
    this.payrollError.set(null);
    try {
      await this.employeeService.registerPayment(input);
      await this.loadPayroll(input.employee_id);
      await this.refresh();
    } catch (err: unknown) {
      this.payrollError.set(errorMessage(err, 'Error al registrar el pago'));
    } finally {
      this.payrollSubmitting.set(false);
    }
  }

  async handleCancelPayment(payment: EmployeePayment): Promise<void> {
    this.payrollSubmitting.set(true);
    this.payrollError.set(null);
    try {
      await this.employeeService.cancelPayment(payment.id);
      await this.loadPayroll(payment.employee_id);
      await this.refresh();
    } catch (err: unknown) {
      this.payrollError.set(errorMessage(err, 'Error al anular el pago'));
    } finally {
      this.payrollSubmitting.set(false);
    }
  }

  // -------------------------------------------------------------- Borrado

  handleDelete(employee: Employee): void {
    this.deleting.set(employee);
    this.deletingError.set(null);
  }

  cancelDelete(): void {
    if (this.deletingSubmitting()) return;
    this.deleting.set(null);
    this.deletingError.set(null);
  }

  async confirmDelete(): Promise<void> {
    const employee = this.deleting();
    if (!employee) return;
    this.deletingSubmitting.set(true);
    this.deletingError.set(null);
    try {
      await this.employeeService.softDeleteEmployee(employee.id);
      if (this.editing()?.id === employee.id) this.formState.set(null);
      if (this.payrollFor()?.id === employee.id) this.closePayroll();
      this.deleting.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.deletingError.set(errorMessage(err, 'Error al eliminar empleado'));
    } finally {
      this.deletingSubmitting.set(false);
    }
  }
}
