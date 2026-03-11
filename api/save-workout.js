function buildBasePayload({ user_id, title, plan }) {
  return {
    user_id,
    title: title || `Treino ${new Date().toLocaleDateString('pt-BR')}`,
    plan,
    status: 'active',
    created_at: new Date().toISOString()
  };
}

function buildExtendedPayload({ user_id, title, plan, phase_name, cycle_month, template, coach_notes }) {
  return {
    ...buildBasePayload({ user_id, title, plan }),
    template: template || plan.template || 'beginner',
    phase_name: phase_name || null,
    cycle_month: cycle_month || null,
    coach_notes: coach_notes || null
  };
}

function isMissingColumnError(err) {
  const msg = String(err?.message || '');
  return err?.code === 'PGRST204' || msg.includes("schema cache") || msg.includes('column');
}

async function insertWorkout(payload) {
  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Prefer': 'return=representation'
  };

  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/workouts`, {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => null);
  return { ok: res.ok, data, status: res.status };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, title, plan, phase_name, cycle_month, template, coach_notes } = req.body || {};

  if (!user_id || !plan || !Array.isArray(plan.blocks)) {
    return res.status(400).json({ error: 'Payload inválido. Necessário: user_id, plan.blocks[]' });
  }

  for (const block of plan.blocks) {
    if (!block?.section || !Array.isArray(block.exercises)) {
      return res.status(400).json({
        error: "Bloco inválido: cada bloco precisa de 'section' e 'exercises[]'"
      });
    }
  }

  const extendedPayload = buildExtendedPayload({
    user_id,
    title,
    plan,
    phase_name,
    cycle_month,
    template,
    coach_notes
  });

  let insert = await insertWorkout(extendedPayload);

  // Fallback while migration is not applied: try minimal payload without optional columns.
  if (!insert.ok && isMissingColumnError(insert.data)) {
    insert = await insertWorkout(buildBasePayload({ user_id, title, plan }));
  }

  if (!insert.ok) {
    console.error('Erro ao salvar workout:', insert.data);
    return res.status(500).json({ error: insert.data?.message || 'Erro ao salvar workout' });
  }

  const workout = Array.isArray(insert.data) ? insert.data[0] : insert.data;
  return res.status(200).json({ success: true, workout });
}
