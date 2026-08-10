import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Client } from '../../../../../../models/client.model';
import { CreateClientInput } from '../../../../../../services/client/client.service';

@Component({
  selector: 'app-admin-clients-form',
  imports: [ReactiveFormsModule],
  templateUrl: './form.html',
  styleUrl: './form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly value = input<Client | null>(null);
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitForm = output<CreateClientInput>();
  readonly cancel = output<void>();

  readonly isEdit = computed(() => this.value() !== null);
  readonly isActive = signal(true);

  // Tope del selector de fecha: la base rechaza nacimientos futuros, así que el
  // input no debería ni ofrecerlos.
  readonly today = new Date().toISOString().slice(0, 10);

  readonly form = this.fb.nonNullable.group({
    ci: ['', [Validators.required, Validators.minLength(3)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    nit: [''],
    business_name: [''],
    phone: [''],
    email: ['', [Validators.email]],
    address: [''],
    birth_date: [''],
    notes: [''],
    is_active: [true],
  });

  constructor() {
    // Precarga el form cuando llega un value (modo edit) y lo limpia al volver a create.
    effect(() => {
      const v = this.value();
      if (v) {
        this.isActive.set(v.is_active);
        this.form.reset({
          ci: v.ci,
          name: v.name,
          nit: v.nit ?? '',
          business_name: v.business_name ?? '',
          phone: v.phone ?? '',
          email: v.email ?? '',
          address: v.address ?? '',
          birth_date: v.birth_date ?? '',
          notes: v.notes ?? '',
          is_active: v.is_active,
        });
      } else {
        this.isActive.set(true);
        this.form.reset({
          ci: '', name: '', nit: '', business_name: '', phone: '',
          email: '', address: '', birth_date: '', notes: '', is_active: true,
        });
      }
    });
  }

  toggleIsActive(checked: boolean): void {
    this.isActive.set(checked);
    this.form.controls.is_active.setValue(checked);
  }

  // Copia el nombre de la persona a la razón social. Atajo para el caso más
  // común: factura a nombre propio.
  copyNameToBusinessName(): void {
    const name = this.form.controls.name.value.trim();
    if (name) this.form.controls.business_name.setValue(name);
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    const raw = this.form.getRawValue();
    const nullable = (v: string): string | null => {
      const t = v.trim();
      return t.length > 0 ? t : null;
    };
    this.submitForm.emit({
      ci: raw.ci.trim(),
      name: raw.name.trim(),
      nit: nullable(raw.nit),
      business_name: nullable(raw.business_name),
      phone: nullable(raw.phone),
      email: nullable(raw.email),
      address: nullable(raw.address),
      birth_date: nullable(raw.birth_date),
      notes: nullable(raw.notes),
      is_active: raw.is_active,
    });
  }
}
