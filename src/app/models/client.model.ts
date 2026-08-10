export interface Client {
  id: string;
  business_id: string;
  // CI identifica a la persona; NIT identifica a quién se le factura, que puede
  // ser una empresa distinta del que compra.
  ci: string;
  nit: string | null;
  business_name: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  birth_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
}

// ------------------------------------------------------------------ Reportes

export interface ClientPurchaseSummary {
  client_id: string;
  business_id: string;
  name: string;
  ci: string;
  nit: string | null;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  orders_count: number;
  total_spent: number;
  avg_ticket: number;
  last_purchase_at: string | null;
  first_purchase_at: string | null;
}

export interface ClientRegistrationsMonthly {
  business_id: string;
  month: string;
  clients_count: number;
  with_nit_count: number;
}
