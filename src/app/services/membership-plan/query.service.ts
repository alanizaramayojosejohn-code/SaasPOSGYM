import { inject, Injectable } from '@angular/core';
import { MembershipPlanWithServices } from '../../models/membership-plan.model';
import { SupabaseService } from '../supabase/supabase.service';

interface PlanRow {
  id: string;
  business_id: string;
  name: string;
  duration_days: number;
  sessions_number: number | null;
  price: number;
  type: 'normal' | 'promo';
  created_at: string;
  membership_plan_services: { service_id: string; services: { name: string } | null }[];
}

@Injectable({ providedIn: 'root' })
export class MembershipPlanQueryService {
  private readonly client = inject(SupabaseService).client;

  // RLS filtra por business_id del caller automáticamente.
  async listPlans(): Promise<MembershipPlanWithServices[]> {
    const { data, error } = await this.client
      .from('membership_plans')
      .select('*, membership_plan_services(service_id, services(name))')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as PlanRow[];
    return rows.map(({ membership_plan_services, ...plan }) => ({
      ...plan,
      service_ids: membership_plan_services.map((link) => link.service_id),
      service_names: membership_plan_services
        .map((link) => link.services?.name)
        .filter((n): n is string => !!n)
        .sort(),
    }));
  }
}
