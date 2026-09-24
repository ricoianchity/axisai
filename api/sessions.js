import { bearerToken, verifiedUser } from '../lib/supabase-auth.mjs';
import { readLimitedJson } from '../lib/limited-json.mjs';

export const config = { runtime: 'edge' };

const textLimits = {
  workout_id: 100,
  notes: 4_000,
  total_duration_formatted: 40,
  discomfort_level: 80,
  discomfort_location: 240,
  user_feedback: 4_000,
};
const durationFields = new Set(['duration_seconds', 'total_duration_seconds']);
const allowedFields = new Set([
  ...Object.keys(textLimits), ...durationFields,
  'started_at', 'finished_at', 'rpe', 'ua', 'blocks_completed',
]);

function validSession(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length === 0 || Object.keys(body).some(key => !allowedFields.has(key))) {
    return false;
  }
  return Object.entries(body).every(([key, value]) => {
    if (value == null) return true;
    if (key in textLimits) return typeof value === 'string' && value.length <= textLimits[key];
    if (durationFields.has(key)) return Number.isInteger(value) && value >= 0 && value <= 604_800;
    if (key === 'rpe') return Number.isInteger(value) && value >= 0 && value <= 10;
    if (key === 'ua') return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10_000_000;
    if (key === 'started_at' || key === 'finished_at') {
      return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
    }
    if (key === 'blocks_completed') return Array.isArray(value) || (typeof value === 'object' && value !== null);
    return false;
  });
}

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!['GET', 'POST'].includes(req.method)) {
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

  if (req.method === 'GET') {
    const type = new URL(req.url).searchParams.get('type') || 'sessions';
    if (!['sessions', 'readiness'].includes(type)) {
      return Response.json({ error: 'Invalid session type' }, { status: 400, headers });
    }
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/${type === 'readiness' ? 'readiness_logs' : 'session_logs'}`);
    url.searchParams.set('user_id', `eq.${user.id}`);
    if (type === 'readiness') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      url.searchParams.set('date', `gte.${sevenDaysAgo}`);
      url.searchParams.set('order', 'date.desc');
      url.searchParams.set('limit', '7');
    } else {
      url.searchParams.set('order', 'finished_at.desc');
      url.searchParams.set('limit', '100');
    }
    const response = await fetch(url, { headers: dbHeaders });
    if (!response.ok) return Response.json({ error: 'Sessions unavailable' }, { status: 502, headers });
    return new Response(await response.text(), { status: response.status, headers });
  }

  const parsed = await readLimitedJson(req, 32_000);
  if (parsed.error) return Response.json({ error: parsed.error }, { status: parsed.status, headers });
  if (!validSession(parsed.data)) {
    return Response.json({ error: 'Invalid session payload' }, { status: 400, headers });
  }
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/session_logs`, {
    method: 'POST', headers: dbHeaders,
    body: JSON.stringify({ ...parsed.data, user_id: user.id }),
  });
  if (!response.ok) return Response.json({ error: 'Sessions unavailable' }, { status: 502, headers });
  return new Response(await response.text(), { status: response.status, headers });
}
