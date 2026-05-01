export type SaleType = 'product' | 'membership';

export interface Sale {
  id: string;
  business_id: string;
  type: SaleType;
  amount: number;
  quantity: number;
  client_id: string | null;
  product_id: string | null;
  client_membership_id: string | null;
  created_by: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
}

// Sale + nombres denormalizados para listar sin joins manuales en el HTML.
export interface SaleWithDetails extends Sale {
  product_name: string | null;
  plan_name: string | null;
  client_label: string | null; // "CI · Nombre" o null si la venta no tiene cliente
}
