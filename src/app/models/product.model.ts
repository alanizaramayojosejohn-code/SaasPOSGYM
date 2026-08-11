// Unidad en la que se vende el producto. 'unit' es el default histórico.
// Solo kg/g/l/ml admiten cantidad decimal (ver is_weighable).
export type SaleUnit = 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'pack' | 'box';

export const SALE_UNITS: readonly { value: SaleUnit; label: string; short: string }[] = [
  { value: 'unit', label: 'Unidad', short: 'u' },
  { value: 'kg', label: 'Kilogramo', short: 'kg' },
  { value: 'g', label: 'Gramo', short: 'g' },
  { value: 'l', label: 'Litro', short: 'L' },
  { value: 'ml', label: 'Mililitro', short: 'ml' },
  { value: 'pack', label: 'Paquete', short: 'paq' },
  { value: 'box', label: 'Caja', short: 'caja' },
];

// Unidades que permiten marcar el producto como pesable.
export const WEIGHABLE_UNITS: readonly SaleUnit[] = ['kg', 'g', 'l', 'ml'];

export function saleUnitLabel(unit: SaleUnit): string {
  return SALE_UNITS.find((u) => u.value === unit)?.label ?? unit;
}

export function saleUnitShort(unit: SaleUnit): string {
  return SALE_UNITS.find((u) => u.value === unit)?.short ?? unit;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  category: { id: string; name: string; description: string | null } | null;
  price: number;
  cost: number;
  stock: number;
  has_stock: boolean;
  is_active: boolean;
  sale_unit: SaleUnit;
  is_weighable: boolean;
  // Ruta dentro del bucket product-images, no la URL: el dominio del
  // proyecto se resuelve en lectura.
  image_path: string | null;
  provider: string | null;
  created_at: string;
  deleted_at: string | null;
}
