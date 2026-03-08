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
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': process.env.SUPABASE_ANON_KEY,
    }
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers });
  }
  const user = await userRes.json();

  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Prefer': 'return=representation',
  };

  if (req.method === 'GET') {
    const type = new URL(req.url).searchParams.get('type') || 'sessions';

    if (type === 'readiness') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateFilter = sevenDaysAgo.toISOString().split('T')[0];

      const res = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/readiness_logs?user_id=eq.${user.id}&date=gte.${dateFilter}&order=date.desc&limit=7`,
        { headers: sbHeaders }
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers });
    }

    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/training_sessions?user_id=eq.${user.id}&order=completed_at.desc&limit=100`,
      { headers: sbHeaders }
    );
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/training_sessions`, {
      method: 'POST',
      headers: sbHeaders,
      body: JSON.stringify({ ...body, user_id: user.id })
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers });
  }

  return new Response('Method not allowed', { status: 405, headers });
}
