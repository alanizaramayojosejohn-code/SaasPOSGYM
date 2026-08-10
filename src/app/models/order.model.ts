export type OrderItemType = 'product' | 'membership';
export type PaymentMethod = 'cash' | 'card' | 'qr';

export interface OrderItem {
  id: string;
  order_id: string;
  business_id: string;
  type: OrderItemType;
  product_id: string | null;
  plan_id: string | null;
  client_membership_id: string | null;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface OrderItemWithDetails extends OrderItem {
  product_name: string | null;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Order {
  id: string;
  business_id: string;
  client_id: string | null;
  payment_method: PaymentMethod;
  total_amount: number;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrderWithDetails extends Order {
  client_label: string | null;
  // Datos de facturación, para la factura impresa.
  client_nit: string | null;
  client_business_name: string | null;
  items: OrderItemWithDetails[];
}

export function orderPrimaryLabel(order: OrderWithDetails): string {
  const first = order.items[0];
  if (!first) return '—';
  const name = first.type === 'product' ? first.product_name : first.plan_name;
  const extra = order.items.length - 1;
  return extra > 0 ? `${name ?? '—'} (+${extra} más)` : (name ?? '—');
}

export function orderPrimaryType(order: OrderWithDetails): OrderItemType {
  return order.items[0]?.type ?? 'product';
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  qr: 'QR',
};
