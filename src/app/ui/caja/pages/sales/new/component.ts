import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from '../../../../../models/client.model';
import { MembershipPlan } from '../../../../../models/membership-plan.model';
import { Product, SaleUnit, saleUnitShort } from '../../../../../models/product.model';
import { AuthService } from '../../../../../services/auth/auth.service';
import { ClientQueryService } from '../../../../../services/client/query.service';
import { MembershipPlanQueryService } from '../../../../../services/membership-plan/query.service';
import { ProductQueryService } from '../../../../../services/product/query.service';
import { MembershipOrderInput, OrderService } from '../../../../../services/order/order.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { SalesMembershipFormComponent } from '../components/membership-form/membership-form';

const PRODUCT_PAGE_SIZE = 20;

interface CartItem {
  product_id: string;
  product_name: string;
  category: string | null;
  unit_price: number;
  stock_available: number;
  has_stock: boolean;
  quantity: number;
}

type PaymentMethod = 'cash' | 'card' | 'qr';
type Mode = 'products' | 'membership';

@Component({
  selector: 'app-caja-sales-new',
  imports: [CurrencyPipe, DecimalPipe, SalesMembershipFormComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CajaSalesNewComponent {
  private readonly orderService = inject(OrderService);
  private readonly productQuery = inject(ProductQueryService);
  private readonly clientQuery = inject(ClientQueryService);
  private readonly planQuery = inject(MembershipPlanQueryService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly products = signal<Product[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly plans = signal<MembershipPlan[]>([]);
  readonly loading = signal(false);

  readonly mode = signal<Mode>('products');
  readonly cart = signal<CartItem[]>([]);
  readonly cartCustomerId = signal<string>('');
  readonly paymentMethod = signal<PaymentMethod>('cash');
  readonly cashReceived = signal<number>(0);

  readonly searchQuery = signal<string>('');
  readonly activeCategory = signal<string | null>(null);
  readonly productPage = signal(1);

  // Lectura de código de barras / SKU desde el buscador.
  readonly scanning = signal(false);
  readonly scanError = signal<string | null>(null);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly isGym = computed(() => this.auth.businessType() === 'gym');

  readonly availableProducts = computed(() =>
    this.products().filter((p) => p.is_active && (!p.has_stock || p.stock > 0))
  );

  readonly categories = computed<string[]>(() => {
    const set = new Set<string>();
    for (const p of this.availableProducts()) {
      if (p.category?.name) set.add(p.category.name);
    }
    return Array.from(set).sort();
  });

  readonly filteredProducts = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.activeCategory();
    return this.availableProducts().filter((p) => {
      if (cat && p.category?.name !== cat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.short_name ?? '').toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly totalProductPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredProducts().length / PRODUCT_PAGE_SIZE)),
  );

  readonly paginatedProducts = computed(() => {
    const p = this.productPage();
    return this.filteredProducts().slice((p - 1) * PRODUCT_PAGE_SIZE, p * PRODUCT_PAGE_SIZE);
  });

  readonly productPageNumbers = computed(() =>
    Array.from({ length: this.totalProductPages() }, (_, i) => i + 1),
  );

  readonly cartSubtotal = computed(() =>
    this.cart().reduce((s, i) => s + i.unit_price * i.quantity, 0),
  );
  readonly cartItemCount = computed(() => this.cart().length);
  readonly cartTotalQuantity = computed(() => this.cart().reduce((s, i) => s + i.quantity, 0));
  readonly cashChange = computed(() => this.cashReceived() - this.cartSubtotal());

  readonly selectedCustomer = computed<Client | null>(() => {
    const id = this.cartCustomerId();
    if (!id) return null;
    return this.clients().find((c) => c.id === id) ?? null;
  });

  readonly canCharge = computed(() => {
    if (this.cart().length === 0) return false;
    if (this.submitting()) return false;
    if (this.paymentMethod() === 'cash' && this.cashReceived() < this.cartSubtotal()) return false;
    return true;
  });

  constructor() {
    void this.load();
    effect(() => {
      this.searchQuery();
      this.activeCategory();
      this.productPage.set(1);
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const tasks: Promise<unknown>[] = [
        this.productQuery.listActiveProducts().then((v) => this.products.set(v)),
        this.clientQuery.listClients().then((v) => this.clients.set(v)),
      ];
      if (this.isGym()) {
        tasks.push(this.planQuery.listPlans().then((v) => this.plans.set(v)));
      }
      await Promise.all(tasks);
    } catch (err) {
      console.error('Error cargando datos', err);
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    void this.router.navigate(['..'], { relativeTo: this.route });
  }

  setMode(m: Mode): void {
    this.mode.set(m);
    this.formError.set(null);
  }

  setProductPage(p: number): void {
    this.productPage.set(p);
  }

  unitShort(unit: SaleUnit): string {
    return saleUnitShort(unit);
  }

  addToCart(product: Product): void {
    if (product.has_stock && product.stock <= 0) return;
    const existing = this.cart().find((i) => i.product_id === product.id);
    if (existing) {
      this.updateQty(product.id, 1);
      return;
    }
    this.cart.update((c) => [
      ...c,
      {
        product_id: product.id,
        product_name: product.name,
        category: product.category?.name ?? null,
        unit_price: Number(product.price),
        stock_available: product.stock,
        has_stock: product.has_stock,
        quantity: 1,
      },
    ]);
  }

  updateQty(productId: string, delta: number): void {
    this.cart.update((c) =>
      c
        .map((i) => {
          if (i.product_id !== productId) return i;
          const next = i.quantity + delta;
          if (i.has_stock && next > i.stock_available) return i;
          return { ...i, quantity: next };
        })
        .filter((i) => i.quantity > 0),
    );
  }

  removeFromCart(productId: string): void {
    this.cart.update((c) => c.filter((i) => i.product_id !== productId));
  }

  clearCart(): void {
    this.cart.set([]);
    this.cartCustomerId.set('');
    this.cashReceived.set(0);
    this.formError.set(null);
  }

  setSearch(value: string): void {
    this.searchQuery.set(value);
    this.scanError.set(null);
  }

  // Enter en el buscador = lectura del escáner. Busca coincidencia exacta por
  // código de barras o SKU y manda el producto al carrito sin más clics.
  // Si el catálogo en memoria no lo tiene (alta reciente), consulta al servidor.
  async submitSearch(): Promise<void> {
    const code = this.searchQuery().trim();
    if (!code) return;

    const lower = code.toLowerCase();
    const local = this.availableProducts().find(
      (p) => p.barcode?.toLowerCase() === lower || p.sku?.toLowerCase() === lower,
    );
    if (local) {
      this.addToCart(local);
      this.searchQuery.set('');
      this.scanError.set(null);
      return;
    }

    this.scanning.set(true);
    this.scanError.set(null);
    try {
      const remote = await this.productQuery.findByCode(code);
      if (!remote) {
        // Puede ser una búsqueda por nombre: la lista filtrada ya la resuelve.
        if (this.filteredProducts().length === 0) {
          this.scanError.set(`Ningún producto con el código "${code}".`);
        }
        return;
      }
      if (remote.has_stock && remote.stock <= 0) {
        this.scanError.set(`"${remote.name}" está sin stock.`);
        return;
      }
      // Incorpora el producto al catálogo en memoria para que aparezca en la grilla.
      this.products.update((list) =>
        list.some((p) => p.id === remote.id) ? list : [remote, ...list],
      );
      this.addToCart(remote);
      this.searchQuery.set('');
    } catch (err) {
      this.scanError.set(errorMessage(err, 'Error al buscar el producto'));
    } finally {
      this.scanning.set(false);
    }
  }

  selectCategory(cat: string | null): void {
    this.activeCategory.set(cat);
  }

  selectCustomer(id: string): void {
    this.cartCustomerId.set(id);
  }

  setPaymentMethod(m: PaymentMethod): void {
    this.paymentMethod.set(m);
    if (m !== 'cash') this.cashReceived.set(0);
  }

  setCashReceived(value: number): void {
    this.cashReceived.set(Math.max(0, isFinite(value) ? value : 0));
  }

  // Un solo RPC atómico — ya no hay N llamadas secuenciales.
  async charge(): Promise<void> {
    if (!this.canCharge()) return;
    this.submitting.set(true);
    this.formError.set(null);

    try {
      await this.orderService.registerOrder({
        client_id: this.cartCustomerId() || null,
        payment_method: this.paymentMethod(),
        items: this.cart().map((item) => ({
          type: 'product' as const,
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });
      this.goBack();
    } catch (err: unknown) {
      this.formError.set(errorMessage(err, 'Error al procesar la venta'));
      this.submitting.set(false);
    }
  }

  async handleSaleMembership(input: MembershipOrderInput): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    try {
      await this.orderService.registerOrder({
        client_id: input.client_id,
        payment_method: this.paymentMethod(),
        items: [{ type: 'membership', plan_id: input.plan_id, start_date: input.start_date }],
      });
      this.goBack();
    } catch (err: unknown) {
      this.formError.set(errorMessage(err, 'Error al registrar membresía'));
      this.submitting.set(false);
    }
  }

  itemAtMax(item: CartItem): boolean {
    return item.has_stock && item.quantity >= item.stock_available;
  }

  productInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
