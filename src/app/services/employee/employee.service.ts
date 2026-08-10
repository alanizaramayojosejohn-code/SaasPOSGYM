import { inject, Injectable } from '@angular/core';
import {
  DeductionType,
  Employee,
  EmployeeDeduction,
  PayrollMethod,
  SalaryType,
} from '../../models/employee.model';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface CreateEmployeeInput {
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
  profile_id: string | null;
}

export type UpdateEmployeeInput = CreateEmployeeInput;

export interface CreateDeductionInput {
  employee_id: string;
  type: DeductionType;
  amount: number;
  description: string | null;
  applied_on: string;
}

export interface RegisterPaymentInput {
  employee_id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  bonus_amount: number;
  deduction_ids: string[];
  payment_method: PayrollMethod;
  paid_on: string;
  notes: string | null;
}

// El índice único parcial de la migración 20260810010000 devuelve 23505.
function translateEmployeeError(err: unknown): unknown {
  if (!err || typeof err !== 'object') return err;
  if ((err as { code?: unknown }).code !== '23505') return err;
  const message = String((err as { message?: unknown }).message ?? '');
  if (message.includes('idx_employees_ci_unique')) {
    return new Error('Ya existe un empleado con ese CI en este negocio.');
  }
  if (message.includes('employees_profile_id_key')) {
    return new Error('Esa cuenta del panel ya está enlazada a otro empleado.');
  }
  return err;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly client = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  private toRow(input: CreateEmployeeInput) {
    return {
      name: input.name,
      ci: input.ci,
      position: input.position,
      phone: input.phone,
      email: input.email,
      hire_date: input.hire_date,
      termination_date: input.termination_date,
      salary_type: input.salary_type,
      base_salary: input.base_salary,
      is_active: input.is_active,
      notes: input.notes,
      profile_id: input.profile_id,
    };
  }

  async createEmployee(input: CreateEmployeeInput): Promise<Employee> {
    const businessId = this.auth.businessId();
    if (!businessId) throw new Error('Tu cuenta no tiene un negocio asignado.');

    const { data, error } = await this.client
      .from('employees')
      .insert({ business_id: businessId, ...this.toRow(input) })
      .select('*')
      .single();
    if (error) throw translateEmployeeError(error);
    return data as Employee;
  }

  async updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
    const { data, error } = await this.client
      .from('employees')
      .update(this.toRow(input))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw translateEmployeeError(error);
    return data as Employee;
  }

  // Dar de baja sin borrar: deja de aparecer como activo pero conserva su
  // historial de sueldos, que es justo lo que un reporte de nómina necesita.
  async setEmployeeActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await this.client
      .from('employees')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
  }

  // Soft delete. Los pagos apuntan al empleado con on delete restrict, así que
  // un borrado real fallaría en cuanto tenga un sueldo liquidado.
  async softDeleteEmployee(id: string): Promise<void> {
    const { error } = await this.client
      .from('employees')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id);
    if (error) throw error;
  }

  // ------------------------------------------------------------- Descuentos

  async createDeduction(input: CreateDeductionInput): Promise<EmployeeDeduction> {
    const businessId = this.auth.businessId();
    if (!businessId) throw new Error('Tu cuenta no tiene un negocio asignado.');

    const { data, error } = await this.client
      .from('employee_deductions')
      .insert({
        business_id: businessId,
        employee_id: input.employee_id,
        type: input.type,
        amount: input.amount,
        description: input.description,
        applied_on: input.applied_on,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as EmployeeDeduction;
  }

  // Solo se puede borrar un descuento que todavía no entró en una liquidación:
  // quitarlo de un pago ya emitido dejaría el neto sin respaldo.
  async deleteDeduction(id: string): Promise<void> {
    const { error } = await this.client
      .from('employee_deductions')
      .delete()
      .eq('id', id)
      .is('payment_id', null);
    if (error) throw error;
  }

  // ------------------------------------------------------------------ Pagos

  // El neto lo calcula la base a partir de los descuentos que se enganchan.
  // Mandarlo desde el cliente permitiría guardar un pago que no cuadra.
  async registerPayment(input: RegisterPaymentInput): Promise<string> {
    const { data, error } = await this.client.rpc('register_employee_payment', {
      p_employee_id: input.employee_id,
      p_period_start: input.period_start,
      p_period_end: input.period_end,
      p_gross_amount: input.gross_amount,
      p_bonus_amount: input.bonus_amount,
      p_deduction_ids: input.deduction_ids,
      p_method: input.payment_method,
      p_paid_on: input.paid_on,
      p_notes: input.notes,
    });
    if (error) throw error;
    return data as string;
  }

  async cancelPayment(paymentId: string): Promise<void> {
    const { error } = await this.client.rpc('cancel_employee_payment', {
      p_payment_id: paymentId,
    });
    if (error) throw error;
  }
}
