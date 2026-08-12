export interface ClientMembership {
  id: string;
  business_id: string;
  client_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  sessions_left: number | null;
  created_at: string;
  cancelled_at: string | null;
}

// Membresía + nombre de plan denormalizado, para mostrar la "última membresía"
// de un cliente sin importar si sigue vigente.
export interface ClientMembershipSummary {
  id: string;
  plan_id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  sessions_left: number | null;
  cancelled_at: string | null;
}
