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

function shouldTryNextKey(errObj, colName) {
  const msg = String(errObj?.message || '').toLowerCase();
  if (isColumnMissing(errObj, colName)) return true;
  // e.g. UUID compared against integer profile PK/FK
  if (errObj?.code === '22P02' && msg.includes('invalid input syntax for type integer')) return true;
  if (msg.includes('invalid input syntax for type integer')) return true;
  return false;
}

async function getProfileByKey(sbHeaders, key, value) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?${key}=eq.${encodeURIComponent(value)}&limit=1`,
    { headers: sbHeaders }
  );
  const data = await readJsonSafe(res);
  if (!res.ok) return { ok: false, error: data };
  return { ok: true, row: Array.isArray(data) ? (data[0] || null) : null };
}

async function patchProfileByKey(sbHeaders, key, value, payload) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?${key}=eq.${encodeURIComponent(value)}`,
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

async function insertProfileByKey(sbHeaders, key, value, payload) {
  const row = { ...payload, created_at: new Date().toISOString() };
  row[key] = value;

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
    // Try multiple schemas safely: user_id(uuid), id(uuid/int), email(text)
    const byUserId = await getProfileByKey(dbHeaders, 'user_id', user.id);
    if (byUserId.ok) return new Response(JSON.stringify(byUserId.row), { headers });
    if (!shouldTryNextKey(byUserId.error, 'user_id')) {
      return new Response(JSON.stringify({ error: byUserId.error?.message || 'Profile fetch error (user_id)' }), { status: 400, headers });
    }

    const byId = await getProfileByKey(dbHeaders, 'id', user.id);
    if (byId.ok) return new Response(JSON.stringify(byId.row), { headers });
    if (!shouldTryNextKey(byId.error, 'id')) {
      return new Response(JSON.stringify({ error: byId.error?.message || 'Profile fetch error (id)' }), { status: 400, headers });
    }

    if (user?.email) {
      const byEmail = await getProfileByKey(dbHeaders, 'email', user.email);
      if (byEmail.ok) return new Response(JSON.stringify(byEmail.row), { headers });
      if (!shouldTryNextKey(byEmail.error, 'email')) {
        return new Response(JSON.stringify({ error: byEmail.error?.message || 'Profile fetch error (email)' }), { status: 400, headers });
      }
    }

    // No compatible key/column found: return null and let client fallback locally.
    return new Response(JSON.stringify(null), { headers });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const payload = { ...body, updated_at: new Date().toISOString() };

    const attempts = [
      { key: 'user_id', value: user.id },
      { key: 'id', value: user.id },
      ...(user?.email ? [{ key: 'email', value: user.email }] : [])
    ];

    let lastError = null;
    for (const attempt of attempts) {
      const patched = await patchProfileByKey(dbHeaders, attempt.key, attempt.value, payload);
      if (patched.ok && patched.rows.length > 0) {
        return new Response(JSON.stringify(patched.rows[0]), { headers });
      }
      if (!patched.ok) {
        if (!shouldTryNextKey(patched.error, attempt.key)) {
          return new Response(JSON.stringify({ error: patched.error?.message || `Profile update error (${attempt.key})` }), { status: 400, headers });
        }
        lastError = patched.error;
        continue;
      }

      const inserted = await insertProfileByKey(dbHeaders, attempt.key, attempt.value, payload);
      if (inserted.ok) return new Response(JSON.stringify(inserted.row), { headers });
      if (!shouldTryNextKey(inserted.error, attempt.key)) {
        return new Response(JSON.stringify({ error: inserted.error?.message || `Profile insert error (${attempt.key})` }), { status: 400, headers });
      }
      lastError = inserted.error;
    }

    // If nothing worked, don't block client fallback: return 200 with sync warning.
    return new Response(JSON.stringify({ ok: false, sync_warning: true, error: lastError?.message || 'No compatible profile key found' }), { headers });
  }

  return new Response('Method not allowed', { status: 405, headers });
}
