export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.query || {};
  if (!user_id) {
    return res.status(400).json({ error: 'user_id obrigatório' });
  }

  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Prefer': 'return=representation'
  };

  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/workouts`);
  url.searchParams.set('select', 'id,title,plan,phase_name,cycle_month,status,created_at');
  url.searchParams.set('user_id', `eq.${user_id}`);
  url.searchParams.set('status', 'eq.active');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '10');

  const fetchRes = await fetch(url.toString(), { headers: sbHeaders });
  const data = await fetchRes.json().catch(() => null);

  if (!fetchRes.ok) {
    return res.status(500).json({ error: data?.message || 'Erro ao buscar workouts' });
  }

  return res.status(200).json({ workouts: Array.isArray(data) ? data : [] });
}
