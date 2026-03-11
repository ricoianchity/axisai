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

  const payload = {
    user_id,
    title: title || `Treino ${new Date().toLocaleDateString('pt-BR')}`,
    plan,
    template: template || plan.template || 'beginner',
    phase_name: phase_name || null,
    cycle_month: cycle_month || null,
    coach_notes: coach_notes || null,
    status: 'active',
    created_at: new Date().toISOString()
  };

  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Prefer': 'return=representation'
  };

  const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/workouts`, {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify(payload)
  });

  const insertData = await insertRes.json().catch(() => null);
  if (!insertRes.ok) {
    console.error('Erro ao salvar workout:', insertData);
    return res.status(500).json({ error: insertData?.message || 'Erro ao salvar workout' });
  }

  const workout = Array.isArray(insertData) ? insertData[0] : insertData;
  return res.status(200).json({ success: true, workout });
}
