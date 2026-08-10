// Modalidad de sueldo. 'monthly' es el caso normal; 'hourly' y 'commission'
// dejan el monto base como referencia y el bruto real se carga al liquidar.
export type SalaryType = 'monthly' | 'hourly' | 'commission';

export const SALARY_TYPES: readonly { value: SalaryType; label: string }[] = [
  { value: 'monthly', label: 'Sueldo mensual' },
  { value: 'hourly', label: 'Por hora' },
  { value: 'commission', label: 'Por comisión' },
];

export function salaryTypeLabel(v: SalaryType): string {
  return SALARY_TYPES.find((t) => t.value === v)?.label ?? v;
}

export type DeductionType =
  | 'advance'
  | 'absence'
  | 'late'
  | 'loan'
  | 'tax'
  | 'social_security'
  | 'other';

export const DEDUCTION_TYPES: readonly { value: DeductionType; label: string }[] = [
  { value: 'advance', label: 'Adelanto' },
  { value: 'absence', label: 'Falta' },
  { value: 'late', label: 'Atraso' },
  { value: 'loan', label: 'Préstamo' },
  { value: 'tax', label: 'Impuesto' },
  { value: 'social_security', label: 'Aporte / AFP' },
  { value: 'other', label: 'Otro' },
];

export function deductionTypeLabel(v: DeductionType): string {
  return DEDUCTION_TYPES.find((t) => t.value === v)?.label ?? v;
}

export type PayrollMethod = 'cash' | 'transfer' | 'check';

export const PAYROLL_METHODS: readonly { value: PayrollMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'check', label: 'Cheque' },
];

export function payrollMethodLabel(v: PayrollMethod): string {
  return PAYROLL_METHODS.find((m) => m.value === v)?.label ?? v;
}

export interface Employee {
  id: string;
  business_id: string;
  // Cuenta del panel, si además es admin o caja. null = solo cobra sueldo.
  profile_id: string | null;
  name: string;
  ci: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  hire_date: string;
  termination_date: string | null;
  salary_type: SalaryType;
  base_salary: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface EmployeeDeduction {
  id: string;
  business_id: string;
  employee_id: string;
  // null = pendiente de aplicar en una liquidación.
  payment_id: string | null;
  type: DeductionType;
  amount: number;
  description: string | null;
  applied_on: string;
  created_at: string;
}

export interface EmployeePayment {
  id: string;
  business_id: string;
  employee_id: string;
  employee?: { id: string; name: string; ci: string; position: string | null } | null;
  period_start: string;
  period_end: string;
  gross_amount: number;
  bonus_amount: number;
  deductions_amount: number;
  net_amount: number;
  payment_method: PayrollMethod;
  paid_on: string;
  status: 'paid' | 'cancelled';
  notes: string | null;
  created_at: string;
  cancelled_at: string | null;
}

// ------------------------------------------------------------------ Reportes

export interface EmployeePayrollSummary {
  employee_id: string;
  business_id: string;
  name: string;
  ci: string;
  position: string | null;
  salary_type: SalaryType;
  base_salary: number;
  is_active: boolean;
  hire_date: string;
  payments_count: number;
  total_gross: number;
  total_bonus: number;
  total_deductions: number;
  total_net: number;
  last_payment_on: string | null;
  pending_deductions: number;
}

export interface EmployeePayrollMonthly {
  business_id: string;
  month: string;
  payments_count: number;
  employees_count: number;
  total_gross: number;
  total_bonus: number;
  total_deductions: number;
  total_net: number;
}

export interface DeductionsByType {
  business_id: string;
  type: DeductionType;
  deductions_count: number;
  total_amount: number;
  pending_count: number;
  pending_amount: number;
}
