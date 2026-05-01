import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
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

  readonly form = this.fb.nonNullable.group({
    ci: ['', [Validators.required, Validators.minLength(3)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
  });

  constructor() {
    // Precarga el form cuando llega un value (modo edit) y lo limpia al volver a create.
    effect(() => {
      const v = this.value();
      if (v) {
        this.form.reset({ ci: v.ci, name: v.name, phone: v.phone ?? '' });
      } else {
        this.form.reset({ ci: '', name: '', phone: '' });
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    const raw = this.form.getRawValue();
    const phone = raw.phone.trim();
    this.submitForm.emit({
      ci: raw.ci.trim(),
      name: raw.name.trim(),
      phone: phone.length > 0 ? phone : null,
    });
  }
}
