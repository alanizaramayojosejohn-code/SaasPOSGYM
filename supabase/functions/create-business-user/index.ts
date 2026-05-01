// =============================================================================
// SaasGym · Edge Function · create-business-user
// =============================================================================
// Crea un auth.user (Admin API) + su profile en una sola llamada, sin que el
// admin tenga que copiar UUIDs del Supabase Dashboard.
//
// Body esperado:
//   { email, password, name, ci, role: 'admin' | 'caja', business_id? }
//
// Reglas:
//   · caja                → 403 (no autorizado).
//   · admin               → crea en SU PROPIO business; ignora body.business_id.
//   · super_admin         → debe pasar body.business_id.
//
// Si la creación del profile falla (RPC create_user_for_business), revierte
// el auth.user para no dejar registros huérfanos.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  email: string;
  password: string;
  name: string;
  ci: string;
  role: 'admin' | 'caja';
  business_id?: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Falta header Authorization' }, 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const { email, password, name, ci, role, business_id } = body ?? {};
  if (!email || !password || !name || !ci || !role) {
    return json({ error: 'Faltan campos: email, password, name, ci, role' }, 400);
  }
  if (role !== 'admin' && role !== 'caja') {
    return json({ error: `Rol inválido: ${role} (debe ser admin o caja)` }, 400);
  }
  if (password.length < 6) {
    return json({ error: 'La password debe tener al menos 6 caracteres' }, 400);
  }

  // Cliente con permisos del caller — para auth.getUser() y la RPC posterior.
  const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  // Cliente admin (service_role) — crea/borra auth.users.
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Validar caller + leer profile -----------------------------------------
  const { data: callerData, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !callerData?.user) {
    return json({ error: 'No autorizado' }, 401);
  }

  const { data: callerProfile, error: profileErr } = await supabaseUser
    .from('profiles')
    .select('id, role, business_id')
    .eq('id', callerData.user.id)
    .single();
  if (profileErr || !callerProfile) {
    return json({ error: 'No se pudo cargar el profile del caller' }, 403);
  }

  // 2. Resolver target business_id según el rol del caller -------------------
  let targetBusinessId: string | null = null;
  if (callerProfile.role === 'super_admin') {
    if (!business_id) {
      return json({ error: 'super_admin debe especificar business_id' }, 400);
    }
    targetBusinessId = business_id;
  } else if (callerProfile.role === 'admin') {
    targetBusinessId = callerProfile.business_id as string | null;
    if (business_id && business_id !== callerProfile.business_id) {
      return json({ error: 'admin solo puede crear users en su propio negocio' }, 403);
    }
  } else {
    return json({ error: 'No autorizado' }, 403);
  }
  if (!targetBusinessId) {
    return json({ error: 'No se pudo resolver el business_id destino' }, 400);
  }

  // 3. Crear auth.user --------------------------------------------------------
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return json({ error: createErr?.message ?? 'No se pudo crear el auth.user' }, 400);
  }

  // 4. Crear profile via RPC (con JWT del caller; la RPC valida permisos) ----
  const { error: rpcErr } = await supabaseUser.rpc('create_user_for_business', {
    p_user_id: created.user.id,
    p_business_id: targetBusinessId,
    p_name: name,
    p_ci: ci,
    p_role: role,
  });

  if (rpcErr) {
    // Rollback: el auth.user quedaría huérfano si dejamos pasar.
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return json({ error: rpcErr.message }, 400);
  }

  return json({ user_id: created.user.id, email }, 200);
});
