import test from 'node:test';
import assert from 'node:assert/strict';
import getWorkouts from '../api/get-workouts.js';
import saveWorkout from '../api/save-workout.js';
import chat from '../api/chat.js';
import profile from '../api/profile.js';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'public-test-key';
process.env.ANTHROPIC_API_KEY = 'server-test-key';

const response = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function nodeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('workout reads require authentication and bind the query to the verified user', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return response({ id: 'owner-id' });
    return response([{ id: 1, user_id: 'owner-id' }]);
  };

  const denied = nodeResponse();
  await getWorkouts({ method: 'GET', headers: {}, query: { user_id: 'victim-id' } }, denied);
  assert.equal(denied.statusCode, 401);
  assert.equal(calls.length, 0);

  const allowed = nodeResponse();
  await getWorkouts({ method: 'GET', headers: { authorization: 'Bearer user-token' }, query: { user_id: 'victim-id' } }, allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(new URL(calls[1].url).searchParams.get('user_id'), 'eq.owner-id');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer user-token');
  assert.equal(calls[1].options.headers.apikey, 'public-test-key');
});

test('workout writes reject another user ID and store the verified ID', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return response({ id: 'owner-id' });
    return response([{ supabase_id: 'stored-id' }], 201);
  };

  const denied = nodeResponse();
  await saveWorkout({ method: 'POST', headers: { authorization: 'Bearer user-token' }, body: { user_id: 'victim-id', titulo: 'A' } }, denied);
  assert.equal(denied.statusCode, 403);
  assert.equal(calls.length, 1);

  const allowed = nodeResponse();
  await saveWorkout({ method: 'POST', headers: { authorization: 'Bearer user-token' }, body: { titulo: 'A' } }, allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(JSON.parse(calls[2].options.body).user_id, 'owner-id');
  assert.equal(calls[2].options.headers.Authorization, 'Bearer user-token');
});

test('chat rejects anonymous calls and ignores client model and token limit', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return response({ id: 'owner-id' });
    return response({ content: [{ text: 'ok' }] });
  };
  const payload = { model: 'other-model', max_tokens: 100000, system: 'coach', messages: [{ role: 'user', content: 'Olá' }] };

  const anonymous = await chat(new Request('https://axis.example/api/chat', { method: 'POST', body: JSON.stringify(payload) }));
  assert.equal(anonymous.status, 401);
  assert.equal(calls.length, 0);

  const authorized = await chat(new Request('https://axis.example/api/chat', {
    method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify(payload),
  }));
  assert.equal(authorized.status, 200);
  const forwarded = JSON.parse(calls[1].options.body);
  assert.equal(forwarded.model, 'claude-sonnet-4-5');
  assert.equal(forwarded.max_tokens, 2048);
});

test('profile API rejects role mass assignment', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return response({ id: 'owner-id' });
  };
  const request = new Request('https://axis.example/api/profile', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-token' },
    body: JSON.stringify({ role: 'admin', parq_answers: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`q${i + 1}`, 'no'])) }),
  });
  const result = await profile(request);
  assert.equal(result.status, 400);
  assert.equal(calls.length, 1);
});
