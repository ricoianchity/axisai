async function fetchJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchWorkoutsByUserId(userId, headers) {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/workouts`);
  url.searchParams.set('select', 'id,title,plan,phase_name,cycle_month,status,created_at');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('status', 'eq.active');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '10');

  const res = await fetch(url.toString(), { headers });
  const data = await fetchJson(res);
  return { ok: res.ok, status: res.status, data };
}

async function resolveUserIdByEmail(email, headers) {
  if (!email) return null;
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/profiles`);
  url.searchParams.set('select', 'user_id');
  url.searchParams.set('email', `eq.${email}`);
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), { headers });
  const data = await fetchJson(res);
  if (!res.ok || !Array.isArray(data) || data.length === 0) return null;
  return data[0]?.user_id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, email } = req.query || {};
  if (!user_id && !email) {
    return res.status(400).json({ error: 'user_id ou email obrigatório' });
  }

  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Prefer': 'return=representation'
  };

  let finalWorkouts = [];

  if (user_id) {
    const byUserId = await fetchWorkoutsByUserId(user_id, sbHeaders);
    if (!byUserId.ok) {
      return res.status(500).json({ error: byUserId.data?.message || 'Erro ao buscar workouts' });
    }
    finalWorkouts = Array.isArray(byUserId.data) ? byUserId.data : [];
  }

  if (finalWorkouts.length === 0 && email) {
    const mappedUserId = await resolveUserIdByEmail(email, sbHeaders);
    if (mappedUserId) {
      const byMappedId = await fetchWorkoutsByUserId(mappedUserId, sbHeaders);
      if (!byMappedId.ok) {
        return res.status(500).json({ error: byMappedId.data?.message || 'Erro ao buscar workouts por email' });
      }
      finalWorkouts = Array.isArray(byMappedId.data) ? byMappedId.data : [];
    }
  }

  return res.status(200).json({ workouts: finalWorkouts });
}
