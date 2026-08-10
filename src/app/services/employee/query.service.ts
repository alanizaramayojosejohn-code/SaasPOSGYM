import { inject, Injectable } from '@angular/core';
import {
  DeductionsByType,
  Employee,
  EmployeeDeduction,
  EmployeePayment,
  EmployeePayrollMonthly,
  EmployeePayrollSummary,
} from '../../models/employee.model';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class EmployeeQueryService {
  private readonly client = inject(SupabaseService).client;

  // RLS restringe todo este módulo a admin del negocio.
  async listEmployees(): Promise<Employee[]> {
    const { data, error } = await this.client
      .from('employees')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Employee[];
  }

  // Todos los descuentos de un empleado, aplicados y pendientes.
  async listDeductions(employeeId: string): Promise<EmployeeDeduction[]> {
    const { data, error } = await this.client
      .from('employee_deductions')
      .select('*')
      .eq('employee_id', employeeId)
      .order('applied_on', { ascending: false });
    if (error) throw error;
    return (data ?? []) as EmployeeDeduction[];
  }

  // Los que todavía no entraron en una liquidación: son los que el formulario
  // de pago ofrece para enganchar.
  async listPendingDeductions(employeeId: string): Promise<EmployeeDeduction[]> {
    const { data, error } = await this.client
      .from('employee_deductions')
      .select('*')
      .eq('employee_id', employeeId)
      .is('payment_id', null)
      .order('applied_on', { ascending: true });
    if (error) throw error;
    return (data ?? []) as EmployeeDeduction[];
  }

  // Historial de pagos. Sin employeeId devuelve el de todo el negocio.
  async listPayments(employeeId?: string): Promise<EmployeePayment[]> {
    let query = this.client
      .from('employee_payments')
      .select('*, employee:employees(id, name, ci, position)')
      .order('paid_on', { ascending: false });
    if (employeeId) query = query.eq('employee_id', employeeId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as EmployeePayment[];
  }

  // ------------------------------------------------------------- Reportes

  async listPayrollSummary(): Promise<EmployeePayrollSummary[]> {
    const { data, error } = await this.client
      .from('employee_payroll_summary')
      .select('*')
      .order('total_net', { ascending: false });
    if (error) throw error;
    return (data ?? []) as EmployeePayrollSummary[];
  }

  async listPayrollMonthly(months = 12): Promise<EmployeePayrollMonthly[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);

    const { data, error } = await this.client
      .from('employee_payroll_monthly')
      .select('*')
      .gte('month', since.toISOString().slice(0, 10))
      .order('month', { ascending: false });
    if (error) throw error;
    return (data ?? []) as EmployeePayrollMonthly[];
  }

  async listDeductionsByType(): Promise<DeductionsByType[]> {
    const { data, error } = await this.client
      .from('employee_deductions_by_type')
      .select('*')
      .order('total_amount', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DeductionsByType[];
  }
}
