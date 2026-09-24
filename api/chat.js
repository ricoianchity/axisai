import { verifiedUser } from '../lib/supabase-auth.mjs';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const user = await verifiedUser(req.headers.get('Authorization'));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (Number(req.headers.get('Content-Length')) > 128_000) {
    return Response.json({ error: 'Request too large' }, { status: 413 });
  }

  try {
    const body = await req.json();
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20 ||
        messages.some(message => !['user', 'assistant'].includes(message?.role) ||
          typeof message?.content !== 'string' || message.content.length > 12_000) ||
        typeof body.system !== 'string' || body.system.length > 40_000) {
      return Response.json({ error: 'Invalid chat payload' }, { status: 400 });
    }

    // Extrair dados relevantes do body
    const { readiness } = body;

    console.log('[api/chat] user:', user.id, '| messages:', messages.length);

    // Construir contexto de prontidão — usa 'readiness' (novo) se disponível, senão tenta 'checkin' legacy
    let readinessContext = '';
    if (readiness && readiness.readiness_score != null) {
      const score = readiness.readiness_score;
      const band  = score >= 70 ? 'Alta' : score >= 40 ? 'Moderada' : 'Baixa';
      const directive = score >= 70
        ? 'Treinar normal — volume e intensidade conforme fase planejada'
        : score >= 40
        ? 'Reduzir volume em 20%, manter intensidade ou reduzir levemente, priorizar movimentos de menor impacto articular'
        : 'Sessão de recuperação ativa ou técnica — sem trabalho de alta intensidade, focar em mobilidade, ativação e movimentos do padrão de baixo risco do FMS';

      const notesLine = readiness.notes ? `\nObservações: ${readiness.notes}` : '';

      readinessContext = `\n\n## PRONTIDÃO DO ATLETA (hoje)
Score: ${score}/100 (${band})
- Qualidade do sono: ${readiness.sleep_quality}/5
- Nível de energia: ${readiness.energy_level}/5
- Dor muscular: ${readiness.muscle_soreness}/5
- Nível de estresse: ${readiness.stress_level}/5${notesLine}

INSTRUÇÃO: Adapte o volume, intensidade e seleção de exercícios do treino de hoje com base neste score:
- Prontidão Alta (70-100): treino normal conforme fase planejada
- Prontidão Moderada (40-69): reduza volume em 20%, mantenha intensidade ou reduza levemente, priorize movimentos de menor impacto articular
- Prontidão Baixa (0-39): sessão de recuperação ativa ou técnica — sem trabalho de alta intensidade, foque em mobilidade, ativação e movimentos do padrão de baixo risco do FMS do atleta`;
    } else {
      readinessContext = '\n\nSem dados de prontidão hoje — prescreva com base no histórico recente e no planejamento de fase.';
    }

    const anthropicPayload = {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: body.system || readinessContext,
      messages,
    };

    let response;
    let data;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) await new Promise(r => setTimeout(r, 1000));
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(anthropicPayload),
      });
      data = await response.json();
      if (response.ok || response.status < 500) break;
      console.warn(`[api/chat] tentativa ${attempt} falhou com status ${response.status}`);
    }
    if (!response.ok) {
      console.error('[api/chat] Anthropic error:', response.status, JSON.stringify(data));
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Chat unavailable' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
