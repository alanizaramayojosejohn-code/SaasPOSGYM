import { inject, Injectable } from '@angular/core';
import { ActiveMembership } from '../../models/active-membership.model';
import { AttendanceWithDetails } from '../../models/attendance.model';
import { ClientMembershipSummary } from '../../models/client-membership.model';
import { SupabaseService } from '../supabase/supabase.service';

interface AttendanceRow {
  id: string;
  business_id: string;
  client_id: string;
  client_membership_id: string | null;
  attended_at: string;
  clients: { ci: string; name: string } | null;
  client_memberships: { membership_plans: { name: string } | null } | null;
}

@Injectable({ providedIn: 'root' })
export class AttendanceQueryService {
  private readonly client = inject(SupabaseService).client;

  // RLS filtra por business_id del caller.
  async lastVisitByClientIds(clientIds: string[]): Promise<Map<string, string>> {
    if (clientIds.length === 0) return new Map();
    const { data, error } = await this.client
      .from('attendance')
      .select('client_id, attended_at')
      .in('client_id', clientIds)
      .order('attended_at', { ascending: false });
    if (error) throw error;
    const map = new Map<string, string>();
    for (const row of (data ?? []) as { client_id: string; attended_at: string }[]) {
      if (!map.has(row.client_id)) map.set(row.client_id, row.attended_at);
    }
    return map;
  }

  // Membresía vigente hoy para el CI buscado en asistencia, si tiene una.
  async activeMembershipByClient(clientId: string): Promise<ActiveMembership | null> {
    const { data, error } = await this.client
      .from('active_memberships')
      .select('*')
      .eq('client_id', clientId)
      .order('end_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as ActiveMembership | null) ?? null;
  }

  // Última membresía registrada para el cliente, vigente o no — para mostrar
  // "su última membresía" cuando no tiene una activa.
  async lastMembershipByClient(clientId: string): Promise<ClientMembershipSummary | null> {
    const { data, error } = await this.client
      .from('client_memberships')
      .select('id, plan_id, start_date, end_date, sessions_left, cancelled_at, membership_plans(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as any;
    return {
      id: row.id,
      plan_id: row.plan_id,
      plan_name: row.membership_plans?.name ?? '—',
      start_date: row.start_date,
      end_date: row.end_date,
      sessions_left: row.sessions_left,
      cancelled_at: row.cancelled_at,
    };
  }

  // Asistencias por día, últimos N días — para el gráfico de barras del
  // dashboard GYM. No hay vista para esto (a diferencia de income_daily),
  // así que se agrega acá mismo en vez de traer filas crudas al componente.
  // Siempre devuelve exactamente `days` entradas (una por día, en orden
  // cronológico) aunque un día no tenga ninguna asistencia — si solo se
  // devolvieran los días con datos, el gráfico de barras del dashboard
  // "perdería" los días vacíos en vez de mostrarlos en 0.
  async countByDay(days = 7): Promise<{ day: string; count: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);
    const { data, error } = await this.client
      .from('attendance')
      .select('attended_at')
      .gte('attended_at', since.toISOString());
    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { attended_at: string }[]) {
      const day = row.attended_at.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }

    const result: { day: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      result.push({ day, count: counts.get(day) ?? 0 });
    }
    return result;
  }

  async listRecent(limit = 50): Promise<AttendanceWithDetails[]> {
    const { data, error } = await this.client
      .from('attendance')
      .select(`
        *,
        clients(ci, name),
        client_memberships(membership_plans(name))
      `)
      .order('attended_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const rows = (data ?? []) as AttendanceRow[];
    return rows.map(({ clients, client_memberships, ...att }) => ({
      ...att,
      client_label: clients ? `${clients.ci} · ${clients.name}` : '—',
      plan_name: client_memberships?.membership_plans?.name ?? null,
    }));
  }
}
