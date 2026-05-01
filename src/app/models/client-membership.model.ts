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
