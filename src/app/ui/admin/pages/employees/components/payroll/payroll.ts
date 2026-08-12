import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MethodBadgeComponent } from '../../../../../shared/method-badge.component';
import {
  DEDUCTION_TYPES,
  DeductionType,
  Employee,
  EmployeeDeduction,
  EmployeePayment,
  PAYROLL_METHODS,
  PayrollMethod,
  deductionTypeLabel,
  payrollMethodLabel,
} from '../../../../../../models/employee.model';
import {
  CreateDeductionInput,
  RegisterPaymentInput,
} from '../../../../../../services/employee/employee.service';

// Panel de nómina de un empleado: cargar descuentos, liquidar el período y ver
// el historial. Vive dentro de una ventana modal abierta desde el listado.
//
// El neto que se muestra acá es una previsualización; el valor que se guarda lo
// calcula register_employee_payment en la base a partir de los descuentos que
// realmente se enganchan.
@Component({
  selector: 'app-admin-employees-payroll',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, MethodBadgeComponent],
  templateUrl: './payroll.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeePayrollComponent {
  private readonly fb = inject(FormBuilder);

  readonly employee = input.required<Employee>();
  readonly deductions = input<EmployeeDeduction[]>([]);
  readonly payments = input<EmployeePayment[]>([]);
  readonly loading = input<boolean>(false);
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);

  readonly addDeduction = output<CreateDeductionInput>();
  readonly removeDeduction = output<EmployeeDeduction>();
  readonly registerPayment = output<RegisterPaymentInput>();
  readonly cancelPayment = output<EmployeePayment>();
  readonly close = output<void>();

  readonly deductionTypes = DEDUCTION_TYPES;
  readonly methods = PAYROLL_METHODS;

  readonly tab = signal<'pay' | 'deductions' | 'history'>('pay');

  // Ids de los descuentos pendientes marcados para incluir en la liquidación.
  readonly selected = signal<Set<string>>(new Set());

  typeLabel(v: DeductionType): string { return deductionTypeLabel(v); }
  methodLabel(v: PayrollMethod): string { return payrollMethodLabel(v); }

  readonly pending = computed(() => this.deductions().filter((d) => !d.payment_id));
  readonly applied = computed(() => this.deductions().filter((d) => !!d.payment_id));

  readonly pendingTotal = computed(() =>
    this.pending().reduce((s, d) => s + Number(d.amount), 0),
  );

  readonly selectedTotal = computed(() => {
    const ids = this.selected();
    return this.pending()
      .filter((d) => ids.has(d.id))
      .reduce((s, d) => s + Number(d.amount), 0);
  });

  // ------------------------------------------------------- Formulario de pago

  readonly payForm = this.fb.nonNullable.group({
    period_start: [firstOfMonth(), [Validators.required]],
    period_end: [lastOfMonth(), [Validators.required]],
    gross_amount: [0, [Validators.required, Validators.min(0)]],
    bonus_amount: [0, [Validators.min(0)]],
    payment_method: ['cash' as PayrollMethod, [Validators.required]],
    paid_on: [new Date().toISOString().slice(0, 10), [Validators.required]],
    notes: [''],
  });

  // Se recalcula al vuelo para que el admin vea el neto antes de confirmar.
  readonly previewGross = signal(0);
  readonly previewBonus = signal(0);

  readonly previewNet = computed(
    () => this.previewGross() + this.previewBonus() - this.selectedTotal(),
  );

  readonly periodInvalid = computed(() => {
    const raw = this.payForm.getRawValue();
    return raw.period_end < raw.period_start;
  });

  readonly canSubmitPayment = computed(
    () =>
      !this.payForm.invalid &&
      !this.periodInvalid() &&
      this.previewNet() >= 0 &&
      !this.submitting(),
  );

  // ------------------------------------------------- Formulario de descuento

  readonly deductionForm = this.fb.nonNullable.group({
    type: ['advance' as DeductionType, [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    description: [''],
    applied_on: [new Date().toISOString().slice(0, 10), [Validators.required]],
  });

  constructor() {
    // Al cambiar de empleado, arranca con su sueldo base propuesto y sin nada
    // seleccionado: los descuentos son de otra persona.
    effect(() => {
      const e = this.employee();
      this.selected.set(new Set());
      this.previewGross.set(Number(e.base_salary));
      this.previewBonus.set(0);
      this.payForm.patchValue({ gross_amount: Number(e.base_salary), bonus_amount: 0 });
    });
  }

  setTab(t: 'pay' | 'deductions' | 'history'): void {
    this.tab.set(t);
  }

  toggleSelected(id: string): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  selectAllPending(): void {
    this.selected.set(new Set(this.pending().map((d) => d.id)));
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  onGrossInput(v: string): void {
    this.previewGross.set(Math.max(0, Number(v) || 0));
  }

  onBonusInput(v: string): void {
    this.previewBonus.set(Math.max(0, Number(v) || 0));
  }

  onSubmitPayment(): void {
    if (!this.canSubmitPayment()) return;
    const raw = this.payForm.getRawValue();
    const notes = raw.notes.trim();
    this.registerPayment.emit({
      employee_id: this.employee().id,
      period_start: raw.period_start,
      period_end: raw.period_end,
      gross_amount: Number(raw.gross_amount),
      bonus_amount: Number(raw.bonus_amount),
      deduction_ids: Array.from(this.selected()),
      payment_method: raw.payment_method,
      paid_on: raw.paid_on,
      notes: notes.length > 0 ? notes : null,
    });
  }

  onSubmitDeduction(): void {
    if (this.deductionForm.invalid || this.submitting()) return;
    const raw = this.deductionForm.getRawValue();
    const description = raw.description.trim();
    this.addDeduction.emit({
      employee_id: this.employee().id,
      type: raw.type,
      amount: Number(raw.amount),
      description: description.length > 0 ? description : null,
      applied_on: raw.applied_on,
    });
    this.deductionForm.patchValue({ amount: 0, description: '' });
  }
}

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('sv-SE');
}

function lastOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('sv-SE');
}
