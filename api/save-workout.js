import { bearerToken, verifiedUser } from '../lib/supabase-auth.mjs';

async function fetchJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function buildSbHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Prefer': 'return=representation'
  };
}

async function findExisting(baseUrl, local_id, user_id, headers) {
  const url = new URL(baseUrl);
  url.searchParams.set('select', 'id,supabase_id');
  url.searchParams.set('id', `eq.${local_id}`);
  url.searchParams.set('user_id', `eq.${user_id}`);
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), { headers });
  const data = await fetchJson(res);
  if (!res.ok || !Array.isArray(data) || data.length === 0) return null;
  return data[0];
}

async function markSynced(baseUrl, local_id, user_id, headers) {
  const url = new URL(baseUrl);
  url.searchParams.set('id', `eq.${local_id}`);
  url.searchParams.set('user_id', `eq.${user_id}`);

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ synced: true })
  });
  return res.ok;
}

async function insertWorkout(baseUrl, payload, headers) {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const data = await fetchJson(res);
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifiedUser(req.headers.authorization || req.headers.Authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Dados de treino inválidos' });
  }
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 64_000) {
    return res.status(413).json({ error: 'Treino muito grande' });
  }

  const {
    local_id,
    titulo,
    data: dataField,
    conteudo,
    categoria,
    tipo,
    fase_num,
    fase_nome,
    plano_titulo,
    fonte
  } = body;
  const user_id = user.id;

  if (body.user_id && body.user_id !== user_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const optionalText = [
    [dataField, 40], [conteudo, 50_000], [categoria, 80], [tipo, 80],
    [fase_nome, 160], [plano_titulo, 240], [fonte, 80],
  ];
  const localIdText = String(local_id);
  if (typeof titulo !== 'string' || !titulo.trim() || titulo.length > 200 ||
      (local_id != null && (!/^\d{1,19}$/.test(localIdText) ||
        BigInt(localIdText) > 9223372036854775807n)) ||
      (fase_num != null && (!Number.isInteger(fase_num) || fase_num < 0 || fase_num > 100)) ||
      optionalText.some(([value, max]) => value != null &&
        (typeof value !== 'string' || value.length > max))) {
    return res.status(400).json({ error: 'Dados de treino inválidos' });
  }

  const baseUrl = `${process.env.SUPABASE_URL}/rest/v1/workouts`;
  const headers = buildSbHeaders(bearerToken(req.headers.authorization || req.headers.Authorization));

  // Se local_id fornecido, verificar se row já existe
  if (local_id) {
    const existing = await findExisting(baseUrl, local_id, user_id, headers);
    if (existing) {
      await markSynced(baseUrl, local_id, user_id, headers);
      return res.status(200).json({
        success: true,
        supabase_id: existing.supabase_id,
        local_id
      });
    }
  }

  // INSERT novo row
  const insertPayload = {
    user_id,
    titulo,
    synced: true,
    status: 'planned',
    ...(local_id !== undefined && local_id !== null ? { id: String(local_id) } : {}),
    ...(dataField !== undefined ? { data: dataField } : {}),
    ...(conteudo !== undefined ? { conteudo } : {}),
    ...(categoria !== undefined ? { categoria } : {}),
    ...(tipo !== undefined ? { tipo } : {}),
    ...(fase_num !== undefined ? { fase_num } : {}),
    ...(fase_nome !== undefined ? { fase_nome } : {}),
    ...(plano_titulo !== undefined ? { plano_titulo } : {}),
    ...(fonte !== undefined ? { fonte } : {})
  };

  const insert = await insertWorkout(baseUrl, insertPayload, headers);

  if (!insert.ok) {
    console.error('[save-workout] INSERT error:', insert.data);
    return res.status(500).json({ error: insert.data?.message || 'Erro ao salvar workout' });
  }

  const row = Array.isArray(insert.data) ? insert.data[0] : insert.data;
  return res.status(200).json({
    success: true,
    supabase_id: row?.supabase_id,
    local_id
  });
}
