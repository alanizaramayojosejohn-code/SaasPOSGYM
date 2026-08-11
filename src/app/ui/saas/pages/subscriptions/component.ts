import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  PAYMENT_METHODS,
  PaymentMethod,
  STATUS_LABELS,
  SubscriptionOverview,
  SubscriptionStatus,
} from '../../../../models/plan.model';
import { PlanService } from '../../../../services/plan/plan.service';
import { SubscriptionService } from '../../../../services/plan/subscription.service';
import { errorMessage } from '../../../../utilities/error-message';
import { ModalShellComponent } from '../../../shared/modal-shell.component';

type Filter = 'all' | 'expiring' | 'expired' | 'trialing';

@Component({
  selector: 'app-saas-subscriptions',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaasSubscriptionsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly subscriptions = inject(SubscriptionService);
  protected readonly plans = inject(PlanService);

  readonly rows = signal<SubscriptionOverview[]>([]);
  readonly loading = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly filter = signal<Filter>('all');
  readonly search = signal('');

  readonly methods = PAYMENT_METHODS;

  // Negocio sobre el que se está cobrando.
  readonly charging = signal<SubscriptionOverview | null>(null);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly payForm = this.fb.nonNullable.group({
    plan_code: ['', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0)]],
    months: [1, [Validators.required, Validators.min(1)]],
    method: ['qr' as PaymentMethod, [Validators.required]],
    reference: [''],
    paid_on: [new Date().toISOString().slice(0, 10), [Validators.required]],
    notes: [''],
  });

  statusLabel(s: SubscriptionStatus): string {
    return STATUS_LABELS[s];
  }

  readonly counts = computed(() => {
    const list = this.rows();
    return {
      all: list.length,
      // "Por vencer" es la lista de cobranza de la semana.
      expiring: list.filter((r) => r.can_write && (r.days_left ?? 99) <= 7).length,
      expired: list.filter((r) => !r.can_write).length,
      trialing: list.filter((r) => r.subscription_status === 'trialing').length,
    };
  });

  // Ingreso recurrente mensual: solo cuenta lo que está efectivamente activo.
  readonly mrr = computed(() =>
    this.rows()
      .filter((r) => r.subscription_status === 'active' && r.can_write)
      .reduce((sum, r) => sum + Number(r.price_monthly), 0),
  );

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    let list = this.rows().slice();

    if (f === 'expiring') list = list.filter((r) => r.can_write && (r.days_left ?? 99) <= 7);
    else if (f === 'expired') list = list.filter((r) => !r.can_write);
    else if (f === 'trialing') list = list.filter((r) => r.subscription_status === 'trialing');

    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    return list;
  });

  constructor() {
    void this.plans.loadCatalog();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.actionError.set(null);
    try {
      this.rows.set(await this.subscriptions.listOverview());
    } catch (err: unknown) {
      this.actionError.set(errorMessage(err, 'Error al cargar las suscripciones'));
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(f: Filter): void { this.filter.set(f); }
  setSearch(v: string): void { this.search.set(v); }

  // --------------------------------------------------------------- Cobro

  openCharge(row: SubscriptionOverview): void {
    this.charging.set(row);
    this.formError.set(null);
    // Se propone el plan que ya tiene y su precio de lista: el caso normal es
    // renovar lo mismo, y así el operador solo confirma.
    this.payForm.reset({
      plan_code: row.plan_code,
      amount: Number(row.price_monthly),
      months: 1,
      method: 'qr',
      reference: '',
      paid_on: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  }

  closeCharge(): void {
    if (this.submitting()) return;
    this.charging.set(null);
    this.formError.set(null);
  }

  // Al cambiar de plan o de cantidad de meses, se recalcula el monto sugerido.
  // Es sugerencia: el operador puede sobrescribirlo por un descuento.
  syncSuggestedAmount(): void {
    const raw = this.payForm.getRawValue();
    const plan = this.plans.catalog().find((p) => p.code === raw.plan_code);
    if (!plan) return;
    const months = Math.max(1, Number(raw.months) || 1);
    // 12 meses cobra el precio anual, que ya trae el descuento.
    const amount = months === 12 && plan.price_yearly
      ? Number(plan.price_yearly)
      : Number(plan.price_monthly) * months;
    this.payForm.controls.amount.setValue(amount);
  }

  async submitCharge(): Promise<void> {
    const row = this.charging();
    if (!row || this.payForm.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.formError.set(null);
    const raw = this.payForm.getRawValue();
    try {
      await this.subscriptions.registerPayment({
        business_id: row.business_id,
        plan_code: raw.plan_code,
        amount: Number(raw.amount),
        months: Math.trunc(Number(raw.months)),
        method: raw.method,
        reference: raw.reference.trim() || null,
        paid_on: raw.paid_on,
        notes: raw.notes.trim() || null,
      });
      this.charging.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(errorMessage(err, 'Error al registrar el pago'));
    } finally {
      this.submitting.set(false);
    }
  }

  // -------------------------------------------------- Cambios sin cobro

  async suspend(row: SubscriptionOverview): Promise<void> {
    await this.applyChange(row, { status: 'suspended' }, 'Error al suspender');
  }

  async reactivate(row: SubscriptionOverview): Promise<void> {
    await this.applyChange(row, { status: 'active' }, 'Error al reactivar');
  }

  async extendTrial(row: SubscriptionOverview): Promise<void> {
    const until = new Date();
    until.setDate(until.getDate() + 14);
    await this.applyChange(
      row,
      { status: 'trialing', trial_ends: until.toISOString().slice(0, 10) },
      'Error al extender la prueba',
    );
  }

  private async applyChange(
    row: SubscriptionOverview,
    changes: Parameters<SubscriptionService['setSubscription']>[1],
    fallback: string,
  ): Promise<void> {
    this.actionError.set(null);
    try {
      await this.subscriptions.setSubscription(row.business_id, changes);
      await this.refresh();
    } catch (err: unknown) {
      this.actionError.set(errorMessage(err, fallback));
    }
  }
}
