import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { SaleWithDetails } from '../../../../../../models/sale.model';

@Component({
  selector: 'app-caja-sales-list',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesListComponent {
  readonly sales = input.required<SaleWithDetails[]>();
  readonly loading = input<boolean>(false);
  readonly cancel = output<SaleWithDetails>();
}
