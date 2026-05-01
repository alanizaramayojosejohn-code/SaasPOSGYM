import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Product } from '../../../../../../models/product.model';

@Component({
  selector: 'app-admin-products-list',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsListComponent {
  readonly products = input.required<Product[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<Product>();
  readonly remove = output<Product>();
}
