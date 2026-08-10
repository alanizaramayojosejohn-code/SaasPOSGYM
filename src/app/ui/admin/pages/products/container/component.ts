import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Category } from '../../../../../models/category.model';
import { Product, saleUnitShort } from '../../../../../models/product.model';
import { CategoryQueryService } from '../../../../../services/category/query.service';
import { CreateProductInput, ProductService } from '../../../../../services/product/product.service';
import { ProductQueryService } from '../../../../../services/product/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { ProductsFormComponent } from '../components/form/form';
import { ProductsListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-products',
  imports: [ProductsListComponent, ProductsFormComponent, ConfirmDeleteModalComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductsContainerComponent {
  private readonly productService = inject(ProductService);
  private readonly productQuery = inject(ProductQueryService);
  private readonly categoryQuery = inject(CategoryQueryService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);

  readonly formState = signal<null | 'create' | Product>(null);
  readonly editing = computed<Product | null>(() => {
    const s = this.formState();
    return s && s !== 'create' ? s : null;
  });
  readonly showForm = computed(() => this.formState() !== null);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  // Errores de acciones sobre la fila (activar/desactivar), fuera del formulario.
  readonly actionError = signal<string | null>(null);

  // Soft delete via modal — los productos no requieren type-to-confirm porque
  // queda en deleted_at, las ventas históricas siguen viendolo.
  readonly deleting = signal<Product | null>(null);
  readonly deletingError = signal<string | null>(null);
  readonly deletingSubmitting = signal(false);

  readonly deletingInitials = computed(() => {
    const p = this.deleting();
    if (!p) return null;
    const parts = p.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });

  // Precio formateado como string para el slot "amount" del modal.
  readonly deletingPrice = computed(() => {
    const p = this.deleting();
    if (!p) return null;
    return `Bs ${Number(p.price).toFixed(2)}`;
  });

  readonly deletingSublabel = computed(() => {
    const p = this.deleting();
    if (!p) return null;
    const cat = p.category?.name ?? 'Sin categoría';
    const code = p.sku ?? p.barcode;
    const stock = `Stock ${p.stock} ${saleUnitShort(p.sale_unit)}`;
    return code ? `${cat} · ${code} · ${stock}` : `${cat} · ${stock}`;
  });

  constructor() {
    void this.refresh();
    void this.loadCategories();
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

  async loadCategories(): Promise<void> {
    try {
      this.categories.set(await this.categoryQuery.listCategories());
    } catch (err: unknown) {
      console.error('Error listando categorías', err);
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

  // Activar/desactivar desde la fila. Actualiza la lista en memoria y sincroniza
  // con el servidor; si falla, revierte y muestra el error sobre la tabla.
  async handleToggleActive(product: Product): Promise<void> {
    const next = !product.is_active;
    this.actionError.set(null);
    this.products.update((list) =>
      list.map((p) => (p.id === product.id ? { ...p, is_active: next } : p)),
    );
    try {
      await this.productService.setProductActive(product.id, next);
    } catch (err: unknown) {
      this.products.update((list) =>
        list.map((p) => (p.id === product.id ? { ...p, is_active: product.is_active } : p)),
      );
      this.actionError.set(
        errorMessage(err, next ? 'Error al activar producto' : 'Error al desactivar producto'),
      );
    }
  }

  handleDelete(product: Product): void {
    this.deleting.set(product);
    this.deletingError.set(null);
  }

  cancelDelete(): void {
    if (this.deletingSubmitting()) return;
    this.deleting.set(null);
    this.deletingError.set(null);
  }

  async confirmDelete(): Promise<void> {
    const product = this.deleting();
    if (!product) return;
    this.deletingSubmitting.set(true);
    this.deletingError.set(null);
    try {
      await this.productService.softDeleteProduct(product.id);
      if (this.editing()?.id === product.id) this.formState.set(null);
      this.deleting.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.deletingError.set(errorMessage(err, 'Error al eliminar producto'));
    } finally {
      this.deletingSubmitting.set(false);
    }
  }
}
