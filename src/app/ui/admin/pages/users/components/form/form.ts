import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Profile, UserRole } from '../../../../../../models/profile.model';

// Shape unificado que emite el form. email/password solo se usan en modo create.
export interface UserFormValue {
  email: string;
  password: string;
  name: string;
  ci: string;
  role: Extract<UserRole, 'admin' | 'caja'>;
}

@Component({
  selector: 'app-admin-users-form',
  imports: [ReactiveFormsModule],
  templateUrl: './form.html',
  styleUrl: './form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly value = input<Profile | null>(null);
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitForm = output<UserFormValue>();
  readonly cancel = output<void>();

  readonly isEdit = computed(() => this.value() !== null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    ci: ['', [Validators.required]],
    role: ['caja' as 'admin' | 'caja', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const v = this.value();
      if (v) {
        // En edit no manejamos credenciales; las deshabilitamos para que el form
        // siga válido sin email/password.
        this.form.controls.email.disable({ emitEvent: false });
        this.form.controls.password.disable({ emitEvent: false });
        const role: 'admin' | 'caja' = v.role === 'admin' ? 'admin' : 'caja';
        this.form.reset({ email: '', password: '', name: v.name, ci: v.ci, role });
      } else {
        this.form.controls.email.enable({ emitEvent: false });
        this.form.controls.password.enable({ emitEvent: false });
        this.form.reset({ email: '', password: '', name: '', ci: '', role: 'caja' });
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    const raw = this.form.getRawValue();
    this.submitForm.emit({
      email: raw.email.trim().toLowerCase(),
      password: raw.password,
      name: raw.name.trim(),
      ci: raw.ci.trim(),
      role: raw.role,
    });
  }
}
