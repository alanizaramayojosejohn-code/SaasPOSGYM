import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../../../../../../models/category.model';
import { Product, SALE_UNITS, SaleUnit, WEIGHABLE_UNITS } from '../../../../../../models/product.model';
import { CreateProductInput } from '../../../../../../services/product/product.service';

@Component({
  selector: 'app-admin-products-form',
  imports: [ReactiveFormsModule],
  templateUrl: './form.html',
  styleUrl: './form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly value = input<Product | null>(null);
  readonly categories = input<Category[]>([]);
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitForm = output<CreateProductInput>();
  readonly cancel = output<void>();

  readonly isEdit = computed(() => this.value() !== null);

  readonly saleUnits = SALE_UNITS;

  readonly hasStock = signal(true);
  readonly isActive = signal(true);
  readonly saleUnit = signal<SaleUnit>('unit');
  readonly isWeighable = signal(false);

  // Solo peso y volumen admiten cantidad decimal (mismo check que la base).
  readonly canBeWeighable = computed(() => WEIGHABLE_UNITS.includes(this.saleUnit()));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    short_name: ['', [Validators.maxLength(24)]],
    description: [''],
    sku: [''],
    barcode: [''],
    category_id: [''],
    price: [0, [Validators.required, Validators.min(0)]],
    cost: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    has_stock: [true],
    is_active: [true],
    sale_unit: ['unit' as SaleUnit, [Validators.required]],
    is_weighable: [false],
    provider: [''],
  });

  constructor() {
    effect(() => {
      const v = this.value();
      if (v) {
        this.hasStock.set(v.has_stock);
        this.isActive.set(v.is_active);
        this.saleUnit.set(v.sale_unit);
        this.isWeighable.set(v.is_weighable);
        this.form.reset({
          name: v.name,
          short_name: v.short_name ?? '',
          description: v.description ?? '',
          sku: v.sku ?? '',
          barcode: v.barcode ?? '',
          category_id: v.category_id ?? '',
          price: v.price,
          cost: v.cost,
          stock: v.stock,
          has_stock: v.has_stock,
          is_active: v.is_active,
          sale_unit: v.sale_unit,
          is_weighable: v.is_weighable,
          provider: v.provider ?? '',
        });
      } else {
        this.hasStock.set(true);
        this.isActive.set(true);
        this.saleUnit.set('unit');
        this.isWeighable.set(false);
        this.form.reset({
          name: '', short_name: '', description: '', sku: '', barcode: '',
          category_id: '', price: 0, cost: 0, stock: 0, has_stock: true,
          is_active: true, sale_unit: 'unit', is_weighable: false, provider: '',
        });
      }
    });
  }

  toggleHasStock(checked: boolean): void {
    this.hasStock.set(checked);
    this.form.controls.has_stock.setValue(checked);
  }

  toggleIsActive(checked: boolean): void {
    this.isActive.set(checked);
    this.form.controls.is_active.setValue(checked);
  }

  // Cambiar a una unidad no pesable apaga is_weighable, que de otro modo
  // rompería el check products_weighable_unit_check al guardar.
  setSaleUnit(unit: string): void {
    const value = unit as SaleUnit;
    this.saleUnit.set(value);
    this.form.controls.sale_unit.setValue(value);
    if (!WEIGHABLE_UNITS.includes(value)) {
      this.isWeighable.set(false);
      this.form.controls.is_weighable.setValue(false);
    }
  }

  toggleIsWeighable(checked: boolean): void {
    const value = checked && this.canBeWeighable();
    this.isWeighable.set(value);
    this.form.controls.is_weighable.setValue(value);
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    const raw = this.form.getRawValue();
    const nullable = (v: string): string | null => {
      const t = v.trim();
      return t.length > 0 ? t : null;
    };
    this.submitForm.emit({
      name: raw.name.trim(),
      short_name: nullable(raw.short_name),
      description: nullable(raw.description),
      sku: nullable(raw.sku),
      barcode: nullable(raw.barcode),
      category_id: raw.category_id.length > 0 ? raw.category_id : null,
      price: Number(raw.price),
      cost: Number(raw.cost),
      stock: Math.trunc(Number(raw.stock)),
      has_stock: raw.has_stock,
      is_active: raw.is_active,
      sale_unit: raw.sale_unit,
      is_weighable: raw.is_weighable && WEIGHABLE_UNITS.includes(raw.sale_unit),
      provider: nullable(raw.provider),
    });
  }
}
