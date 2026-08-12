import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { AuthService } from '../../../../../../services/auth/auth.service';
import { OrderWithDetails, PAYMENT_METHOD_LABEL } from '../../../../../../models/order.model';
import { MethodBadgeComponent } from '../../../../../shared/method-badge.component';

@Component({
  selector: 'app-order-invoice',
  imports: [CurrencyPipe, DatePipe, MethodBadgeComponent],
  templateUrl: './invoice.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderInvoiceComponent {
  private readonly auth = inject(AuthService);

  readonly order = input.required<OrderWithDetails>();
  readonly close = output<void>();

  readonly businessName = computed(() => this.auth.businessName() ?? 'SaasGym');
  readonly businessInitial = computed(() => (this.businessName()[0] ?? 'S').toUpperCase());

  readonly orderNumber = computed(() => this.order().id.replace(/-/g, '').slice(-8).toUpperCase());

  readonly paymentLabel = computed(() => PAYMENT_METHOD_LABEL[this.order().payment_method]);

  readonly subtotal = computed(() =>
    this.order().items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
  );

  print(): void {
    window.print();
  }
}
