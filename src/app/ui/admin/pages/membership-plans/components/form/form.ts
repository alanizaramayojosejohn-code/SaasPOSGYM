import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MembershipPlanWithServices } from '../../../../../../models/membership-plan.model';
import { Service } from '../../../../../../models/service.model';
import { CreateMembershipPlanInput } from '../../../../../../services/membership-plan/membership-plan.service';

@Component({
  selector: 'app-admin-membership-plans-form',
  imports: [ReactiveFormsModule],
  templateUrl: './form.html',
  styleUrl: './form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembershipPlansFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly value = input<MembershipPlanWithServices | null>(null);
  readonly services = input.required<Service[]>();
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitForm = output<CreateMembershipPlanInput>();
  readonly cancel = output<void>();

  readonly isEdit = computed(() => this.value() !== null);

  // Set de service_ids tildados. Vive fuera del FormGroup (más simple que un FormArray dinámico).
  readonly selectedServices = signal<Set<string>>(new Set());

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['normal' as 'normal' | 'promo', [Validators.required]],
    duration_days: [30, [Validators.required, Validators.min(1)]],
    sessions_number: [null as number | null],
    price: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    effect(() => {
      const v = this.value();
      if (v) {
        this.form.reset({
          name: v.name,
          type: v.type,
          duration_days: v.duration_days,
          sessions_number: v.sessions_number,
          price: v.price,
        });
        this.selectedServices.set(new Set(v.service_ids));
      } else {
        this.form.reset({
          name: '', type: 'normal', duration_days: 30,
          sessions_number: null, price: 0,
        });
        this.selectedServices.set(new Set());
      }
    });
  }

  toggleService(serviceId: string): void {
    this.selectedServices.update((set) => {
      const next = new Set(set);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  isSelected(serviceId: string): boolean {
    return this.selectedServices().has(serviceId);
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    const raw = this.form.getRawValue();
    const sessions =
      raw.sessions_number === null || Number.isNaN(Number(raw.sessions_number))
        ? null
        : Math.trunc(Number(raw.sessions_number));
    this.submitForm.emit({
      name: raw.name.trim(),
      type: raw.type,
      duration_days: Math.trunc(Number(raw.duration_days)),
      sessions_number: sessions !== null && sessions > 0 ? sessions : null,
      price: Number(raw.price),
      service_ids: Array.from(this.selectedServices()),
    });
  }
}
