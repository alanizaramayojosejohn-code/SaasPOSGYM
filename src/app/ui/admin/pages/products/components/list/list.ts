import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Product, SaleUnit, saleUnitShort } from '../../../../../../models/product.model';
import { ProductImageService } from '../../../../../../services/image/product-image.service';

type ProductFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock' | 'no-category' | 'inactive';
type ProductSort = 'name' | 'stock-asc' | 'price-desc' | 'created';

@Component({
  selector: 'app-admin-products-list',
  imports: [CurrencyPipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsListComponent {
  private readonly images = inject(ProductImageService);

  readonly products = input.required<Product[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<Product>();
  readonly remove = output<Product>();
  readonly view = output<Product>();
  readonly toggleActive = output<Product>();

  readonly search = signal('');
  readonly filter = signal<ProductFilter>('all');
  readonly sort = signal<ProductSort>('created');
  readonly sortMenuOpen = signal(false);

  imageUrl(product: Product): string | null {
    return this.images.publicUrl(product.image_path);
  }

  unitShort(unit: SaleUnit): string {
    return saleUnitShort(unit);
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // Bajo stock = (1, 5). Sin stock = 0. Solo aplica a productos con has_stock = true.
  readonly counts = computed(() => {
    const list = this.products();
    return {
      all: list.length,
      inStock: list.filter((p) => p.has_stock && p.stock >= 5).length,
      lowStock: list.filter((p) => p.has_stock && p.stock > 0 && p.stock < 5).length,
      outOfStock: list.filter((p) => p.has_stock && p.stock === 0).length,
      noCategory: list.filter((p) => !p.category_id).length,
      inactive: list.filter((p) => !p.is_active).length,
    };
  });

  readonly filteredSorted = computed<Product[]>(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    const s = this.sort();
    let list = this.products().slice();

    if (f === 'in-stock') list = list.filter((p) => p.has_stock && p.stock >= 5);
    else if (f === 'low-stock') list = list.filter((p) => p.has_stock && p.stock > 0 && p.stock < 5);
    else if (f === 'out-of-stock') list = list.filter((p) => p.has_stock && p.stock === 0);
    else if (f === 'no-category') list = list.filter((p) => !p.category_id);
    else if (f === 'inactive') list = list.filter((p) => !p.is_active);

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.short_name ?? '').toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase().includes(q) ||
          (p.category?.name ?? '').toLowerCase().includes(q) ||
          (p.provider ?? '').toLowerCase().includes(q),
      );
    }

    if (s === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (s === 'stock-asc') list.sort((a, b) => a.stock - b.stock);
    else if (s === 'price-desc') list.sort((a, b) => Number(b.price) - Number(a.price));
    else list.sort((a, b) => b.created_at.localeCompare(a.created_at));

    return list;
  });

  readonly sortLabel = computed(() => {
    switch (this.sort()) {
      case 'name': return 'Nombre A→Z';
      case 'stock-asc': return 'Stock ascendente';
      case 'price-desc': return 'Precio descendente';
      default: return 'Recientes primero';
    }
  });

  setSearch(v: string): void { this.search.set(v); }
  setFilter(f: ProductFilter): void { this.filter.set(f); }
  setSort(s: ProductSort): void {
    this.sort.set(s);
    this.sortMenuOpen.set(false);
  }
  toggleSortMenu(): void { this.sortMenuOpen.update((v) => !v); }
}
