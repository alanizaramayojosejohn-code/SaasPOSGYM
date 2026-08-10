import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Product } from '../../../../../../models/product.model';
import { Supplier } from '../../../../../../models/supplier.model';
import { ProductQueryService } from '../../../../../../services/product/query.service';
import { CreatePurchaseOrderInput, PurchaseOrderItemInput, PurchasesService } from '../../../../../../services/purchases/purchases.service';
import { SupplierService } from '../../../../../../services/supplier/supplier.service';
import { errorMessage } from '../../../../../../utilities/error-message';

interface OrderItemRow {
  product_id: string;
  quantity_ordered: number;
  unit_cost_estimate: number | null;
}

@Component({
  selector: 'app-new-purchase-order',
  imports: [FormsModule, RouterLink],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewPurchaseOrderComponent {
  private readonly purchases = inject(PurchasesService);
  private readonly productQuery = inject(ProductQueryService);
  private readonly supplierService = inject(SupplierService);
  private readonly router = inject(Router);

  readonly products = signal<Product[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly loadingData = signal(true);

  readonly supplierId = signal('');
  readonly expectedDate = signal('');
  readonly notes = signal('');
  readonly items = signal<OrderItemRow[]>([{ product_id: '', quantity_ordered: 1, unit_cost_estimate: null }]);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  constructor() {
    void this.loadData();
  }

  async loadData(): Promise<void> {
    try {
      const [products, suppliers] = await Promise.all([
        this.productQuery.listActiveProducts(),
        this.supplierService.listSuppliers(),
      ]);
      this.products.set(products);
      this.suppliers.set(suppliers);
    } catch (err: unknown) {
      console.error('Error cargando datos', err);
    } finally {
      this.loadingData.set(false);
    }
  }

  addItem(): void {
    this.items.update((rows) => [...rows, { product_id: '', quantity_ordered: 1, unit_cost_estimate: null }]);
  }

  removeItem(index: number): void {
    if (this.items().length <= 1) return;
    this.items.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateItem(index: number, field: keyof OrderItemRow, value: string | number | null): void {
    this.items.update((rows) => {
      const updated = [...rows];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  get isValid(): boolean {
    return this.items().every((i) => i.product_id && i.quantity_ordered > 0) && this.items().length > 0;
  }

  async onSubmit(): Promise<void> {
    if (!this.isValid || this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    try {
      const p_items: PurchaseOrderItemInput[] = this.items().map((i) => ({
        product_id: i.product_id,
        quantity_ordered: Number(i.quantity_ordered),
        unit_cost_estimate: i.unit_cost_estimate != null ? Number(i.unit_cost_estimate) : null,
      }));
      const input: CreatePurchaseOrderInput = {
        supplier_id: this.supplierId() || null,
        expected_date: this.expectedDate() || null,
        notes: this.notes().trim() || null,
        items: p_items,
      };
      await this.purchases.createPurchaseOrder(input);
      await this.router.navigateByUrl('/admin/purchases');
    } catch (err: unknown) {
      this.submitError.set(errorMessage(err, 'Error al crear pedido'));
    } finally {
      this.submitting.set(false);
    }
  }
}
