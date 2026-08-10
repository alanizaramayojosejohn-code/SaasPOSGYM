import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Employee, SALARY_TYPES, SalaryType } from '../../../../../../models/employee.model';
import { Profile } from '../../../../../../models/profile.model';
import { CreateEmployeeInput } from '../../../../../../services/employee/employee.service';

@Component({
  selector: 'app-admin-employees-form',
  imports: [ReactiveFormsModule],
  templateUrl: './form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly value = input<Employee | null>(null);
  // Cuentas del panel disponibles para enlazar (admin / caja del negocio).
  readonly profiles = input<Profile[]>([]);
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitForm = output<CreateEmployeeInput>();
  readonly cancel = output<void>();

  readonly isEdit = computed(() => this.value() !== null);
  readonly salaryTypes = SALARY_TYPES;

  readonly isActive = signal(true);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    ci: ['', [Validators.required, Validators.minLength(3)]],
    position: [''],
    phone: [''],
    email: ['', [Validators.email]],
    hire_date: [new Date().toISOString().slice(0, 10), [Validators.required]],
    termination_date: [''],
    salary_type: ['monthly' as SalaryType, [Validators.required]],
    base_salary: [0, [Validators.required, Validators.min(0)]],
    is_active: [true],
    notes: [''],
    profile_id: [''],
  });

  // La base rechaza una baja anterior al ingreso; se avisa antes de enviar.
  readonly datesInvalid = computed(() => {
    const raw = this.form.getRawValue();
    if (!raw.termination_date) return false;
    return raw.termination_date < raw.hire_date;
  });

  constructor() {
    effect(() => {
      const v = this.value();
      if (v) {
        this.isActive.set(v.is_active);
        this.form.reset({
          name: v.name,
          ci: v.ci,
          position: v.position ?? '',
          phone: v.phone ?? '',
          email: v.email ?? '',
          hire_date: v.hire_date,
          termination_date: v.termination_date ?? '',
          salary_type: v.salary_type,
          base_salary: v.base_salary,
          is_active: v.is_active,
          notes: v.notes ?? '',
          profile_id: v.profile_id ?? '',
        });
      } else {
        this.isActive.set(true);
        this.form.reset({
          name: '', ci: '', position: '', phone: '', email: '',
          hire_date: new Date().toISOString().slice(0, 10),
          termination_date: '', salary_type: 'monthly', base_salary: 0,
          is_active: true, notes: '', profile_id: '',
        });
      }
    });
  }

  toggleIsActive(checked: boolean): void {
    this.isActive.set(checked);
    this.form.controls.is_active.setValue(checked);
  }

  onSubmit(): void {
    if (this.form.invalid || this.datesInvalid() || this.submitting()) return;
    const raw = this.form.getRawValue();
    const nullable = (v: string): string | null => {
      const t = v.trim();
      return t.length > 0 ? t : null;
    };
    this.submitForm.emit({
      name: raw.name.trim(),
      ci: raw.ci.trim(),
      position: nullable(raw.position),
      phone: nullable(raw.phone),
      email: nullable(raw.email),
      hire_date: raw.hire_date,
      termination_date: nullable(raw.termination_date),
      salary_type: raw.salary_type,
      base_salary: Number(raw.base_salary),
      is_active: raw.is_active,
      notes: nullable(raw.notes),
      profile_id: raw.profile_id.length > 0 ? raw.profile_id : null,
    });
  }
}
