import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Business, BusinessType } from '../../../../../../models/business.model';
import { BusinessColors, DEFAULT_COLORS, QUICK_PALETTES } from '../../../../../../services/theme/theme.presets';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Shape unificado que emite el form. Los campos de admin solo se llenan en create.
// theme = los 2 colores del negocio. El fondo es siempre monocromo (no
// seleccionable) y el mode (light/dark/system) es preferencia del USUARIO
// en su navegador, no se asigna desde aca.
export interface BusinessFormValue {
  businessName: string;
  businessType: BusinessType;
  adminUserId: string;
  adminName: string;
  adminCi: string;
  services: string[];
  theme: BusinessColors;
}

@Component({
  selector: 'app-saas-businesses-form',
  imports: [ReactiveFormsModule],
  templateUrl: './form.html',
  styleUrl: './form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessesFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly value = input<Business | null>(null);
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitForm = output<BusinessFormValue>();
  readonly cancel = output<void>();

  readonly isEdit = computed(() => this.value() !== null);
  readonly quickPalettes = QUICK_PALETTES;

  readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required, Validators.minLength(2)]],
    businessType: ['gym' as BusinessType, [Validators.required]],
    adminUserId: ['', [Validators.required, Validators.pattern(UUID_REGEX)]],
    adminName: ['', [Validators.required, Validators.minLength(2)]],
    adminCi: ['', [Validators.required]],
    services: [''],
    color1: [DEFAULT_COLORS.color1, [Validators.required, Validators.pattern(HEX_PATTERN)]],
    color2: [DEFAULT_COLORS.color2, [Validators.required, Validators.pattern(HEX_PATTERN)]],
  });

  private readonly typeValue = signal<BusinessType>(this.form.controls.businessType.value);
  readonly isGym = computed(() => this.typeValue() === 'gym');

  constructor() {
    this.form.controls.businessType.valueChanges.subscribe((v) => {
      if (v) this.typeValue.set(v);
    });

    effect(() => {
      const v = this.value();
      if (v) {
        this.form.controls.adminUserId.disable({ emitEvent: false });
        this.form.controls.adminName.disable({ emitEvent: false });
        this.form.controls.adminCi.disable({ emitEvent: false });
        this.form.controls.services.disable({ emitEvent: false });
        const colors = v.theme ?? DEFAULT_COLORS;
        this.form.reset({
          businessName: v.name,
          businessType: v.type,
          adminUserId: '', adminName: '', adminCi: '', services: '',
          color1: colors.color1,
          color2: colors.color2,
        });
        this.typeValue.set(v.type);
      } else {
        this.form.controls.adminUserId.enable({ emitEvent: false });
        this.form.controls.adminName.enable({ emitEvent: false });
        this.form.controls.adminCi.enable({ emitEvent: false });
        this.form.controls.services.enable({ emitEvent: false });
        this.form.reset({
          businessName: '', businessType: 'gym',
          adminUserId: '', adminName: '', adminCi: '', services: '',
          color1: DEFAULT_COLORS.color1,
          color2: DEFAULT_COLORS.color2,
        });
        this.typeValue.set('gym');
      }
    });
  }

  // Atajo: llena color1/color2 de un click. El super_admin puede seguir
  // ajustándolos a mano después — no es una selección exclusiva.
  selectQuickPalette(p: { color1: string; color2: string }): void {
    this.form.patchValue({ color1: p.color1, color2: p.color2 });
    this.form.controls.color1.markAsDirty();
    this.form.controls.color2.markAsDirty();
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    const raw = this.form.getRawValue();
    const services = raw.businessType === 'gym'
      ? raw.services.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
      : [];
    this.submitForm.emit({
      businessName: raw.businessName.trim(),
      businessType: raw.businessType,
      adminUserId: raw.adminUserId.trim(),
      adminName: raw.adminName.trim(),
      adminCi: raw.adminCi.trim(),
      services,
      theme: { color1: raw.color1, color2: raw.color2 },
    });
  }
}
