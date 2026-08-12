import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Product, saleUnitLabel } from '../../../../../../models/product.model';
import { DetailFieldComponent } from '../../../../../shared/detail-field.component';

@Component({
  selector: 'app-admin-products-detail',
  imports: [CurrencyPipe, DetailFieldComponent],
  templateUrl: './detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsDetailComponent {
  readonly value = input.required<Product>();
  // Se resuelve en el container (ProductImageService no es un servicio que
  // un dumb component pueda inyectar).
  readonly imageUrl = input<string | null>(null);
  readonly edit = output<void>();
  readonly closed = output<void>();

  readonly initials = computed(() => {
    const parts = this.value().name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });

  readonly saleUnitLabel = computed(() => saleUnitLabel(this.value().sale_unit));
}
