import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Client } from '../../../../../../models/client.model';
import { MembershipPlan } from '../../../../../../models/membership-plan.model';
import { PaymentMethod } from '../../../../../../models/order.model';
import { MembershipOrderInput } from '../../../../../../services/order/order.service';

@Component({
  selector: 'app-caja-sales-membership-form',
  imports: [ReactiveFormsModule, DecimalPipe, CurrencyPipe],
  templateUrl: './membership-form.html',
  styleUrl: './membership-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesMembershipFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly clients = input.required<Client[]>();
  readonly plans = input.required<MembershipPlan[]>();
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  // Id de un cliente recién creado desde el modal del contenedor: al cambiar,
  // se autoselecciona en el form.
  readonly newClientId = input<string | null>(null);
  readonly submitForm = output<MembershipOrderInput>();
  readonly cancel = output<void>();
  readonly requestCreateClient = output<void>();

  readonly form = this.fb.nonNullable.group({
    client_id: ['', [Validators.required]],
    plan_id: ['', [Validators.required]],
    start_date: [this.today()],
    notes: [''],
  });

  // form.controls.X.value (y .invalid) son propiedades planas, no signals:
  // leerlas dentro de un computed() no las vuelve reactivas (el computed no
  // se entera cuando el <select> cambia — solo recalcula si otra signal
  // rastreada cambió primero). Se espejan a signals propias vía
  // valueChanges — mismo patrón que businesses/components/form/form.ts usa
  // para su typeValue/presetValue. canSubmit chequea estas signals en vez
  // de form.invalid por la misma razón.
  private readonly clientIdValue = signal(this.form.controls.client_id.value);
  private readonly planIdValue = signal(this.form.controls.plan_id.value);

  readonly selectedPlan = computed<MembershipPlan | null>(() => {
    const id = this.planIdValue();
    return this.plans().find((p) => p.id === id) ?? null;
  });

  // Pago — mismo patrón que el panel de carrito de productos (segmentado
  // efectivo/tarjeta/QR + recibido/cambio cuando es efectivo), pero propio
  // de este form: la venta de membresía es una transacción independiente
  // del carrito de productos.
  readonly paymentMethod = signal<PaymentMethod>('cash');
  readonly cashReceived = signal<number>(0);

  readonly cashChange = computed(() => this.cashReceived() - (this.selectedPlan()?.price ?? 0));

  readonly canSubmit = computed(() => {
    if (this.submitting()) return false;
    if (!this.clientIdValue() || !this.planIdValue()) return false;
    if (this.paymentMethod() === 'cash' && this.cashReceived() < (this.selectedPlan()?.price ?? 0)) return false;
    return true;
  });

  constructor() {
    this.form.controls.client_id.valueChanges.subscribe((v) => this.clientIdValue.set(v));
    this.form.controls.plan_id.valueChanges.subscribe((v) => this.planIdValue.set(v));

    effect(() => {
      const id = this.newClientId();
      if (id) this.form.controls.client_id.setValue(id);
    });

    // Precarga "Recibido" con el precio del plan mientras el pago sea
    // efectivo: sin esto el campo arranca en 0, se ve vacío, y el botón
    // queda deshabilitado sin ninguna pista de por qué — el cajero asume
    // "pagó justo" por defecto y solo ajusta si el cliente dio de más.
    // Al cambiar de plan o de método, resincroniza (pisa un monto manual
    // que ya no corresponde al plan/método anterior).
    effect(() => {
      const plan = this.selectedPlan();
      const method = this.paymentMethod();
      this.cashReceived.set(method === 'cash' ? (plan?.price ?? 0) : 0);
    });
  }

  private today(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  setPaymentMethod(m: PaymentMethod): void {
    this.paymentMethod.set(m);
  }

  setCashReceived(value: number): void {
    this.cashReceived.set(Math.max(0, isFinite(value) ? value : 0));
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;
    const raw = this.form.getRawValue();
    const startDate = raw.start_date.trim();
    const notes = raw.notes.trim();
    this.submitForm.emit({
      client_id: raw.client_id,
      plan_id: raw.plan_id,
      start_date: startDate.length > 0 ? startDate : null,
      payment_method: this.paymentMethod(),
      notes: notes.length > 0 ? notes : null,
    });
  }
}
