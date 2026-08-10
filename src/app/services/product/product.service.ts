import { inject, Injectable } from '@angular/core';
import { Product, SaleUnit } from '../../models/product.model';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface CreateProductInput {
  name: string;
  short_name: string | null;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  price: number;
  cost: number;
  stock: number;
  has_stock: boolean;
  is_active: boolean;
  sale_unit: SaleUnit;
  is_weighable: boolean;
  provider: string | null;
}

export type UpdateProductInput = CreateProductInput;

// Los índices únicos parciales de la migración 20260810000000 devuelven 23505.
// Traduce el error de Postgres a un mensaje que el admin entienda.
function translateProductError(err: unknown): unknown {
  if (!err || typeof err !== 'object') return err;
  const code = (err as { code?: unknown }).code;
  if (code !== '23505') return err;

  const message = String((err as { message?: unknown }).message ?? '');
  if (message.includes('idx_products_sku_unique')) {
    return new Error('Ya existe un producto con ese SKU en este negocio.');
  }
  if (message.includes('idx_products_barcode_unique')) {
    return new Error('Ya existe un producto con ese código de barras en este negocio.');
  }
  return err;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly client = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  // Campos compartidos por insert y update. El stock se fuerza a 0 cuando el
  // producto no gestiona stock, y is_weighable solo sobrevive en unidades de
  // peso/volumen (mismo check que la base).
  private toRow(input: CreateProductInput) {
    return {
      name: input.name,
      short_name: input.short_name,
      description: input.description,
      sku: input.sku,
      barcode: input.barcode,
      category_id: input.category_id,
      price: input.price,
      cost: input.cost,
      stock: input.has_stock ? input.stock : 0,
      has_stock: input.has_stock,
      is_active: input.is_active,
      sale_unit: input.sale_unit,
      is_weighable: input.is_weighable,
      provider: input.provider,
    };
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    const businessId = this.auth.businessId();
    if (!businessId) throw new Error('Tu cuenta no tiene un negocio asignado.');

    const { data, error } = await this.client
      .from('products')
      .insert({ business_id: businessId, ...this.toRow(input) })
      .select('*, category:categories(id, name, description)')
      .single();
    if (error) throw translateProductError(error);
    return data as Product;
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    const { data, error } = await this.client
      .from('products')
      .update(this.toRow(input))
      .eq('id', id)
      .select('*, category:categories(id, name, description)')
      .single();
    if (error) throw translateProductError(error);
    return data as Product;
  }

  // Activa o desactiva sin abrir el formulario. Un producto inactivo desaparece
  // del POS y del reporte de bajo stock, pero conserva su historial.
  async setProductActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await this.client
      .from('products')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
  }

  // Soft delete: marca deleted_at. Las ventas históricas mantienen su producto;
  // los listados filtran por deleted_at is null para esconderlo.
  async softDeleteProduct(id: string): Promise<void> {
    const { error } = await this.client
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }
}
