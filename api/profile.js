export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers });

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

  // Verify token with Supabase
  const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': process.env.SUPABASE_ANON_KEY,
    },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers });
  const user = await userRes.json();

  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Prefer': 'return=representation',
  };

  if (req.method === 'GET') {
    // profiles.id = user auth UUID (existing schema)
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&limit=1`,
      { headers: sbHeaders }
    );
    const data = await res.json();
    return new Response(JSON.stringify(data[0] || null), { headers });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const payload = { ...body, id: user.id, updated_at: new Date().toISOString() };

    // Try PATCH first (upsert by id)
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=representation,resolution=merge-duplicates' },
        body: JSON.stringify(payload),
      }
    );
    let data = await res.json();

    // If record doesn't exist, INSERT
    if (!Array.isArray(data) || data.length === 0) {
      const createRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({ ...payload, created_at: new Date().toISOString() }),
      });
      data = await createRes.json();
    }

    return new Response(JSON.stringify(data[0] || data), { headers });
  }

  return new Response('Method not allowed', { status: 405, headers });
}
