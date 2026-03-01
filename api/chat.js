export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // TEMP DEBUG — remove after fix
  console.log('[api/chat] called. ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);

  try {
    const body = await req.json();

    // ALTERAÇÃO 1 — Extrair dados do body da requisição
    const { messages, checkin, profile, fmsLatest, ...rest } = body;

    // TEMP DEBUG — remove after fix
    console.log('[api/chat] model:', rest.model, '| messages:', messages?.length);

    // ALTERAÇÃO 2 — Construir contexto de prontidão
    let readinessContext = '';
    if (checkin && checkin.readiness_score) {
      const score = checkin.readiness_score;
      const directive = score >= 70
        ? 'Treinar normal — volume e intensidade conforme planejado'
        : score >= 45
        ? 'Reduzir volume 30-40% — manter técnica, cortar séries'
        : 'Descanso ativo — mobilidade e trabalho leve apenas';

      readinessContext = `
READINESS SCORE HOJE: ${score}/100
- Sono: ${checkin.sleep}h (peso 35%)
- Estresse: ${checkin.stress}/10 (peso 25%)
- DOMS: ${checkin.doms}/10 (peso 25%)
- Hidratação: ${checkin.hydration}L (peso 15%)
DIRETRIZ DE PRESCRIÇÃO: ${directive}`;
    }

    // ALTERAÇÃO 3 — Injetar contexto no system prompt
    const systemSuffix = `${readinessContext}

PERFIL DO USUÁRIO:
${profile ? JSON.stringify(profile) : 'Não disponível'}

ÚLTIMA AVALIAÇÃO FMS:
${fmsLatest ? JSON.stringify(fmsLatest) : 'Não disponível'}`;

    const updatedSystem = (rest.system || '') + systemSuffix;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ ...rest, messages, system: updatedSystem }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[api/chat] Anthropic error:', response.status, JSON.stringify(data));
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
