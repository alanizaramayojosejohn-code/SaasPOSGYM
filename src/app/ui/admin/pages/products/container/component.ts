import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Product } from '../../../../../models/product.model';
import { CreateProductInput, ProductService } from '../../../../../services/product/product.service';
import { ProductQueryService } from '../../../../../services/product/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ProductsFormComponent } from '../components/form/form';
import { ProductsListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-products',
  imports: [ProductsListComponent, ProductsFormComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductsContainerComponent {
  private readonly productService = inject(ProductService);
  private readonly productQuery = inject(ProductQueryService);

  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);

  readonly formState = signal<null | 'create' | Product>(null);
  readonly editing = computed<Product | null>(() => {
    const s = this.formState();
    return s && s !== 'create' ? s : null;
  });
  readonly showForm = computed(() => this.formState() !== null);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.products.set(await this.productQuery.listProducts());
    } catch (err: unknown) {
      console.error('Error listando productos', err);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.formState.set('create');
    this.formError.set(null);
  }

  openEdit(product: Product): void {
    this.formState.set(product);
    this.formError.set(null);
  }

  closeForm(): void {
    this.formState.set(null);
    this.formError.set(null);
  }

  async handleSubmit(input: CreateProductInput): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    const editing = this.editing();
    try {
      if (editing) {
        await this.productService.updateProduct(editing.id, input);
      } else {
        await this.productService.createProduct(input);
      }
      this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(
        errorMessage(err, editing ? 'Error al guardar producto' : 'Error al crear producto'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  async handleDelete(product: Product): Promise<void> {
    const ok = window.confirm(
      `¿Eliminar "${product.name}" del inventario?\n` +
      `Soft delete: ya no aparecerá en listas ni se podrá vender, ` +
      `pero las ventas históricas seguirán mostrándolo.`,
    );
    if (!ok) return;
    try {
      await this.productService.softDeleteProduct(product.id);
      if (this.editing()?.id === product.id) this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      window.alert(errorMessage(err, 'Error al eliminar producto'));
    }
  }
}
