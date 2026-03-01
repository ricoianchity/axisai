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

  try {
    const body = await req.json();

    // Extrair dados do body
    const { messages, readiness, checkin, profile, fmsLatest, ...rest } = body;

    console.log('[api/chat] model:', rest.model, '| messages:', messages?.length, '| readiness_score:', readiness?.readiness_score ?? 'n/a');

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

    // O system prompt já vem completo do frontend (inclui perfil, FMS e readiness).
    // Apenas garantimos que o contexto de prontidão está presente se o frontend não o incluiu
    // (compatibilidade com versões antigas do cliente).
    const updatedSystem = rest.system ? rest.system : readinessContext;

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
