import { bearerToken, verifiedUser } from '../lib/supabase-auth.mjs';
import { readLimitedJson } from '../lib/limited-json.mjs';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  }

  const token = bearerToken(req.headers.get('Authorization'));
  const user = await verifiedUser(req.headers.get('Authorization'));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });

  const dbHeaders = {
    'Content-Type': 'application/json',
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Prefer: 'return=representation',
  };
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/chat_messages`);

  if (req.method === 'POST') {
    const parsed = await readLimitedJson(req, 16_000);
    if (parsed.error) return Response.json({ error: parsed.error }, { status: parsed.status, headers });
    const { role, content } = parsed.data || {};
    if (!['user', 'assistant'].includes(role) || typeof content !== 'string' ||
        !content.trim() || content.length > 12_000) {
      return Response.json({ error: 'Invalid chat message' }, { status: 400, headers });
    }
    const response = await fetch(url, {
      method: 'POST', headers: dbHeaders,
      body: JSON.stringify({ user_id: user.id, role, content }),
    });
    if (!response.ok) return Response.json({ error: 'Chat history unavailable' }, { status: 502, headers });
    return new Response(await response.text(), { status: response.status, headers });
  }

  url.searchParams.set('user_id', `eq.${user.id}`);
  if (req.method === 'GET') {
    url.searchParams.set('order', 'created_at.asc');
    url.searchParams.set('limit', '100');
  }
  const response = await fetch(url, {
    method: req.method === 'DELETE' ? 'DELETE' : 'GET',
    headers: dbHeaders,
  });
  if (!response.ok) return Response.json({ error: 'Chat history unavailable' }, { status: 502, headers });
  if (req.method === 'DELETE') return Response.json({ ok: true }, { headers });
  return new Response(await response.text(), { status: response.status, headers });
}
