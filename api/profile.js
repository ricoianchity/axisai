export const config = { runtime: 'edge' };

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
}

function isColumnMissing(errObj, colName) {
  const msg = String(errObj?.message || '');
  return errObj?.code === '42703' && msg.includes(`profiles.${colName}`);
}

async function getProfileByKey(user, sbHeaders, key) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?${key}=eq.${user.id}&limit=1`,
    { headers: sbHeaders }
  );
  const data = await readJsonSafe(res);
  if (!res.ok) return { ok: false, error: data };
  return { ok: true, row: Array.isArray(data) ? (data[0] || null) : null };
}

async function patchProfileByKey(user, sbHeaders, key, payload) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?${key}=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: { ...sbHeaders, 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    }
  );
  const data = await readJsonSafe(res);
  if (!res.ok) return { ok: false, error: data };
  return { ok: true, rows: Array.isArray(data) ? data : [] };
}

async function insertProfileByKey(user, sbHeaders, key, payload) {
  const row = key === 'user_id'
    ? { user_id: user.id, ...payload, created_at: new Date().toISOString() }
    : { id: user.id, ...payload, created_at: new Date().toISOString() };

  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify(row),
  });
  const data = await readJsonSafe(res);
  if (!res.ok) return { ok: false, error: data };
  return { ok: true, row: Array.isArray(data) ? (data[0] || null) : data };
}

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

  const dbHeaders = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Prefer': 'return=representation',
  };

  if (req.method === 'GET') {
    // Prefer profiles.user_id = auth.uid(); fallback to profiles.id = auth.uid()
    const byUserId = await getProfileByKey(user, dbHeaders, 'user_id');
    if (byUserId.ok) return new Response(JSON.stringify(byUserId.row), { headers });
    if (!isColumnMissing(byUserId.error, 'user_id')) {
      return new Response(JSON.stringify({ error: byUserId.error?.message || 'Profile fetch error' }), { status: 400, headers });
    }

    const byId = await getProfileByKey(user, dbHeaders, 'id');
    if (byId.ok) return new Response(JSON.stringify(byId.row), { headers });
    return new Response(JSON.stringify({ error: byId.error?.message || 'Profile fetch error' }), { status: 400, headers });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const payload = { ...body, updated_at: new Date().toISOString() };

    // 1) Try user_id schema first
    const patchUserId = await patchProfileByKey(user, dbHeaders, 'user_id', payload);
    if (patchUserId.ok && patchUserId.rows.length > 0) {
      return new Response(JSON.stringify(patchUserId.rows[0]), { headers });
    }

    if (!patchUserId.ok && !isColumnMissing(patchUserId.error, 'user_id')) {
      return new Response(JSON.stringify({ error: patchUserId.error?.message || 'Profile update error' }), { status: 400, headers });
    }

    if (patchUserId.ok && patchUserId.rows.length === 0) {
      const insUserId = await insertProfileByKey(user, dbHeaders, 'user_id', payload);
      if (insUserId.ok) return new Response(JSON.stringify(insUserId.row), { headers });
    }

    // 2) Fallback id schema
    const patchId = await patchProfileByKey(user, dbHeaders, 'id', payload);
    if (patchId.ok && patchId.rows.length > 0) {
      return new Response(JSON.stringify(patchId.rows[0]), { headers });
    }
    if (patchId.ok && patchId.rows.length === 0) {
      const insId = await insertProfileByKey(user, dbHeaders, 'id', payload);
      if (insId.ok) return new Response(JSON.stringify(insId.row), { headers });
      return new Response(JSON.stringify({ error: insId.error?.message || 'Profile insert error' }), { status: 400, headers });
    }

    return new Response(JSON.stringify({ error: patchId.error?.message || 'Profile update error' }), { status: 400, headers });
  }

  return new Response('Method not allowed', { status: 405, headers });
}
