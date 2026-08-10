import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Product } from '../../../../../../models/product.model';
import { Supplier } from '../../../../../../models/supplier.model';
import { ProductQueryService } from '../../../../../../services/product/query.service';
import { AcquisitionItemInput, PurchasesService } from '../../../../../../services/purchases/purchases.service';
import { SupplierService } from '../../../../../../services/supplier/supplier.service';
import { errorMessage } from '../../../../../../utilities/error-message';

interface ItemRow {
  product_id: string;
  quantity: number;
  unit_cost: number;
}

@Component({
  selector: 'app-new-acquisition',
  imports: [FormsModule, RouterLink, CurrencyPipe],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewAcquisitionComponent {
  private readonly purchases = inject(PurchasesService);
  private readonly productQuery = inject(ProductQueryService);
  private readonly supplierService = inject(SupplierService);
  private readonly router = inject(Router);

  readonly products = signal<Product[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly loadingData = signal(true);

  // Form fields
  readonly supplierId = signal<string>('');
  readonly notes = signal('');
  readonly acquiredAt = signal(new Date().toISOString().slice(0, 10));

  // Items
  readonly items = signal<ItemRow[]>([{ product_id: '', quantity: 1, unit_cost: 0 }]);

  readonly total = computed(() =>
    this.items().reduce((sum, i) => sum + (i.quantity || 0) * (i.unit_cost || 0), 0),
  );

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  // Computed product name for display
  readonly productMap = computed(() => {
    const map = new Map<string, Product>();
    for (const p of this.products()) map.set(p.id, p);
    return map;
  });

  constructor() {
    void this.loadData();
  }

  async loadData(): Promise<void> {
    try {
      const [products, suppliers] = await Promise.all([
        this.productQuery.listActiveProducts(),
        this.supplierService.listSuppliers(),
      ]);
      this.products.set(products.filter((p) => p.has_stock));
      this.suppliers.set(suppliers);
    } catch (err: unknown) {
      console.error('Error cargando datos', err);
    } finally {
      this.loadingData.set(false);
    }
  }

  addItem(): void {
    this.items.update((rows) => [...rows, { product_id: '', quantity: 1, unit_cost: 0 }]);
  }

  removeItem(index: number): void {
    if (this.items().length <= 1) return;
    this.items.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateItem(index: number, field: keyof ItemRow, value: string | number): void {
    this.items.update((rows) => {
      const updated = [...rows];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  get isValid(): boolean {
    return this.items().every(
      (i) => i.product_id && i.quantity > 0 && i.unit_cost >= 0,
    ) && this.items().length > 0;
  }

  async onSubmit(): Promise<void> {
    if (!this.isValid || this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    try {
      const p_items: AcquisitionItemInput[] = this.items().map((i) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
      }));
      await this.purchases.registerAcquisition({
        supplier_id: this.supplierId() || null,
        notes: this.notes().trim() || null,
        acquired_at: this.acquiredAt(),
        items: p_items,
      });
      await this.router.navigateByUrl('/admin/purchases');
    } catch (err: unknown) {
      this.submitError.set(errorMessage(err, 'Error al registrar llegada'));
    } finally {
      this.submitting.set(false);
    }
  }
}
