import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Category } from '../../../../../models/category.model';
import { Product, saleUnitShort } from '../../../../../models/product.model';
import { CategoryService, CreateCategoryInput } from '../../../../../services/category/category.service';
import { CategoryQueryService } from '../../../../../services/category/query.service';
import { CreateProductInput, ProductService } from '../../../../../services/product/product.service';
import { ProductImageService } from '../../../../../services/image/product-image.service';
import { ProductQueryService } from '../../../../../services/product/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { CategoriesFormComponent } from '../../categories/components/form/form';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { ModalShellComponent } from '../../../../shared/modal-shell.component';
import { ProductsDetailComponent } from '../components/detail/detail';
import { ImageChange, ProductsFormComponent } from '../components/form/form';
import { ProductsListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-products',
  imports: [
    ModalShellComponent,
    ProductsListComponent,
    ProductsFormComponent,
    ProductsDetailComponent,
    ConfirmDeleteModalComponent,
    CategoriesFormComponent,
  ],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductsContainerComponent {
  private readonly productService = inject(ProductService);
  private readonly productQuery = inject(ProductQueryService);
  private readonly categoryService = inject(CategoryService);
  private readonly categoryQuery = inject(CategoryQueryService);
  private readonly imageService = inject(ProductImageService);

  // Modal de alta rápida de categoría, disparado desde el form de producto.
  readonly categoryModalOpen = signal(false);
  readonly categorySubmitting = signal(false);
  readonly categoryError = signal<string | null>(null);
  // Id de la última categoría creada desde el modal: se pasa al form para
  // que la autoseleccione.
  readonly newCategoryId = signal<string | null>(null);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);

  readonly formState = signal<null | 'create' | Product>(null);
  readonly editing = computed<Product | null>(() => {
    const s = this.formState();
    return s && s !== 'create' ? s : null;
  });
  readonly showForm = computed(() => this.formState() !== null);

  readonly editingImageUrl = computed(() =>
    this.imageService.publicUrl(this.editing()?.image_path ?? null),
  );

  // Modal de detalle (solo lectura), independiente del form.
  readonly viewing = signal<Product | null>(null);
  readonly viewingImageUrl = computed(() =>
    this.imageService.publicUrl(this.viewing()?.image_path ?? null),
  );

  imageUrl(product: Product): string | null {
    return this.imageService.publicUrl(product.image_path);
  }

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

  openCategoryModal(): void {
    this.categoryModalOpen.set(true);
    this.categoryError.set(null);
  }

  closeCategoryModal(): void {
    if (this.categorySubmitting()) return;
    this.categoryModalOpen.set(false);
    this.categoryError.set(null);
  }

  async handleCreateCategory(input: CreateCategoryInput): Promise<void> {
    this.categorySubmitting.set(true);
    this.categoryError.set(null);
    try {
      const category = await this.categoryService.createCategory(input);
      this.categories.update((list) => [...list, category]);
      this.newCategoryId.set(category.id);
      this.categoryModalOpen.set(false);
    } catch (err: unknown) {
      this.categoryError.set(errorMessage(err, 'Error al crear categoría'));
    } finally {
      this.categorySubmitting.set(false);
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

  openView(product: Product): void {
    this.viewing.set(product);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  // Pasa del detalle al form de edición para el mismo producto.
  editFromView(): void {
    const product = this.viewing();
    this.viewing.set(null);
    if (product) this.openEdit(product);
  }

  // El producto se guarda primero y la imagen después: la ruta en el bucket
  // incluye el id, que en un alta no existe hasta que la fila está creada.
  // Si la subida falla, el producto ya quedó guardado y se avisa sin perderlo.
  async handleSubmit(payload: { input: CreateProductInput; image: ImageChange }): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    const editing = this.editing();
    try {
      const saved = editing
        ? await this.productService.updateProduct(editing.id, payload.input)
        : await this.productService.createProduct(payload.input);

      await this.applyImageChange(saved.id, editing?.image_path ?? null, payload.image);

      this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(
        errorMessage(err, editing ? 'Error al guardar producto' : 'Error al crear producto'),
      );
      // El producto pudo haberse guardado aunque fallara la imagen: se refresca
      // para que el listado refleje el estado real.
      await this.refresh();
    } finally {
      this.submitting.set(false);
    }
  }

  private async applyImageChange(
    productId: string,
    previousPath: string | null,
    change: ImageChange,
  ): Promise<void> {
    if (change === 'keep') return;

    if (change === 'remove') {
      await this.productService.setProductImage(productId, null);
      await this.imageService.remove(previousPath);
      return;
    }

    // Se sube la nueva, se apunta la fila y recién entonces se borra la vieja:
    // si algo falla en el medio, el producto nunca queda sin imagen válida.
    const { path } = await this.imageService.upload(productId, change.file);
    await this.productService.setProductImage(productId, path);
    if (previousPath && previousPath !== path) {
      await this.imageService.remove(previousPath);
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
      // El soft delete deja la fila, pero el objeto del bucket ya no se usa.
      await this.imageService.remove(product.image_path);
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
