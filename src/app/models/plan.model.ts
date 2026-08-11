// Módulos que un plan puede habilitar. La lista está replicada como check en
// la tabla `plans` (migración 20260811000000): si agregas uno acá, agrégalo
// también allá o la base rechazará el catálogo.
export type PlanFeature =
  | 'memberships'
  | 'purchases'
  | 'employees'
  | 'product_images'
  | 'client_reports'
  | 'payroll_reports';

export const FEATURE_LABELS: Readonly<Record<PlanFeature, string>> = {
  memberships: 'Membresías y asistencia',
  purchases: 'Compras y proveedores',
  employees: 'Empleados y nómina',
  product_images: 'Imágenes de producto',
  client_reports: 'Reportes de clientes',
  payroll_reports: 'Reportes de nómina',
};

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled';

export const STATUS_LABELS: Readonly<Record<SubscriptionStatus, string>> = {
  trialing: 'En prueba',
  active: 'Activa',
  past_due: 'Pago pendiente',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

export type PaymentMethod = 'qr' | 'transfer' | 'cash' | 'card' | 'other';

export const PAYMENT_METHODS: readonly { value: PaymentMethod; label: string }[] = [
  { value: 'qr', label: 'QR Simple' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otro' },
];

export interface Plan {
  code: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  // null = ilimitado
  max_users: number | null;
  max_clients: number | null;
  max_products: number | null;
  features: PlanFeature[];
  sort_order: number;
  is_active: boolean;
}

/** Plan y consumo del negocio del usuario actual. */
export interface MyPlanUsage {
  business_id: string;
  plan_code: string;
  plan_name: string;
  price_monthly: number;
  features: PlanFeature[];
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  // Negativo = ya venció.
  days_left: number | null;
  can_write: boolean;
  max_users: number | null;
  max_clients: number | null;
  max_products: number | null;
  users_count: number;
  clients_count: number;
  products_count: number;
}

/** Fila del panel del super_admin. */
export interface SubscriptionOverview {
  business_id: string;
  name: string;
  type: 'pos' | 'gym';
  plan_code: string;
  plan_name: string;
  price_monthly: number;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  days_left: number | null;
  can_write: boolean;
  users_count: number;
  clients_count: number;
  products_count: number;
  max_users: number | null;
  max_clients: number | null;
  max_products: number | null;
  total_paid: number;
}

export interface SubscriptionPayment {
  id: string;
  business_id: string;
  plan_code: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  period_start: string;
  period_end: string;
  paid_on: string;
  notes: string | null;
  created_at: string;
}
