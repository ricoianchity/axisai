import { readLimitedJson } from '../lib/limited-json.mjs';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const parsed = await readLimitedJson(req, 2_000);
    if (parsed.error) return Response.json({ error: parsed.error }, { status: parsed.status, headers: cors });
    const email = parsed.data?.email;
    if (typeof email !== 'string' || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email' }, { status: 400, headers: cors });
    }

    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email,
        redirect_to: 'https://axisaibeta.vercel.app/',
      }),
    });

    return new Response(JSON.stringify({ ok: res.ok }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Password recovery unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
