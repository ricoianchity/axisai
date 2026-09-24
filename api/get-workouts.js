import { bearerToken, verifiedUser } from '../lib/supabase-auth.mjs';

async function fetchJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchWorkoutsByUserId(userId, headers) {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/workouts`);
  url.searchParams.set('select', 'id,supabase_id,titulo,data,conteudo,categoria,tipo,fase_num,fase_nome,plano_titulo,fonte,synced,status,created_at');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('status', 'neq.completed');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '10');

  const res = await fetch(url.toString(), { headers });
  const data = await fetchJson(res);
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifiedUser(req.headers.authorization || req.headers.Authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${bearerToken(req.headers.authorization || req.headers.Authorization)}`,
    'Prefer': 'return=representation'
  };

  const byUserId = await fetchWorkoutsByUserId(user.id, sbHeaders);
  if (!byUserId.ok) {
    return res.status(500).json({ error: 'Erro ao buscar workouts' });
  }

  return res.status(200).json({ workouts: Array.isArray(byUserId.data) ? byUserId.data : [] });
}
