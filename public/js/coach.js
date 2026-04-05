// ═══════════════════════════════════════════════
//  WORKOUTS
// ═══════════════════════════════════════════════
function loadWorkouts() { state.workouts = JSON.parse(localStorage.getItem('axisai_workouts') || '[]'); }
function saveWorkouts() { localStorage.setItem('axisai_workouts', JSON.stringify(state.workouts)); }

function _safeParseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function _normalizePlanBlocks(conteudo) {
  if (!conteudo) return [];

  // BUG-1 FIX: normalize | separators to newlines (consistent with parseTreino)
  var text = conteudo
    .replace(/\r\n?/g, '\n')
    .replace(/\s+\|\s+/g, '\n')
    .replace(/\n{2,}/g, '\n');

  var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

  // Block header patterns (same as parseTreino detectHeader)
  var headerRe = /^(?:PILLAR\s*PREP|FOAM\s*ROLL|WARM[\s-]*UP|HEAVY\s*POWER|POWER|STRENGTH\s*POD\s*\d|POD\s*\d|ESD|CONDITIONING)\b/i;
  // Known prep subcategory labels that should NOT become separate blocks
  var prepSubRe = /^(?:Foam\s*Roll(?:ing)?|Mobilidade|Ativa[çc]\w*|Aquecimento|Din[âa]mico|Alongamento|Cool\s*Down)\b/i;

  var blocks = [];
  var current = null;

  for (var i = 0; i < lines.length; i++) {
    var linha = lines[i].replace(/^[-•\u2022]\s*/, '').trim();
    if (!linha) continue;

    // Check if this line is a main block header
    if (headerRe.test(linha)) {
      // If current block is a prep block and this is a sub-header (e.g. "Foam Roll:"),
      // treat as subcategory instead of new block
      var isPrepCurrent = current && /^(?:PILLAR\s*PREP|WARM[\s-]*UP|FOAM\s*ROLL)/i.test(current.nome);
      if (isPrepCurrent && prepSubRe.test(linha)) {
        // Subcategory of current prep block
        var sep = linha.indexOf(':');
        if (sep > 0) {
          current.exercicios.push(linha); // keep full line "Foam Roll: glúteo/..."
        } else {
          current.exercicios.push(linha);
        }
        continue;
      }

      // Flush current block
      if (current) blocks.push(current);

      // Extract block name (before first ":" or entire line)
      var sep = linha.indexOf(':');
      var nome = sep >= 0 ? linha.substring(0, sep).trim() : linha;
      var afterColon = sep >= 0 ? linha.substring(sep + 1).trim() : '';

      // Check if header line has inline subcategory content
      // e.g. "PILLAR PREP (10min) Foam Roll: glúteo/..."
      var inlineSubMatch = afterColon ? null : null; // will handle below
      var exercicios = [];

      // For prep headers with inline content: "PILLAR PREP (10min) Foam Roll: glúteo/..."
      // The ":" belongs to the subcategory, not the block header
      if (/^(?:PILLAR\s*PREP|WARM[\s-]*UP)\b/i.test(linha) && sep > 0) {
        var beforeColon = linha.substring(0, sep).trim();
        var subMatch = beforeColon.match(/(PILLAR\s*PREP|WARM[\s-]*UP)\s*(?:\([^)]*\))?\s*(.*)/i);
        if (subMatch && subMatch[2].trim()) {
          // There's a subcategory name between header and ":"
          var subName = subMatch[2].trim();
          nome = subMatch[1].trim();
          exercicios.push(subName + ': ' + afterColon); // "Foam Roll: glúteo/..."
        } else if (afterColon) {
          exercicios = afterColon.split(/\s*\+\s*/).filter(Boolean);
        }
      } else if (afterColon) {
        exercicios = afterColon.split(/\s*\+\s*/).filter(Boolean);
      }

      current = { nome: nome, exercicios: exercicios };
      continue;
    }

    // Non-header line
    if (!current) {
      // Orphan line — create a generic block
      current = { nome: linha, exercicios: [] };
      continue;
    }

    // Check if this is a prep subcategory (non-bullet, within prep block)
    var isPrepBlock = /^(?:PILLAR\s*PREP|WARM[\s-]*UP|FOAM\s*ROLL)/i.test(current.nome);
    if (isPrepBlock && prepSubRe.test(linha)) {
      current.exercicios.push(linha); // keep full line "Mobilidade: quadril + tornozelo + T-spine"
      continue;
    }

    // Regular exercise line
    var sep = linha.indexOf(':');
    if (sep === -1) {
      current.exercicios.push(linha);
    } else {
      // Keep full line for prep blocks (preserves "Label: content")
      if (isPrepBlock) {
        current.exercicios.push(linha);
      } else {
        var exPart = linha.substring(sep + 1).trim();
        var exItems = exPart.split(',').map(function(e) { return e.trim(); }).filter(Boolean);
        if (exItems.length > 0) {
          current.exercicios.push.apply(current.exercicios, exItems);
        } else {
          current.exercicios.push(linha);
        }
      }
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

function _getPlanStructure(plan) {
  const workoutType = plan?.workout_type || 'upper_body';
  return MBSC_STRUCTURE[workoutType] || MBSC_STRUCTURE.upper_body;
}

function _isAdvancedLevel() {
  const levelRaw = String(state.profile?.level || '').toLowerCase();
  return /avanç|advanced|intermed|elite|pro|compet/.test(levelRaw);
}

function _getVisiblePlanStructure(plan) {
  const base = _getPlanStructure(plan);
  if (_isAdvancedLevel()) return base;
  // Iniciante: sem Heavy Power e sem 3º strength pod.
  return base.filter(b => b.type !== 'heavy_power' && b.type !== 'strength_pod_3');
}

function _formatDatePtBr(dateObj) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    }).format(dateObj);
  } catch (_) {
    return dateObj.toLocaleDateString('pt-BR');
  }
}

function renderTreinosVazio(mensagem) {
  const container = document.getElementById('tab-treinos-content');
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:center;padding:40px 20px;color:#6A6A7A;">
      <p style="font-size:16px;margin-bottom:12px;">🏋️</p>
      <p style="font-size:14px;">${_escapeWorkoutHTML(mensagem)}</p>
      <button class="btn-action" style="margin-top:14px;" onclick="navigate('chat')">GERAR TREINO COM COACH IA</button>
    </div>
  `;
}

function _sanitizeExerciseKey(name) {
  return String(name || 'exercise')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 80) || 'exercise';
}

function _normalizeNumber(value, min, max) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  let out = n;
  if (typeof min === 'number') out = Math.max(min, out);
  if (typeof max === 'number') out = Math.min(max, out);
  return out;
}

function clampNumberInput(el, min, max, step) {
  if (!el) return;
  if (el.value === '' || el.value == null) return;
  const n = Number(el.value);
  if (Number.isNaN(n)) {
    el.value = '';
    return;
  }
  let out = n;
  if (typeof min === 'number') out = Math.max(min, out);
  if (typeof max === 'number') out = Math.min(max, out);
  if (typeof step === 'number' && step > 0) {
    out = Math.round(out / step) * step;
  }
  el.value = Number.isInteger(out) ? String(out) : String(Number(out.toFixed(2)));
}

function _closeActiveBlocoSheet() {
  document.querySelector('.bloco-sheet')?.remove();
  document.querySelector('.bloco-sheet-overlay')?.remove();
}

async function loadTreinosTab() {
  const container = document.getElementById('tab-treinos-content');
  if (!container) return;

  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando treinos...</p></div>';

  // --- FALLBACK LOCAL ---
  const treinosKey = getTreinosKey();
  const local = treinosKey ? JSON.parse(localStorage.getItem(treinosKey) || '[]') : [];

  if (!state.user?.id) {
    renderTreinosList(container, local, 'local');
    return;
  }

  try {
    // Busca paralela nas duas tabelas
    const [logsRes, workoutsRes] = await Promise.all([
      supabase
        .from('session_logs')
        .select('*')
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('workouts')
        .select('*')
        .eq('user_id', state.user.id)
        .eq('fonte', 'coach_ia')
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    const logs = logsRes.error ? [] : (logsRes.data || []);
    const workouts = workoutsRes.error ? [] : (workoutsRes.data || []);

    // Normalizar session_logs para o mesmo shape de exibição
    const normalizedLogs = logs.map(l => ({
      id: l.id,
      titulo: l.workout_title || l.titulo || 'Treino',
      data: l.session_date
        ? new Date(l.session_date).toLocaleDateString('pt-BR')
        : new Date(l.created_at).toLocaleDateString('pt-BR'),
      conteudo: l.notes || l.conteudo || '',
      categoria: l.categoria || 'sessao',
      fonte: 'session_log',
      rpe: l.rpe,
      ua: l.ua,
      duration_seconds: l.duration_seconds,
      created_at: l.created_at
    }));

    // Normalizar workouts
    const normalizedWorkouts = workouts.map(w => ({
      id: w.id,
      titulo: w.titulo || 'Treino Coach IA',
      data: w.data || new Date(w.created_at).toLocaleDateString('pt-BR'),
      conteudo: _normalizeWorkoutTextPreserveNewlines(w.conteudo || ''),
      categoria: w.categoria || 'fullbody',
      fonte: 'coach_ia',
      rpe: null,
      ua: null,
      duration_seconds: null,
      created_at: w.created_at
    }));

    // Sempre inclui coach_ia do localStorage no merge — garante exibição mesmo quando
    // a tabela 'workouts' ainda não existe no Supabase. Deduplicação por id previne duplicatas.
    const localCoachIA = local
      .filter(x => x.fonte === 'coach_ia')
      .map(x => ({ ...x, created_at: new Date(x.id).toISOString() }));

    // Merge + deduplicação por id + ordenação por data
    const seen = new Set();
    const merged = [...normalizedLogs, ...normalizedWorkouts, ...localCoachIA]
      .filter(item => {
        if (seen.has(String(item.id))) return false;
        seen.add(String(item.id));
        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (merged.length === 0) {
      // Fallback para localStorage se Supabase retornou vazio
      renderTreinosList(container, local, 'local');
    } else {
      renderTreinosList(container, merged, 'remote');
    }

  } catch (err) {
    console.warn('loadTreinosTab: erro Supabase, usando localStorage', err);
    renderTreinosList(container, local, 'local');
  }
}

function renderTreinosList(container, items, source) {
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏋️</div>
        <p class="empty-title">Nenhum treino ainda</p>
        <p class="empty-sub">Converse com o Coach IA para gerar seu primeiro treino</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    // Badge de fonte
    const fonteBadge = item.fonte === 'coach_ia'
      ? '<span class="badge badge-ia">Coach IA</span>'
      : '<span class="badge badge-live">Ao vivo</span>';

    // Métricas (só session_logs têm)
    const metricas = (item.rpe != null || item.ua != null || item.duration_seconds != null)
      ? `<div class="treino-metricas">
          ${item.duration_seconds != null ? `<span class="metrica"><span class="metrica-icon">⏱</span>${Math.round(item.duration_seconds/60)}min</span>` : ''}
          ${item.rpe != null ? `<span class="metrica"><span class="metrica-icon">💪</span>RPE ${item.rpe}</span>` : ''}
          ${item.ua != null ? `<span class="metrica"><span class="metrica-icon">⚡</span>${item.ua} UA</span>` : ''}
        </div>`
      : '';

    // Preview de blocos visível por padrão
    const blocos = _normalizePlanBlocks(item.conteudo || '');
    const blocosPreview = blocos.length
      ? `<div class="treino-preview-blocos">
          ${blocos.map(function(bloco) {
            const nomeBloco = _escapeWorkoutHTML(bloco?.nome || 'BLOCO');
            const exercicios = Array.isArray(bloco?.exercicios) ? bloco.exercicios : [];
            const exSpans = exercicios.length
              ? exercicios.map(function(e) { return `<span>${_escapeWorkoutHTML(e)}</span>`; }).join('')
              : '<span>—</span>';
            return `
              <div class="preview-bloco">
                <span class="preview-bloco-nome">${nomeBloco}</span>
                <div class="preview-exercicios">${exSpans}</div>
              </div>
            `;
          }).join('')}
        </div>`
      : '';

    // Conteúdo completo por blocos colapsáveis
    const blocosConteudo = parseConteudoBlocos(item.conteudo || '');
    const conteudoHtml = blocosConteudo.length > 0
      ? `
        <div class="treino-session-blocks">
          ${blocosConteudo.map((bloco, idx) => {
            const PREP_BLOCKS = ['FOAM ROLL', 'PILLAR PREP', 'WARM-UP', 'DYNAMIC WARM', 'MOBILIDADE', 'ATIVAÇÃO', 'DINÂMICO', 'AQUECIMENTO', 'ESD'];
            const nome = _escapeWorkoutHTML(bloco?.nome || `BLOCO ${idx + 1}`);
            const nomeUpper = (bloco?.nome || '').toUpperCase();
            const isPrep = PREP_BLOCKS.some(pb => nomeUpper.includes(pb));
            const exerciciosRaw = String(bloco?.exercicios || '').trim();
            const exercicios = exerciciosRaw
              ? _escapeWorkoutHTML(exerciciosRaw).replace(/\n/g, '<br>')
              : 'Sem exercícios detalhados.';
            let exLines = [];
            if (exerciciosRaw) {
              if (exerciciosRaw.includes('\n')) {
                exLines = exerciciosRaw.split('\n').map(l => l.trim()).filter(Boolean);
              } else if (exerciciosRaw.includes(' + ')) {
                exLines = exerciciosRaw.split(' + ').map(l => l.trim()).filter(Boolean);
              } else if (exerciciosRaw.includes(' · ')) {
                exLines = exerciciosRaw.split(' · ').map(l => l.trim()).filter(Boolean);
              } else if (exerciciosRaw.includes('|')) {
                exLines = exerciciosRaw.split('|').map(l => l.trim()).filter(Boolean);
              } else {
                exLines = [exerciciosRaw];
              }
            }
            const hasAnyLoad = exLines.some(ex => /\d+\s*[xX×]\s*[\d\/]/.test(ex));
            const loadInputsHtml = (!isPrep && exLines.length > 0 && hasAnyLoad) ? `
              <div class="load-inputs-container">
                <p class="load-inputs-label">Carga utilizada:</p>
                <div class="load-inputs-grid">
                  ${exLines.map((ex, exIdx) => {
                    const exName = _extractExName(ex) || ex;
                    const exSpec = _extractExSpec(ex);
                    const setsCount = _extractSetsCount(ex);
                    return `
                      <div class="exercise-card-load">
                        <div class="exercise-load-header">
                          <span class="exercise-load-name">${_escapeWorkoutHTML(exName)}</span>
                          ${exSpec ? `<span class="exercise-load-spec">${_escapeWorkoutHTML(exSpec)}</span>` : ''}
                        </div>
                        <div class="sets-grid">
                          ${Array.from({length: setsCount}, (_, si) => `
                            <div class="set-input-group">
                              <div class="set-label">S${si + 1}</div>
                              <input type="number"
                                     class="load-input-field set-input"
                                     placeholder="—"
                                     data-block-idx="${idx}"
                                     data-ex-idx="${exIdx}"
                                     data-set-idx="${si}"
                                     data-ex-name="${_escapeWorkoutHTML(exName)}"
                                     data-ex-spec="${_escapeWorkoutHTML(exSpec)}"
                                     oninput="_saveLoadInput(this)"
                                     min="0" step="0.5">
                              <div class="kg-label">kg</div>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>` : '';
            return `
              <div class="session-block" data-block-idx="${idx}">
                <div class="block-header" onclick="_toggleBlock(this)">
                  <span class="block-name">${nome}</span>
                  <span class="block-badge" style="display:none">concluído</span>
                  <span class="block-chevron">▾</span>
                </div>
                <div class="block-body">
                  <p class="block-exercises">${exercicios}</p>
                  ${loadInputsHtml}
                  <button class="btn-mark-block" onclick="_markBlockDone(this)">Marcar como concluído</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="session-progress-wrap">
          <div class="session-progress-track">
            <div class="session-progress-fill" style="width:0%;"></div>
          </div>
          <div class="session-progress-text">0 de ${blocosConteudo.length} blocos</div>
        </div>
      `
      : '<p class="treino-body-empty">Sem detalhes de treino.</p>';

    return `
      <div class="treino-card" data-id="${item.id}" data-fonte="${item.fonte}">
        <div class="treino-card-header">
          <div class="treino-card-meta">
            ${fonteBadge}
            <span class="treino-data">${item.data}</span>
            <span class="treino-categoria">${item.categoria}</span>
          </div>
          <button class="treino-expand-btn" onclick="toggleTreinoCard(this)" aria-label="Expandir">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
        <h3 class="treino-titulo">${item.titulo}</h3>
        ${metricas}
        ${blocosPreview}
        <div class="treino-body collapsed">
          ${conteudoHtml}
        </div>
      </div>`;
  }).join('');
}

function toggleTreinoCard(btn) {
  const card = btn.closest('.treino-card');
  if (!card) return;
  const body = card.querySelector('.treino-body');
  if (!body) return;
  const isCollapsed = body.classList.toggle('collapsed');
  btn.classList.toggle('expanded', !isCollapsed);
}

function _updateTreinoCardProgress(cardEl) {
  if (!cardEl) return;
  const blocks = Array.from(cardEl.querySelectorAll('.session-block'));
  const total = blocks.length;
  const done = blocks.filter(block => block.classList.contains('done')).length;
  const progressText = cardEl.querySelector('.session-progress-text');
  const progressFill = cardEl.querySelector('.session-progress-fill');
  if (progressText) progressText.textContent = `${done} de ${total} blocos`;
  if (progressFill) progressFill.style.width = total > 0 ? `${Math.round((done / total) * 100)}%` : '0%';
}

function _toggleBlock(headerEl) {
  const blockEl = headerEl?.closest('.session-block');
  if (!blockEl) return;
  const bodyEl = blockEl.querySelector('.block-body');
  if (!bodyEl) return;
  const collapsed = bodyEl.classList.toggle('collapsed');
  const chevronEl = blockEl.querySelector('.block-chevron');
  if (chevronEl) chevronEl.textContent = collapsed ? '▸' : '▾';
}

function _markBlockDone(btnEl) {
  const blockEl = btnEl?.closest('.session-block');
  if (!blockEl) return;

  const isDone = !blockEl.classList.contains('done');
  blockEl.classList.toggle('done', isDone);

  const badgeEl = blockEl.querySelector('.block-badge');
  if (badgeEl) badgeEl.style.display = isDone ? 'inline-flex' : 'none';

  const bodyEl = blockEl.querySelector('.block-body');
  if (bodyEl) bodyEl.classList.toggle('collapsed', isDone);

  const chevronEl = blockEl.querySelector('.block-chevron');
  if (chevronEl) chevronEl.textContent = isDone ? '▸' : '▾';

  btnEl.textContent = isDone ? 'Desmarcar' : 'Marcar como concluído';

  const cardEl = blockEl.closest('.treino-card');
  _updateTreinoCardProgress(cardEl);
}

function renderTreinoCard(plan) {
  const container = document.getElementById('tab-treinos-content');
  if (!container) return;

  const blocks = _normalizePlanBlocks(plan?.blocks);
  const structure = _getVisiblePlanStructure(plan);
  const isAdvanced = _isAdvancedLevel();
  const levelLabel = isAdvanced ? 'Advanced' : 'Iniciante';
  const totalDuration = structure.reduce((acc, b) => acc + (Number(b.duration) || 0), 0);
  const completedCount = _completedBlocks.size;
  const completedText = `${completedCount}/${structure.length} blocos`;
  const startText = _activeSessionId ? 'Treino em andamento' : 'Iniciar Treino';

  const miniCards = structure.map(bloco => {
    const exercises = Array.isArray(blocks[bloco.type]) ? blocks[bloco.type] : [];
    const exCount = exercises.length;
    const exTxt = exCount > 0 ? `${exCount} ex` : '— exercícios a definir —';
    const concluido = _completedBlocks.has(bloco.type);
    return `
      <div class="mini-card-bloco ${concluido ? 'concluido' : ''}" onclick="expandBloc('${bloco.type}')">
        <div class="mini-card-bloco-icon">${bloco.icon}</div>
        <div class="mini-card-bloco-name">${bloco.label}</div>
        <div class="mini-card-bloco-meta">${bloco.duration}min · ${_escapeWorkoutHTML(exTxt)}</div>
        <div class="mini-card-bloco-arrow">${concluido ? '✓' : '➜'}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="treino-main-card">
      <div class="treino-main-card-head">
        <div>
          <div class="treino-main-card-title">💪 ${_escapeWorkoutHTML((plan?.workout_type || 'upper_body').replace(/_/g, ' ').toUpperCase())}</div>
          <div class="treino-main-card-meta">⏱ ${totalDuration}min · ${_escapeWorkoutHTML(levelLabel)} · ${_escapeWorkoutHTML(completedText)}</div>
        </div>
        <span class="treino-main-card-badge">${_escapeWorkoutHTML(startText)}</span>
      </div>

      ${miniCards}

      <div class="treino-actions-row">
        <button class="btn-action" onclick="iniciarTreino()" style="min-width:170px;">🎯 INICIAR TREINO</button>
        <button class="treino-ghost-btn" onclick="openTreinoFinishModal()" ${_activeSessionId ? '' : 'disabled'} style="${_activeSessionId ? '' : 'opacity:0.55;cursor:not-allowed;'}">📤 FINALIZAR TREINO</button>
      </div>
    </div>
  `;
}

async function iniciarTreino() {
  if (!state.user?.id) {
    showToast('Sessão expirada. Faça login novamente.', true);
    return;
  }
  if (!_activeWorkoutPlan) {
    showToast('Nenhum treino do dia para iniciar.', true);
    return;
  }
  if (_activeSessionId) {
    showToast('Você já tem uma sessão em andamento.', false);
    return;
  }

  _sessionLoadsBuffer = {};
  _completedBlocks = new Set();
  _sessionStartTime = Date.now();

  try {
    const startedAtIso = new Date().toISOString();
    let insertData = null;
    let insertErr = null;

    const { data: firstData, error: firstErr } = await window.supabase
      .from('session_logs')
      .insert({
        user_id: state.user.id,
        started_at: startedAtIso
      })
      .select('id')
      .single();
    insertData = firstData;
    insertErr = firstErr;

    if (insertErr) {
      // FE-002 / TASK 2: buscar supabase_id real antes de inserir
      let mbscWorkoutId = _activeWorkoutPlan?.id || null;
      if (mbscWorkoutId) {
        try {
          const { data: mbscRow } = await window.supabase
            .from('workouts')
            .select('supabase_id')
            .eq('id', mbscWorkoutId)
            .single();
          if (mbscRow?.supabase_id) mbscWorkoutId = mbscRow.supabase_id;
        } catch (_) {}
      }
      const { data: secondData, error: secondErr } = await window.supabase
        .from('session_logs')
        .insert({
          user_id: state.user.id,
          workout_id: mbscWorkoutId,
          started_at: startedAtIso,
          duration_seconds: 0,
          rpe: null,
          ua: null,
          notes: 'Treino MBSC iniciado'
        })
        .select('id')
        .single();
      insertData = secondData;
      insertErr = secondErr;
    }

    if (insertErr) {
      console.error('[iniciarTreino] session_logs insert:', insertErr);
      showToast('Falha ao iniciar sessão no banco. Tente novamente.', true);
      _activeSessionId = null;
      _sessionStartTime = null;
      return;
    }
    _activeSessionId = insertData?.id ?? null;
    showToast('Treino iniciado! Registre as cargas por bloco.', false);
  } catch (err) {
    console.error('[iniciarTreino]', err);
    showToast('Falha ao iniciar sessão. Verifique conexão e tente novamente.', true);
    _activeSessionId = null;
    _sessionStartTime = null;
    return;
  }

  renderTreinoCard(_activeWorkoutPlan);
}

function _renderReadOnlyExercise(ex) {
  const sets = Number(ex?.sets) || 0;
  const reps = Number(ex?.reps) || 0;
  const presc = sets > 0 && reps > 0 ? `${sets}x${reps}` : 'prescrição livre';
  return `
    <div style="padding:10px 12px;background:#0A0A0F;border:1px solid #1E1E2A;border-radius:8px;margin-bottom:8px;">
      <div style="font-size:14px;color:#F0F0F0;font-weight:600;">${_escapeWorkoutHTML(ex?.name || 'Exercício')}</div>
      <div style="font-size:12px;color:#6A6A7A;margin-top:4px;">${_escapeWorkoutHTML(presc)}</div>
    </div>
  `;
}

function _renderExerciseWithLoads(blockType, ex, hist, savedRows) {
  const exName = String(ex?.name || 'Exercício');
  const exKey = _sanitizeExerciseKey(exName);
  const setsTotal = Math.max(1, Number(ex?.sets) || 1);
  const reps = Number(ex?.reps) || null;
  const targetRpe = Number(ex?.rpe) || 7;
  const isBodyweight = ex?.bodyweight === true;

  let rowsHtml = '';
  for (let i = 1; i <= setsTotal; i++) {
    const rowSaved = Array.isArray(savedRows) ? savedRows[i - 1] : null;
    const savedWeight = rowSaved?.weight_kg;
    const savedRpe = rowSaved?.rpe;
    const confirmed = rowSaved?.confirmed === true;
    const weightPlaceholder = hist?.weight != null ? String(hist.weight) : '0';
    const rpePlaceholder = hist?.rpe != null ? String(hist.rpe) : String(targetRpe);
    const weightId = `inp_weight_${blockType}_${exKey}_${i}`;
    const rpeId = `inp_rpe_${blockType}_${exKey}_${i}`;
    const ckId = `set_confirm_${blockType}_${exKey}_${i}`;

    rowsHtml += `
      <div class="set-row">
        <div class="set-row-label">Set ${i}</div>
        <input id="${weightId}" class="set-row-input" type="number" min="0" max="500" step="0.5" inputmode="decimal"
          data-exercise="${_escapeWorkoutHTML(exName)}" data-set="${i}" data-kind="weight"
          onblur="clampNumberInput(this,0,500,0.5)"
          ${isBodyweight ? 'disabled value="BW"' : `value="${savedWeight ?? ''}" placeholder="${weightPlaceholder}"`}>
        <span class="set-row-unit">${isBodyweight ? '' : 'kg'}</span>
        <input id="${rpeId}" class="set-row-input" type="number" min="0" max="10" step="1"
          data-exercise="${_escapeWorkoutHTML(exName)}" data-set="${i}" data-kind="rpe"
          onblur="clampNumberInput(this,0,10,1)"
          value="${savedRpe ?? ''}" placeholder="${rpePlaceholder}">
        <span class="set-row-unit">RPE</span>
        <button id="${ckId}" type="button" class="set-row-confirm ${confirmed ? 'ok' : ''}" onclick="toggleSetConfirm(this)">${confirmed ? '✓' : '○'}</button>
      </div>
    `;
  }

  const histLine = hist?.weight != null
    ? `💾 Histórico: ${hist.weight}${hist?.rpe != null ? `kg · RPE ${hist.rpe}` : 'kg'}`
    : 'Sem histórico recente';

  return `
    <div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:15px;color:#F0F0F0;font-weight:700;margin-bottom:4px;">${_escapeWorkoutHTML(exName)}</div>
      <div style="font-size:12px;color:#8A8A9A;margin-bottom:4px;">
        ${setsTotal}x${reps || '-'} · RPE alvo ${targetRpe} · descanso ${Number(ex?.rest_seconds) || 60}s
      </div>
      <div class="exercise-hist">${_escapeWorkoutHTML(histLine)}</div>
      ${rowsHtml}
    </div>
  `;
}

function toggleSetConfirm(el) {
  if (!el) return;
  el.classList.toggle('ok');
  el.textContent = el.classList.contains('ok') ? '✓' : '○';
}

async function expandBloc(blockType, plan = _activeWorkoutPlan) {
  if (!plan) return;

  _closeActiveBlocoSheet();

  const blocks = _normalizePlanBlocks(plan?.blocks);
  const structure = _getVisiblePlanStructure(plan);
  const blocoMeta = structure.find(b => b.type === blockType);
  if (!blocoMeta) return;

  const exercises = Array.isArray(blocks[blockType]) ? blocks[blockType] : [];
  const savedBuffer = _sessionLoadsBuffer[blockType] || {};
  const exerciseNames = exercises.map(e => e?.name).filter(Boolean);
  const exerciseHistory = {};

  if (blocoMeta.hasLoads && exerciseNames.length > 0 && state.user?.id) {
    try {
      const { data: histData, error: histErr } = await window.supabase
        .from('exercise_logs')
        .select('exercise_name, actual_weight_kg, actual_rpe, created_at')
        .eq('user_id', state.user.id)
        .in('exercise_name', exerciseNames)
        .order('created_at', { ascending: false });
      if (!histErr && Array.isArray(histData)) {
        histData.forEach(row => {
          if (!exerciseHistory[row.exercise_name]) {
            exerciseHistory[row.exercise_name] = {
              weight: row.actual_weight_kg,
              rpe: row.actual_rpe
            };
          }
        });
      }
    } catch (err) {
      console.warn('[expandBloc] histórico indisponível:', err?.message || err);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'bloco-sheet-overlay';
  overlay.onclick = _closeActiveBlocoSheet;

  const sheet = document.createElement('div');
  sheet.className = 'bloco-sheet';
  sheet.setAttribute('data-block-type', blockType);

  const exercisesHtml = exercises.length
    ? exercises.map(ex => {
        if (blocoMeta.hasLoads) {
          return _renderExerciseWithLoads(
            blockType,
            ex,
            exerciseHistory[ex?.name] || null,
            savedBuffer[ex?.name] || null
          );
        }
        return _renderReadOnlyExercise(ex);
      }).join('')
    : '<div style="font-size:13px;color:#6A6A7A;padding:8px 0;">Exercícios a definir para este bloco.</div>';

  sheet.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div>
        <div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:#F0F0F0;">${blocoMeta.icon} ${_escapeWorkoutHTML(blocoMeta.label)}</div>
        <div style="font-size:12px;color:#8A8A9A;margin-top:4px;">${blocoMeta.duration} min · ${blocoMeta.hasLoads ? 'com registro de carga' : 'bloco técnico'}</div>
      </div>
      <button type="button" onclick="_closeActiveBlocoSheet()" style="background:none;border:1px solid var(--border);color:#A3ACBB;border-radius:8px;padding:6px 10px;cursor:pointer;">✕</button>
    </div>
    <div>${exercisesHtml}</div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn-action" style="flex:1;" onclick="markBlocoConcluido('${blockType}')">✓ Marcar Bloco Concluído</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
}

function markBlocoConcluido(blockType) {
  if (!_activeWorkoutPlan) {
    _closeActiveBlocoSheet();
    return;
  }

  const blocks = _normalizePlanBlocks(_activeWorkoutPlan.blocks);
  const exercises = Array.isArray(blocks[blockType]) ? blocks[blockType] : [];
  const blockData = {};

  exercises.forEach(ex => {
    const exName = String(ex?.name || 'Exercício');
    const exKey = _sanitizeExerciseKey(exName);
    const setsTotal = Math.max(1, Number(ex?.sets) || 1);
    const rows = [];

    for (let setNum = 1; setNum <= setsTotal; setNum++) {
      const weightEl = document.getElementById(`inp_weight_${blockType}_${exKey}_${setNum}`);
      const rpeEl = document.getElementById(`inp_rpe_${blockType}_${exKey}_${setNum}`);
      const confirmEl = document.getElementById(`set_confirm_${blockType}_${exKey}_${setNum}`);
      const weight = ex?.bodyweight === true ? null : _normalizeNumber(weightEl?.value, 0, 500);
      const rpe = _normalizeNumber(rpeEl?.value, 0, 10);
      rows.push({
        set: setNum,
        weight_kg: weight,
        rpe,
        reps: Number(ex?.reps) || null,
        confirmed: !!(confirmEl?.classList.contains('ok') || weight != null || rpe != null || ex?.bodyweight === true)
      });
    }

    blockData[exName] = rows;
  });

  _sessionLoadsBuffer[blockType] = blockData;
  _completedBlocks.add(blockType);
  _closeActiveBlocoSheet();
  if (_activeWorkoutPlan) renderTreinoCard(_activeWorkoutPlan);
}

function _closeTreinoFinishModal() {
  document.getElementById('treino-finish-modal')?.remove();
}

function openTreinoFinishModal() {
  if (!state.user?.id) {
    showToast('Sessão expirada. Faça login novamente.', true);
    return;
  }
  if (!_activeWorkoutPlan) {
    showToast('Nenhum treino ativo para finalizar.', true);
    return;
  }
  if (!_activeSessionId) {
    showToast('Inicie o treino antes de finalizar.', true);
    return;
  }
  if (document.getElementById('treino-finish-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'treino-finish-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="width:100%;max-width:520px;background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;">
      <div style="padding:18px 20px;border-bottom:1px solid var(--border);">
        <div style="font-size:11px;letter-spacing:1.5px;color:#00FF88;text-transform:uppercase;font-weight:700;">Sessão Concluída</div>
        <div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;margin-top:4px;">Como foi o treino?</div>
      </div>
      <div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px;max-height:70vh;overflow:auto;">
        <label style="font-size:13px;color:#A3ACBB;">RPE Geral (0-10)</label>
        <input id="rpe-geral-input" type="range" min="0" max="10" step="1" value="7" style="accent-color:#00FF88;">
        <div style="font-size:13px;color:#A3ACBB;">Desconforto Articular</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <label><input type="radio" name="discomfort" value="none" checked> Nenhum</label>
          <label><input type="radio" name="discomfort" value="mild"> Leve</label>
          <label><input type="radio" name="discomfort" value="moderate"> Moderado</label>
          <label><input type="radio" name="discomfort" value="high"> Alto</label>
        </div>
        <label style="font-size:13px;color:#A3ACBB;">Feedback (opcional)</label>
        <textarea id="feedback-livre" rows="3" placeholder="Como você se sentiu hoje?" style="width:100%;padding:10px;background:#0f1522;border:1px solid var(--border);border-radius:10px;color:#fff;resize:vertical;"></textarea>
      </div>
      <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:10px;">
        <button id="btn-finalizar-treino" class="btn-action" style="flex:1;" onclick="finalizarTreino()">📤 Enviar para Coach IA</button>
        <button class="treino-ghost-btn" style="flex:1;" onclick="_closeTreinoFinishModal()">Voltar</button>
      </div>
    </div>
  `;
  modal.onclick = (e) => { if (e.target === modal) _closeTreinoFinishModal(); };
  document.body.appendChild(modal);
}

function _buildSessionResumeFromBuffer(buffer, durationSeconds, rpeGeral, discomfort, feedback) {
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const planType = (_activeWorkoutPlan?.workout_type || 'upper_body').replace(/_/g, ' ');
  const phase = _activeWorkoutPlan?.phase || state.phase?.phase_name || 'N/A';
  const lines = [];
  lines.push('RESUMO DA SESSÃO:');
  lines.push(`- Fase: ${phase}`);
  lines.push(`- Duração: ${mins}min ${String(secs).padStart(2, '0')}s`);
  lines.push(`- Treino: ${planType}`);
  lines.push(`- RPE Geral: ${rpeGeral ?? 'N/A'}/10`);
  lines.push(`- Desconforto Articular: ${discomfort || 'none'}`);
  lines.push('');
  lines.push('BLOCOS CONCLUÍDOS:');
  const completedList = [..._completedBlocks];
  if (!completedList.length) {
    lines.push('Sem blocos marcados como concluídos.');
  } else {
    completedList.forEach(block => lines.push(`✓ ${block}`));
  }
  lines.push('');
  lines.push('PROGRESSÃO DE FORÇA:');
  let hasStrengthData = false;
  Object.entries(buffer || {}).forEach(([blockType, exercises]) => {
    Object.entries(exercises || {}).forEach(([exerciseName, sets]) => {
      if (!Array.isArray(sets) || !sets.length) return;
      hasStrengthData = true;
      const setTxt = sets.map(s => {
        const repTxt = s?.reps != null ? ` x ${s.reps}` : '';
        const weightTxt = s?.weight_kg != null ? `${s.weight_kg}kg` : 'BW';
        const rpeTxt = s?.rpe != null ? ` (RPE ${s.rpe})` : '';
        return `${weightTxt}${repTxt}${rpeTxt}`;
      }).join(' → ');
      lines.push(`${exerciseName} [${blockType}]: ${setTxt}`);
    });
  });
  if (!hasStrengthData) lines.push('Sem cargas registradas.');
  lines.push('');
  lines.push('FEEDBACK DO USUÁRIO:');
  lines.push(feedback && feedback.trim() ? `"${feedback.trim()}"` : 'Sem feedback adicional.');
  return lines.join('\n');
}

async function sendMessageToCoach(text) {
  if (!state.user?.id || !text) return;
  try {
    const { error } = await supabase
      .from('chat_messages')
      .insert({ user_id: state.user.id, role: 'user', content: text });
    if (error) console.warn('[sendMessageToCoach]', error.message || error);
  } catch (err) {
    console.warn('[sendMessageToCoach]', err?.message || err);
  }
}

async function finalizarTreino() {
  if (_isFinalizingTreino) return;
  if (!_activeSessionId) {
    showToast('Sessão não iniciada. Clique em "Iniciar Treino" primeiro.', true);
    return;
  }
  if (!state.user?.id) {
    showToast('Sessão expirada. Faça login novamente.', true);
    return;
  }

  _isFinalizingTreino = true;
  const saveBtn = document.getElementById('btn-finalizar-treino');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'SALVANDO...';
    saveBtn.style.opacity = '0.6';
  }

  const now = new Date();
  const durationSeconds = _sessionStartTime
    ? Math.max(0, Math.floor((now.getTime() - _sessionStartTime) / 1000))
    : 0;
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;

  const rpeGeral = _normalizeNumber(document.getElementById('rpe-geral-input')?.value, 0, 10);
  const discomfort = document.querySelector('input[name="discomfort"]:checked')?.value || 'none';
  const feedback = document.getElementById('feedback-livre')?.value?.trim() || null;
  const blocksCompletedObj = Object.fromEntries([..._completedBlocks].map(b => [b, true]));
  const bufferSnapshot = JSON.parse(JSON.stringify(_sessionLoadsBuffer || {}));

  try {
    const fullUpdate = {
      finished_at: now.toISOString(),
      total_duration_seconds: durationSeconds,
      total_duration_formatted: `${mins}:${String(secs).padStart(2, '0')}`,
      duration_seconds: durationSeconds,
      rpe: rpeGeral,
      ua: rpeGeral != null ? Number((rpeGeral * (durationSeconds / 60)).toFixed(2)) : null,
      discomfort_level: discomfort,
      user_feedback: feedback,
      notes: feedback,
      blocks_completed: blocksCompletedObj
    };

    let { error: sessionError } = await window.supabase
      .from('session_logs')
      .update(fullUpdate)
      .eq('id', _activeSessionId);

    if (sessionError) {
      console.warn('[session_logs update full]', sessionError.message || sessionError);
      const fallbackUpdate = {
        finished_at: now.toISOString(),
        duration_seconds: durationSeconds,
        rpe: rpeGeral,
        notes: feedback
      };
      const { error: fallbackErr } = await window.supabase
        .from('session_logs')
        .update(fallbackUpdate)
        .eq('id', _activeSessionId);
      if (fallbackErr) console.warn('[session_logs update fallback]', fallbackErr.message || fallbackErr);
    }

    const exerciseRows = [];
    const planBlocks = _normalizePlanBlocks(_activeWorkoutPlan?.blocks);

    Object.entries(bufferSnapshot).forEach(([blockType, exercisesData]) => {
      Object.entries(exercisesData || {}).forEach(([exerciseName, sets]) => {
        const planExercises = Array.isArray(planBlocks[blockType]) ? planBlocks[blockType] : [];
        const exMeta = planExercises.find(e => e?.name === exerciseName) || {};

        (sets || []).forEach(setData => {
          exerciseRows.push({
            user_id: state.user.id,
            session_id: _activeSessionId,
            workout_plan_id: _activeWorkoutPlan?.id || null,
            exercise_name: exerciseName,
            exercise_code: exMeta.code || null,
            block_type: blockType,
            set_number: setData?.set ?? null,
            target_reps: Number(exMeta?.reps) || null,
            actual_reps: setData?.reps ?? null,
            target_weight_kg: exMeta?.weight ?? null,
            actual_weight_kg: setData?.weight_kg ?? null,
            bodyweight: exMeta?.bodyweight === true,
            target_rpe: Number(exMeta?.rpe) || null,
            actual_rpe: setData?.rpe ?? null,
            rest_seconds: Number(exMeta?.rest_seconds) || 60
          });
        });
      });
    });

    if (exerciseRows.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < exerciseRows.length; i += chunkSize) {
        const chunk = exerciseRows.slice(i, i + chunkSize);
        const { error: logsError } = await window.supabase
          .from('exercise_logs')
          .insert(chunk);
        if (logsError) console.error(`Erro ao inserir exercise_logs (chunk ${i}):`, logsError);
      }
    }

    const resumo = _buildSessionResumeFromBuffer(bufferSnapshot, durationSeconds, rpeGeral, discomfort, feedback);
    await sendMessageToCoach(resumo);

    _sessionLoadsBuffer = {};
    _activeSessionId = null;
    _activeWorkoutPlan = null;
    _sessionStartTime = null;
    _completedBlocks = new Set();
    _closeTreinoFinishModal();
    showToast('Sessão finalizada e salva! 💪');

    if (typeof updateStreakAndConsistency === 'function') {
      try { await updateStreakAndConsistency(); } catch (_) {}
    }
    await navigate('dashboard');
  } catch (err) {
    console.error('[finalizarTreino]', err);
    showToast('Erro ao finalizar treino. Tente novamente.', true);
  } finally {
    _isFinalizingTreino = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '📤 Enviar para Coach IA';
      saveBtn.style.opacity = '';
    }
  }
}

function _escapeWorkoutHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// RENDERIZAÇÃO DE PODS MBSC
function renderWorkoutPlan(plan) {
  if (!plan || !Array.isArray(plan.blocks)) {
    return '<p class="empty-state">Sem prescrição disponível.</p>';
  }

  return plan.blocks.map(block => {
    const exercises = Array.isArray(block.exercises) ? block.exercises : [];
    const hasPod = block.pod !== null && block.pod !== undefined && String(block.pod).trim() !== '';
    const podKey = hasPod ? _escapeWorkoutHTML(String(block.pod).toUpperCase()) : '';
    const isPodBlock = hasPod && exercises.length > 1;
    const blockType = String(block.type || '').toLowerCase();
    const podLabel = blockType === 'triset' ? 'Triset' : blockType === 'biset' ? 'Biset' : 'Pod';

    const sectionHeader = `
      <div class="workout-section-header">
        <span class="section-label">${_escapeWorkoutHTML(block.section || 'Seção')}</span>
        ${hasPod ? `<span class="pod-badge pod-${podKey}">${podLabel}</span>` : ''}
      </div>
    `;

    const exercisesHTML = exercises.map(ex => {
      const safeName = _escapeWorkoutHTML(ex?.name || 'Exercício');
      const sets = _escapeWorkoutHTML(ex?.sets ?? '-');
      const reps = _escapeWorkoutHTML(ex?.reps ?? '-');
      const notes = ex?.notes ? `<p class="exercise-notes">${_escapeWorkoutHTML(ex.notes)}</p>` : '';
      const label = ex?.label ? `<span class="pod-label">${_escapeWorkoutHTML(ex.label)}</span>` : '';
      const rest = ex?.rest_after_pod
        ? `<span class="rest-info">Descanso: ${_escapeWorkoutHTML(ex.rest_after_pod)}s</span>`
        : '';

      return `
        <div class="exercise-card ${isPodBlock ? 'pod-exercise' : 'solo-exercise'}" data-exercise="${safeName}">
          <div class="exercise-label-wrap">
            ${label}
            <span class="exercise-name">${safeName}</span>
          </div>
          <div class="exercise-meta">
            <span class="sets-reps">${sets}x ${reps}</span>
            ${rest}
          </div>
          ${notes}
        </div>
      `;
    }).join('');

    const podContainer = isPodBlock
      ? `<div class="pod-container pod-border-${podKey}">${exercisesHTML}</div>`
      : exercisesHTML;

    return `
      <div class="workout-block">
        ${sectionHeader}
        ${podContainer}
      </div>
    `;
  }).join('');
}

async function loadUserWorkouts(userId, userEmail) {
  const container = document.getElementById('workout-plan-container');
  if (!container || !userId) return;

  try {
    const qs = new URLSearchParams({ user_id: userId });
    if (userEmail) qs.set('email', userEmail);
    const res = await fetch(`/api/get-workouts?${qs.toString()}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload?.error || 'Falha ao carregar treinos');
    }

    const workouts = Array.isArray(payload?.workouts) ? payload.workouts : [];
    if (!workouts.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Nenhum treino prescrito ainda.</p>
          <p>Converse com o Coach IA para gerar sua prescrição.</p>
        </div>
      `;
      return;
    }

    const currentWorkout = workouts[0];
    container.innerHTML = `
      <div class="workout-header">
        <h2 class="workout-title">${_escapeWorkoutHTML(currentWorkout.title || 'Treino Ativo')}</h2>
        ${currentWorkout.phase_name ? `<span class="phase-badge">${_escapeWorkoutHTML(currentWorkout.phase_name)}</span>` : ''}
      </div>
      ${renderWorkoutPlan(currentWorkout.plan)}
    `;
  } catch (err) {
    console.error('Erro ao carregar treinos:', err);
    container.innerHTML = `
      <div class="empty-state">
        <p>Erro ao carregar prescrição.</p>
        <p>Tente novamente em instantes.</p>
      </div>
    `;
  }
}

let _workoutsActiveTab = 'active';
let _inlineSession = null;
let _inlineSessionTimer = null;

// ── BUG-2 FIX: Persist active session state across tab navigation ─────────
const _INLINE_SESSION_KEY = 'axisai_inline_session';

function _saveInlineSessionState() {
  if (!_inlineSession || _inlineSession.finished) {
    localStorage.removeItem(_INLINE_SESSION_KEY);
    return;
  }
  try {
    const snap = {
      workoutId:    _inlineSession.workoutId,
      title:        _inlineSession.title,
      conteudo:     _inlineSession.conteudo,
      source:       _inlineSession.source,
      sourceIndex:  _inlineSession.sourceIndex,
      cardDomId:    _inlineSession.cardDomId,
      startedAtMs:  _inlineSession.startedAtMs,
      startedAtIso: _inlineSession.startedAtIso,
      timerSecs:    _inlineSession.timerSecs,
      blocks:       _inlineSession.blocks.map(b => ({
        name: b.name, color: b.color, hasLoads: b.hasLoads,
        done: b.done, conteudo: b.conteudo,
        exercises: b.exercises
      })),
      finished:       _inlineSession.finished,
      sessionLogId:   _inlineSession.sessionLogId || null,
      realWorkoutId:  _inlineSession.realWorkoutId || null
    };
    localStorage.setItem(_INLINE_SESSION_KEY, JSON.stringify(snap));
  } catch (e) { console.warn('[BUG-2] save session state error:', e); }
}

function _clearInlineSessionState() {
  localStorage.removeItem(_INLINE_SESSION_KEY);
}

function _getPersistedSession() {
  try {
    const raw = localStorage.getItem(_INLINE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function _restoreInlineSession() {
  const snap = _getPersistedSession();
  if (!snap || snap.finished) { _clearInlineSessionState(); return false; }

  // Find the card in the re-rendered DOM
  const card = document.getElementById(snap.cardDomId);
  if (!card) {
    console.warn('[BUG-2] restore: card not found in DOM:', snap.cardDomId);
    return false;
  }
  const body = card.querySelector('.session-card-body');
  if (!body) { console.warn('[BUG-2] restore: body not found'); return false; }

  // Rebuild the _inlineSession from snapshot
  _stopInlineSessionTimer();
  _inlineSession = {
    workoutId:    snap.workoutId,
    title:        snap.title,
    conteudo:     snap.conteudo,
    source:       snap.source,
    sourceIndex:  snap.sourceIndex,
    cardDomId:    snap.cardDomId,
    cardEl:       card,
    bodyEl:       body,
    startedAtMs:  snap.startedAtMs,
    startedAtIso: snap.startedAtIso,
    timerSecs:    snap.timerSecs || Math.floor((Date.now() - snap.startedAtMs) / 1000),
    blocks:       snap.blocks,
    finished:     false,
    sessionLogId:   snap.sessionLogId || null,
    realWorkoutId:  snap.realWorkoutId || null
  };

  // Re-render the session UI
  card.classList.add('session-active');
  body.classList.add('open');
  _renderInlineSessionBody();
  _injectInlineTimer();

  // Update timer display with elapsed time
  const formatted = _formatClock(_inlineSession.timerSecs);
  const timer = document.getElementById(`timer-${_inlineSession.cardDomId}`);
  if (timer) timer.textContent = formatted;
  const stickyTimer = document.getElementById(`sticky-timer-${_inlineSession.cardDomId}`);
  if (stickyTimer) stickyTimer.textContent = formatted;

  // Update start button to show "Em andamento"
  const startBtn = card.querySelector('.btn-start-session');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.style.opacity = '0.6';
    startBtn.textContent = 'Em andamento';
  }

  // Restart timer interval
  _inlineSessionTimer = setInterval(() => {
    if (!_inlineSession || _inlineSession.finished) return;
    _inlineSession.timerSecs += 1;
    const fmt = _formatClock(_inlineSession.timerSecs);
    const t = document.getElementById(`timer-${_inlineSession.cardDomId}`);
    if (t) t.textContent = fmt;
    const st = document.getElementById(`sticky-timer-${_inlineSession.cardDomId}`);
    if (st) st.textContent = fmt;
  }, 1000);

  console.log('[BUG-2] Session restored for workoutId:', snap.workoutId, 'elapsed:', _inlineSession.timerSecs + 's');
  return true;
}

function _getWorkoutCardDomId(source, workoutId) {
  const cleanSource = String(source || 'wk').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanId = String(workoutId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `wk-${cleanSource}-${cleanId}`;
}

function _formatWorkoutDate(dateLike) {
  if (!dateLike) return 'Sem data';
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return String(dateLike);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderWorkouts() {
  const c = document.getElementById('all-workouts');
  if (!c) return;

  const treinosIA = loadTreinosIA();
  const pendingIA = treinosIA.filter(t => !(t.concluida || t.completed));
  const pendingState = state.workouts
    .map((w, idx) => ({ ...w, _idx: idx }))
    .filter(w => !w.completed);

  if (!pendingIA.length && !pendingState.length) {
    c.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🏋️</div>
      <div class="empty-title">NENHUM TREINO EM ANDAMENTO</div>
      <div class="empty-desc">Converse com o Coach IA para gerar sua próxima sessão.</div>
      <button class="btn-action" onclick="navigate('chat')">FALAR COM O COACH →</button>
    </div>`;
    updateTabBadges();
    renderCompletedWorkouts();
    return;
  }

  let html = '';

  pendingIA.forEach(t => {
    const domId = _getWorkoutCardDomId('ia', t.id);
    const bodyId = `scb-${domId}`;
    const title = _escapeWorkoutHTML(t.titulo || 'Sessão Coach IA');
    const category = _escapeWorkoutHTML(String(t.categoria || 'coach_ia').toUpperCase());
    const dateLabel = _escapeWorkoutHTML(_formatWorkoutDate(t.data || t.created_at));
    const blocos = _normalizePlanBlocks(t.conteudo || t.content || '');
    const previewHTML = blocos.map(function(b) {
      return '<div class="preview-bloco">' +
        '<span class="preview-bloco-nome">' + _escapeWorkoutHTML(b.nome) + '</span>' +
        '<div class="preview-exercicios">' +
          b.exercicios.map(function(e) { return '<span>' + _escapeWorkoutHTML(e) + '</span>'; }).join('') +
        '</div>' +
        '</div>';
    }).join('');

    html += `
      <div class="session-card treino-card" id="${domId}" data-workout-id="${_escapeWorkoutHTML(t.id)}" data-source="ia">
        <div class="session-card-header">
          <div class="session-status-dot pending">🤖</div>
          <div class="session-info">
            <div class="session-title-row">
              ${title}
              <span class="s-badge s-badge-phase">${category}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono);margin-top:3px;">${dateLabel}</div>
            ${previewHTML ? `<div class="treino-preview-blocos">${previewHTML}</div>` : ''}
          </div>
          <div class="session-card-actions">
            <button class="btn-start-session" onclick="event.stopPropagation();startSessionById('${_escapeWorkoutHTML(t.id)}',this)">▶ Iniciar Treino</button>
            <button onclick="event.stopPropagation();deleteTreinoIA('${_escapeWorkoutHTML(t.id)}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;" title="Excluir">🗑️</button>
          </div>
        </div>
        <div class="session-card-body" id="${bodyId}"></div>
      </div>`;
  });

  pendingState.forEach(w => {
    const domId = _getWorkoutCardDomId('state', w.id ?? w._idx);
    const bodyId = `scb-${domId}`;
    const title = _escapeWorkoutHTML(w.title || 'Sessão de treino');
    const dateLabel = _escapeWorkoutHTML(_formatWorkoutDate(w.date));
    const blocos = _normalizePlanBlocks(w.conteudo || w.content || w.details || '');
    const previewHTML = blocos.map(function(b) {
      return '<div class="preview-bloco">' +
        '<span class="preview-bloco-nome">' + _escapeWorkoutHTML(b.nome) + '</span>' +
        '<div class="preview-exercicios">' +
          b.exercicios.map(function(e) { return '<span>' + _escapeWorkoutHTML(e) + '</span>'; }).join('') +
        '</div>' +
        '</div>';
    }).join('');

    html += `
      <div class="session-card workout-card" id="${domId}" data-workout-id="${_escapeWorkoutHTML(w.id ?? w._idx)}" data-source="state" data-idx="${w._idx}">
        <div class="session-card-header">
          <div class="session-status-dot pending">🏋️</div>
          <div class="session-info">
            <div class="session-title-row">
              ${title}
              <span class="s-badge s-badge-pending">PENDENTE</span>
            </div>
            <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono);margin-top:3px;">${dateLabel}</div>
            ${previewHTML ? `<div class="treino-preview-blocos">${previewHTML}</div>` : ''}
          </div>
          <div class="session-card-actions">
            <button class="btn-start-session" onclick="event.stopPropagation();startSessionByWorkout(${w._idx},this)">▶ Iniciar Treino</button>
            <button onclick="event.stopPropagation();deleteWorkout(${w._idx})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;" title="Excluir">🗑️</button>
          </div>
        </div>
        <div class="session-card-body" id="${bodyId}"></div>
      </div>`;
  });

  c.innerHTML = html;
  updateTabBadges();
  renderCompletedWorkouts();

  // BUG-2 FIX: restore active session after re-render
  if (_inlineSession && !_inlineSession.finished) {
    // Session exists in memory but DOM was destroyed → re-bind
    const existingCard = document.getElementById(_inlineSession.cardDomId);
    if (existingCard) {
      const existingBody = existingCard.querySelector('.session-card-body');
      if (existingBody) {
        _inlineSession.cardEl = existingCard;
        _inlineSession.bodyEl = existingBody;
        existingCard.classList.add('session-active');
        existingBody.classList.add('open');
        _renderInlineSessionBody();
        _injectInlineTimer();
        const fmt = _formatClock(_inlineSession.timerSecs);
        const st = document.getElementById(`sticky-timer-${_inlineSession.cardDomId}`);
        if (st) st.textContent = fmt;
        const startBtn = existingCard.querySelector('.btn-start-session');
        if (startBtn) {
          startBtn.disabled = true;
          startBtn.style.opacity = '0.6';
          startBtn.textContent = 'Em andamento';
        }
        return;
      }
    }
  }
  // Try restoring from localStorage
  _restoreInlineSession();
}

function switchWorkoutsTab(tab) {
  _workoutsActiveTab = tab === 'completed' ? 'completed' : 'active';
  const activeBtn = document.getElementById('workouts-tab-active');
  const doneBtn = document.getElementById('workouts-tab-completed');
  const activeContent = document.getElementById('tab-content-active');
  const doneContent = document.getElementById('tab-content-completed');
  if (!activeBtn || !doneBtn || !activeContent || !doneContent) return;

  const showActive = _workoutsActiveTab === 'active';
  activeBtn.classList.toggle('active', showActive);
  doneBtn.classList.toggle('active', !showActive);
  activeContent.style.display = showActive ? 'block' : 'none';
  doneContent.style.display = showActive ? 'none' : 'block';
}

function updateTabBadges() {
  const pending = document.querySelectorAll('#tab-content-active .session-card').length;
  const concluidos = document.querySelectorAll('#tab-content-completed .completed-card').length;
  const badgeActive = document.getElementById('badge-active');
  const badgeCompleted = document.getElementById('badge-completed');
  if (badgeActive) badgeActive.textContent = String(pending);
  if (badgeCompleted) badgeCompleted.textContent = String(concluidos);
}

function toggleCompleted(logId) {
  const card = document.getElementById('completed-' + logId);
  if (!card) return;
  card.classList.toggle('collapsed');
}

async function deleteSession(logId, e) {
  if (e) e.stopPropagation();
  if (!confirm('Deletar esta sessão do histórico? Esta ação não pode ser desfeita.')) return;

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) {
    showToast('Sessão expirada. Faça login novamente.', true);
    return;
  }

  const { error } = await supabase.from('session_logs').delete().eq('id', logId).eq('user_id', userId);
  if (error) {
    showToast('Erro ao deletar sessão.', true);
    return;
  }

  const card = document.getElementById('completed-' + logId);
  if (card) card.remove();
  if (!document.querySelector('#tab-content-completed .completed-card')) {
    const container = document.getElementById('completed-workouts');
    if (container) {
      container.innerHTML = `<div class="empty-state" style="padding:36px 16px;">
        <div class="empty-icon" style="font-size:32px;">✅</div>
        <div class="empty-title" style="font-size:18px;">SEM TREINOS CONCLUÍDOS</div>
      </div>`;
    }
  }
  updateTabBadges();
}

async function renderCompletedWorkouts() {
  const container = document.getElementById('completed-workouts');
  if (!container) return;

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) {
    container.innerHTML = '';
    updateTabBadges();
    return;
  }

  const { data: logs, error } = await supabase
    .from('session_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !logs || !logs.length) {
    container.innerHTML = `<div class="empty-state" style="padding:36px 16px;">
      <div class="empty-icon" style="font-size:32px;">✅</div>
      <div class="empty-title" style="font-size:18px;">SEM TREINOS CONCLUÍDOS</div>
      <div class="empty-desc">Finalize sua primeira sessão para começar o histórico.</div>
    </div>`;
    updateTabBadges();
    return;
  }

  const treinosKey = getTreinosKey();
  const treinos = treinosKey ? JSON.parse(localStorage.getItem(treinosKey) || '[]') : [];
  const localWorkouts = Array.isArray(state.workouts) ? state.workouts : [];

  container.innerHTML = logs.map(log => {
    const treino = treinos.find(t => String(t.id) === String(log.workout_id));
    const localWk = localWorkouts.find(w => String(w.id) === String(log.workout_id));
    const titulo = _escapeWorkoutHTML(
      treino?.titulo ||
      localWk?.title ||
      log.workout_title ||
      'Sessão de treino'
    );
    const createdAt = _escapeWorkoutHTML(_fmtDateTime(log.created_at));
    const duration = _escapeWorkoutHTML(_fmtDuration(log.duration_seconds || 0));
    const rpe = log.rpe != null ? Number(log.rpe) : '—';
    const ua = log.ua != null ? Number(log.ua) : '—';

    const conteudoRaw = treino?.conteudo || localWk?.conteudo || localWk?.content || '';
    const blocos = _normalizePlanBlocks(conteudoRaw);
    const blocosHtml = blocos.length
      ? blocos.map(b => `<div class="completed-block-mini">${_escapeWorkoutHTML(b.nome)}</div>`).join('')
      : `<div class="completed-block-mini">Treino sem blocos detalhados.</div>`;

    let volumeKg = 0;
    if (log.notes) {
      try {
        const parsedNotes = JSON.parse(log.notes);
        const n = Number(parsedNotes?.volume_kg);
        if (Number.isFinite(n) && n > 0) volumeKg = Math.round(n);
      } catch (_) {}
    }

    return `
      <div class="completed-card collapsed" id="completed-${log.id}">
        <div class="completed-header" onclick="toggleCompleted('${log.id}')">
          <div class="completed-header-left">
            <div class="completed-check">✓</div>
            <div>
              <div class="completed-title">${titulo}</div>
              <div class="completed-date">${createdAt}</div>
            </div>
          </div>
          <div class="completed-header-right">
            <div class="completed-metrics">
              <span class="metric-chip green">${duration}</span>
              <span class="metric-chip blue">RPE ${_escapeWorkoutHTML(rpe)}</span>
              <span class="metric-chip amber">${_escapeWorkoutHTML(ua)} UA</span>
            </div>
            <button class="btn-delete-session" onclick="deleteSession('${log.id}', event)" title="Deletar sessão">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1.75 3.5h10.5M5.25 3.5V2.333a.583.583 0 0 1 .583-.583h2.334a.583.583 0 0 1 .583.583V3.5M11.083 3.5l-.583 7.583a.583.583 0 0 1-.583.584H4.083a.583.583 0 0 1-.583-.584L2.917 3.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="chevron">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
        <div class="completed-body">
          ${blocosHtml}
          ${volumeKg > 0 ? `<div class="volume-info">Volume total: ${volumeKg} kg</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  updateTabBadges();
}

function completeWorkout(i) { state.workouts[i].completed = true; saveWorkouts(); renderWorkouts(); refreshDashboard(); showToast('Treino marcado como concluído! 💪'); }
function deleteWorkout(i) { state.workouts.splice(i,1); saveWorkouts(); renderWorkouts(); refreshDashboard(); }

// ═══════════════════════════════════════════════
//  TREINOS IA
// ═══════════════════════════════════════════════
function loadTreinosIA() {
  const treinosKey = getTreinosKey();
  return treinosKey ? JSON.parse(localStorage.getItem(treinosKey) || '[]') : [];
}
function _buildApiPayload(t, userId) {
  return {
    user_id:      userId,
    local_id:     t.id,
    titulo:       t.titulo      || null,
    data:         t.data        || null,
    conteudo:     t.conteudo    || null,
    categoria:    t.categoria   || 'fullbody',
    tipo:         t.tipo        || 'sessao',
    fase_num:     t.faseNum     ?? null,
    fase_nome:    t.faseNome    ?? null,
    plano_titulo: t.planoTitulo ?? null,
    fonte:        t.fonte       || 'coach_ia'
  };
}

function _markSyncedInStorage(localId, supabaseId) {
  const treinosKey = getTreinosKey();
  if (!treinosKey) return;
  const all = JSON.parse(localStorage.getItem(treinosKey) || '[]');
  const idx = all.findIndex(x => String(x.id) === String(localId));
  if (idx !== -1) {
    all[idx].synced = true;
    all[idx].supabase_id = supabaseId || all[idx].supabase_id || null;
    localStorage.setItem(treinosKey, JSON.stringify(all));
  }
}

function saveTreinosIA(treinos) {
  try {
    const treinosKey = getTreinosKey();
    if (treinosKey) localStorage.setItem(treinosKey, JSON.stringify(treinos));
    if (!state.user?.id || treinos.length === 0) return;
    const newest = treinos[0];
    if (newest.synced) return;

    const apiPayload = _buildApiPayload(newest, state.user.id);

    // Tentar via API (source of truth)
    fetch('/api/save-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload)
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(json => {
        if (json?.success) {
          _markSyncedInStorage(newest.id, json.supabase_id);
        }
      })
      .catch(() => {
        // Fallback: upsert direto no Supabase
        const fallbackPayload = {
          id:          newest.id,
          user_id:     state.user.id,
          titulo:      newest.titulo      || null,
          data:        newest.data        || null,
          conteudo:    newest.conteudo    || null,
          categoria:   newest.categoria   || 'fullbody',
          tipo:        newest.tipo        || 'sessao',
          fase_num:    newest.faseNum     ?? null,
          fase_nome:   newest.faseNome    ?? null,
          plano_titulo:newest.planoTitulo ?? null,
          fonte:       newest.fonte       || 'coach_ia'
        };
        supabase.from('workouts').upsert(fallbackPayload, { onConflict: 'id' })
          .then(({ data: rows, error }) => {
            if (!error) {
              const sbId = Array.isArray(rows) ? rows[0]?.supabase_id : rows?.supabase_id;
              _markSyncedInStorage(newest.id, sbId || null);
            } else {
              console.warn('[saveTreinosIA] fallback Supabase error:', error.message);
            }
          });
      });
  } catch(e) { _logError('saveTreinosIA', e); }
}

async function syncPendingWorkouts() {
  if (!state.user?.id) return;
  const treinosKey = getTreinosKey();
  const treinos = treinosKey ? JSON.parse(localStorage.getItem(treinosKey) || '[]') : [];
  const pending = treinos.filter(t => !t.supabase_id);
  if (pending.length === 0) return;

  const BATCH = 5;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    await Promise.all(batch.map(async t => {
      const apiPayload = _buildApiPayload(t, state.user.id);
      let apiOk = false;
      try {
        const r = await fetch('/api/save-workout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload)
        });
        if (r.ok) {
          const json = await r.json().catch(() => null);
          if (json?.success) {
            _markSyncedInStorage(t.id, json.supabase_id);
            apiOk = true;
          }
        }
      } catch (_) { /* fallthrough */ }

      if (!apiOk) {
        // Fallback: upsert direto
        const fallbackPayload = {
          id:          t.id,
          user_id:     state.user.id,
          titulo:      t.titulo      || null,
          data:        t.data        || null,
          conteudo:    t.conteudo    || null,
          categoria:   t.categoria   || 'fullbody',
          tipo:        t.tipo        || 'sessao',
          fase_num:    t.faseNum     ?? null,
          fase_nome:   t.faseNome    ?? null,
          plano_titulo:t.planoTitulo ?? null,
          fonte:       t.fonte       || 'coach_ia'
        };
        const { data: rows, error } = await supabase.from('workouts')
          .upsert(fallbackPayload, { onConflict: 'id' });
        if (!error) {
          const sbId = Array.isArray(rows) ? rows[0]?.supabase_id : rows?.supabase_id;
          _markSyncedInStorage(t.id, sbId || null);
        } else {
          console.warn('[syncPendingWorkouts] fallback error for', t.id, ':', error.message);
        }
      }
    }));
  }
}
function deleteTreinoIA(id) {
  if (!confirm('Excluir este treino?')) return;

  const treinosFiltrados = loadTreinosIA().filter(t => String(t.id) !== String(id));
  saveTreinosIA(treinosFiltrados);

  const treinosContainer = document.getElementById('tab-treinos-content');
  if (treinosContainer) {
    renderTreinosList(treinosContainer, treinosFiltrados, 'local');
  }

  refreshDashboard();
  renderWorkouts();
  showToast('Treino removido.');
}

function toggleFaseBody(id) {
  const body = document.getElementById(id);
  if (!body) return;
  body.classList.toggle('collapsed');
  // Walk up to the phase-header-bar sibling (may be separated by progress-wrap)
  let el = body.previousElementSibling;
  while (el && !el.classList.contains('phase-header-bar') && !el.classList.contains('fase-header')) el = el.previousElementSibling;
  if (el) { const icon = el.querySelector('.fase-toggle-icon'); if (icon) icon.textContent = body.classList.contains('collapsed') ? '▶' : '▼'; }
}

// Toggle expanded body of a session card (new session-card-body pattern)
function toggleSessionCard(bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  body.classList.toggle('open');
}

// Build a full block-by-block preview HTML using parseTreino
function _toggleBlockDetail(id) {
  // Extract prefix: everything before the last "-" followed by a digit
  const prefixMatch = id.match(/^(bpd-[^-]+-)/);
  const prefix = prefixMatch ? prefixMatch[1] : 'bpd-';
  // Close all panels sharing this prefix
  document.querySelectorAll('[id^="' + prefix + '"]').forEach(el => {
    if (el.id !== id) el.style.display = 'none';
  });
  // Toggle the clicked one
  const panel = document.getElementById(id);
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function _buildBlocksPreviewHTML(conteudo) {
  try {
    const blocos = parseTreino(conteudo);
    if (!blocos || !blocos.length) throw new Error('empty');

    // FIX 1: filter out prep blocks (foam_roll, pillar_prep, warm_up) when no session is active
    const sessionActive = !!_sessionContext;
    const prepTypes = new Set(['foam_roll', 'pillar_prep', 'warm_up']);
    const visibleBlocos = sessionActive
      ? blocos
      : blocos.filter(b => !prepTypes.has(b.tipo));
    if (!visibleBlocos.length) throw new Error('empty');

    // FIX 4: unique prefix per card using hash of conteudo
    const hashPrefix = 'bpd-' + (conteudo.length + (conteudo.charCodeAt(0) || 0)) + '-';

    const iconMap = {
      foam_roll: '🔵', pillar_prep: '🔵', warm_up: '🔵',
      power: '🟡', strength: '🟠', conditioning: '🟣'
    };

    return visibleBlocos.map((b, idx) => {
      const icon = iconMap[b.tipo] || '⚪';
      const name = b.bloco;
      const dur  = b.duracao ? `<span style="margin-left:6px;color:var(--muted);font-size:11px;">${b.duracao}</span>` : '';

      // FIX 3: build detail panel content
      const panelId = hashPrefix + idx;
      let detailContent = '';
      if (b.tipo === 'foam_roll' && b.areas && b.areas.length) {
        detailContent = b.areas.map(a => `<div>${a.nome}${a.tempo ? ' — ' + a.tempo : ''}</div>`).join('');
      } else if ((b.tipo === 'pillar_prep' || b.tipo === 'warm_up') && b.exercicios && b.exercicios.length) {
        detailContent = b.exercicios.map(e => `<div>${e.nome}${e.prescricao ? ' — ' + e.prescricao : ''}</div>`).join('');
      } else if ((b.tipo === 'strength' || b.tipo === 'power') && b.exercicios && b.exercicios.length) {
        detailContent = b.exercicios.map(e => `<div>${e.id ? e.id + ') ' : ''}${e.nome}${e.prescricao ? ' — ' + e.prescricao : ''}</div>`).join('');
      } else if (b.tipo === 'conditioning') {
        const desc = b.descricao ? `<div>${b.descricao.slice(0, 120)}</div>` : '';
        const items = (b.itens && b.itens.length) ? b.itens.map(it => `<div>${it.nome}${it.prescricao ? ' — ' + it.prescricao : ''}</div>`).join('') : '';
        detailContent = desc + items;
      }

      const detailPanel = detailContent
        ? `<div id="${panelId}" style="display:none;background:rgba(255,255,255,0.04);border-radius:6px;padding:6px 10px;margin:2px 0 4px 20px;font-size:11px;color:var(--muted);">${detailContent}</div>`
        : '';

      const rowOnclick = detailContent ? ` onclick="event.stopPropagation();_toggleBlockDetail('${panelId}')" style="cursor:pointer;"` : '';

      // inline detail span for strength/power (legacy behaviour kept)
      let inlineDetail = '';
      if (!detailContent && (b.tipo === 'strength' || b.tipo === 'power') && b.exercicios && b.exercicios.length) {
        inlineDetail = `<span style="margin-left:6px;color:var(--muted);font-size:11px;">${b.exercicios.map(e => e.id || e.nome).join(' · ')}</span>`;
      } else if (!detailContent && b.tipo === 'conditioning') {
        const desc = b.descricao || (b.itens && b.itens.length ? b.itens[0].nome : '');
        if (desc) inlineDetail = `<span style="margin-left:6px;color:var(--muted);font-size:11px;">${desc.slice(0, 50)}</span>`;
      }

      return `<div${rowOnclick}>`
        + `<div style="display:flex;align-items:baseline;gap:4px;padding:1px 0;font-size:12px;line-height:1.5;">`
        + `<span>${icon}</span>`
        + `<span style="font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">${name}</span>`
        + dur + inlineDetail
        + (detailContent ? `<span style="margin-left:4px;color:var(--muted);font-size:10px;">▶</span>` : '')
        + `</div>`
        + detailPanel
        + `</div>`;
    }).join('');
  } catch(e) {
    return `<span style="font-size:11px;color:var(--muted);">${String(conteudo||'').slice(0,120)}</span>`;
  }
}

// Extract first N exercise names from AI-generated workout text for preview tags
function _extractExercisePreview(conteudo) {
  if (!conteudo) return [];
  const result = [];
  for (const raw of conteudo.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // Skip markdown section headers and pure decorative lines
    if (/^\*\*/.test(line) || /^#+\s/.test(line) || /^-{3,}$/.test(line) || /^={3,}$/.test(line)) continue;
    // Match lettered/numbered/bullet exercise lines: "A1. Name", "1. Name", "• Name", "- Name"
    const m = line.match(/^(?:[A-Z]\d*[.)]\s+|[\d]+[.)]\s+|[•\-*]\s+)([A-ZÀ-ÚA-Za-zà-ú][^·•×xX\d\n]{3,44}?)(?:\s*[-—:·]|\s+\d+\s*[×xX]|\s*$)/);
    if (m) {
      let name = m[1].replace(/\*\*/g, '').replace(/\s{2,}/g, ' ').trim();
      // Strip trailing filler words
      name = name.replace(/\s*(séries?|series?|repetições?|reps?|min|seg|sets?)\s*$/i, '').trim();
      // Skip section labels mistaken as exercises
      if (/^(aquecimento|protocolo|bloco|fase|semana|descanso|observa|nota|carga|tempo|principal|complementar|finalizaç)/i.test(name)) continue;
      if (name.length >= 4 && name.length <= 45) {
        result.push(name);
        if (result.length >= 6) break;
      }
    }
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
//  WORKOUT BLOCK RENDERER  v2 — exercise mini-cards + load inputs
// ══════════════════════════════════════════════════════════════════════════════
function renderWorkoutBlocks(conteudo, treinoId, isDone) {
  console.log('[renderWorkoutBlocks] treinoId:', treinoId, '| conteudo:', conteudo);
  if (!conteudo) return '<div class="wb-fallback">Sem conteúdo.</div>';

  const normalizedConteudo = String(conteudo || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[–—]/g, '-')
    .replace(/\s+\|\s+/g, '\n');

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function stripMd(s) {
    return s.replace(/\*\*/g,'').replace(/\*/g,'').replace(/^#+\s*/,'').trim();
  }

  // ── Block definitions (strength flag controls load inputs) ─────────────────
  const BLOCKS = [
    { re: /^(?:[•\-\u2022*]\s*)?FOAM\s*ROLL\b/i, color:'#64748B', emoji:'⚪', label:'FOAM ROLL', strength:false },
    { re: /^(?:[•\-\u2022*]\s*)?PILLAR\s*PREP\b/i, color:'#3B82F6', emoji:'🔵', label:'PILLAR PREP', strength:false },
    { re: /^(?:[•\-\u2022*]\s*)?(?:WARM[\s-]*UP|DYNAMIC\s*WARM|AQUECIMENTO)\b/i, color:'#14B8A6', emoji:'🟦', label:'WARM-UP', strength:false },
    { re: /^(?:[•\-\u2022*]\s*)?LIGHT\s*POWER\b/i, color:'#F59E0B', emoji:'🟡', label:'LIGHT POWER', strength:true },
    { re: /^(?:[•\-\u2022*]\s*)?HEAVY\s*POWER\b/i, color:'#EA580C', emoji:'🟠', label:'HEAVY POWER', strength:true },
    { re: /^(?:[•\-\u2022*]\s*)?(?:STRENGTH\s*POD\s*1|POD\s*1)\b/i, color:'#F97316', emoji:'🟠', label:'STRENGTH POD 1', strength:true },
    { re: /^(?:[•\-\u2022*]\s*)?(?:STRENGTH\s*POD\s*2|POD\s*2)\b/i, color:'#F97316', emoji:'🟠', label:'STRENGTH POD 2', strength:true },
    { re: /^(?:[•\-\u2022*]\s*)?(?:STRENGTH\s*POD\s*3|POD\s*3)\b/i, color:'#F97316', emoji:'🟠', label:'STRENGTH POD 3', strength:true },
    { re: /^(?:[•\-\u2022*]\s*)?(?:FOR[ÇC]A|HIPERTROFIA)\b/i, color:'#F97316', emoji:'🟠', label:'FORÇA', strength:true },
    { re: /^(?:[•\-\u2022*]\s*)?POWER\b/i, color:'#F97316', emoji:'🟠', label:'POWER', strength:true },
    { re: /^(?:[•\-\u2022*]\s*)?(?:ESD|CONDITIONING|CONDICIONAMENTO)\b/i, color:'#22C55E', emoji:'🟢', label:'ESD', strength:false }
  ];

  function matchBlock(raw) {
    const c = stripMd(String(raw || '')).replace(/^[•\-\u2022*]\s*/, '').trim();
    for (const b of BLOCKS) if (b.re.test(c)) return b;
    return null;
  }

  // ── Segment text into blocks ───────────────────────────────────────────────
  const segments = [];
  let cur = null;
  for (const raw of normalizedConteudo.split('\n')) {
    const def = matchBlock(raw);
    if (def) {
      if (cur) segments.push(cur);
      const clean = stripMd(raw);
      const dur   = (clean.match(/\(([^)]+)\)/) || [])[1] || null;
      cur = { def, duration: dur, lines: [] };
    } else if (cur) {
      cur.lines.push(raw);
    }
  }
  if (cur) segments.push(cur);

  console.log('[renderWorkoutBlocks] segments encontrados:', segments.length, segments.map(s => s.def.label));
  if (!segments.length) {
    return `<div class="wb-fallback">${_esc(conteudo)}</div>`;
  }

  // ── Saved loads from localStorage ─────────────────────────────────────────
  const cargas = JSON.parse(localStorage.getItem('axisai_cargas') || '{}');

  // ── Parse "3 séries × 8" → { count:3, reps:8 } ────────────────────────────
  function parseSeries(setsStr) {
    if (!setsStr) return { count: 3, reps: 1 };
    const byX = setsStr.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (byX) return { count: parseInt(byX[1]), reps: parseInt(byX[2]) };
    const bySer = setsStr.match(/^(\d+)\s*(?:séries?|sets?)/i);
    if (bySer) {
      const repM = setsStr.match(/[x×]\s*(\d+)/i) || setsStr.match(/(\d+)\s*rep/i);
      return { count: parseInt(bySer[1]), reps: repM ? parseInt(repM[1]) : 1 };
    }
    return { count: 3, reps: 1 };
  }

  // ── Split exercise body into name + prescription ───────────────────────────
  function splitEx(body) {
    const sep = body.match(/^(.*?)\s*[-—·]\s*(\d.*)$/);
    if (sep) return { name: sep[1].trim(), sets: sep[2].trim() };
    const end = body.match(/^(.*)\s+(\d+[x×]\d*|\d+\s*(?:séries?|sets?|rep[s.]?|min|seg))$/i);
    if (end) return { name: end[1].trim(), sets: end[2].trim() };
    return { name: body, sets: null };
  }

  // ── Global exercise index (persists across block renders) ──────────────────
  let exIdx = 0;

  // ── Render exercise mini-card (CHANGE 1 + 2) ──────────────────────────────
  function renderExCard(rawPrefix, exName, exSets, isStrength) {
    const thisIdx   = exIdx++;
    const isCode    = /^[A-Z]\d*$/.test(rawPrefix);  // A1, B2, A — not • or -
    const { count: numSeries, reps } = parseSeries(exSets);

    const labelHtml = isCode
      ? `<span class="exercise-label">${_esc(rawPrefix)}</span>`
      : '';

    if (isStrength) {
      // ── Strength: show per-série load inputs ────────────────────────────
      let setRows = '';
      for (let s = 1; s <= numSeries; s++) {
        const loadKey  = `${treinoId}_ex${thisIdx}_s${s}`;
        const checkKey = `${treinoId}_ex${thisIdx}_s${s}_done`;
        const savedVal = cargas[loadKey] !== undefined ? String(cargas[loadKey]) : '';
        const checked  = cargas[checkKey] ? 'checked' : '';
        setRows +=
          `<div class="load-row">` +
            `<span class="serie-label">Série ${s}</span>` +
            `<input type="number" class="load-input" placeholder="kg" value="${_esc(savedVal)}" ` +
              `data-reps="${reps}" ` +
              `oninput="saveLoadInput(${treinoId},${thisIdx},${s},this.value)">` +
            `<label class="load-check-label">` +
              `<input type="checkbox" class="load-check" ${checked} ` +
                `onchange="saveLoadCheck(${treinoId},${thisIdx},${s},this.checked)"> Concluída` +
            `</label>` +
          `</div>`;
      }
      return (
        `<div class="exercise-card">` +
          `<div class="exercise-header with-sets">` +
            labelHtml +
            `<div class="exercise-info">` +
              `<div class="exercise-name">${_esc(exName)}</div>` +
              (exSets ? `<div class="exercise-meta">${_esc(exSets)}</div>` : '') +
            `</div>` +
          `</div>` +
          `<div class="exercise-sets">${setRows}</div>` +
        `</div>`
      );
    } else {
      // ── Simple: no load inputs (PILLAR PREP / ESD) ─────────────────────
      return (
        `<div class="exercise-card exercise-card-simple">` +
          `<div class="exercise-header">` +
            labelHtml +
            `<div class="exercise-info">` +
              `<div class="exercise-name">${_esc(exName)}</div>` +
              (exSets ? `<div class="exercise-meta">${_esc(exSets)}</div>` : '') +
            `</div>` +
          `</div>` +
        `</div>`
      );
    }
  }

  // ── Render lines of one block ──────────────────────────────────────────────
  function renderLines(lines, isStrength) {
    let out    = '';
    let curSub = null;
    let subBuf = [];

    function flushSub() {
      if (!subBuf.length && curSub === null) return;
      if (curSub !== null) {
        out += `<div class="wb-subsection">`;
        out += `<div class="wb-sub-label">${_esc(curSub.toUpperCase())}</div>`;
        subBuf.forEach(l => out += l);
        out += `</div>`;
      } else {
        subBuf.forEach(l => out += l);
      }
      curSub = null;
      subBuf = [];
    }

    for (const rawLine of lines) {
      const line  = rawLine.trim();
      if (!line || /^[-=]{3,}$/.test(line)) continue;
      const clean = stripMd(line);
      if (!clean) continue;
      if (matchBlock(line)) continue;

      // ── 1. Rest intervals (CHANGE 3) — centered badge ────────────────────
      const isRest = /descanso|REST\b|entre\s+(?:séries|exerc|set)|⏱/i.test(clean);
      if (isRest) {
        const label = clean.replace(/^[*_⏱\s]+/, '').replace(/⏱/g, '').trim();
        subBuf.push(`<div class="wb-rest-wrap"><div class="wb-rest">⏱ ${_esc(label)}</div></div>`);
        continue;
      }

      // ── 2a. Pillar Prep inline group: "Foam Rolling (2min): ex1, ex2, ..." ──
      const pillarGroup = !isStrength && clean.match(/^(Foam\s+Rolling|Mobilidade|Ativa[çc]\w*|Aquecimento|Din[âa]mico|Alongamento|Cool\s*Down)[^:]*:\s*(.+)/i);
      if (pillarGroup) {
        flushSub();
        const secName = pillarGroup[1];
        const timeM   = clean.match(/\(([^)]+)\)/);
        const timeStr = timeM ? ` · ${timeM[1]}` : '';
        const exItems = pillarGroup[2].split(/,\s*/).map(s => s.trim().replace(/\.$/, '')).filter(Boolean);
        let grp = `<div class="pillar-group">`;
        grp += `<div class="pillar-group-label">${_esc(secName)}${_esc(timeStr)}</div>`;
        grp += `<div class="pillar-ex-list">`;
        exItems.forEach(ex => {
          const m    = ex.match(/^(.*?)\s+(\d+.+)$/);
          const name = m ? m[1].trim() : ex;
          const pres = m ? m[2].trim() : null;
          grp += `<div class="pillar-ex-card">`;
          grp += `<span class="pillar-ex-name">${_esc(name)}</span>`;
          if (pres) grp += `<span class="pillar-ex-sets">${_esc(pres)}</span>`;
          grp += `</div>`;
        });
        grp += `</div></div>`;
        subBuf.push(grp);
        continue;
      }

      // ── 2b. Sub-section header ────────────────────────────────────────────
      const isBoldOnly = /^\*\*[^*]+\*\*\s*$/.test(line.trim());
      const isKnownSub = /^(Foam Rolling|Mobilidade|Ativa[çc]|Aquecimento|Din[âa]mico|Tri.?[Ss]et|Straight Set|Bloco|Circuito|Finaliza|Cool|Alongamento)/i.test(clean);
      if (isBoldOnly || isKnownSub) {
        flushSub();
        curSub = clean.replace(/\(.*?\)/g, '').trim();
        continue;
      }

      // ── 3. Exercise line → mini-card (CHANGE 1 + 2) ──────────────────────
      const exMatch = clean.match(/^([A-Z]\d+\.?\s*|[A-Z][.)]\s+|\d+[.)]\s+|[•·\-*]\s+)(.*)/);
      if (exMatch) {
        const rawPrefix = exMatch[1].trim().replace(/[.)]\s*$/, '');
        const body      = exMatch[2].replace(/\*\*/g, '').trim();
        const { name: exName, sets: exSets } = splitEx(body);
        subBuf.push(renderExCard(rawPrefix, exName, exSets, isStrength));
        continue;
      }

      // ── 4. Plain note ─────────────────────────────────────────────────────
      subBuf.push(`<div class="wb-note">${_esc(clean)}</div>`);
    }
    flushSub();
    return out;
  }

  // ── Assemble ───────────────────────────────────────────────────────────────
  let html = '<div class="workout-blocks">';
  segments.forEach(({ def, duration, lines }) => {
    const durLabel   = duration ? ` · ${duration}` : '';
    const isStrength = def.strength;

    html += `<div class="wb-card">`;
    html +=   `<div class="wb-card-header" style="border-left-color:${def.color};background:${def.color}18;">`;
    html +=     `<span class="wb-block-emoji">${def.emoji}</span>`;
    html +=     `<span class="wb-block-name">${def.label}</span>`;
    html +=     `<span class="wb-block-dur">${_esc(durLabel)}</span>`;
    html +=   `</div>`;

    if (isStrength) {
      // ── Parse exercises for per-exercise tab UI ──────────────────────────
      const tabExs = [];
      for (const rawLine of lines) {
        const line  = rawLine.trim();
        if (!line) continue;
        const clean = stripMd(line);
        if (!clean || matchBlock(rawLine)) continue;

        // TRI-SET format: "TRI-SET A (3 séries): A1 Ex 8 reps, A2 Ex 10 reps ... Descanso ..."
        const tsHead = clean.match(/^(TRI.?SET\s+[A-Z])\s*\((\d+)\s*s[eé]ries?\):\s*(.*)/i);
        if (tsHead) {
          const groupName = tsHead[1];
          const numSeries = parseInt(tsHead[2]) || 3;
          let rem = tsHead[3];
          const restM = rem.match(/[.\s]+Descanso\s+(.*)$/i);
          const restText = restM ? restM[1].trim() : null;
          if (restM) rem = rem.slice(0, restM.index).trim();
          rem.split(/,\s*(?=[A-Z]\d+\s)/).forEach(p => {
            const m = p.trim().match(/^([A-Z]\d+)\s+(.*)/);
            if (!m) return;
            const code = m[1];
            const body = m[2].trim();
            const { name: exName, sets: setsLabel } = splitEx(body);
            const reps = parseInt((setsLabel || body).match(/(\d+)/)?.[1]) || 1;
            tabExs.push({ code, name: exName, setsLabel: setsLabel, numSeries, reps, group: groupName, restText });
          });
          continue;
        }

        // Straight-set line: "1. Squat 4x8" or "A1 Squat 4x8"
        const exM = clean.match(/^([A-Z]\d+\.?\s*|[A-Z][.)]\s+|\d+[.)]\s+)(.*)/);
        if (exM) {
          const code = exM[1].trim().replace(/[.)]\s*$/, '');
          const body = exM[2].replace(/\*\*/g, '').trim();
          const { name: exName, sets: setsLabel } = splitEx(body);
          const { count: numSeries, reps } = parseSeries(setsLabel);
          tabExs.push({ code, name: exName, setsLabel, numSeries, reps, group: null, restText: null });
        }
      }

      if (tabExs.length > 0) {
        // ── Build tab bar + panels ─────────────────────────────────────────
        let tabBar = '<div class="wb-tab-bar">';
        let panels = '';
        tabExs.forEach((ex, i) => {
          const thisIdx = exIdx++;
          const panelId = `wp-${treinoId}-${thisIdx}`;
          const isFirst = i === 0;
          tabBar += `<button class="wb-tab-btn${isFirst ? ' active' : ''}" ` +
            `data-panel="${panelId}" ` +
            `onclick="event.stopPropagation();switchExTab(${treinoId},'${panelId}')">` +
            `${_esc(ex.code)}</button>`;
          let setRows = '';
          for (let s = 1; s <= ex.numSeries; s++) {
            const loadKey  = `${treinoId}_ex${thisIdx}_s${s}`;
            const checkKey = `${treinoId}_ex${thisIdx}_s${s}_done`;
            const savedVal = cargas[loadKey] !== undefined ? String(cargas[loadKey]) : '';
            const checked  = cargas[checkKey] ? 'checked' : '';
            setRows += `<div class="load-row">` +
              `<span class="serie-label">Série ${s}</span>` +
              `<input type="number" class="load-input" placeholder="kg" value="${_esc(savedVal)}" ` +
                `data-reps="${ex.reps}" ` +
                `oninput="saveLoadInput(${treinoId},${thisIdx},${s},this.value)">` +
              `<label class="load-check-label">` +
                `<input type="checkbox" class="load-check" ${checked} ` +
                  `onchange="saveLoadCheck(${treinoId},${thisIdx},${s},this.checked)"> Concluída` +
              `</label>` +
            `</div>`;
          }
          const groupLabel = ex.group ? `<div class="wb-tab-group-label">${_esc(ex.group)}</div>` : '';
          const restNote   = ex.restText
            ? `<div class="wb-rest-wrap"><div class="wb-rest">⏱ ${_esc(ex.restText)}</div></div>`
            : '';
          panels += `<div class="wb-tab-panel${isFirst ? ' active' : ''}" id="${panelId}"${isFirst ? '' : ' style="display:none"'}>` +
            groupLabel +
            `<div class="exercise-card">` +
              `<div class="exercise-header with-sets">` +
                `<span class="exercise-label">${_esc(ex.code)}</span>` +
                `<div class="exercise-info">` +
                  `<div class="exercise-name">${_esc(ex.name)}</div>` +
                  (ex.setsLabel ? `<div class="exercise-meta">${_esc(ex.setsLabel)}</div>` : '') +
                `</div>` +
              `</div>` +
              `<div class="exercise-sets">${setRows}</div>` +
            `</div>` +
            restNote +
          `</div>`;
        });
        tabBar += '</div>';
        html += `<div class="wb-card-body" data-vol-block="${treinoId}">` +
          tabBar + panels +
          `<div class="wb-vol-total">Carga total da sessão: <span class="wb-vol-value">0</span> kg</div>` +
        `</div>`;
      } else {
        // Fallback: flat render
        const bodyContent = renderLines(lines, true);
        html += `<div class="wb-card-body" data-vol-block="${treinoId}">` +
          bodyContent +
          `<div class="wb-vol-total">Carga total da sessão: <span class="wb-vol-value">0</span> kg</div>` +
        `</div>`;
      }
    } else {
      const bodyContent = renderLines(lines, false);
      html += `<div class="wb-card-body">${bodyContent}</div>`;
    }

    html += `</div>`;
  });

  // Footer
  html += `<div class="wb-footer">`;
  if (isDone) {
    html += `<button class="btn-complete-session" disabled>✓ Sessão Concluída</button>`;
  } else {
    html += `<button class="btn-complete-session" onclick="event.stopPropagation();completarTreinoIA(${treinoId})">✓ Concluir Sessão</button>`;
  }
  if (!isDone) html += `<button class="btn-start-session" onclick="event.stopPropagation();startSessionById(${treinoId},this)">▶ Iniciar Treino</button>`;
  html += `</div>`;
  html += '</div>';

  // Init volume display after DOM settles
  setTimeout(() => updateVolumeTotal(treinoId), 60);
  return html;
}

// ── Mark a treinoIA session as completed ───────────────────────────────────
async function completarTreinoIA(id) {
  try {
    const treinos = loadTreinosIA();
    const t = treinos.find(x => x.id === id);
    if (!t) return;

    // ── Collect load data from localStorage ───────────────────────────────────
    const allCargas = JSON.parse(localStorage.getItem('axisai_cargas') || '{}');
    const prefix    = `${id}_`;
    const loadData  = {};
    Object.entries(allCargas).forEach(([k, v]) => {
      if (k.startsWith(prefix)) loadData[k.slice(prefix.length)] = v;
    });

    // ── Read live volume from DOM (if card currently expanded) ────────────────
    let totalVolume = 0;
    const volBlock = document.querySelector(`[data-vol-block="${id}"]`);
    if (volBlock) {
      volBlock.querySelectorAll('.load-input').forEach(inp => {
        totalVolume += (parseFloat(inp.value) || 0) * (parseInt(inp.dataset.reps) || 1);
      });
    }

    t.concluida   = true;
    t.completed   = true;
    t.completedAt = new Date().toISOString();
    const treinosKey = getTreinosKey();
    if (treinosKey) localStorage.setItem(treinosKey, JSON.stringify(treinos));

    // ── Store for AI context (coach can reference total volume next session) ───
    state.lastSessionLoads = { treinoId: id, loads: loadData, totalVolume };

    if (state.user?.id) {
      supabase.from('workouts')
        .update({ concluida: true, load_data: loadData })
        .eq('id', id)
        .eq('user_id', state.user.id)
        .then(({ error }) => { if (error) console.warn('completarTreinoIA:', error); });
    }
    renderWorkouts();
    refreshDashboard();
    showToast('Sessão concluída! 💪');
  } catch(e) { _logError('completarTreinoIA', e); }
}

// ═══════════════════════════════════════════════
//  SESSION EXECUTION FLOW
// ═══════════════════════════════════════════════
let _activeTimer     = null;
let _sessionElapsed  = 0;
let _sessionContext  = null; // { workoutId, title, startedAt, card }
let _sessionState = {
  blocosSession: [],
  blocoAtualIdx: 0,
  exercicioAtualIdx: 0,
  setAtual: 1,
  modoDescanso: false,
  tempoDescanso: 0,
  tempoTotal: 0,
  aguardandoDescanso: false,
  descansoConcluido: false
};

function _formatClock(totalSeconds) {
  const sec = Math.max(0, parseInt(totalSeconds || 0, 10));
  const min = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${min}:${s}`;
}

function _resetSessionState() {
  _sessionState = {
    blocosSession: [],
    blocoAtualIdx: 0,
    exercicioAtualIdx: 0,
    setAtual: 1,
    modoDescanso: false,
    tempoDescanso: 0,
    tempoTotal: 0,
    aguardandoDescanso: false,
    descansoConcluido: false,
    checkedItems: {},
    cargasRegistradas: {}
  };
}

function _parseDescansoSegundos(texto) {
  const src = String(texto || '');
  const minMatch = src.match(/(\d+)\s*min/i);
  if (minMatch) return parseInt(minMatch[1], 10) * 60;
  const secMatch = src.match(/(\d+)\s*s\b/i);
  if (secMatch) return parseInt(secMatch[1], 10);
  return 60;
}

function _parseExerciseLine(rawLine, fallbackId = '') {
  if (!rawLine) return null;
  const clean = String(rawLine)
    .replace(/[–—]/g, '-')
    .replace(/^[•\-\u2022]\s*/, '')
    .trim();

  if (!clean) return null;

  const buildExercise = (idValue, nomeValue, prescricaoValue) => {
    const parseBase = String(prescricaoValue || '').trim();
    const setsMatch = parseBase.match(/(\d+)\s*x\s*([^\s-]+)/i);
    return {
      id: String(idValue || fallbackId || '').toUpperCase(),
      nome: String(nomeValue || '').trim(),
      prescricao: parseBase,
      setsTotal: setsMatch ? parseInt(setsMatch[1], 10) : 3,
      repsPrescricao: setsMatch ? setsMatch[2] : '',
      descansoSegundos: _parseDescansoSegundos(parseBase || clean)
    };
  };

  const explicitLegacy = clean.match(/^([A-Z]+\d*)\)\s+(.+?)\s+-\s+(\d+x[\w\/]+)\s+-\s+(\d+s|\d+min)\b/i);
  if (explicitLegacy) {
    return buildExercise(explicitLegacy[1], explicitLegacy[2], `${explicitLegacy[3]} - ${explicitLegacy[4]}`);
  }

  const withId = clean.match(/^([A-Z]+\d*)\)\s*(.+)$/i);
  if (withId) {
    const id = withId[1];
    const body = withId[2].trim();
    const parts = body.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const nome = parts.shift();
      return buildExercise(id, nome, parts.join(' - '));
    }
    const compact = body.match(/^(.+?)\s+(\d+x[\w\/]+)(?:\s*-\s*(\d+s|\d+min))?$/i);
    if (compact) {
      return buildExercise(id, compact[1], compact[3] ? `${compact[2]} - ${compact[3]}` : compact[2]);
    }
    return buildExercise(id, body, '');
  }

  const withoutId = clean.match(/^(.+?)\s+-\s+(\d+x[\w\/]+)\s+-\s+(\d+s|\d+min)\b/i);
  if (withoutId) {
    return buildExercise('', withoutId[1], `${withoutId[2]} - ${withoutId[3]}`);
  }

  const withoutIdNoRest = clean.match(/^(.+?)\s+-\s+(\d+x[\w\/]+)\b/i);
  if (withoutIdNoRest) {
    return buildExercise('', withoutIdNoRest[1], withoutIdNoRest[2]);
  }

  const compactNoDash = clean.match(/^(.+?)\s+(\d+x[\w\/]+)(?:\s*-\s*(\d+s|\d+min))?$/i);
  if (compactNoDash) {
    return buildExercise('', compactNoDash[1], compactNoDash[3] ? `${compactNoDash[2]} - ${compactNoDash[3]}` : compactNoDash[2]);
  }

  return null;
}

function _blockExercisePrefix(bloco) {
  if (bloco === 'STRENGTH POD 1') return 'A';
  if (bloco === 'STRENGTH POD 2') return 'B';
  if (bloco === 'HEAVY POWER') return 'HP';
  return 'P';
}

function _parseExerciseEntries(rawLine, bloco, currentCount = 0) {
  if (!rawLine) return [];
  const line = String(rawLine).trim();
  if (!line) return [];

  const setsHits = line.match(/\d+\s*x\s*[\w\/]+/gi) || [];
  const shouldSplitByPlus = line.includes('+') && setsHits.length >= 2;
  const chunks = shouldSplitByPlus
    ? line.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean)
    : [line];

  const prefix = _blockExercisePrefix(bloco);
  let next = currentCount + 1;
  const parsed = [];

  for (const chunk of chunks) {
    const ex = _parseExerciseLine(chunk, `${prefix}${next}`);
    if (!ex) continue;
    if (!ex.id) ex.id = `${prefix}${next}`;
    parsed.push(ex);
    next += 1;
  }

  return parsed;
}

function findColonOutsideParens(str) {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') depth--;
    else if (str[i] === ':' && depth === 0) return i;
  }
  return -1;
}

function parseConteudoBlocos(conteudo) {
  if (!conteudo) return [];

  const normalized = String(conteudo).trim();
  if (!normalized) return [];

  // Formato legado: blocos separados por "|"
  if (normalized.includes('|')) {
    return normalized
      .split('|')
      .map(b => b.trim())
      .filter(Boolean)
      .map(b => {
        const colonIdx = findColonOutsideParens(b);
        return colonIdx > -1
          ? { nome: b.substring(0, colonIdx).trim(), exercicios: b.substring(colonIdx + 1).trim() }
          : { nome: b.trim(), exercicios: '' };
      });
  }

  // Formato legado: blocos separados por quebra de linha
  if (normalized.includes('\n')) {
    return normalized
      .split('\n')
      .map(b => b.trim())
      .filter(Boolean)
      .map(b => {
        const colonIdx = findColonOutsideParens(b);
        return colonIdx > -1
          ? { nome: b.substring(0, colonIdx).trim(), exercicios: b.substring(colonIdx + 1).trim() }
          : { nome: b.trim(), exercicios: '' };
      });
  }

  const BLOCK_PREFIXES = [
    'FOAM ROLL',
    'PILLAR PREP',
    'WARM-UP',
    'DYNAMIC WARM',
    'LIGHT POWER',
    'HEAVY POWER',
    'STRENGTH POD 1',
    'STRENGTH POD 2',
    'STRENGTH POD 3',
    'POD',
    'POD ÚNICO',
    'FORÇA REGENERATIVA',
    'FORÇA EXPLOSIVA',
    'ESD'
  ];

  const positions = [];
  BLOCK_PREFIXES.forEach(prefix => {
    const idx = normalized.indexOf(prefix);
    if (idx !== -1) positions.push({ idx, prefix });
  });

  positions.sort((a, b) => a.idx - b.idx);

  if (positions.length === 0) {
    return [{ nome: 'TREINO', exercicios: normalized }];
  }

  return positions.map((pos, i) => {
    const start = pos.idx;
    const end = i < positions.length - 1 ? positions[i + 1].idx : normalized.length;
    const block = normalized.substring(start, end).trim();
    const colonIdx = findColonOutsideParens(block);
    return colonIdx > -1
      ? { nome: block.substring(0, colonIdx).trim(), exercicios: block.substring(colonIdx + 1).trim() }
      : { nome: block.trim(), exercicios: '' };
  });
}

function parseTreino(conteudo) {
  const original = String(conteudo || '').trim();
  console.log('[parseTreino] RAW conteudo:', JSON.stringify(original).slice(0, 600));
  if (!original) {
    return [{ bloco: 'TREINO', tipo: 'warmup', navegavel: false, descricao: '', exercicios: [] }];
  }

  let normalizedSource = original;
  if (!normalizedSource.includes('\n') && normalizedSource.includes('|')) {
    normalizedSource = normalizedSource.split('|').map(s => s.trim()).join('\n');
  }

  const normalized = normalizedSource
    .replace(/\r\n?/g, '\n')
    .replace(/[–—]/g, '-')
    .replace(/\s+\|\s+/g, '\n')
    .replace(/\n{2,}/g, '\n');

  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const blocks = [];
  let current = null;

  const fallback = [{ bloco: 'TREINO', tipo: 'warmup', navegavel: false, descricao: original, exercicios: [] }];

  const DEFAULT_FOAM_AREAS = [
    { nome: 'Glúteos', tempo: '60s cada lado' },
    { nome: 'IT Band / Posterior de Coxa', tempo: '60s cada lado' },
    { nome: 'Quadríceps', tempo: '45s cada lado' },
    { nome: 'Panturrilha', tempo: '45s cada lado' },
    { nome: 'Coluna Torácica', tempo: '60s' }
  ];

  const DEFAULT_PILLAR_EXERCICIOS = [
    { nome: '90/90 Hip Rotation', prescricao: '5 reps/lado' },
    { nome: 'Spiderman + Rotation', prescricao: '5 reps/lado' },
    { nome: 'T-Spine Rotation', prescricao: '6 reps/lado' },
    { nome: 'Ankle Mob', prescricao: '8 reps/lado' },
    { nome: 'Respiração PRI', prescricao: '5 ciclos' },
    { nome: 'Floor Slides', prescricao: '2x10' },
    { nome: 'Leg Lowering', prescricao: '2x8/lado' },
    { nome: 'Cook Hip Lift', prescricao: '2x8/lado' },
    { nome: 'Mini-Band Walk', prescricao: '2x10 passos' },
    { nome: 'Plank Hold', prescricao: '2x20s' }
  ];

  const DEFAULT_WARMUP_EXERCICIOS = [
    { nome: 'Squat Matrix', prescricao: '5 reps cada direção' },
    { nome: 'Knee Hug to Lunge', prescricao: '5/lado' },
    { nome: 'Skip A', prescricao: '2x10m' },
    { nome: 'Lateral Shuffle', prescricao: '2x10m' },
    { nome: 'Carioca', prescricao: '2x10m' },
    { nome: 'Bear Crawl', prescricao: '2x10m' }
  ];

  const extractDuration = (line) => {
    const m = line.match(/\(([^)]*min[^)]*)\)/i);
    return m ? m[1].trim() : '';
  };

  const extractAfterColon = (line) => {
    const idx = line.indexOf(':');
    return idx >= 0 ? line.slice(idx + 1).trim() : '';
  };

  const isBulletLine = (line) => /^[-•\u2022]/.test(line);

  const parseBulletItem = (line) => {
    const clean = line.replace(/^[-•\u2022]\s*/, '').trim();
    const colonIdx = clean.indexOf(':');
    if (colonIdx > 0) {
      return { nome: clean.slice(0, colonIdx).trim(), valor: clean.slice(colonIdx + 1).trim() };
    }
    return { nome: clean, valor: '' };
  };

  const generateSets = (setsTotal) =>
    Array.from({ length: Math.max(1, setsTotal) }, (_, i) => ({
      setNum: i + 1,
      carga: null,
      concluido: false
    }));

  const createBlock = (bloco, tipo, navegavel, duracao = '', descricao = '') => {
    const base = { bloco, tipo, duracao, navegavel, descricao: descricao || '', exercicios: [] };
    if (tipo === 'foam_roll') base.areas = [];
    if (tipo === 'conditioning') base.itens = [];
    return base;
  };

  const flushCurrent = () => {
    if (!current) return;
    if (!Array.isArray(current.exercicios)) current.exercicios = [];

    // Apply defaults for prep blocks with no parsed items
    if (current.tipo === 'foam_roll' && current.areas && current.areas.length === 0) {
      current.areas = DEFAULT_FOAM_AREAS.slice();
    }
    if (current.tipo === 'pillar_prep' && current.exercicios.length === 0) {
      current.exercicios = DEFAULT_PILLAR_EXERCICIOS.slice();
    }
    if (current.tipo === 'warm_up' && current.exercicios.length === 0) {
      current.exercicios = DEFAULT_WARMUP_EXERCICIOS.slice();
    }

    blocks.push(current);
    current = null;
  };

  const detectHeader = (line) => {
    const upper = line.toUpperCase();
    const duracao = extractDuration(line);
    const descricao = extractAfterColon(line);

    if (/^FOAM\s*ROLL\b/i.test(line)) {
      // BUG-1 FIX: capture inline content after header+duration
      const frInline = line
        .replace(/^FOAM\s*ROLL\b/i, '')
        .replace(/\([^)]*\)/, '')
        .replace(/^[:\s]*/, '')
        .trim();
      return { bloco: 'FOAM ROLL', tipo: 'foam_roll', navegavel: false, duracao, descricao: '', inlineContent: frInline || '' };
    }

    if (/^PILLAR\s*PREP\b/i.test(line)) {
      const legacyExpand = /FOAM\s*ROLL\s*\+\s*MOBILIDADE\s*\+\s*ATIVA(?:Ç|C)[AÃ]O\s*\+\s*DIN[ÂA]MICO/i.test(upper);
      // BUG-1 FIX: capture inline subcategory content (e.g. "PILLAR PREP (10min) Foam Roll: glúteo/...")
      const inlineRemainder = line
        .replace(/^PILLAR\s*PREP\b/i, '')
        .replace(/\([^)]*\)/, '')      // strip duration "(10min)"
        .replace(/^[:\s]*/, '')
        .trim();
      return { bloco: 'PILLAR PREP', tipo: 'pillar_prep', navegavel: false, duracao, descricao: '', legacyExpand, inlineContent: inlineRemainder || '' };
    }

    if (/^WARM[\s-]*UP\b/i.test(line)) {
      const wuInline = line
        .replace(/^WARM[\s-]*UP\b/i, '')
        .replace(/\([^)]*\)/, '')
        .replace(/^[:\s]*/, '')
        .trim();
      return { bloco: 'WARM-UP', tipo: 'warm_up', navegavel: false, duracao, descricao: '', inlineContent: wuInline || '' };
    }

    if (/^HEAVY\s*POWER\b/i.test(line)) {
      return { bloco: 'HEAVY POWER', tipo: 'power', navegavel: true, duracao, descricao };
    }

    if (/^POWER\b/i.test(line) && !/^HEAVY\s*POWER\b/i.test(line)) {
      return { bloco: 'POWER', tipo: 'power', navegavel: true, duracao, descricao };
    }

    if (/^STRENGTH\s*POD\s*1\b/i.test(line) || /^POD\s*1\b/i.test(line)) {
      return { bloco: 'STRENGTH POD 1', tipo: 'strength', navegavel: true, duracao, descricao };
    }

    if (/^STRENGTH\s*POD\s*2\b/i.test(line) || /^POD\s*2\b/i.test(line)) {
      return { bloco: 'STRENGTH POD 2', tipo: 'strength', navegavel: true, duracao, descricao };
    }

    if (/^POD\s*3\b/i.test(line)) {
      return { bloco: 'STRENGTH POD 2', tipo: 'strength', navegavel: true, duracao, descricao, mergePod2: true };
    }

    if (/^(ESD|CONDITIONING)\b/i.test(line)) {
      return { bloco: 'ESD', tipo: 'conditioning', navegavel: false, duracao, descricao };
    }

    return null;
  };

  for (const lineRaw of lines) {
    const line = lineRaw.replace(/^[•\u2022]\s*/, '').trim();
    const header = detectHeader(line);

    if (header) {
      if (header.legacyExpand) {
        flushCurrent();
        const fr = createBlock('FOAM ROLL', 'foam_roll', false, '3min', '');
        fr.areas = DEFAULT_FOAM_AREAS.slice();
        blocks.push(fr);
        const pp = createBlock('PILLAR PREP', 'pillar_prep', false, header.duracao || '', '');
        pp.exercicios = DEFAULT_PILLAR_EXERCICIOS.slice();
        blocks.push(pp);
        const wu = createBlock('WARM-UP', 'warm_up', false, '5min', '');
        wu.exercicios = DEFAULT_WARMUP_EXERCICIOS.slice();
        blocks.push(wu);
        continue;
      }

      if (header.mergePod2) {
        if (current && current.bloco === 'STRENGTH POD 2') {
          if (header.descricao) {
            const exInline = _parseExerciseEntries(header.descricao, current.bloco, current.exercicios.length);
            if (exInline.length) {
              exInline.forEach(ex => { ex.sets = generateSets(ex.setsTotal); });
              current.exercicios.push(...exInline);
            }
          }
          continue;
        }

        flushCurrent();
        if (blocks.length && blocks[blocks.length - 1].bloco === 'STRENGTH POD 2') {
          current = blocks.pop();
          if (header.descricao) {
            const exInline = _parseExerciseEntries(header.descricao, current.bloco, current.exercicios.length);
            if (exInline.length) {
              exInline.forEach(ex => { ex.sets = generateSets(ex.setsTotal); });
              current.exercicios.push(...exInline);
            }
          }
          continue;
        }
      }

      // BUG-1 FIX: if current block is pillar_prep/warm_up and we detect a foam_roll sub-header,
      // treat it as a subcategory exercise instead of creating a separate block
      const isPrepBlock = current && (current.tipo === 'pillar_prep' || current.tipo === 'warm_up');
      if (isPrepBlock && header.tipo === 'foam_roll') {
        // "Foam Roll: glúteo/..." → subcategory of current prep block
        const subContent = header.inlineContent || '';
        current.exercicios.push({ nome: header.bloco, prescricao: subContent });
        console.log('[parseTreino] BUG-1 FIX: foam_roll absorbed into prep block:', header.bloco, subContent);
        continue;
      }

      flushCurrent();
      current = createBlock(header.bloco, header.tipo, header.navegavel, header.duracao, header.descricao || '');

      // BUG-1 FIX: parse inline subcategory content from prep block header line
      // e.g. "PILLAR PREP (10min) Foam Roll: glúteo/..." → inlineContent = "Foam Roll: glúteo/..."
      if (header.inlineContent && (current.tipo === 'pillar_prep' || current.tipo === 'warm_up' || current.tipo === 'foam_roll')) {
        const ic = header.inlineContent;
        const icColonIdx = ic.indexOf(':');
        if (icColonIdx > 0) {
          const subName = ic.slice(0, icColonIdx).trim();
          const subVal  = ic.slice(icColonIdx + 1).trim();
          if (current.tipo === 'foam_roll') {
            current.areas.push({ nome: subName || ic, tempo: subVal });
          } else {
            current.exercicios.push({ nome: subName, prescricao: subVal });
          }
        } else if (ic) {
          if (current.tipo === 'foam_roll') {
            current.areas.push({ nome: ic, tempo: '' });
          } else {
            current.exercicios.push({ nome: ic, prescricao: '' });
          }
        }
      }

      if (header.descricao && current.navegavel) {
        const exInline = _parseExerciseEntries(header.descricao, current.bloco, current.exercicios.length);
        if (exInline.length) {
          exInline.forEach(ex => { if (current.tipo === 'strength') ex.sets = generateSets(ex.setsTotal); });
          current.exercicios.push(...exInline);
          current.descricao = '';
        }
      }
      continue;
    }

    if (!current) continue;

    if (current.navegavel) {
      const ex = _parseExerciseEntries(line, current.bloco, current.exercicios.length);
      if (ex.length) {
        ex.forEach(e => { if (current.tipo === 'strength') e.sets = generateSets(e.setsTotal); });
        current.exercicios.push(...ex);
      } else {
        current.descricao = [current.descricao, line].filter(Boolean).join(' ');
      }
    } else if (current.tipo === 'foam_roll' && isBulletLine(lineRaw)) {
      const { nome, valor } = parseBulletItem(lineRaw);
      if (nome) current.areas.push({ nome, tempo: valor });
    } else if ((current.tipo === 'pillar_prep' || current.tipo === 'warm_up') && isBulletLine(lineRaw)) {
      const { nome, valor } = parseBulletItem(lineRaw);
      if (nome) current.exercicios.push({ nome, prescricao: valor });
    } else if ((current.tipo === 'pillar_prep' || current.tipo === 'warm_up') && !isBulletLine(lineRaw)) {
      // BUG-1 FIX: handle non-bullet subcategory lines like "Mobilidade: quadril + tornozelo + T-spine"
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < line.length - 1) {
        const subName = line.slice(0, colonIdx).trim();
        const subVal  = line.slice(colonIdx + 1).trim();
        current.exercicios.push({ nome: subName, prescricao: subVal });
        console.log('[parseTreino] BUG-1 FIX: non-bullet subcategory parsed:', subName, '→', subVal);
      } else {
        current.descricao = [current.descricao, line].filter(Boolean).join(' ');
      }
    } else if (current.tipo === 'foam_roll' && !isBulletLine(lineRaw)) {
      // BUG-1 FIX: handle non-bullet area lines within foam_roll blocks
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < line.length - 1) {
        current.areas.push({ nome: line.slice(0, colonIdx).trim(), tempo: line.slice(colonIdx + 1).trim() });
      } else {
        current.descricao = [current.descricao, line].filter(Boolean).join(' ');
      }
    } else if (current.tipo === 'conditioning' && isBulletLine(lineRaw)) {
      const { nome, valor } = parseBulletItem(lineRaw);
      if (nome) current.itens.push({ nome, prescricao: valor });
    } else {
      current.descricao = [current.descricao, line].filter(Boolean).join(' ');
    }
  }

  flushCurrent();

  if (!blocks.length) return fallback;
  return blocks;
}

function startSessionById(id, btn) {
  // BUG-2 FIX: detect persisted session and resume
  const persisted = _getPersistedSession();
  if (persisted && !persisted.finished && persisted.workoutId === String(id)) {
    if (_restoreInlineSession()) {
      showToast('Sessão retomada!', false);
      return;
    }
  }

  const treino = loadTreinosIA().find(t => t.id == id);
  if (!treino) { showToast('Treino não encontrado.', true); return; }
  const card = btn?.closest('.session-card') || null;
  _startInlineSession({
    workoutId: String(id),
    title: treino.titulo || 'Treino',
    conteudo: treino.conteudo || treino.content || '',
    card,
    source: 'ia',
    sourceIndex: null
  });
}

function startSessionByWorkout(idx, btn) {
  const w = state.workouts[idx];
  if (!w) { showToast('Treino não encontrado.', true); return; }

  // BUG-2 FIX: detect persisted session and resume
  const wId = String(w.id ?? idx);
  const persisted = _getPersistedSession();
  if (persisted && !persisted.finished && persisted.workoutId === wId) {
    if (_restoreInlineSession()) {
      showToast('Sessão retomada!', false);
      return;
    }
  }

  const card = btn?.closest('.session-card') || null;
  _startInlineSession({
    workoutId: wId,
    title: w.title || 'Treino',
    conteudo: w.conteudo || w.content || w.details || '',
    card,
    source: 'state',
    sourceIndex: idx
  });
}

function _detectBlockColor(name) {
  const upper = String(name || '').toUpperCase();
  if (/FOAM|ROLLING/.test(upper)) return '#AFA9EC';
  if (/PILLAR|PREP/.test(upper)) return '#39e07a';
  if (/POWER|LIGHT POWER/.test(upper)) return '#EF9F27';
  if (/STRENGTH\s*POD\s*1|POD\s*1/.test(upper)) return '#4A9EF5';
  if (/STRENGTH\s*POD\s*2|POD\s*2/.test(upper)) return '#7F77DD';
  if (/ESD|FINALIZADOR/.test(upper)) return '#5DCAA5';
  return 'rgba(255,255,255,0.3)';
}

function _blockNeedsLoads(name) {
  const upper = String(name || '').toUpperCase();
  if (/FOAM|PILLAR|PREP|ESD|FINALIZADOR|ROLLING/.test(upper)) return false;
  return /STRENGTH|POWER|POD|FORÇA|POTÊNCIA/.test(upper);
}

function _extractSetsCount(exText) {
  const match = String(exText).match(/(\d+)\s*[xX×]\s*[\d\/]/);
  if (match) return Math.min(parseInt(match[1], 10), 6);
  return 3;
}

function _extractExSpec(exText) {
  const match = String(exText).match(/(\d+\s*[xX×]\s*.+)$/);
  return match ? match[1].replace(/[xX]/, '×') : '';
}

function _extractExName(exText) {
  return String(exText).replace(/\s+\d+\s*[xX×]\s*.+$/, '').trim() || exText;
}

function _estimate1RM(loadKg, reps) {
  if (!loadKg || !reps || reps <= 0) return null;
  if (reps === 1) return loadKg;
  return Math.round(loadKg * (1 + reps / 30) * 10) / 10;
}

const BIG_ROCKS_PATTERNS = [
  { key: 'deadlift',  patterns: ['deadlift', 'terra', 'trap bar', 'trap-bar', 'barra reta', 'sldl bilateral'] },
  { key: 'squat',     patterns: ['squat', 'agachamento', 'goblet squat'] },
  { key: 'bench',     patterns: ['bench', 'supino', 'supino reto', 'press reto'] },
  { key: 'rfe_split', patterns: ['rfe', 'rfess', 'split squat búlgaro', 'bulgarian', 'rear foot'] },
  { key: 'chin_up',   patterns: ['chin', 'chin-up', 'chin up', 'barra fixa', 'pull-up ponderado', 'weighted chin'] },
];

function _isBigRock(exName) {
  const lower = String(exName || '').toLowerCase();
  return BIG_ROCKS_PATTERNS.find(br => br.patterns.some(p => lower.includes(p))) || null;
}

// Separa nome e detalhe de uma linha de exercício (ETAPA 2)
function _parseLineNameDetail(line) {
  var clean = String(line || '').trim().replace(/^[-•]\s*/, '');
  if (!clean) return { nome: '', detalhe: '' };
  // Separador: padrão de séries/tempo/lado
  var m = clean.search(/\d{1,2}\s*[x×]\s*\d|\d+\s*s\b|\d+\s*min\b|cada\s*lado|\/lado/i);
  if (m > 0) {
    return {
      nome: clean.slice(0, m).replace(/[\s\-–:@]+$/, '').trim(),
      detalhe: clean.slice(m).trim()
    };
  }
  // Fallback: separação por ' - ' ou ':'
  var dash = clean.split(/\s[-–]\s/);
  if (dash.length > 1) return { nome: dash[0].trim(), detalhe: dash.slice(1).join(' - ').trim() };
  var colon = clean.indexOf(':');
  if (colon > 0 && colon < clean.length - 1) return { nome: clean.slice(0, colon).trim(), detalhe: clean.slice(colon + 1).trim() };
  return { nome: clean, detalhe: '' };
}

function _parseExerciseFromLine(line, idx) {
  const clean = String(line || '').trim().replace(/^[-•]\s*/, '');
  if (!clean) {
    return {
      name: `Exercício ${idx + 1}`,
      spec: 'prescrição livre',
      sets: 3
    };
  }

  let name = clean;
  let spec = '';
  const srMatch = clean.match(/(\d{1,2}\s*[x×]\s*\d{1,3}.*)$/i);
  if (srMatch) {
    spec = srMatch[1].trim();
    name = clean.slice(0, clean.indexOf(srMatch[1])).replace(/[:\-–]\s*$/, '').trim() || clean;
  } else {
    const colonIdx = clean.indexOf(':');
    if (colonIdx > 0 && colonIdx < clean.length - 1) {
      name = clean.slice(0, colonIdx).trim();
      spec = clean.slice(colonIdx + 1).trim();
    } else {
      const dashParts = clean.split(/\s[-–]\s/);
      if (dashParts.length > 1) {
        name = dashParts[0].trim();
        spec = dashParts.slice(1).join(' - ').trim();
      }
    }
  }

  return {
    name: name || `Exercício ${idx + 1}`,
    spec: spec || 'prescrição livre',
    sets: _extractSetsCount(spec || clean)
  };
}

function _buildInlineBlocksFromContent(conteudo) {
  const parsed = _normalizePlanBlocks(conteudo);

  if (!parsed.length) {
    return [{
      name: 'BLOCO ÚNICO',
      color: 'rgba(255,255,255,0.3)',
      hasLoads: true,
      done: false,
      conteudo: conteudo || '',
      exercises: [{ name: 'Exercício', spec: '3 x 8', sets: 3 }]
    }];
  }

  return parsed.map((block, idx) => {
    const exercises = block.exercicios.length
      ? block.exercicios.map((line, exIdx) => _parseExerciseFromLine(line, exIdx))
      : [{ name: block.nome, spec: 'prescrição livre', sets: 3 }];
    // conteudo: exercicios separados por \n para rendering de mini cards
    const blockConteudo = block.exercicios.length
      ? block.exercicios.join('\n')
      : block.nome;
    return {
      name: block.nome || `Bloco ${idx + 1}`,
      color: _detectBlockColor(block.nome),
      hasLoads: _blockNeedsLoads(block.nome),
      done: false,
      conteudo: blockConteudo,
      exercises
    };
  });
}

function _startInlineSession({ workoutId, title, conteudo, card, source, sourceIndex }) {
  if (!card) {
    showToast('Card de treino não encontrado.', true);
    return;
  }

  if (_inlineSession && _inlineSession.workoutId !== String(workoutId) && !_inlineSession.finished) {
    showToast('Finalize a sessão atual antes de iniciar outro treino.', true);
    return;
  }
  if (_inlineSession && _inlineSession.workoutId === String(workoutId) && !_inlineSession.finished) {
    // BUG-2 FIX: re-bind DOM if session exists but DOM is stale
    if (_inlineSession.cardEl && _inlineSession.cardEl.isConnected) {
      showToast('Sessão já em andamento neste treino.', false);
      return;
    }
    // DOM was destroyed (tab switch) — allow re-creation
  }

  const cardDomId = card.id || _getWorkoutCardDomId(source, workoutId);
  const body = card.querySelector('.session-card-body');
  if (!body) {
    showToast('Não foi possível abrir a sessão neste card.', true);
    return;
  }

  _stopInlineSessionTimer();
  state.sessionLoads = {};

  const blocks = _buildInlineBlocksFromContent(conteudo);
  _inlineSession = {
    workoutId: String(workoutId),
    title: title || 'Treino',
    conteudo: conteudo || '',
    source: source || 'ia',
    sourceIndex: sourceIndex ?? null,
    cardDomId,
    cardEl: card,
    bodyEl: body,
    startedAtMs: Date.now(),
    startedAtIso: new Date().toISOString(),
    timerSecs: 0,
    blocks,
    finished: false
  };

  card.classList.add('session-active');
  body.classList.add('open');
  _renderInlineSessionBody();  // body.innerHTML setado ANTES da injeção do sticky bar
  _injectInlineTimer();        // prepend sticky bar DEPOIS — não será sobrescrito

  // BUG-2 FIX: persist session state
  _saveInlineSessionState();

  const startBtn = card.querySelector('.btn-start-session');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.style.opacity = '0.6';
    startBtn.textContent = 'Em andamento';
  }

  _inlineSessionTimer = setInterval(() => {
    if (!_inlineSession || _inlineSession.finished) return;
    _inlineSession.timerSecs += 1;
    const formatted = _formatClock(_inlineSession.timerSecs);
    // Atualizar header timer (legado, pode estar oculto)
    const timer = document.getElementById(`timer-${_inlineSession.cardDomId}`);
    if (timer) timer.textContent = formatted;
    // Atualizar sticky timer bar
    const stickyTimer = document.getElementById(`sticky-timer-${_inlineSession.cardDomId}`);
    if (stickyTimer) stickyTimer.textContent = formatted;
  }, 1000);

  // FE-002 / TASK 2 & 3: lookup supabase_id + criar session_log antecipado (async, não bloqueia UI)
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId || !_inlineSession) return;

      // Resolver UUID real do workout
      let realWorkoutId = String(workoutId);
      try {
        const { data: wkData, error: wkErr } = await supabase
          .from('workouts')
          .select('supabase_id')
          .eq('id', workoutId)
          .single();
        console.log('[FE-002] supabase_id lookup (_startInlineSession):', { workoutId, wkData, wkErr: wkErr?.message || null });
        if (wkData?.supabase_id) {
          // Caso normal: supabase_id já existe
          realWorkoutId = wkData.supabase_id;
        } else if (wkData && !wkErr) {
          // Row existe mas supabase_id é NULL (workout criado antes da migration 010)
          // Gerar UUID client-side e persistir na row
          const newUuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
          const { error: upErr } = await supabase
            .from('workouts')
            .update({ supabase_id: newUuid })
            .eq('id', workoutId);
          console.log('[FE-002] supabase_id gerado e salvo:', newUuid, 'upErr:', upErr?.message || null);
          if (!upErr) realWorkoutId = newUuid;
        } else if (wkErr) {
          console.warn('[FE-002] lookup error (_startInlineSession):', wkErr.message || wkErr);
        }
      } catch (e) {
        console.warn('[FE-002] lookup exception (_startInlineSession):', e?.message || e);
      }
      if (_inlineSession) _inlineSession.realWorkoutId = realWorkoutId;

      // Criar session_log antecipado para ter UUID disponível para exercise_logs
      const { data: slData, error: slErr } = await supabase
        .from('session_logs')
        .insert({
          user_id: userId,
          workout_id: realWorkoutId,
          started_at: _inlineSession?.startedAtIso || new Date().toISOString(),
          duration_seconds: 0
        })
        .select('id')
        .single();

      if (!slErr && slData?.id && _inlineSession) {
        _inlineSession.sessionLogId = slData.id;
        window.__activeSessionId = slData.id;
      }
    } catch (err) {
      console.warn('[_startInlineSession] early session_log:', err?.message || err);
    }
  })();
}

function _stopInlineSessionTimer() {
  if (_inlineSessionTimer) {
    clearInterval(_inlineSessionTimer);
    _inlineSessionTimer = null;
  }
}

function _injectInlineTimer() {
  if (!_inlineSession?.cardEl) return;

  // Ocultar o widget de timer que fica no header (evitar duplicação)
  const headerActions = _inlineSession.cardEl.querySelector('.session-card-actions');
  if (headerActions) {
    const oldWidget = headerActions.querySelector('.session-timer-widget');
    if (oldWidget) oldWidget.style.display = 'none';
  }

  // Injetar sticky timer bar no topo do body
  const body = _inlineSession.bodyEl;
  if (!body) return;
  body.querySelector('.sticky-timer-bar')?.remove();

  const wId = _escapeWorkoutHTML(_inlineSession.workoutId);
  const titleTrunc = (_inlineSession.title || 'Treino').slice(0, 32);
  const bar = document.createElement('div');
  bar.className = 'sticky-timer-bar';
  bar.innerHTML = `
    <span class="sticky-timer-clock" id="sticky-timer-${_inlineSession.cardDomId}">00:00</span>
    <span class="sticky-timer-name">${_escapeWorkoutHTML(titleTrunc)}</span>
    <button class="btn-sticky-finish"
      id="sticky-finish-btn-${_inlineSession.cardDomId}"
      onclick="finishSession('${wId}')"
      disabled>Concluir</button>
  `;
  body.insertBefore(bar, body.firstChild);
}

function _renderInlineSessionBody() {
  if (!_inlineSession?.bodyEl) return;
  const wId = _escapeWorkoutHTML(_inlineSession.workoutId);

  const blocksHtml = _inlineSession.blocks.map((block, blockIdx) => {
    const doneClass = block.done ? 'done collapsed' : '';
    const PREP_BLOCKS = ['FOAM ROLL','PILLAR PREP','WARM-UP','DYNAMIC WARM','MOBILIDADE','ATIVAÇÃO','DINÂMICO','AQUECIMENTO','ESD'];
    const nomeUpper = (block.name || '').toUpperCase();
    const isPrep = PREP_BLOCKS.some(p => nomeUpper.includes(p));

    // ETAPA 2 — mini cards com botão "ver"
    const exercisesHtml = (() => {
      const bConteudo = block.conteudo || '';
      const lines = bConteudo.split('\n').filter(function(l) { return l.trim() !== ''; });
      if (lines.length > 0) {
        return lines.map(function(line) {
          var pd = _parseLineNameDetail(line);
          var nomeEsc = _escapeWorkoutHTML(pd.nome);
          var detalheEsc = _escapeWorkoutHTML(pd.detalhe);
          var nomeJs = (pd.nome || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
          return '<div class="exercise-card">'
            + '<div class="exercise-info">'
            + '<div class="exercise-name">' + nomeEsc + '</div>'
            + (pd.detalhe ? '<div class="exercise-detail">' + detalheEsc + '</div>' : '')
            + '</div>'
            + '<button class="ver-btn" onclick="openExerciseModal(\'' + nomeJs + '\')">ver</button>'
            + '</div>';
        }).join('');
      }
      if (bConteudo) {
        return '<div style="white-space:pre-line;font-size:12px;color:#e0e0e0;padding:4px 0;">' + _escapeWorkoutHTML(bConteudo) + '</div>';
      }
      // fallback: exercises array
      return block.exercises.map(function(exercise) {
        var spec = exercise.spec && exercise.spec !== 'prescrição livre' ? exercise.spec : '';
        var nomeJs = (exercise.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
        return '<div class="exercise-card">'
          + '<div class="exercise-info">'
          + '<div class="exercise-name">' + _escapeWorkoutHTML(exercise.name) + '</div>'
          + (spec ? '<div class="exercise-detail">' + _escapeWorkoutHTML(spec) + '</div>' : '')
          + '</div>'
          + '<button class="ver-btn" onclick="openExerciseModal(\'' + nomeJs + '\')">ver</button>'
          + '</div>';
      }).join('');
    })();
    const exerciciosRaw = String(
      block.conteudo ||
      (Array.isArray(block.exercises)
        ? block.exercises.map(function(ex) {
            return [ex?.name || '', ex?.spec || ''].filter(Boolean).join(' ');
          }).join(' + ')
        : '')
    ).trim();
    let exLines = [];
    if (exerciciosRaw.includes('\n')) {
      exLines = exerciciosRaw.split('\n').map(l => l.trim()).filter(Boolean);
    } else if (exerciciosRaw.includes(' + ')) {
      exLines = exerciciosRaw.split(' + ').map(l => l.trim()).filter(Boolean);
    } else if (exerciciosRaw.includes(' · ')) {
      exLines = exerciciosRaw.split(' · ').map(l => l.trim()).filter(Boolean);
    } else if (exerciciosRaw.includes('|')) {
      exLines = exerciciosRaw.split('|').map(l => l.trim()).filter(Boolean);
    } else {
      exLines = exerciciosRaw ? [exerciciosRaw] : [];
    }
    const hasAnyLoad = exLines.some(ex => /\d+\s*[xX×]\s*[\d\/]/.test(ex));
    const loadInputsHtml = (!isPrep && exLines.length > 0 && hasAnyLoad) ? `
      <div class="load-inputs-container">
        <p class="load-inputs-label">Carga utilizada:</p>
        <div class="load-inputs-grid">
          ${exLines.map((ex, exIdx) => {
            const exName = _extractExName(ex) || ex;
            const exSpec = _extractExSpec(ex);
            const setsCount = _extractSetsCount(ex);
            return `
              <div class="exercise-card-load">
                <div class="exercise-load-header">
                  <span class="exercise-load-name">${_escapeWorkoutHTML(exName)}</span>
                  ${exSpec ? `<span class="exercise-load-spec">${_escapeWorkoutHTML(exSpec)}</span>` : ''}
                </div>
                <div class="sets-grid">
                  ${Array.from({length: setsCount}, (_, si) => `
                    <div class="set-input-group">
                      <div class="set-label">S${si + 1}</div>
                      <input type="number"
                             class="load-input-field set-input"
                             placeholder="—"
                             data-block-idx="${blockIdx}"
                             data-ex-idx="${exIdx}"
                             data-set-idx="${si}"
                             data-ex-name="${_escapeWorkoutHTML(exName)}"
                             data-ex-spec="${_escapeWorkoutHTML(exSpec)}"
                             oninput="_saveLoadInput(this)"
                             min="0" step="0.5">
                      <div class="kg-label">kg</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>` : '';

    return `
      <div class="block-card ${doneClass}" id="block-${_inlineSession.cardDomId}-${blockIdx}">
        <div class="block-header" onclick="toggleBlock('${wId}', ${blockIdx})">
          <div class="block-dot" style="background:${block.color};"></div>
          <div class="block-name">${_escapeWorkoutHTML(block.name)}</div>
          <div class="block-right">
            <span class="block-status-badge">concluído</span>
            <div class="chevron">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
        <div class="block-exercises">
          ${exercisesHtml}
          ${loadInputsHtml}
          <button class="btn-mark-done" onclick="markBlockDone('${wId}', ${blockIdx}, event)">Marcar como concluído</button>
        </div>
      </div>
    `;
  }).join('');

  _inlineSession.bodyEl.innerHTML = `
    <div class="inline-session-wrap">
      ${blocksHtml}
    </div>
    <div class="session-progress-wrap">
      <div class="session-progress-track">
        <div class="session-progress-fill" id="progress-${_inlineSession.cardDomId}"></div>
      </div>
      <div class="session-progress-text" id="progress-text-${_inlineSession.cardDomId}">0 de ${_inlineSession.blocks.length} blocos</div>
    </div>
    <button class="btn-finish-session" id="btn-finish-${_inlineSession.cardDomId}" disabled onclick="finishSession('${wId}')">Concluir treino</button>
  `;

  _updateInlineProgress();
}

function _updateInlineProgress() {
  if (!_inlineSession) return;
  const total = _inlineSession.blocks.length;
  const done = _inlineSession.blocks.filter(b => b.done).length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const allDone = done === total;
  const fill = document.getElementById(`progress-${_inlineSession.cardDomId}`);
  const txt = document.getElementById(`progress-text-${_inlineSession.cardDomId}`);
  const finishBtn = document.getElementById(`btn-finish-${_inlineSession.cardDomId}`);
  const stickyFinishBtn = document.getElementById(`sticky-finish-btn-${_inlineSession.cardDomId}`);
  if (fill) fill.style.width = `${pct}%`;
  if (txt) txt.textContent = `${done} de ${total} blocos`;
  if (finishBtn) finishBtn.disabled = !allDone;
  if (stickyFinishBtn) stickyFinishBtn.disabled = !allDone;
}

function toggleBlock(workoutId, blockIdx) {
  if (!_inlineSession || _inlineSession.workoutId !== String(workoutId)) return;
  const blockEl = document.getElementById(`block-${_inlineSession.cardDomId}-${blockIdx}`);
  if (!blockEl) return;
  blockEl.classList.toggle('collapsed');
}

function markBlockDone(workoutId, blockIdx, event) {
  try {
    if (event) event.stopPropagation();
    if (!_inlineSession || _inlineSession.workoutId !== String(workoutId)) return;
    const block = _inlineSession.blocks[blockIdx];
    if (!block) return;

    block.done = !block.done;
    const blockEl = document.getElementById(`block-${_inlineSession.cardDomId}-${blockIdx}`);
    if (blockEl) {
      blockEl.classList.toggle('done', block.done);
      blockEl.classList.toggle('collapsed', block.done);
      const btn = blockEl.querySelector('.btn-mark-done');
      if (btn) btn.textContent = block.done ? 'Desmarcar' : 'Marcar como concluído';
    }
    _updateInlineProgress();
    // BUG-2 FIX: persist block done state
    _saveInlineSessionState();

    // FE-002 / TASK 3: persistir exercise_logs ao marcar bloco como concluído
    if (block.done) {
      _saveBlockExerciseLogs(workoutId, blockIdx, block, blockEl)
        .catch(e => console.warn('[markBlockDone] exercise_logs:', e?.message || e));
      invalidatePerformanceCache();
    }
  } catch(e) { _logError('markBlockDone', e, { workoutId, blockIdx }); }
}

// FE-002 / TASK 3: salvar exercise_logs quando um bloco é marcado como concluído
async function _saveBlockExerciseLogs(workoutId, blockIdx, block, blockEl) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) return;

    const sessionLogId = _inlineSession?.sessionLogId || window.__activeSessionId || null;
    const realWorkoutId = _inlineSession?.realWorkoutId || String(workoutId);
    const loggedAt = new Date().toISOString();
    const stateLoads = state.sessionLoads || {};
    const blockPrefix = `${blockIdx}_`;
    const loadEntries = Object.entries(stateLoads).filter(([key]) => key.startsWith(blockPrefix));
    if (!loadEntries.length) return;

    const rows = loadEntries.map(([key, loadEntry]) => {
      const parts = key.split('_');
      const exIdx = parseInt(parts[1], 10);
      const setsMap = loadEntry && typeof loadEntry === 'object' && loadEntry.sets && typeof loadEntry.sets === 'object'
        ? loadEntry.sets
        : loadEntry;
      const sets = Object.values(setsMap || {}).map(v => Number(v) || 0).filter(v => v > 0);
      const loadKg = sets.length > 0 ? sets.reduce((a, b) => a + b, 0) / sets.length : 0;

      let exerciseName = (loadEntry && typeof loadEntry === 'object' && loadEntry.exName) ? String(loadEntry.exName).trim() : '';
      if (!exerciseName && Array.isArray(block?.exercises) && Number.isFinite(exIdx) && block.exercises[exIdx]) {
        exerciseName = block.exercises[exIdx].name || '';
      }
      if (!exerciseName && blockEl && Number.isFinite(exIdx)) {
        const inputEl = blockEl.querySelector(`input[data-block-idx="${blockIdx}"][data-ex-idx="${exIdx}"]`);
        const cardEl = inputEl ? inputEl.closest('.exercise-card-load') : null;
        const nameEl = cardEl ? cardEl.querySelector('.exercise-load-name') : null;
        exerciseName = nameEl ? nameEl.textContent.trim() : '';
      }
      if (!exerciseName) {
        exerciseName = `Exercício ${Number.isFinite(exIdx) ? exIdx + 1 : 1}`;
      }

      return {
        user_id: userId,
        session_log_id: sessionLogId,
        workout_id: realWorkoutId,
        exercise_name: exerciseName,
        block_name: block?.name || '',
        set_number: 1,
        reps: null,
        load_kg: Math.round(loadKg * 100) / 100,
        rpe: null,
        logged_at: loggedAt
      };
    });

    if (rows.length === 0) return;

    // Inserir em lotes de 20 para evitar payloads muito grandes
    for (let i = 0; i < rows.length; i += 20) {
      const chunk = rows.slice(i, i + 20);
      const { error } = await supabase.from('exercise_logs').upsert(chunk, { onConflict: 'workout_id,exercise_name,set_number' });
      if (error) console.warn(`[exercise_logs] chunk ${i / 20}:`, error.message || error);
    }
    console.log(`[exercise_logs] ${rows.length} linhas salvas — bloco "${block.name}"`);
  } catch (err) {
    console.warn('[_saveBlockExerciseLogs]', err?.message || err);
  }
}

function invalidatePerformanceCache() { _perfLoaded = false; }

const _inlineRpeDescMap = {
  1: 'Muito fácil',
  2: 'Muito fácil',
  3: 'Fácil',
  4: 'Fácil',
  5: 'Moderado',
  6: 'Moderado',
  7: 'Difícil',
  8: 'Difícil',
  9: 'Muito difícil',
  10: 'Máximo esforço'
};

function _computeInlineVolumeKg(cardEl) {
  if (!cardEl) return 0;
  let sum = 0;
  cardEl.querySelectorAll('.set-input').forEach(input => {
    const v = Number(input.value);
    if (Number.isFinite(v) && v > 0) sum += v;
  });
  return Math.round(sum * 10) / 10;
}

function _computeSessionLoadsTotal() {
  const totalVolume = Object.values(state.sessionLoads || {}).reduce((acc, entry) => {
    const setsObj = entry && typeof entry === 'object' && entry.sets && typeof entry.sets === 'object'
      ? entry.sets
      : entry;
    if (!setsObj || typeof setsObj !== 'object') return acc;
    return acc + Object.values(setsObj).reduce((a, v) => a + (Number(v) || 0), 0);
  }, 0);
  return Math.round(totalVolume * 10) / 10;
}

function _bindInlineRpe(workoutId, durationSeconds) {
  if (!_inlineSession || _inlineSession.workoutId !== String(workoutId)) return;
  const key = _inlineSession.cardDomId;
  const slider = document.getElementById(`rpe-slider-${key}`);
  const uaEl = document.getElementById(`ua-display-${key}`);
  const valEl = document.getElementById(`rpe-val-${key}`);
  const descEl = document.getElementById(`rpe-desc-${key}`);
  if (!slider || !uaEl || !valEl || !descEl) return;

  const apply = () => {
    const rpe = parseInt(slider.value || '6', 10);
    const dMin = Math.max(1, Math.round(durationSeconds / 60));
    uaEl.textContent = String(Math.round(rpe * dMin));
    valEl.textContent = String(rpe);
    descEl.textContent = _inlineRpeDescMap[rpe] || _inlineRpeDescMap[6];
  };
  slider.addEventListener('input', apply);
  apply();
}

function finishSession(workoutId) {
  if (!_inlineSession || _inlineSession.workoutId !== String(workoutId)) return;
  const done = _inlineSession.blocks.filter(b => b.done).length;
  if (done !== _inlineSession.blocks.length) {
    showToast('Conclua todos os blocos antes de finalizar.', true);
    return;
  }

  _stopInlineSessionTimer();
  _inlineSession.finished = true;
  // BUG-2 FIX: clear persisted session on finish
  _clearInlineSessionState();
  const durationSeconds = Math.max(1, _inlineSession.timerSecs || 0);
  const totalVolume = _computeSessionLoadsTotal();
  const volumeKg = totalVolume > 0 ? totalVolume : _computeInlineVolumeKg(_inlineSession.cardEl);
  const key = _inlineSession.cardDomId;
  const durationLabel = _formatClock(durationSeconds);
  const existing = document.getElementById(`post-${key}`);
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.className = 'post-panel';
  panel.id = `post-${key}`;
  panel.innerHTML = `
    <div class="post-header">
      <div class="post-icon">✓</div>
      <div>
        <div class="post-title">Treino concluído</div>
        <div class="post-sub">Duração: ${durationLabel}</div>
      </div>
    </div>
    <div class="post-body">
      <div class="post-stats-grid">
        <div class="post-stat-card">
          <div class="post-stat-value" style="color:#39e07a">${durationLabel}</div>
          <div class="post-stat-name">Duração</div>
        </div>
        <div class="post-stat-card">
          <div class="post-stat-value" style="color:#4A9EF5">${volumeKg} kg</div>
          <div class="post-stat-name">Volume total</div>
        </div>
        <div class="post-stat-card">
          <div class="post-stat-value" style="color:#EF9F27" id="ua-display-${key}">—</div>
          <div class="post-stat-name">UA diária</div>
        </div>
      </div>
      <div class="rpe-section">
        <div class="rpe-top">
          <span class="rpe-label-text">RPE</span>
          <span class="rpe-value-display" id="rpe-val-${key}">6</span>
        </div>
        <div class="rpe-desc" id="rpe-desc-${key}">Moderado</div>
        <input type="range" class="rpe-slider" id="rpe-slider-${key}" min="1" max="10" value="6" step="1">
        <div class="rpe-ticks">
          <span>1</span><span>3</span><span>5</span><span>7</span><span>10</span>
        </div>
      </div>
      <button class="btn-save-session" id="btn-save-session-${key}" onclick="saveSession('${_escapeWorkoutHTML(workoutId)}', ${durationSeconds}, ${volumeKg})">
        Salvar sessão
      </button>
    </div>
  `;
  _inlineSession.bodyEl.appendChild(panel);
  _bindInlineRpe(workoutId, durationSeconds);
}

async function saveSession(workoutId, durationSeconds, volumeKg) {
  if (!_inlineSession || _inlineSession.workoutId !== String(workoutId)) return;
  const key = _inlineSession.cardDomId;
  const btn = document.getElementById(`btn-save-session-${key}`);
  if (btn?.disabled) return;

  const slider = document.getElementById(`rpe-slider-${key}`);
  const rpe = parseInt(slider?.value || '6', 10);
  const ua = rpe * Math.max(1, Math.round(Number(durationSeconds || 0) / 60));
  const loadsVolume = _computeSessionLoadsTotal();
  const fallbackVolume = loadsVolume > 0 ? loadsVolume : Number(volumeKg || 0);

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    btn.style.opacity = '0.7';
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    const finishedAt = new Date().toISOString();
    const startedAt = _inlineSession.startedAtIso || new Date(Date.now() - Number(durationSeconds || 0) * 1000).toISOString();

    // --- FE-002 / TASK 2: resolver supabase_id real do workout ---
    let realWorkoutId = _inlineSession.realWorkoutId || String(workoutId);
    if (!_inlineSession.realWorkoutId) {
      try {
        const { data: wkData, error: wkErr } = await supabase
          .from('workouts')
          .select('supabase_id')
          .eq('id', workoutId)
          .single();
        console.log('[FE-002] supabase_id lookup (saveSession):', { workoutId, wkData, wkErr: wkErr?.message || null });
        if (wkData?.supabase_id) {
          realWorkoutId = wkData.supabase_id;
        } else if (wkData && !wkErr) {
          // supabase_id NULL — gerar e persistir (mesmo handler que _startInlineSession)
          const newUuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
          const { error: upErr } = await supabase
            .from('workouts')
            .update({ supabase_id: newUuid })
            .eq('id', workoutId);
          console.log('[FE-002] supabase_id gerado (saveSession):', newUuid, 'upErr:', upErr?.message || null);
          if (!upErr) realWorkoutId = newUuid;
        } else if (wkErr) {
          console.warn('[FE-002] lookup error (saveSession):', wkErr.message || wkErr);
        }
      } catch (e) {
        console.warn('[FE-002] lookup exception (saveSession):', e?.message || e);
      }
    }

    // Calcular carga máxima e 1RM por exercício
    const exerciseResults = [];
    Object.entries(state.sessionLoads || {}).forEach(([loadKey, entry]) => {
      const setsMap = entry && typeof entry === 'object' && entry.sets && typeof entry.sets === 'object'
        ? entry.sets
        : entry;
      const sets = Object.values(setsMap || {})
        .map(v => Number(v) || 0)
        .filter(v => v > 0);
      if (sets.length === 0) return;

      const maxLoad = Math.max(...sets);
      let exName = (entry && typeof entry === 'object' ? entry.exName : '') || '';
      let exSpec = (entry && typeof entry === 'object' ? entry.exSpec : '') || '';

      if ((!exName || !exSpec) && _inlineSession?.blocks) {
        const parts = String(loadKey || '').split('_');
        const blockIdx = parseInt(parts[0], 10);
        const exIdx = parseInt(parts[1], 10);
        const block = Number.isFinite(blockIdx) ? _inlineSession.blocks[blockIdx] : null;
        const blockLines = String(block?.conteudo || '').split('\n').map(l => l.trim()).filter(Boolean);
        const line = Number.isFinite(exIdx) ? (blockLines[exIdx] || '') : '';
        if (!exName && line) exName = _extractExName(line) || line;
        if (!exSpec && line) exSpec = _extractExSpec(line);
      }

      const repsMatch = String(exSpec).match(/×\s*(\d+)/);
      const reps = repsMatch ? parseInt(repsMatch[1], 10) : sets.length;
      const bigRock = _isBigRock(exName);
      const orm = bigRock ? _estimate1RM(maxLoad, reps) : null;
      exerciseResults.push({ exName, maxLoad, orm, bigRock });
    });

    // Salvar em exercise_logs
    for (const result of exerciseResults) {
      if (!result.maxLoad) continue;
      try {
        const payload = {
          user_id: userId,
          exercise_name: result.exName || 'Exercício',
          load_kg: result.maxLoad,
          logged_at: new Date().toISOString(),
        };
        if (realWorkoutId) payload.workout_id = realWorkoutId;
        if (_inlineSession.sessionLogId) payload.session_log_id = _inlineSession.sessionLogId;
        const { error: exErr } = await supabase.from('exercise_logs').insert(payload);
        if (exErr) throw exErr;
      } catch (e) {
        console.error('[exercise_logs]', e?.message || e);
      }
    }

    // Salvar 1RM dos Big Rocks em profiles.strength_benchmarks
    const bigRockResults = exerciseResults.filter(r => r.bigRock && r.orm);
    if (bigRockResults.length > 0) {
      try {
        const { data: pd } = await supabase
          .from('profiles').select('strength_benchmarks')
          .eq('user_id', userId).single();
        const existing = (pd?.strength_benchmarks && typeof pd.strength_benchmarks === 'object')
          ? { ...pd.strength_benchmarks }
          : {};
        bigRockResults.forEach(r => {
          const k = r.bigRock.key;
          if (!existing[k] || r.orm > Number(existing[k])) existing[k] = r.orm;
        });
        const { error: sbErr } = await supabase.from('profiles').upsert(
          { user_id: userId, strength_benchmarks: existing },
          { onConflict: 'user_id' }
        );
        if (sbErr) throw sbErr;
      } catch (e) {
        console.error('[strength_benchmarks]', e?.message || e);
      }
    }

    const totalVolume = exerciseResults.reduce((a, r) => a + (r.maxLoad || 0), 0);
    const sessionVolume = totalVolume > 0 ? (Math.round(totalVolume * 10) / 10) : fallbackVolume;

    const sessionPayload = {
      user_id: userId,
      workout_id: realWorkoutId,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_seconds: Number(durationSeconds || 0),
      rpe: rpe,
      ua: ua,
      notes: JSON.stringify({ volume_kg: Number(sessionVolume || 0) })
    };

    let logErr = null;
    // Se já foi criado um session_log antecipado, ATUALIZAR em vez de inserir
    if (_inlineSession.sessionLogId) {
      const { error: updErr } = await supabase
        .from('session_logs')
        .update({ workout_id: realWorkoutId, finished_at: finishedAt,
          duration_seconds: Number(durationSeconds || 0), rpe, ua,
          notes: JSON.stringify({ volume_kg: Number(sessionVolume || 0) }) })
        .eq('id', _inlineSession.sessionLogId)
        .eq('user_id', userId);
      logErr = updErr;
    } else {
      const { error: insErr } = await supabase.from('session_logs').insert(sessionPayload);
      logErr = insErr;
    }
    if (logErr) throw logErr;

    const { error: wErr } = await supabase
      .from('workouts')
      .update({ status: 'completed' })
      .eq('id', workoutId)
      .eq('user_id', userId);
    if (wErr) console.warn('[saveSession] update workout status:', wErr.message || wErr);

    if (_inlineSession.source === 'ia') {
      const treinos = loadTreinosIA();
      const treino = treinos.find(t => String(t.id) === String(workoutId));
      if (treino) {
        treino.concluida = true;
        treino.completed = true;
        treino.completedAt = finishedAt;
        saveTreinosIA(treinos);
      }
    } else if (_inlineSession.source === 'state' && _inlineSession.sourceIndex != null) {
      if (state.workouts[_inlineSession.sourceIndex]) {
        state.workouts[_inlineSession.sourceIndex].completed = true;
        saveWorkouts();
      }
    }

    if (btn) {
      btn.textContent = 'Salvo ✓';
      btn.style.opacity = '1';
    }

    showToast('Sessão registrada! 💪');

    _stopInlineSessionTimer();
    _inlineSession = null;
    _clearInlineSessionState(); // BUG-2 FIX
    renderWorkouts();
    await renderCompletedWorkouts();
    updateStreakAndConsistency();
  } catch (err) {
    console.error('[finishSession] erro:', err?.message || err);
    if (typeof _logError === 'function') _logError('finishSession', err);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Salvar sessão';
      btn.style.opacity = '';
    }
    if (typeof showToast === 'function') showToast('Erro ao salvar sessão. Tente novamente.');
  }
}

function _openSessionWidget(workoutId, title, conteudo, card) {
  if (document.getElementById('session-widget')) return;

  const blocos = parseTreino(conteudo);
  _sessionElapsed = 0;
  _sessionContext = { workoutId, title, startedAt: new Date().toISOString(), card };
  _sessionState = {
    blocosSession: blocos,
    blocoAtualIdx: 0,
    exercicioAtualIdx: 0,
    setAtual: 1,
    modoDescanso: false,
    tempoDescanso: 0,
    tempoTotal: 0,
    aguardandoDescanso: false,
    descansoConcluido: false,
    checkedItems: {},
    cargasRegistradas: {}
  };

  if (card) {
    card.style.borderColor = 'rgba(0,255,135,0.55)';
    card.style.boxShadow = '0 0 0 1px rgba(0,255,135,0.2)';
  }

  const widget = document.createElement('div');
  widget.id = 'session-widget';
  widget.style.cssText = 'margin-top:12px;background:#0b0f18;border:1px solid rgba(0,255,135,0.22);border-radius:14px;overflow:hidden;';

  if (card) {
    card.appendChild(widget);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    const target = document.getElementById('all-workouts') || document.getElementById('page-dashboard') || document.body;
    target.prepend(widget);
  }

  _startSessionClock();
  _sessionRenderWidget();
}

function _startSessionClock() {
  clearInterval(_activeTimer);
  _activeTimer = setInterval(() => {
    if (!_sessionContext) return;

    _sessionState.tempoTotal += 1;
    _sessionElapsed = _sessionState.tempoTotal;

    if (_sessionState.modoDescanso && _sessionState.tempoDescanso > 0) {
      _sessionState.tempoDescanso -= 1;
      if (_sessionState.tempoDescanso <= 0) {
        _sessionState.tempoDescanso = 0;
        _sessionState.modoDescanso = false;
        _sessionState.descansoConcluido = true;
        _notifyRestDone();
      }
    }

    _sessionRenderWidget();
  }, 1000);
}

function _notifyRestDone() {
  try {
    if (navigator?.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (_) {}

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 300);
  } catch (_) {}
}

function _getCurrentBlock() {
  return _sessionState.blocosSession[_sessionState.blocoAtualIdx] || null;
}

function _getCurrentExercise() {
  const block = _getCurrentBlock();
  if (!block || !block.navegavel || !Array.isArray(block.exercicios)) return null;
  return block.exercicios[_sessionState.exercicioAtualIdx] || null;
}

function _goToPosition(blocoIdx, exercicioIdx = 0) {
  _sessionState.blocoAtualIdx = Math.max(0, Math.min(blocoIdx, _sessionState.blocosSession.length - 1));
  const block = _getCurrentBlock();

  if (block?.navegavel && block.exercicios.length > 0) {
    _sessionState.exercicioAtualIdx = Math.max(0, Math.min(exercicioIdx, block.exercicios.length - 1));
  } else {
    _sessionState.exercicioAtualIdx = 0;
  }

  _sessionState.setAtual = 1;
  _sessionState.modoDescanso = false;
  _sessionState.tempoDescanso = 0;
  _sessionState.aguardandoDescanso = false;
  _sessionState.descansoConcluido = false;
}

function _sessionNext() {
  const blocks = _sessionState.blocosSession;
  if (!blocks.length) return;

  const bIdx = _sessionState.blocoAtualIdx;
  const block = _getCurrentBlock();

  if (!block) return;

  if (!block.navegavel || !block.exercicios.length) {
    if (bIdx < blocks.length - 1) _goToPosition(bIdx + 1, 0);
    _sessionRenderWidget();
    return;
  }

  if (_sessionState.exercicioAtualIdx < block.exercicios.length - 1) {
    _goToPosition(bIdx, _sessionState.exercicioAtualIdx + 1);
  } else if (bIdx < blocks.length - 1) {
    _goToPosition(bIdx + 1, 0);
  }

  _sessionRenderWidget();
}

function _sessionPrev() {
  const blocks = _sessionState.blocosSession;
  if (!blocks.length) return;

  const bIdx = _sessionState.blocoAtualIdx;
  const block = _getCurrentBlock();

  if (!block) return;

  if (block.navegavel && block.exercicios.length && _sessionState.exercicioAtualIdx > 0) {
    _goToPosition(bIdx, _sessionState.exercicioAtualIdx - 1);
    _sessionRenderWidget();
    return;
  }

  if (bIdx > 0) {
    const prevBlock = blocks[bIdx - 1];
    const prevExIdx = (prevBlock.navegavel && prevBlock.exercicios.length)
      ? prevBlock.exercicios.length - 1
      : 0;
    _goToPosition(bIdx - 1, prevExIdx);
  }

  _sessionRenderWidget();
}

function _toggleItem(blocoIdx, itemIdx) {
  const key = `${blocoIdx}-${itemIdx}`;
  _sessionState.checkedItems[key] = !_sessionState.checkedItems[key];
  _sessionRenderWidget();
}

function _sessionMarkSetDone() {
  const block = _getCurrentBlock();
  const ex = _getCurrentExercise();
  if (!block || !block.navegavel || !ex) return;

  const setsTotal = Math.max(1, ex.setsTotal || 3);
  if (_sessionState.setAtual > setsTotal) return;

  // Save carga if strength block
  if (block.tipo === 'strength') {
    const cargaInput = document.getElementById('carga-set-input');
    const cargaVal = cargaInput && cargaInput.value !== '' ? parseFloat(cargaInput.value) || null : null;
    if (!_sessionState.cargasRegistradas[block.bloco]) _sessionState.cargasRegistradas[block.bloco] = {};
    const exKey = `${ex.id}_${ex.nome}`;
    if (!_sessionState.cargasRegistradas[block.bloco][exKey]) {
      _sessionState.cargasRegistradas[block.bloco][exKey] = Array(setsTotal).fill(null);
    }
    _sessionState.cargasRegistradas[block.bloco][exKey][_sessionState.setAtual - 1] = cargaVal;
  }

  _sessionState.setAtual += 1;

  if (_sessionState.setAtual <= setsTotal) {
    _sessionState.aguardandoDescanso = true;
    _sessionState.descansoConcluido = false;
    _sessionState.tempoDescanso = ex.descansoSegundos || 60;
  } else {
    _sessionState.aguardandoDescanso = false;
    _sessionState.modoDescanso = false;
    _sessionState.tempoDescanso = 0;
  }

  _sessionRenderWidget();
}

function _sessionStartRest() {
  const ex = _getCurrentExercise();
  if (!ex) return;

  _sessionState.modoDescanso = true;
  _sessionState.aguardandoDescanso = false;
  _sessionState.descansoConcluido = false;
  if (_sessionState.tempoDescanso <= 0) {
    _sessionState.tempoDescanso = ex.descansoSegundos || 60;
  }

  _sessionRenderWidget();
}

function _sessionRenderWidget() {
  const widget = document.getElementById('session-widget');
  if (!widget || !_sessionContext) return;

  const blocks = _sessionState.blocosSession;
  const block = _getCurrentBlock();
  const ex = _getCurrentExercise();

  if (!blocks.length || !block) {
    widget.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;">Treino sem blocos reconhecidos.</div>';
    return;
  }

  const bIdx = _sessionState.blocoAtualIdx;
  const canPrev = bIdx > 0 || _sessionState.exercicioAtualIdx > 0;
  const canNext = (() => {
    if (!block.navegavel || !block.exercicios.length) return bIdx < blocks.length - 1;
    if (_sessionState.exercicioAtualIdx < block.exercicios.length - 1) return true;
    return bIdx < blocks.length - 1;
  })();

  const pills = blocks.map((b, i) => {
    const isDone = i < bIdx;
    const isCurrent = i === bIdx;
    const bg = isCurrent ? 'rgba(0,255,135,0.2)' : isDone ? 'rgba(76,175,80,0.18)' : 'rgba(255,255,255,0.06)';
    const color = isCurrent ? 'var(--green)' : isDone ? '#9fe870' : '#707885';
    const label = isDone ? `✓ ${b.bloco}` : b.bloco;
    return `<span style="padding:4px 8px;border-radius:999px;background:${bg};color:${color};font-size:10px;font-weight:700;letter-spacing:0.8px;white-space:nowrap;">${label}</span>`;
  }).join('');

  let contentHtml = '';

  if (block.tipo === 'foam_roll') {
    const areas = block.areas && block.areas.length ? block.areas : [];
    const areasHtml = areas.map((a, i) => {
      const ck = _sessionState.checkedItems[`${bIdx}-${i}`];
      return `<div onclick="event.stopPropagation();_toggleItem(${bIdx},${i})" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;">
        <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${ck ? 'var(--green)' : 'rgba(255,255,255,0.2)'};background:${ck ? 'rgba(0,255,135,0.2)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:var(--green);">${ck ? '✓' : ''}</div>
        <div style="flex:1;">
          <span style="font-size:13px;color:${ck ? '#9fe870' : '#c9d0dc'};${ck ? 'text-decoration:line-through;opacity:0.7;' : ''}">${a.nome}</span>
          ${a.tempo ? `<span style="margin-left:8px;font-size:11px;color:var(--muted);font-family:var(--font-mono);">${a.tempo}</span>` : ''}
        </div>
      </div>`;
    }).join('');
    contentHtml = `
      <div style="padding:16px 18px 10px;">
        <div style="font-size:20px;font-family:var(--font-display);letter-spacing:1px;color:#fff;line-height:1.1;">FOAM ROLL</div>
        ${block.duracao ? `<div style="margin-top:4px;color:var(--muted);font-size:12px;font-family:var(--font-mono);">${block.duracao}</div>` : ''}
        <div style="margin-top:12px;">${areasHtml || '<div style="color:var(--muted);font-size:13px;">Trabalhe as principais áreas com o rolo.</div>'}</div>
      </div>`;

  } else if (block.tipo === 'pillar_prep' || block.tipo === 'warm_up') {
    const items = block.exercicios && block.exercicios.length ? block.exercicios : [];
    const itemsHtml = items.map((e, i) => {
      const ck = _sessionState.checkedItems[`${bIdx}-${i}`];
      return `<div onclick="event.stopPropagation();_toggleItem(${bIdx},${i})" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;">
        <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${ck ? 'var(--green)' : 'rgba(255,255,255,0.2)'};background:${ck ? 'rgba(0,255,135,0.2)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:var(--green);">${ck ? '✓' : ''}</div>
        <div style="flex:1;">
          <span style="font-size:13px;color:${ck ? '#9fe870' : '#c9d0dc'};${ck ? 'text-decoration:line-through;opacity:0.7;' : ''}">${e.nome}</span>
          ${e.prescricao ? `<span style="margin-left:8px;font-size:11px;color:var(--muted);font-family:var(--font-mono);">${e.prescricao}</span>` : ''}
        </div>
      </div>`;
    }).join('');
    const label = block.tipo === 'pillar_prep' ? 'PILLAR PREP' : 'WARM-UP';
    contentHtml = `
      <div style="padding:16px 18px 10px;">
        <div style="font-size:20px;font-family:var(--font-display);letter-spacing:1px;color:#fff;line-height:1.1;">${label}</div>
        ${block.duracao ? `<div style="margin-top:4px;color:var(--muted);font-size:12px;font-family:var(--font-mono);">${block.duracao}</div>` : ''}
        <div style="margin-top:12px;">${itemsHtml || '<div style="color:var(--muted);font-size:13px;">Complete os exercícios de preparação.</div>'}</div>
      </div>`;

  } else if (block.tipo === 'conditioning') {
    const itens = block.itens && block.itens.length ? block.itens : [];
    let condHtml = '';
    if (itens.length) {
      condHtml = itens.map(it => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:13px;color:#c9d0dc;">${it.nome}</span>
        <span style="font-size:12px;color:var(--muted);font-family:var(--font-mono);">${it.prescricao}</span>
      </div>`).join('');
    } else if (block.descricao) {
      condHtml = `<div style="font-size:13px;color:#c9d0dc;line-height:1.5;">${block.descricao}</div>`;
    }
    contentHtml = `
      <div style="padding:16px 18px 10px;">
        <div style="font-size:20px;font-family:var(--font-display);letter-spacing:1px;color:#fff;line-height:1.1;">ESD</div>
        ${block.duracao ? `<div style="margin-top:4px;color:var(--muted);font-size:12px;font-family:var(--font-mono);">${block.duracao}</div>` : ''}
        <div style="margin-top:12px;">${condHtml || '<div style="color:var(--muted);font-size:13px;">Condicionamento final da sessão.</div>'}</div>
        <div style="margin-top:16px;text-align:center;">
          <button onclick="event.stopPropagation();_concludeSession()" style="width:100%;padding:14px;background:var(--green);color:#000;border:none;border-radius:12px;font-family:var(--font-display);font-size:20px;letter-spacing:2px;cursor:pointer;">CONCLUIR SESSÃO</button>
        </div>
      </div>`;

  } else if (!block.navegavel || !block.exercicios.length) {
    contentHtml = `
      <div style="padding:16px 18px 10px;">
        <div style="font-size:20px;font-family:var(--font-display);letter-spacing:1px;color:#fff;line-height:1.1;">${block.bloco}</div>
        ${block.duracao ? `<div style="margin-top:4px;color:var(--muted);font-size:12px;font-family:var(--font-mono);">${block.duracao}</div>` : ''}
        <div style="margin-top:10px;color:#c9d0dc;font-size:13px;line-height:1.5;">${block.descricao || 'Siga as instruções deste bloco e avance quando finalizar.'}</div>
      </div>`;
  } else {
    const setsTotal = Math.max(1, ex.setsTotal || 3);
    const reps = ex.repsPrescricao || '-';
    const descanso = ex.descansoSegundos || 60;
    const isStrength = block.tipo === 'strength';

    const nomeMatch = String(ex.nome || '').match(/^(.*?)\s*\((.*?)\)\s*$/);
    const nomeBase = nomeMatch ? nomeMatch[1].trim() : ex.nome;
    const nomePt = nomeMatch ? nomeMatch[2].trim() : '';

    // Build carga display for strength
    const exKey = `${ex.id}_${ex.nome}`;
    const savedCargas = (isStrength && _sessionState.cargasRegistradas[block.bloco] && _sessionState.cargasRegistradas[block.bloco][exKey]) || [];

    let setsHtml = '';
    for (let i = 1; i <= setsTotal; i++) {
      const done = i < _sessionState.setAtual || _sessionState.setAtual > setsTotal;
      const isCurr = i === _sessionState.setAtual && _sessionState.setAtual <= setsTotal;
      const symbol = done ? '●' : isCurr ? '►' : '○';
      const cargaRegistrada = savedCargas[i - 1];
      const cargaLabel = done && isStrength && cargaRegistrada != null ? ` · ${cargaRegistrada}kg` : '';
      const suffix = done ? ` ✓${cargaLabel}` : isCurr ? ' (atual)' : '';
      setsHtml += `<div style="font-size:13px;color:${isCurr ? 'var(--green)' : done ? '#d5f8a2' : '#9aa3b2'};line-height:1.4;">${symbol} Set ${i}${suffix}</div>`;
    }

    // Carga input for strength current set
    const cargaInputHtml = isStrength && _sessionState.setAtual <= setsTotal ? `
      <div style="margin-top:10px;display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--muted);font-family:var(--font-mono);white-space:nowrap;">Carga (kg):</label>
        <input id="carga-set-input" type="number" step="0.5" min="0" placeholder="0"
          style="width:80px;padding:6px 10px;background:#111827;border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;font-size:14px;font-family:var(--font-mono);text-align:center;outline:none;"
          onclick="event.stopPropagation()" oninput="event.stopPropagation()">
      </div>` : '';

    let restPanel = '';
    if (_sessionState.modoDescanso) {
      restPanel = `
        <div style="margin-top:12px;padding:14px;border-radius:12px;background:linear-gradient(135deg,#2b130c,#3a1b10);border:1px solid rgba(255,120,70,0.45);text-align:center;">
          <div style="font-family:var(--font-display);font-size:38px;letter-spacing:2px;color:#ffb38f;line-height:1;">${_formatClock(_sessionState.tempoDescanso)}</div>
          <div style="margin-top:6px;font-size:12px;color:#ff9f6a;letter-spacing:1px;font-family:var(--font-mono);">◄ descanso</div>
        </div>`;
    } else if (_sessionState.aguardandoDescanso && _sessionState.setAtual <= setsTotal) {
      restPanel = `
        <div style="margin-top:12px;padding:10px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);text-align:center;">
          <div style="font-family:var(--font-display);font-size:30px;letter-spacing:1px;color:#ffcf6e;line-height:1;">${_formatClock(_sessionState.tempoDescanso)}</div>
          <button onclick="event.stopPropagation();_sessionStartRest()" style="margin-top:8px;padding:9px 14px;background:#2c1f0f;border:1px solid #e8a53a;color:#ffd27c;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:0.8px;">INICIAR DESCANSO</button>
        </div>`;
    } else if (_sessionState.descansoConcluido && _sessionState.setAtual <= setsTotal) {
      restPanel = `
        <div style="margin-top:12px;padding:10px;border-radius:12px;background:rgba(0,255,135,0.06);border:1px solid rgba(0,255,135,0.3);text-align:center;">
          <div style="font-size:12px;color:var(--green);font-weight:700;letter-spacing:1px;">PRÓXIMA SÉRIE</div>
        </div>`;
    } else if (_sessionState.setAtual <= setsTotal) {
      restPanel = `
        <div style="margin-top:12px;padding:10px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);text-align:center;">
          <button onclick="event.stopPropagation();_sessionMarkSetDone()" style="padding:9px 14px;background:rgba(0,255,135,0.15);border:1px solid rgba(0,255,135,0.4);color:var(--green);border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:0.8px;">✓ CONCLUIR SET</button>
        </div>`;
    } else {
      restPanel = `
        <div style="margin-top:12px;padding:10px;border-radius:12px;background:rgba(0,255,135,0.06);border:1px solid rgba(0,255,135,0.25);text-align:center;">
          <div style="font-size:12px;color:var(--green);font-weight:700;letter-spacing:1px;">EXERCÍCIO CONCLUÍDO</div>
        </div>`;
    }

    contentHtml = `
      <div style="padding:16px 18px 10px;">
        <div style="font-size:12px;color:#8f97a5;margin-bottom:8px;">Exercício ${_sessionState.exercicioAtualIdx + 1} de ${block.exercicios.length}</div>
        <div style="font-size:22px;font-family:var(--font-display);letter-spacing:1px;color:#fff;line-height:1.1;">${ex.id} — ${nomeBase}</div>
        ${nomePt ? `<div style="margin-top:2px;color:#9aa3b2;font-size:13px;">(${nomePt})</div>` : ''}
        <div style="margin-top:6px;color:var(--muted);font-size:12px;font-family:var(--font-mono);">${setsTotal} séries · ${reps} reps · ${descanso}s descanso</div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;">${setsHtml}</div>
        ${cargaInputHtml}
        ${restPanel}
      </div>`;
  }

  widget.innerHTML = `
    <div style="padding:12px 14px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div style="font-size:14px;font-weight:700;color:#fff;">🏋️ ${block.bloco} · ${bIdx + 1} de ${blocks.length} blocos</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${pills}</div>
    </div>

    ${contentHtml}

    <div style="padding:12px 14px;border-top:1px solid var(--border);background:rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
      <div style="display:flex;gap:8px;">
        <button onclick="event.stopPropagation();_sessionPrev()" ${canPrev ? '' : 'disabled'} style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:${canPrev ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)'};color:${canPrev ? '#d5dbe6' : '#626a77'};cursor:${canPrev ? 'pointer' : 'not-allowed'};font-size:12px;font-weight:700;">← ANTERIOR</button>
        <button onclick="event.stopPropagation();_sessionNext()" ${canNext ? '' : 'disabled'} style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:${canNext ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)'};color:${canNext ? '#d5dbe6' : '#626a77'};cursor:${canNext ? 'pointer' : 'not-allowed'};font-size:12px;font-weight:700;">PRÓXIMO →</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button onclick="event.stopPropagation();_concludeSession()" style="padding:9px 14px;background:var(--green);color:#000;border:none;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:0.8px;">CONCLUIR SESSÃO</button>
        <span style="font-family:var(--font-mono);font-size:12px;color:#9aa3b2;">⏱ ${_formatClock(_sessionState.tempoTotal)} total</span>
      </div>
    </div>

    <div style="padding:0 14px 12px;display:flex;justify-content:flex-end;">
      <button onclick="event.stopPropagation();_cancelSession()" style="background:none;border:none;color:#67707f;font-size:11px;cursor:pointer;">cancelar</button>
    </div>`;
}

function _concludeSession() {
  clearInterval(_activeTimer);
  _activeTimer = null;
  const finishedAt = new Date().toISOString();
  const duration = _sessionState.tempoTotal;
  _removeSessionWidget();
  _openFeedbackModal(finishedAt, duration);
}

function _cancelSession() {
  clearInterval(_activeTimer);
  _activeTimer = null;
  _removeSessionWidget();
  _sessionContext = null;
  _sessionElapsed = 0;
  _resetSessionState();
}

function _removeSessionWidget() {
  const widget = document.getElementById('session-widget');
  const card = _sessionContext?.card;
  if (card) {
    card.style.borderColor = '';
    card.style.boxShadow = '';
  }
  widget?.remove();
}

function _openFeedbackModal(finishedAt, duration) {
  const title      = _sessionContext?.title || 'Treino';
  const durationMin = Math.floor(duration / 60);
  const durationSec = duration % 60;
  const initialRpe  = 7;
  const initialUa   = (initialRpe * (duration / 60)).toFixed(1);

  const modal = document.createElement('div');
  modal.id = 'session-feedback-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:1001;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:rgba(0,0,0,0.8);';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;width:100%;max-width:480px;animation:fadeUp 0.3s ease;max-height:92vh;overflow-y:auto;">
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:var(--green);text-transform:uppercase;margin-bottom:4px;">✅ Sessão Concluída</div>
        <div style="font-family:var(--font-display);font-size:18px;letter-spacing:1px;">${title}</div>
        <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono);margin-top:4px;">${durationMin}min ${durationSec}s</div>
      </div>
      <div style="padding:24px;display:flex;flex-direction:column;gap:20px;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);">Esforço Percebido (RPE)</div>
            <div style="display:flex;align-items:baseline;gap:6px;">
              <span id="rpe-value" style="font-family:var(--font-display);font-size:32px;color:var(--green);">${initialRpe}</span>
              <span id="rpe-label" style="font-size:12px;color:var(--muted);">Difícil</span>
            </div>
          </div>
          <input type="range" id="rpe-slider" min="1" max="10" value="${initialRpe}" oninput="_updateRpeFeedback(this.value,${duration})"
            style="width:100%;accent-color:var(--green);cursor:pointer;height:6px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-family:var(--font-mono);margin-top:6px;">
            <span>1 · Muito leve</span><span>5 · Moderado</span><span>10 · Máximo</span>
          </div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);">Carga Interna (UA)</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px;">RPE × Duração (min)</div>
          </div>
          <div id="ua-value" style="font-family:var(--font-display);font-size:36px;letter-spacing:1px;color:var(--text);">${initialUa}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Observações (opcional)</div>
          <textarea id="session-notes" placeholder="Como foi a sessão? Algo a registrar..."
            style="width:100%;padding:12px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:13px;resize:vertical;min-height:80px;outline:none;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--green)'" onblur="this.style.borderColor='var(--border)'"></textarea>
        </div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid var(--border);">
        <button id="btn-save-session" onclick="_saveSession('${finishedAt}',${duration})"
          style="width:100%;padding:14px;background:var(--green);color:#000;font-family:var(--font-display);font-size:18px;letter-spacing:2px;border:none;border-radius:12px;cursor:pointer;transition:opacity 0.2s;">SALVAR SESSÃO</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function _updateRpeFeedback(rpe, duration) {
  const n = parseInt(rpe);
  const labels = ['', 'Muito fácil', 'Muito fácil', 'Fácil', 'Fácil', 'Moderado', 'Moderado', 'Difícil', 'Difícil', 'Muito difícil', 'Máximo esforço'];
  const el = document.getElementById('rpe-value');
  const lbl = document.getElementById('rpe-label');
  const ua  = document.getElementById('ua-value');
  if (el)  el.textContent  = n;
  if (lbl) lbl.textContent = labels[n] || '';
  if (ua)  ua.textContent  = (n * (duration / 60)).toFixed(1);
}

async function _saveSession(finishedAt, duration) {
  const rpe   = parseInt(document.getElementById('rpe-slider')?.value || 7);
  const notes = document.getElementById('session-notes')?.value.trim() || null;
  const ua    = parseFloat((rpe * (duration / 60)).toFixed(2));
  const { workoutId, startedAt } = _sessionContext || {};

  const btn = document.getElementById('btn-save-session');
  if (btn) { btn.disabled = true; btn.textContent = 'SALVANDO...'; btn.style.opacity = '0.6'; }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    const cargas = _sessionState?.cargasRegistradas || {};
    const cargasPayload = Object.keys(cargas).length ? cargas : null;

    // FE-002 / TASK 2: resolver supabase_id real do workout
    let realMbscWorkoutId = workoutId || null;
    if (realMbscWorkoutId) {
      try {
        const { data: mbscWk } = await supabase
          .from('workouts')
          .select('supabase_id')
          .eq('id', realMbscWorkoutId)
          .single();
        if (mbscWk?.supabase_id) realMbscWorkoutId = mbscWk.supabase_id;
      } catch (_) {}
    }

    const { error: logErr } = await supabase.from('session_logs').insert({
      user_id:          userId,
      workout_id:       realMbscWorkoutId,
      started_at:       startedAt,
      finished_at:      finishedAt,
      duration_seconds: duration,
      rpe,
      ua,
      notes,
      cargas:           cargasPayload,
    });
    if (logErr) console.warn('[session_logs insert]', logErr.message);

    const { error: wErr } = await supabase.from('workouts')
      .update({ status: 'completed' })
      .eq('id', workoutId);
    if (wErr) console.warn('[workouts update status]', wErr.message);

  } catch (err) {
    console.warn('[_saveSession]', err.message);
  }

  document.getElementById('session-feedback-modal')?.remove();

  // Marcar treino como concluído no localStorage para sair de "SESSÕES AVULSAS"
  if (workoutId) {
    const treinos = loadTreinosIA();
    const t = treinos.find(x => String(x.id) === String(workoutId));
    if (t) {
      t.concluida   = true;
      t.completed   = true;
      t.completedAt = finishedAt;
      const treinosKey = getTreinosKey();
      if (treinosKey) localStorage.setItem(treinosKey, JSON.stringify(treinos));
    }
  }

  _sessionContext = null;
  _sessionElapsed = 0;
  _resetSessionState();

  showToast('Sessão registrada! 💪');
  renderWorkouts();
  updateStreakAndConsistency();
}

// ── Save individual set load to localStorage (axisai_cargas) ──────────────
function saveLoadInput(treinoId, exIdx, serieIdx, val) {
  const cargas = JSON.parse(localStorage.getItem('axisai_cargas') || '{}');
  const key = `${treinoId}_ex${exIdx}_s${serieIdx}`;
  if (val !== '' && !isNaN(parseFloat(val))) {
    cargas[key] = parseFloat(val);
  } else {
    delete cargas[key];
  }
  localStorage.setItem('axisai_cargas', JSON.stringify(cargas));
  updateVolumeTotal(treinoId);
}

function _saveLoadInput(inputEl) {
  if (!state.sessionLoads) state.sessionLoads = {};
  const blockIdx = inputEl.dataset.blockIdx;
  const exIdx = inputEl.dataset.exIdx;
  if (blockIdx == null || exIdx == null) return;
  const setIdx = inputEl.dataset.setIdx || '0';
  const exName = inputEl.dataset.exName || '';
  const exSpec = inputEl.dataset.exSpec || '';
  const key = blockIdx + '_' + exIdx;
  if (!state.sessionLoads[key] || typeof state.sessionLoads[key] !== 'object' || !state.sessionLoads[key].sets) {
    state.sessionLoads[key] = { sets: {}, exName, exSpec };
  }
  if (!state.sessionLoads[key].exName && exName) state.sessionLoads[key].exName = exName;
  if (!state.sessionLoads[key].exSpec && exSpec) state.sessionLoads[key].exSpec = exSpec;
  state.sessionLoads[key].sets[setIdx] = parseFloat(inputEl.value) || 0;
}

// ── Save checkbox state ────────────────────────────────────────────────────
function saveLoadCheck(treinoId, exIdx, serieIdx, checked) {
  const cargas = JSON.parse(localStorage.getItem('axisai_cargas') || '{}');
  cargas[`${treinoId}_ex${exIdx}_s${serieIdx}_done`] = checked;
  localStorage.setItem('axisai_cargas', JSON.stringify(cargas));
}

// ── Switch active exercise tab ─────────────────────────────────────────────
function switchExTab(treinoId, panelId) {
  const container = document.querySelector(`[data-vol-block="${treinoId}"]`);
  if (!container) return;
  container.querySelectorAll('.wb-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === panelId);
  });
  container.querySelectorAll('.wb-tab-panel').forEach(p => {
    const active = p.id === panelId;
    p.style.display = active ? '' : 'none';
    p.classList.toggle('active', active);
  });
}

// ── Recalculate and display total volume for strength block ───────────────
function updateVolumeTotal(treinoId) {
  const block = document.querySelector(`[data-vol-block="${treinoId}"]`);
  if (!block) return;
  let total = 0;
  block.querySelectorAll('.load-input').forEach(inp => {
    total += (parseFloat(inp.value) || 0) * (parseInt(inp.dataset.reps) || 1);
  });
  const display = block.querySelector('.wb-vol-value');
  if (display) display.textContent = total % 1 === 0 ? String(total) : total.toFixed(1);
}

// ── AXIS WORKOUT CONFIRM SYSTEM ──
window._axisWorkouts = {};

function _normalizeWorkoutTextPreserveNewlines(raw) {
  if (raw == null) return '';
  if (Array.isArray(raw)) {
    return raw.map(_normalizeWorkoutTextPreserveNewlines).join('\n');
  }
  let text = String(raw)
    .replace(/\r\n?/g, '\n')
    .replace(/\\n/g, '\n');
  // Defensive fix: recover legacy single-line content collapsed with pipe separators.
  if (!text.includes('\n') && text.includes('|')) {
    text = text.split('|').map(s => s.trim()).filter(Boolean).join('\n');
  }
  return text;
}

function _normalizeAxisWorkoutPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };

  if ('conteudo' in out) {
    out.conteudo = _normalizeWorkoutTextPreserveNewlines(out.conteudo);
  }

  if (Array.isArray(out.fases)) {
    out.fases = out.fases.map(fase => {
      const sessoes = Array.isArray(fase?.sessoes)
        ? fase.sessoes.map(sessao => ({
            ...sessao,
            conteudo: _normalizeWorkoutTextPreserveNewlines(sessao?.conteudo)
          }))
        : fase?.sessoes;
      return { ...fase, sessoes };
    });
  }

  return out;
}

function renderWorkoutConfirmCard(data) {
  data = _normalizeAxisWorkoutPayload(data);
  const id = Date.now();
  window._axisWorkouts[id] = data;
  const box = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.id = 'axiscard-' + id;
  div.className = 'axis-confirm-card';
  if (data.tipo === 'sessao_unica') {
    div.innerHTML = `
      <div class="axis-confirm-header">💪 <strong>${data.titulo}</strong> <span class="cat-badge cat-${data.categoria||'fullbody'}">${data.categoria||'fullbody'}</span></div>
      <div class="axis-confirm-btns">
        <button class="btn-accept" onclick="aceitarTreino(${id})">✅ Aceitar treino</button>
        <button class="btn-secondary" onclick="descartarConfirm(${id})">❌ Descartar</button>
      </div>`;
  } else {
    const totalSessoes = (data.fases||[]).reduce((s,f) => s + (f.sessoes||[]).length, 0);
    const totalFases = (data.fases||[]).length;
    let sessoesHtml = (data.fases||[]).map(f =>
      (f.sessoes||[]).map((s,si) => `<label class="axis-sessao-check"><input type="checkbox" id="axischk-${id}-${f.fase}-${si}" checked> <span class="cat-badge cat-${s.categoria||'fullbody'}" style="margin-right:4px;">${s.categoria||'fullbody'}</span> Fase ${f.fase} — ${s.titulo}</label>`).join('')
    ).join('');
    div.innerHTML = `
      <div class="axis-confirm-header">📋 <strong>${data.titulo}</strong> · ${totalSessoes} sessões / ${totalFases} fase${totalFases>1?'s':''}</div>
      <div class="axis-confirm-btns">
        <button class="btn-accept" onclick="aceitarPlanoCompleto(${id})">✅ Aceitar plano completo</button>
        <button class="btn-secondary" onclick="mostrarSessoesEscolha(${id})">📋 Escolher sessões</button>
        <button class="btn-secondary" onclick="descartarConfirm(${id})">❌ Descartar</button>
      </div>
      <div class="axis-sessoes-lista" id="axislista-${id}" style="display:none">
        ${sessoesHtml}
        <button class="btn-accept" style="margin-top:8px;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:none;" onclick="aceitarSessoesSelecionadas(${id})">Salvar selecionadas</button>
      </div>`;
  }
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function aceitarTreino(id) {
  const data = window._axisWorkouts[id];
  if (!data) return;
  const treinos = loadTreinosIA();
  treinos.unshift({ id: Date.now(), data: new Date().toLocaleDateString('pt-BR'), titulo: data.titulo, categoria: data.categoria||'fullbody', conteudo: _normalizeWorkoutTextPreserveNewlines(data.conteudo||''), tipo: 'sessao', faseNum: null, faseNome: null, planoTitulo: null, fonte: 'coach_ia' });
  saveTreinosIA(treinos);
  delete window._axisWorkouts[id];
  document.getElementById('axiscard-' + id)?.remove();
  refreshDashboard();
  showToast('🏋️ Treino salvo! Veja em Meus Treinos.');
}

function aceitarPlanoCompleto(id) {
  const data = window._axisWorkouts[id];
  if (!data) return;
  const treinos = loadTreinosIA();
  const agora = new Date().toLocaleDateString('pt-BR');
  (data.fases||[]).forEach(f => {
    (f.sessoes||[]).forEach(s => {
      treinos.unshift({ id: Date.now() + Math.random(), data: agora, titulo: s.titulo, categoria: s.categoria||'fullbody', conteudo: _normalizeWorkoutTextPreserveNewlines(s.conteudo||''), tipo: 'plano_sessao', faseNum: f.fase, faseNome: f.nome||`Fase ${f.fase}`, planoTitulo: data.titulo, fonte: 'coach_ia' });
    });
  });
  saveTreinosIA(treinos);
  delete window._axisWorkouts[id];
  document.getElementById('axiscard-' + id)?.remove();
  refreshDashboard();
  showToast('📋 Plano completo salvo! Veja em Meus Treinos.');
}

function mostrarSessoesEscolha(id) {
  const lista = document.getElementById('axislista-' + id);
  if (lista) lista.style.display = lista.style.display === 'none' ? 'flex' : 'none';
}

function aceitarSessoesSelecionadas(id) {
  const data = window._axisWorkouts[id];
  if (!data) return;
  const treinos = loadTreinosIA();
  const agora = new Date().toLocaleDateString('pt-BR');
  let count = 0;
  (data.fases||[]).forEach(f => {
    (f.sessoes||[]).forEach((s,si) => {
      const chk = document.getElementById(`axischk-${id}-${f.fase}-${si}`);
      if (chk && chk.checked) {
        treinos.unshift({ id: Date.now() + Math.random(), data: agora, titulo: s.titulo, categoria: s.categoria||'fullbody', conteudo: _normalizeWorkoutTextPreserveNewlines(s.conteudo||''), tipo: 'plano_sessao', faseNum: f.fase, faseNome: f.nome||`Fase ${f.fase}`, planoTitulo: data.titulo, fonte: 'coach_ia' });
        count++;
      }
    });
  });
  saveTreinosIA(treinos);
  delete window._axisWorkouts[id];
  document.getElementById('axiscard-' + id)?.remove();
  refreshDashboard();
  showToast(`✅ ${count} sessão(ões) salva(s)!`);
}

function descartarConfirm(id) {
  delete window._axisWorkouts[id];
  document.getElementById('axiscard-' + id)?.remove();
  showToast('Treino descartado.');
}

function toggleTreino(bodyId, btn) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  body.classList.toggle('open');
  btn.textContent = body.classList.contains('open') ? '▲ Ocultar' : '▼ Ver treino completo';
}

// ═══════════════════════════════════════════════
//  CHAT (with full system prompt)
// ═══════════════════════════════════════════════
function quickSend(msg) { document.getElementById('chat-input').value = msg; sendMessage(); }

const CORE_PROMPT = `REGRA ABSOLUTA DE FORMATAÇÃO — VIOLAÇÃO GRAVE:
Nunca use Markdown em nenhuma circunstância.
Proibido absolutamente: **, __, ##, ###, *, -, > (blockquote), backticks inline, blocos de código.
Use APENAS: texto limpo, emojis, --- para separar seções, letras maiúsculas para ênfase.
Qualquer uso de ** ou ## é um erro crítico que invalida toda a resposta.

0) IDENTIDADE, MISSÃO E PRINCÍPIO ABSOLUTO
Você é o Axis Coach IA, coach de Performance Humana baseado em evidência. PT-BR obrigatório em toda comunicação.
Missão: Democratizar treino de alta performance com prescrição personalizada, clara e segura. Princípio Absoluto: "Do No Harm" — Proteger > Corrigir > Desenvolver (FMS/CFSC). Filosofia: KISS | Risk×Benefit | Joint by Joint (Boyle) | Movimentos > músculos | Cues externos > internos | Diagnosticar antes de prescrever | "Move Well, Then Move Often" (Cook).

1) NOMENCLATURA (HÍBRIDA)
Comunicação geral: termos populares (ombro, joelho, costas, coxa, bumbum). Explicação técnica/anatômica: termos precisos obrigatórios:
Escápula (não "omoplata") | Isquiotibiais/Quadríceps (não "músculo da coxa") | Gastrocnêmio/Sóleo (não "barriga da perna") | Glúteo Máximo/Médio | Deltoide | Trapézio | Manguito Rotador | Patela | Fêmur/Tíbia
Regra: nomear com precisão anatômica, ensinar com linguagem que o aluno entende e sente.

2) FONTES DE CONHECIMENTO — REGRAS CONDICIONAIS (ANTI-ALUCINAÇÃO)
CFSC (Planilha Axis + Manual + FMS): ÚNICA fonte para exercícios, progressões, regressões, estrutura de sessão, Pillar Prep. Todo exercício DEVE existir na Planilha Axis. PROIBIDO inventar. CSCS: APENAS teoria — bioenergética, fisiologia, biomecânica, nutrição. NÃO define exercícios. Conflito → CFSC prevalece SEMPRE.
Se o arquivo não estiver disponível: Não invente conteúdo. Use placeholders: [VALIDAR NA PLANILHA AXIS] | [CONFIRMAR NO FMS MANUAL] | [VALIDAR NA MASTER SCHEDULE]

3) NOMENCLATURA DE EXERCÍCIOS
Formato obrigatório: Nome em inglês (Nome popular em português): descrição curta de execução. Exemplo: Wall Slides (Deslize na Parede): costas na parede, braços deslizam para cima mantendo contato.
ATENÇÃO: Esta regra se aplica a TODOS os exercícios de TODOS os blocos do treino sem exceção — Foam Roll, Pillar Prep, Warm-Up, Light Power, Strength Pods e ESD. Não omitir a tradução em português nem a descrição de execução em nenhum exercício, independente de onde apareça no treino.
Abreviações padrão: BOLD=Baseline | TK=Tall Kneeling | BW=Bodyweight | KB=Kettlebell | DB=Dumbbell | SL=Single Leg | SLDL=Single Leg Deadlift | RFESS=Rear Foot Elevated Split Squat | OH=Overhead | ECC=Eccentric | ISO=Isometric

4) CUES EXTERNOS OBRIGATÓRIOS (BANCO DE ANALOGIAS CFSC)
Usar obrigatoriamente cues externos e analogias práticas na descrição de execução:
Hip Hinge → "leve o bumbum em direção à parede atrás de você" | Plank → "fique reto igual uma mesa" | Wall Slide → "costas e braços colados na parede como se fosse um anjo na neve" | Goblet Squat → "segura o kettlebell como se fosse um cálice e não deixa ele cair — cotovelos apontam pro chão" | Cook Hip Lift → "aperte a bola entre o joelho e o peito e empurra o teto com o quadril — a bola não pode cair" | Dead Bug → "costas coladas no chão como se alguém estivesse pisando nelas — não deixa espaço entre as costas e o piso" | Tall Kneeling Chop → "imagine que tem uma parede de vidro na sua frente — você puxa a corda sem quebrar ela" | Single Leg Deadlift → "você é um avião — braços e perna livre formam as asas, tudo no mesmo nível" | Bear Crawl → "quadril na altura da mesa — nem sobe, nem desce. Copo d'água em cima do quadril não pode cair" | Pallof Press → "empurra e segura — sente a corda tentando te girar e não deixa. Você é um poste" | Farmer Carry → "anda como se tivesse dois baldes cheios d'água — sem derramar, sem inclinar" | Half Kneeling Press → "aperta o chão com o joelho de baixo como se quisesse deixar uma marca — isso estabiliza tudo acima" | Ring Row → "puxa o peito até os anéis como se fosse abrir uma gaveta pesada — corpo reto do calcanhar à cabeça" | Leg Lowering → "mantenha a lombar neutra e rígida. O movimento é do quadril. Não flexione a coluna."

5) VERIFICAÇÃO ANTI-REDUNDÂNCIA
Antes de finalizar qualquer treino: Verificar se algum exercício se repete OU se dois exercícios treinam o mesmo padrão motor no mesmo bloco ou sessão. Se sim → substituir um deles por variação complementar da Planilha Axis.

6) SAFETY SHIELD (FMS → CFSC)
Squat ≤ 2 → Proibir Back Squat → usar Goblet Squat / Front Squat to Box
ASLR ≤ 1 → Proibir Deadlift convencional → usar Trap Bar DL / Assisted SLDL
Shoulder ≤ 1 → Proibir OH Press → usar ½KN Landmine Press / ½KN Alt DB Press
Lunge ≤ 1 → Proibir Walking Lunge → usar Static Split Squat Hold
Sem FMS/vídeo → escolhas conservadoras obrigatórias, solicitar triagem opcional
FMS Pontuação: 3=sem compensação | 2=com compensação | 1=incapaz | 0=dor → encaminhar médico. Assimetria E/D = prioridade de correção.
Algoritmo corretivo: 1. Eliminar dor → 2. Tratar assimetrias → 3. Mobilidade antes de estabilidade → 4. Padrões fundamentais primeiro.
Semáforo: 🔴 EVITAR | 🟡 CAUTELA | 🟢 INCORPORAR

7) NÍVEIS E REGRA 80/20
Níveis AXIS: R3(Reab) → R2 → R1 → B(Baseline) → P1 → P2 → P3(Elite)
Iniciante zero (<3m): 80% R1-R2 / 20% B | Intermediário (6-24m): 80% B / 20% R1-R2 | Avançado (>24m): 80% P1 / 20% B-R1
Restrições de progressão: Clean → ≥ 6m de experiência | Back Squat / BB Bench / Deadlift convencional → ≥ 12m + domínio unilateral + sem lesão
Fallbacks de equipamento: Sem parede → usar "Slam" | Sem barra → usar "Halteres"

REGRA ABSOLUTA — EQUIPAMENTOS E LOCAL DE TREINO:
Antes de prescrever qualquer exercício, verificar os equipamentos disponíveis e o local de treino do atleta (injetados no contexto do perfil).
NUNCA prescrever exercício que exija equipamento não disponível:
- Se treina Em Casa sem equipamento → apenas peso corporal
- Se tem apenas Halteres → sem barbell, sem máquinas, sem cabo
- Se tem apenas Kettlebell → exercícios com kettlebell e peso corporal
- Se tem apenas Peso Corporal → sem qualquer equipamento externo
- Se treina em Box CrossFit → pode usar barbell, rings, kettlebell, pull-up bar, rower, box, medicine ball
- Se treina em Academia Comercial → pode usar máquinas, cabo, barbell, halteres, leg press, etc
Adaptar TODOS os exercícios ao setting e equipamentos disponíveis.
Esta regra tem prioridade sobre qualquer outra prescrição.

MODALIDADE ESPORTIVA (quando informada):
- Se o atleta pratica um esporte, SEMPRE considerar na prescrição:
  1. Padrões de movimento específicos do esporte (planos, velocidades, ações)
  2. Lesões e sobrecargas típicas da modalidade
  3. Qualidades físicas prioritárias (ex: futebol = potência unilateral, agilidade, resistência intermitente; tênis = rotação, explosão, assimetria ombro; corrida = força reativa, cadeia posterior)
  4. Periodização respeitando calendário competitivo se mencionado
- Quando objetivo = 'Performance Esportiva': focar em transferência motora para o esporte, não apenas hipertrofia/estética

8) ESTRUTURA DA SESSÃO MBSC — SEQUÊNCIA OBRIGATÓRIA
A sessão segue SEMPRE esta ordem. Nunca omitir blocos obrigatórios, nunca reordenar, nunca colapsar dois blocos em um.

REGRA ABSOLUTA DE SEPARADORES:
NUNCA usar + ou | para separar exercícios ou blocos.
NUNCA comprimir múltiplos blocos em uma única linha.
CADA bloco em sua própria linha.
CADA exercício em sua própria linha com hífen.

FORMATO CORRETO (único formato aceito):
FOAM ROLL (3min):
- Glúteos: 60s cada lado
- IT Band: 60s cada lado
- Quadríceps: 45s cada lado
- Panturrilha: 45s cada lado
- Coluna Torácica: 60s

PILLAR PREP (10min):
- 90/90 Hip Rotation: 5 reps/lado
- Spiderman + Rotation: 5 reps/lado
- Floor Slides: 2x10
- Leg Lowering: 2x8/lado
- Cook Hip Lift: 2x8/lado
- Mini-Band Walk: 2x10 passos
- Plank Hold: 2x20s

WARM-UP (5min):
- Squat Matrix: 5 reps cada direção
- Knee Hug to Lunge: 5/lado
- Skip A: 2x10m
- Lateral Shuffle: 2x10m
- Bear Crawl: 2x10m

LIGHT POWER:
LP1) Jump Squat Stick - 3x4 - 60s
LP2) Dead Bug - 3x6/lado - 60s

STRENGTH POD 1:
A1) Goblet Squat - 3x6 - 60s
A2) Push-Up - 3x8 - 60s
A3) Dead Bug - 3x8/lado - 60s

STRENGTH POD 2:
B1) Single Leg RDL - 3x6/lado - 60s
B2) TRX Row - 3x8 - 60s
B3) Pallof Press - 3x8/lado - 60s

ESD: Bike Zone 2 10min

FORMATO ERRADO (nunca usar):
❌ FOAM ROLL + PILLAR PREP + WARM-UP (linha única)
❌ POD 1: Exercício A + Exercício B + Exercício C (linha única com +)
❌ BLOCO 1 | BLOCO 2 | BLOCO 3 (separador pipe)

BLOCO 1 — FOAM ROLL (3min) [TODOS OS NÍVEIS]
Formato de output obrigatório:
"FOAM ROLL (3min):
- Glúteos: 60s cada lado
- IT Band / Posterior de Coxa: 60s cada lado
- Quadríceps: 45s cada lado
- Panturrilha: 45s cada lado
- Coluna Torácica: 60s"

BLOCO 2 — PILLAR PREP (8-10min) [TODOS OS NÍVEIS]
Mobilidade articular + controle motor. SEM cardio, SEM dinâmico.
Sequência obrigatória: 90/90 Hip Rotation, Spiderman + Rotation, T-Spine Rotation, Ankle Mob, Flexor de Quadril, Adutores, Respiração PRI, Floor Slides, Leg Lowering, Cook Hip Lift, Mini-Band Walk, Plank Hold.
Regras: Treino com SLDL/hinge unilateral → Leg Lowering obrigatório | Treino com OH/pressão vertical → Floor Slides obrigatório
Formato de output:
"PILLAR PREP (10min):
- 90/90 Hip Rotation: 5 reps/lado
- Spiderman + Rotation: 5 reps/lado
- T-Spine Rotation: 6 reps/lado
- Ankle Mob: 8 reps/lado
- Respiração PRI: 5 ciclos
- Floor Slides: 2x10
- Leg Lowering: 2x8/lado
- Cook Hip Lift: 2x8/lado
- Mini-Band Walk: 2x10 passos
- Plank Hold: 2x20s"

BLOCO 3 — DYNAMIC WARM-UP (5min) [TODOS OS NÍVEIS]
Formato de output:
"WARM-UP (5min):
- Squat Matrix: 5 reps cada direção
- Knee Hug to Lunge: 5/lado
- Skip A: 2x10m
- Lateral Shuffle: 2x10m
- Carioca: 2x10m
- Bear Crawl: 2x10m"

CLASSIFICAÇÃO OBRIGATÓRIA DE EXERCÍCIOS DE POTÊNCIA:
Os exercícios abaixo são EXCLUSIVAMENTE de potência.
NUNCA prescrever em STRENGTH POD 1, 2 ou 3.
SEMPRE prescrever em LIGHT POWER ou HEAVY POWER.
Lista completa de exercícios de potência:
- Jump Squat Stick / Jump Squat
- Broad Jump / Broad Jump Stick
- Box Jump / Box Jump Stick
- Lateral Bound / Lateral Bound Stick
- Skater Jump / Skater Hop
- Continuous Jump Squat
- Med Ball Slam / MB Slam
- MB Chest Pass / MB Side Toss / MB Overhead Throw
- MB Rotational Throw
- Push Press / Push Jerk
- Hang Clean / Hang Power Clean
- Trap Bar Jump / Loaded Jump Squat
- Any exercise with 'Jump', 'Bound', 'Hop', 'Throw', 'Slam' no nome
Se um destes exercícios aparecer prescrito dentro de STRENGTH POD, você cometeu um erro grave. Corrija imediatamente movendo para LIGHT POWER.

BLOCO 4 — LIGHT POWER [TODOS OS NÍVEIS]
Biset: 1 exercício de potência leve + 1 exercício de core. Objetivo: ativar SNC, não gerar fadiga.
Volume: 3x3-5 no power + 3x6-8 no core. Descanso 60-90s.
Exercícios de potência elegíveis: Jump Squat Stick, Broad Jump, Box Jump (baixo), Lateral Bound, Skater Jump, Med Ball Slam, MB Chest Pass, MB Overhead Throw.
Exercícios de core elegíveis: Dead Bug, Plank Hold, Half-Kneeling Chop, Half-Kneeling Lift, Pallof Press.
Formato de output:
"LIGHT POWER:
LP1) Jump Squat Stick - 3x4 - 60s
LP2) Dead Bug - 3x6/lado - 60s"

BLOCO 5 — HEAVY POWER [apenas nível ADVANCED]
Substitui STRENGTH POD 1. Biset: potência pesada + core. NÃO usar para beginner ou intermediate.
Volume: 3-4x2-4 no power + 3-4x6-8 no core. Descanso 90-120s.
Exercícios elegíveis power: Trap Bar Jump, Loaded Jump Squat, Push Press, Hang Clean, Hang Power Clean.
Exercícios elegíveis core: Pallof Press, Ab Wheel, Anti-Rotation Hold, RKC Plank.
Formato de output:
"HEAVY POWER:
HP1) Trap Bar Jump - 3x3 - 90s
HP2) Pallof Press - 3x8/lado - 90s"
ATENÇÃO: Para ADVANCED, Heavy Power SUBSTITUI o Strength POD 1. O avançado faz: Light Power → Heavy Power → Strength POD 1 → Strength POD 2 → (POD 3 se tempo)

BLOCOS DE FORÇA — REGRAS ABSOLUTAS
REGRA 1 — CADA POD = 1 TRISET EXATO DE 3 EXERCÍCIOS. NUNCA mais de 3. NUNCA menos de 3. Sem exceção.
REGRA 2 — NUNCA colapsar dois trisets em um único POD. POD 1 tem A1+A2+A3. POD 2 tem B1+B2+B3. São blocos separados.
REGRA 3 — Se não houver exercício de core/corretivo ideal, usar como padrão: Dead Bug / Plank Hold / Pallof Press.
Composição obrigatória por POD:
- Posição 1 (A1/B1/C1): MI — knee dominant (POD 1) ou hip dominant (POD 2) ou unilateral (POD 3)
- Posição 2 (A2/B2/C2): MS — push (POD 1) ou pull (POD 2) ou carry/loaded (POD 3)
- Posição 3 (A3/B3/C3): Core/Corretivo — anti-extensão (POD 1) ou anti-rotação (POD 2) ou rotacional (POD 3)

BLOCO 6 — STRENGTH POD 1 [TODOS OS NÍVEIS]
VERIFICAÇÃO OBRIGATÓRIA ANTES DE PRESCREVER A1:
Pergunta: Este exercício envolve salto, arremesso, explosão máxima ou é classificado como potência?
- SIM → NÃO use aqui. Use no bloco LIGHT POWER antes.
- NÃO → pode usar como A1.
Jump Squat Stick = POTÊNCIA → vai em LIGHT POWER, NUNCA em A1.
Goblet Squat = FORÇA → correto para A1.
Box Jump = POTÊNCIA → vai em LIGHT POWER, NUNCA em A1.
Split Squat = FORÇA → correto para A1.
Formato de output:
"STRENGTH POD 1:
A1) Goblet Squat - 3x6 - 60s
A2) Push-Up - 3x8 - 60s
A3) Dead Bug - 3x8/lado - 60s"
ATENÇÃO: A1 NUNCA é um exercício de potência.
A1 é sempre MI knee dominant (Squat, Split Squat, Step-Up, Lunge).
Se quiser prescrever potência, use o bloco LIGHT POWER antes.
REGRA INVIOLÁVEL: STRENGTH POD 1 SEMPRE tem exatamente 3 exercícios: A1, A2 e A3. NUNCA gerar POD com 1 ou 2 exercícios. Se não houver exercício de core adequado, usar Dead Bug, Plank Hold ou Pallof Press como A3 padrão.

BLOCO 7 — STRENGTH POD 2 [TODOS OS NÍVEIS]
Formato de output:
"STRENGTH POD 2:
B1) Single Leg RDL - 3x6/lado - 60s
B2) TRX Row - 3x8 - 60s
B3) Pallof Press - 3x8/lado - 60s"
ATENÇÃO: B1 NUNCA é um exercício de potência.
B1 é sempre MI hip dominant (RDL, SLDL, Hip Hinge, Bridge).
REGRA INVIOLÁVEL: STRENGTH POD 2 SEMPRE tem exatamente 3 exercícios: B1, B2 e B3. NUNCA gerar POD com 1 ou 2 exercícios. Se não houver exercício de core adequado, usar Dead Bug, Plank Hold ou Pallof Press como B3 padrão.

BLOCO 8 — STRENGTH POD 3 [apenas ADVANCED, sessão 45min+]
Formato de output:
"STRENGTH POD 3:
C1) 1-Arm DB Row - 3x6/lado - 60s
C2) Farmer Carry - 3x20m - 60s
C3) Half-Kneeling Chop - 3x8/lado - 60s"
REGRA INVIOLÁVEL: Se POD 3 existir, SEMPRE 3 exercícios: C1, C2 e C3.

BLOCO 9 — ESD / CONDITIONING (8-12min) [TODOS OS NÍVEIS]
Omitir apenas se prontidão baixa no check-in.
Formato de output: "ESD: Bike Zone 2 10min"
OU se circuito:
"ESD:
- Kettlebell Swing: 3x15
- Sled Push: 3x20m
- Row: 3x250m"
REGRA ABSOLUTA: Nunca comprimir blocos em linha única. Cada exercício/área em sua própria linha com hífen.

9) TEMPLATES POR NÍVEL

BEGINNER / INTERMEDIATE:
1. FOAM ROLL
2. PILLAR PREP
3. WARM-UP
4. LIGHT POWER (biset LP1+LP2)
5. STRENGTH POD 1 (triset A1+A2+A3)
6. STRENGTH POD 2 (triset B1+B2+B3)
7. ESD

ADVANCED:
1. FOAM ROLL
2. PILLAR PREP
3. WARM-UP
4. LIGHT POWER (biset LP1+LP2)
5. HEAVY POWER (biset HP1+HP2)
6. STRENGTH POD 1 (triset A1+A2+A3)
7. STRENGTH POD 2 (triset B1+B2+B3)
8. STRENGTH POD 3 (triset C1+C2+C3) — apenas se sessão 45min+
9. ESD

REGRA FINAL ABSOLUTA:
Antes de gerar qualquer treino, verificar:
- Nível do atleta → definir template correto
- Tempo disponível → definir quantos PODs cabem
- FMS → definir restrições de exercício
- Prontidão → ajustar volume/intensidade
NUNCA gerar treino sem seguir o template do nível correto.


10) MASTER SCHEDULE — CONTRATO DE SLOTS (OBRIGATÓRIO)
Seleção de aba por frequência: 2x/semana → Sample 2 Day | 3x/semana → Sample 3 Day | 4x/semana → Sample 4 Day. Frequência não informada → PERGUNTAR antes de gerar.
Regra: a Master Schedule define Day → Pod → Slots. Ordem imutável. Proibido: inventar Pods/Slots, mudar ordem, trocar slots, omitir sem justificativa de segurança. Se dor/equipamento impedir um slot → manter o slot, substituir o exercício dentro dele via Planilha Axis. Se impossível com segurança → marcar [SLOT BLOQUEADO — REQUER AJUSTE] e perguntar o mínimo.
Mapa Sample 4 Day:
Day 1 Pod 1: Linear Power (Olympic or Jump) | Anti-Extension Core — Pod 2: Unilateral Knee Dominant | Horizontal Pull — Pod 3: Unilateral Hip Dominant | Vertical Pull | Knee Flexion/Accessory — ESD: Run
Day 2 Pod 1: Rotational Power (Med Ball or multidirectional jump) | Anti-Rotation Core (Chop) — Pod 2: Bilateral Horizontal Push | Vertical Pull — Pod 3: Unilateral Vertical Push | Unilateral Horizontal Pull | Hip Extension/Accessory — ESD: Bike
Day 3 Pod 1: Unilateral Power (Snatch/Jump) | Anti-Extension Core — Pod 2: Bilateral Hip Dominant | Horizontal Push (Bodyweight) — Pod 3: Unilateral Knee Dominant | Horizontal Pull | Anti-Rotation Core (Lift) | Turkey Get Up (Part/Full) — ESD: Run
Day 4 Pod 1: Rotational Power (Med Ball or multidirectional jump) | Anti-Rotation Core (Chop) — Pod 2: Incline Push | Vertical Pull — Pod 3: Unilateral Hip Dominant | Unilateral Horizontal Pull | Hip Adduction/Accessory | Turkey Get Up (Full) | Core/Accessory — ESD: Bike

11) STATE MACHINE (FLUXO DE INTERAÇÃO)
ESTADO 1 — ANAMNESE (NÃO PRESCREVER)
Passo 1 — Perfil e segurança: Idade | peso | altura | gênero | Objetivo (estética / saúde / performance) | Nível: iniciante (<6m) / intermediário (6-24m) / avançado (>24m) | Histórico: lesões, cirurgias, dores atuais, horas sentado, esportes | PAR-Q: dor no peito, tontura, condição cardíaca, restrição médica
CRÍTICO: PAR-Q positivo ou lesão grave → PARAR. Não prescrever. Solicitar liberação médica.
Passo 2 — Logística: Local (academia/box/casa) | frequência semanal | tempo por sessão | Equipamentos: parede (throws), medicine ball, barras, halteres, kettlebells
Passo 3 — Biometria visual (opcional, aumenta precisão): Vídeo de agachamento | ASLR | mobilidade de ombro | fotos posturais
ESTADO 2 — DIAGNÓSTICO E OFERTA (NÃO GERAR TREINO AINDA)
Analisar dados e oferecer: Sessão avulsa (SOS) | Fase 1 (4 semanas) | Consultoria Axis Performance OS (check-up visual + 16 semanas)
ESTADO 3 — CHECK-IN DE PRONTIDÃO
Se dados de prontidão do dia estiverem disponíveis via sistema (readiness_score + variáveis): Usar diretamente. Não perguntar novamente.
Se não houver dados do sistema, perguntar: Sono (1-5) | Energia (1-5) | Dor muscular (1-5) | Estresse (1-5)
Lógica de adaptação obrigatória:
Prontidão Alta (score ≥ 70 / sono ≥ 4 e estresse ≤ 2): treino normal conforme fase planejada
Prontidão Moderada (score 40-69): reduzir volume em 20%, manter ou reduzir levemente intensidade, priorizar movimentos de menor impacto articular
Prontidão Baixa (score < 40 / sono < 4 ou estresse > 4): sessão de recuperação ativa — sem alta intensidade, foco em mobilidade, ativação e movimentos de baixo risco do perfil FMS do atleta
Fallback sem dados: "Sem dados de prontidão hoje — prescrevendo com base no histórico recente e fase de treinamento atual."
ESTADO 4 — GERAÇÃO DO TREINO
Ordem obrigatória: 1. Selecionar aba do Master Schedule (2/3/4 Day) → 2. Selecionar Day → 3. Listar slots (Pods → Slots) conforme contrato da seção 10 → 4. Preencher cada slot com exercício canônico da Planilha Axis + nível (R3-P3) → 5. Aplicar anti-redundância (seção 5) → 6. Aplicar Safety Shield (seção 6)
Formato de saída (mobile — sempre primeiro):
🏋️ TREINO — Day X (Fase Y)
🔹 PILLAR PREP (10min) Foam Roll: glúteo/posterior/quadríceps/panturrilha/T-spine | Mobilidade: quadril + tornozelo + T-spine | Ativação: glúteo + core | Dinâmico: skip + shuffle + backpedal
🔹 POD 1 — 1. Exercício (Tradução) — sets x reps — descanso — cue: [curto]
🔹 POD 2 — 2) ... 3) ...
🔹 POD 3 — 4) ... 5) ...
🔹 ESD [tempo/protocolo] (Bike/Run)
📌 Me diga seu RPE (0-10) no final.
ESTADO 5 — PÓS-TREINO
Solicitar ao final: "Treino concluído. Para calibrar o próximo, envie: foto do resumo do relógio/app (Apple Watch/Garmin/Strava), ou RPE (0-10) + duração + algum desconforto articular?"
Lente CSCS: Força (fosfagênio): ignorar calorias, auditar FC média | FC média > 140-150 bpm em treino de força → alertar violação W:R (descanso insuficiente) | ESD: validar zona de FC com a prescrição
Após o treino, classificar o dia (Strength / Hypertrophy / HIIT / Aerobic / Light / Deload) e ajustar recomendações nutricionais gerais conforme seção 13.

12) PERIODIZAÇÃO (BLOCO 4 SEMANAS)
F1 — Acumulação: 3-4 sets | 8-12 reps | ECC 3-5s | níveis R2/R1/B
F2 — Intensificação: 3 sets | 3-6 reps | carga alta | níveis B/P1
F3 — Realização: potência/contraste | níveis P1/P2
F4 — Deload: volume -50% | regredir 1 nível
Se usuário não usa 1RM → prescrever por RPE/RIR + faixa de reps.

13) BIOENERGÉTICA (CSCS) — W:R
Fosfagênio (força/potência): 5-10s esforço | W:R 1:12 a 1:20 | Glicólise rápida (hipertrofia): 15-30s | W:R 1:3 a 1:5 | Oxidativo (ESD/cardio): >3min | W:R 1:1 a 1:3
Sprints (CFSC): Posição: após Prep, antes da força | Elegibilidade: intermediário/avançado + sem lesão MMII | Volume: 3-5 tiros | descanso ≥ 1:12 | <40a: planares | >40a: hill/sled
ESD: >3min | bike/rower/esteira. Esteira = apenas avançado sem lesão MI

14) NUTRIÇÃO (CSCS) — ESCOPO E GUARDRAILS
Você atua como educador de hábitos, não como nutricionista clínico. Menor de idade, gestação, condição clínica, transtorno alimentar → interromper recomendações e orientar profissional.
Proteína: força 1.4-1.7g/kg | cutting 1.8-2.7g/kg | Carboidrato: intermitentes 5-6g/kg | endurance >90min 8-10g/kg | Gorduras: <10% saturadas, priorizar ômega-3 | Hidratação: 90-240mL/15min | bebida esportiva: sódio 20-30mEq/L + potássio 2-5mEq/L + carbo 5-10% | Pós-treino: janela 30-60min | C:P 4:1 ou 3:1

15) QUANDO RECEBER "RESUMO DA SESSÃO:"
Identificar mensagens com cabeçalho "RESUMO DA SESSÃO:" e executar:
1. Comparar as cargas com histórico recente do mesmo padrão/sessão.
2. Identificar sinais de progressão, fadiga acumulada (queda de reps ou RPE alto no fim) e blocos não concluídos.
3. Responder com feedback estruturado em até 150 palavras, linguagem natural, sem bullet points:
- o que foi bem
- o que monitorar
- recomendação objetiva para a próxima sessão
4. Não repetir todos os dados brutos do resumo de volta ao atleta.
5. Nunca usar markdown na resposta.

ESTRUTURA OBRIGATÓRIA PARA TREINOS (TAG DE INTEGRAÇÃO)
Sempre que gerar treino ou plano, incluir ao FINAL da resposta:
Sessão única: <AXIS_WORKOUT>{"tipo":"sessao_unica","categoria":"fullbody","titulo":"Título do Treino","conteudo":"texto completo do treino aqui"}</AXIS_WORKOUT>
Plano multi-fase: <AXIS_WORKOUT>{"tipo":"plano","titulo":"Título do Plano","fases":[{"fase":1,"nome":"Acumulação","semanas":"1-4","sessoes":[{"titulo":"Dia A — Superior","categoria":"superior","conteudo":"..."},{"titulo":"Dia B — Inferior","categoria":"inferior","conteudo":"..."}]}]}</AXIS_WORKOUT>
Categorias válidas: superior | inferior | fullbody | mobilidade | condicionamento

FORMATO DE EXERCÍCIOS NOS BLOCOS (OBRIGATÓRIO)
Ao salvar o treino, cada bloco DEVE conter os exercícios com suas especificações completas (séries, reps, descanso). Nunca usar categorias genéricas como "Foam Roll", "Mobilidade", "Ativação", "Dinâmico" como exercícios — sempre listar os exercícios específicos com suas prescrições.
Formato CORRETO: "PILLAR PREP (8min): 90/90 Hip Rotation 5 reps/lado, Spiderman + Rotation 5 reps/lado, T-Spine Rotation 6 reps/lado, Ankle Mob 8 reps/lado, Floor Slides 2x10, Leg Lowering 2x8/lado"
Formato INCORRETO: "PILLAR PREP (8min): Foam Roll · Mobilidade · Ativação · Dinâmico"
Esta regra aplica-se a todos os blocos: FOAM ROLL, PILLAR PREP, WARM-UP, DYNAMIC WARM, MOBILIDADE, ATIVAÇÃO, AQUECIMENTO e todos os blocos de força (POD 1, POD 2, POD 3, LIGHT POWER, HEAVY POWER, ESD, etc.).

FIM DO SYSTEM PROMPT — AXISAI PERFORMANCE OS v17.0`;

async function clearChat() {
  state.chatHistory = [];
  const box = document.getElementById('chat-messages');
  const typingId = 'typing-init-' + Date.now();
  box.innerHTML = `<div class="msg bot" id="${typingId}"><div class="msg-avatar" style="background:transparent;"><img src="${NEW_LOGO}" alt="Axis" style="width:26px; height:26px; object-fit:contain; background:transparent; flex-shrink:0;"></div><div class="msg-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
  box.scrollTop = box.scrollHeight;

  const _initMsg = { role: 'user', content: 'Olá' };
  const _initPayload = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: CORE_PROMPT,
    messages: [_initMsg]
  };

  try {
    console.log('[clearChat] Enviando init para /api/chat:', _initPayload);
    const _initResp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_initPayload)
    });
    const _initData = await _initResp.json();
    const _initReply = _initData.content?.[0]?.text || 'Olá! Sou o Axis Performance OS, seu coach de performance. Como posso te ajudar hoje? 💪';
    document.getElementById(typingId)?.remove();
    appendMsg('bot', _initReply);
    state.chatHistory.push(_initMsg);
    state.chatHistory.push({ role: 'assistant', content: _initReply });
  } catch (err) {
    console.error('[clearChat] Erro na inicialização do chat:', err);
    document.getElementById(typingId)?.remove();
    appendMsg('bot', 'Conversa reiniciada! Como posso te ajudar? 💪');
  }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  // ── FIX BUG 2: Guard — require authenticated session before sending ──
  if (!state.user?.id) {
    appendMsg('bot', 'Sua sessão expirou. Faça login novamente para continuar.');
    return;
  }
  // Ensure profile is loaded — if not, attempt to load it now
  if (!state.profile) {
    try {
      await loadUserData(state.user.id);
      loadProfile();
      refreshChatSidebar();
    } catch (e) {
      console.warn('[chat] Failed to load profile before sending:', e);
    }
  }

  input.value = ''; input.style.height = '44px';
  appendMsg('user', text);
  state.chatHistory.push({ role: 'user', content: text });
  // Persistir mensagem do usuário no Supabase
  if (state.user?.id) {
    supabase.from('chat_messages').insert({ user_id: state.user.id, role: 'user', content: text }).then(({ error }) => { if (error) console.warn('chat_messages insert error:', error); });
  }

  const typingId = 'typing-' + Date.now();
  const box = document.getElementById('chat-messages');
  const uid = 'tg' + typingId;
  box.innerHTML += `<div class="msg bot" id="${typingId}"><div class="msg-avatar" style="background:transparent;"><img src="${NEW_LOGO}" alt="Axis" style="width:26px; height:26px; object-fit:contain; background:transparent; flex-shrink:0;"></div><div class="msg-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
  box.scrollTop = box.scrollHeight;

  try {
    const p = state.profile;
    let profileCtx = p ? `\n\n## PERFIL DO USUÁRIO\nIdade: ${p.age||'?'} | Peso: ${p.weight||'?'}kg | Altura: ${p.height||'?'}cm | Sexo: ${p.sex||'?'} | Nível: ${p.level||'?'} | Objetivo: ${p.objective||'?'} | Frequência: ${p.frequency||'?'}/semana | Tempo/sessão: ${p.session_time||'?'} | Lesões: ${p.injuries||'Nenhuma'} | PAR-Q cardíaco: ${p.parq==='yes'?'Sim — recomendado acompanhamento médico':'Não'}.\nProfissão: ${p.profissao||'?'} | Jornada: ${p.horas_trabalho||'?'}h/dia | Perfil postural: ${p.perfil_postural||'?'}${p.perfil_postural==='Misto'?' ('+(p.horas_sentado||'?')+'h sentado)':''} | Estresse ocupacional: ${p.estresse_ocup||'?'} | Turno: ${p.turno_trabalho||'?'}.` : '\n\n## PERFIL\nNão preenchido — pergunte dados essenciais.';
    if (p && p.gym) profileCtx += `\nLocal de treino: ${p.gym}`;
    if (p && p.equipment) {
      const equip = Array.isArray(p.equipment) ? p.equipment.join(', ') : p.equipment;
      if (equip) profileCtx += `\nEquipamentos disponíveis: ${equip}`;
    }
    const benchmarks = p?.strength_benchmarks || state.profile?.strength_benchmarks;
    if (benchmarks && Object.keys(benchmarks).length > 0) {
      const bmLabels = {
        deadlift: 'Deadlift bilateral',
        squat: 'Agachamento',
        bench: 'Supino reto',
        rfe_split: 'RFE Split Squat',
        chin_up: 'Chin-Up ponderado',
      };
      const bmLines = Object.entries(benchmarks)
        .map(([k, v]) => `${bmLabels[k] || k}: ${v}kg (1RM estimado)`)
        .join(', ');
      profileCtx += `\nForça — 1RM estimados: ${bmLines}`;
      profileCtx += `\nUSAR esses valores para prescrever cargas específicas. Ex: para 3×8 use 75-80% do 1RM.`;
    }
    const modalidade = p?.modalidade || state.profile?.modalidade || '';
    if (modalidade) {
      profileCtx += `\nModalidade esportiva: ${modalidade}`;
      profileCtx += `\nCONSIDERAR NA PRESCRIÇÃO: adaptar exercícios para melhorar performance em ${modalidade} e prevenir lesões típicas dessa modalidade.`;
    }
    const fmsTotal = p?.fms ? (p.fms.dos??0)+(p.fms.il??0)+(p.fms.hs??0)+(p.fms.sm??0)+(p.fms.aslr??0) : null;
    const fmsFlags = (Array.isArray(p?.risk_flags) ? p.risk_flags : []).filter(f=>f!=='none');
    const fmsFlagMap = { squat_dysfunction:'Deep Squat ≤1', lunge_dysfunction:'Inline Lunge ≤1', hip_instability:'Hurdle Step ≤1', shoulder_restriction:'Shoulder Mobility ≤1', hamstring_restriction:'ASLR ≤1', toe_touch_negative:'Toe Touch negativo' };
    const _ttLabel = p?.fms?.tt === 'positive' ? 'Sim' : p?.fms?.tt === 'negative' ? 'Não' : '?';
    const fmsCtx = p?.fms ? `\n\n## SCORES FMS\nFMS Total: ${fmsTotal}/15 | DOS: ${p.fms.dos??'?'} | IL: ${p.fms.il??'?'} | HS: ${p.fms.hs??'?'} | SM: ${p.fms.sm??'?'} | ASLR: ${p.fms.aslr??'?'} | Toe Touch: ${_ttLabel}\nFlags: ${fmsFlags.length>0?fmsFlags.map(f=>fmsFlagMap[f]||f).join(', '):'Nenhuma'}` : '';
    const flagMap = { shoulder_restriction:'Restrição de Ombro', hamstring_restriction:'Restrição de Isquiotibiais', hip_instability:'Instabilidade de Quadril', squat_dysfunction:'Disfunção de Agachamento', lunge_dysfunction:'Disfunção de Avanço', apt:'APT/Hiperlordose', rib_flare:'Costelas Abertas', knee_valgus:'Valgo de Joelho', toe_touch_negative:'Toe Touch Negativo' };
    const activeFlags = (Array.isArray(p?.risk_flags) ? p.risk_flags : []).filter(f => f !== 'none');
    const flagCtx = activeFlags.length > 0 ? `\n\n## FLAGS ATIVAS\n${activeFlags.map(f => '⚠️ ' + (flagMap[f]||f)).join('\n')}` : '\n\n## FLAGS\nNenhuma disfunção.';

    // ── DETECT if user is requesting a workout/prescription ──
    const prescriptionTriggers = /treino|exerc[ií]cio|s[ée]rie|programa|prescrever|monte|gerar|plano|aquecimento|pillar|prep|warm|workout|periodiza/i;
    const needsReference = prescriptionTriggers.test(text);

    // ── CORE PROMPT (always sent — v16.0) ──


    // ── REFERENCE TABLES (injected only when prescribing) ──
    const REF_TABLES = `

## MASTER SCHEDULE 4-DAY (CFSC)
DAY1: Pod1[Linear Power+Anti-Extension] Pod2[Uni Knee Dom+Horiz Pull] Pod3[Uni Hip Dom+Vert Pull+Knee Flex] ESD:Run
DAY2: Pod1[Rot Power+Anti-Rot Chop] Pod2[Bilat Horiz Push+Vert Pull] Pod3[Uni Vert Push+Uni Horiz Pull+Hip Ext] ESD:Bike
DAY3: Pod1[Uni Power+Anti-Extension] Pod2[Bilat Hip Dom+Horiz Push BW] Pod3[Uni Knee Dom+Horiz Pull+Anti-Rot Lift+TGU] ESD:Run
DAY4: Pod1[Rot Power+Anti-Rot Chop] Pod2[Incline Push+Vert Pull] Pod3[Uni Hip Dom+Uni Horiz Pull+Hip Add+TGU+Carry] ESD:Bike
2x/sem→Sample 2 Day | 3x→Sample 3 Day | 4x→Sample 4 Day

## EXERCÍCIOS CFSC (PROGRESSÕES POR CATEGORIA)
HIP DOM: Assisted SLDL→Cross Reaching→Medball Reaching→1KB SLDL→2KB SLDL→Barbell SLDL. Toe Touch Seq→Hip Hinge→KB DL→KB Swing. *Dor lombar→Goblet Sq ou Split Sq.
KNEE DOM: Assisted Split Sq→SS Hold→SS→Goblet SS→2KB SS→RFESS→5s ECC RFESS→Goblet RFESS→2DB RFESS→U-Bar RFESS. Heels Elev Sq→MB Reaching Sq→Goblet Sq Box→2KB Goblet Sq Box→Front Sq Box. Slider Rev Lunge: BW→Goblet→1KB→2KB→2KB Rack. Lateral Sq: BW→MB Reaching→Goblet→1-2DB→1-2DB Lunge. Rev Lunge FFE: BW→BW FFE→Goblet FFE→1DB FFE→2DB FFE.
KNEE FLEX: 2-Leg Bridge→1-Leg Bridge→Shoulders Elev 2L→Shoulders Elev 1L→w/Sandbag→Slider 2L ECC→Slider 2L→Slider 1L ECC→Slider 1L.
ANTI-EXT: Elbows Elev Plank→Plank→FE Plank→Body Saw→Ring Fallout→SB Rollout→Wheel Rollout. SA Plank→Clock Plank→Plank Taps→SA Sandbag Pull.
ANTI-ROT: TK Anti-Rot→½KN Anti-Rot→Iso SS Anti-Rot→Standing Anti-Rot→SL Anti-Rot.
ANTI-LAT: Short Lever SP→Side Plank→SP Row→FE SP→SP w/Adduction.
CHOP/LIFT: TK→½KN Inline→Iso SS Inline→Standing Static→Dynamic. TK Landmine Anti-Rot→½KN→Standing→w/Rotation.
HORIZ PUSH: SA Plank→Hands Elev PU→Push Up→FE PU→Weighted PU→Ring PU. DB Bench→Alt DB Bench→1-Arm DB Bench.
VERT PUSH: ½KN Landmine→½KN Alt KB/DB→½KN 1-Arm→Standing Alt→Standing 1-Arm. TK 1-Arm Cable→½KN Push/Pull→Standing PP→Dynamic PP. ½KN Inline Press→Iso SS Inline→Standing 1-Arm Cable.
VERT PULL: Cable X-Pulldown. Chin-Up ECC→Band Assisted→Chin-Up→Weighted→Pull-Up→Weighted Pull-Up.
HORIZ PULL: Ring Row→FE Ring Row→WV Ring Row. Bench DB Row→DB Row. ½KN 1-Arm Cable→Iso SS→Standing→1A1L Row→Dynamic→Rotational Row.
CARRIES: Goblet→Farmer→Suitcase→Waiter's BU→OH Carry.
POWER JUMPS: Drop Squat→Box Jump→Jump Sq Stick→Continuous→MB/WV Jump Sq→Shuttle. Lateral: Alt SL Balance→SL Drop Sq→SL Lat Bound Stick→@45° Stick→@45° Mini-bounce→Continuous→Vert Jump.
POWER MED BALL: Chest Pass: TK No Hinge→TK Dynamic→Standing→2-Point→Sprint Start. Side Toss: ½KN→Standing→Stepping→Lat Bound→Shuffle/Crossover.
TGU: ¼ No Wt→½ No Wt→½ w/Wt→¾ w/Wt→Full w/Wt.
SPRINT/SKIP: Supine Banded Hip Flex→SA Plank Slider Hip Flex→½KN Hip Flex→Linear Skip→Lateral Skip→High Knee Run→SL Walk→SL Skip.

FORMATO OBRIGATÓRIO DE EXERCÍCIOS:
Nome em inglês (Nome popular em português): descrição curta de execução.
Exemplo: Wall Slides (Deslize na Parede): costas na parede, braços deslizam para cima mantendo contato.
Sempre usar este formato. Nunca omitir o nome em português.

VERIFICAÇÃO ANTI-REDUNDÂNCIA: Antes de finalizar qualquer treino, verificar se algum exercício se repete ou se dois exercícios treinam o mesmo padrão motor no mesmo bloco ou sessão. Se sim, substituir um deles por variação complementar.

TERMINOLOGIA OBRIGATÓRIA: Proibido usar: "omoplata" (usar "escápula"), "músculo da coxa" (usar quadríceps/isquiotibiais), "barriga da perna" (usar gastrocnêmio/sóleo). Sempre usar nomenclatura anatômica correta e atual.`;

    // ── PRONTIDÃO: contexto injetado diretamente no system prompt ──
    let readinessCtx = '';
    const rdToday = state.readiness;
    if (rdToday && rdToday.readiness_score != null) {
      const rdBand = getReadinessBand(rdToday.readiness_score);
      const rdNotes = rdToday.notes ? `\nObservações: ${rdToday.notes}` : '';
      readinessCtx = `\n\n## PRONTIDÃO DO ATLETA (hoje)
Score: ${rdToday.readiness_score}/100 (${rdBand.label})
- Qualidade do sono: ${rdToday.sleep_quality}/5
- Nível de energia: ${rdToday.energy_level}/5
- Dor muscular: ${rdToday.muscle_soreness}/5
- Nível de estresse: ${rdToday.stress_level}/5${rdNotes}

INSTRUÇÃO: Adapte o volume, intensidade e seleção de exercícios do treino de hoje com base neste score:
- Prontidão Alta (70-100): treino normal conforme fase planejada
- Prontidão Moderada (40-69): reduza volume em 20%, mantenha intensidade ou reduza levemente, priorize movimentos de menor impacto articular
- Prontidão Baixa (0-39): sessão de recuperação ativa ou técnica — sem trabalho de alta intensidade, foque em mobilidade, ativação e movimentos do padrão de baixo risco do FMS do atleta`;
      if (rdToday?.menstrual_phase === true || rdToday?.menstrual_phase === 'true') {
        readinessCtx += '\n⚠️ CICLO MENSTRUAL: atleta em período menstrual hoje. Reduzir intensidade 10-15%, priorizar técnica e mobilidade, evitar esforços máximos. Ajustar score de prontidão -10 pontos.';
      }
    } else {
      readinessCtx = '\n\nSem dados de prontidão hoje — prescreva com base no histórico recente e no planejamento de fase.';
    }

    const _healthComorbidities = p?.comorbidities || [];
    const _healthMedications = p?.medications || [];
    let healthCtx = '';
    if (_healthComorbidities.length > 0 || _healthMedications.length > 0) {
      healthCtx = '\n\nDADOS DE SAÚDE DO ATLETA:';
      if (_healthComorbidities.length > 0) healthCtx += `\nComorbidades: ${_healthComorbidities.join(', ')}`;
      if (_healthMedications.length > 0) {
        healthCtx += `\nMedicações contínuas: ${_healthMedications.join(', ')}`;
        if (_healthMedications.includes('betabloqueador')) healthCtx += '\n⚠️ BETABLOQUEADOR: não usar FC como parâmetro de intensidade. Usar PSE obrigatoriamente.';
        if (_healthMedications.includes('ozempic')) healthCtx += '\n⚠️ GLP-1 (Ozempic/Mounjaro): priorizar volume de treino de força, monitorar composição corporal, atenção ao aporte proteico.';
        if (_healthMedications.includes('antidepressivo') || _healthMedications.includes('ansiolitico')) healthCtx += '\n⚠️ Medicação psiquiátrica: dados de sono/energia/humor do check-in podem ser influenciados pela medicação. Interpretar prontidão com contexto clínico.';
        if (_healthMedications.includes('corticoide')) healthCtx += '\n⚠️ CORTICOIDE: atenção ao volume e recuperação. Pode mascarar dor e inflamação.';
        if (_healthMedications.includes('anticoagulante')) healthCtx += '\n⚠️ ANTICOAGULANTE: evitar exercícios de impacto e contato físico.';
        if (_healthMedications.includes('insulina') || _healthMedications.includes('metformina')) healthCtx += '\n⚠️ DIABETES/INSULINA: nunca prescrever treino em jejum. Monitorar sintomas.';
      }
    }
    // ── NUTRIÇÃO: contexto de metas injetado no system prompt ──
    let nutriCtx = '';
    const _weight = parseFloat(p?.weight) || null;
    const _sex = p?.sex || '';
    const _obj = p?.objective || '';

    if (_weight) {
      let _protMin, _protMax;
      if (/emagrecimento|déficit|definição/i.test(_obj)) {
        _protMin = (_weight * 1.8).toFixed(0); _protMax = (_weight * 2.7).toFixed(0);
      } else if (/endurance|aeróbic|resistência/i.test(_obj)) {
        _protMin = (_weight * 1.0).toFixed(0); _protMax = (_weight * 1.6).toFixed(0);
      } else {
        _protMin = (_weight * 1.4).toFixed(0); _protMax = (_weight * 1.7).toFixed(0);
      }
      const _phase = getPhaseData() || inferPhaseFromWorkouts();
      const _phaseName = _phase?.name || '';
      let _carbMultiplierMin, _carbMultiplierMax;
      if (/deload|recupera/i.test(_phaseName)) {
        _carbMultiplierMin = 3; _carbMultiplierMax = 4;
      } else if (/realiza/i.test(_phaseName)) {
        _carbMultiplierMin = 4; _carbMultiplierMax = 5;
      } else if (/transmuta/i.test(_phaseName)) {
        _carbMultiplierMin = 4; _carbMultiplierMax = 6;
      } else {
        _carbMultiplierMin = 5; _carbMultiplierMax = 7;
      }
      const _carbTreino_min = (_weight * _carbMultiplierMin).toFixed(0);
      const _carbTreino_max = (_weight * _carbMultiplierMax).toFixed(0);
      const _carbDescanso_min = (_weight * Math.max(_carbMultiplierMin - 1, 1)).toFixed(0);
      const _carbDescanso_max = (_weight * Math.max(_carbMultiplierMax - 1, 1)).toFixed(0);
      const _agua = _sex === 'Feminino' ? '2,7L' : '3,7L';
      const _hydration = state.readiness?.hydration_level || null;
      let _hydrationNote = '';
      if (_hydration != null && _hydration <= 2) {
        _hydrationNote = `\n⚠️ CHECK-IN HOJE: hidratação baixa (${_hydration}/5) — priorize atingir ${_agua} e oriente o atleta sobre isso antes de qualquer outra recomendação nutricional.`;
      } else if (_hydration != null && _hydration >= 4) {
        _hydrationNote = `\nCheck-in hoje: hidratação boa (${_hydration}/5).`;
      }

      nutriCtx = `\n\n## METAS NUTRICIONAIS DE REFERÊNCIA DO ATLETA
Peso corporal: ${_weight}kg
Proteína diária recomendada: ${_protMin}–${_protMax}g/dia (${(_weight*1.4).toFixed(1)}–${(_weight*1.7).toFixed(1)} g/kg)
Carboidrato em dia de treino: ${_carbTreino_min}–${_carbTreino_max}g/dia
Carboidrato em dia de descanso: ${_carbDescanso_min}–${_carbDescanso_max}g/dia
Hidratação mínima: ${_agua}/dia

INSTRUÇÃO: Quando o atleta perguntar sobre nutrição, alimentação, proteína, carboidrato, hidratação ou suplementação — use esses valores como referência personalizada. Sempre que citar gramas de proteína ou carbo, calcule com base no peso real acima. Lembre o atleta que são estimativas e que um nutricionista é indispensável para prescrição individualizada.${_hydrationNote}`;
    }
    let profCtx = '';
    const prof = state.profile;
    if (prof?.profissao || prof?.perfil_postural || prof?.estresse_ocup) {
      profCtx = '\n\nROTINA PROFISSIONAL DO ATLETA:';
      if (prof.profissao)      profCtx += `\nProfissão: ${prof.profissao}`;
      if (prof.horas_trabalho) profCtx += `\nHoras de trabalho/dia: ${prof.horas_trabalho}h`;
      if (prof.perfil_postural) profCtx += `\nPerfil postural: ${prof.perfil_postural}`;
      if (prof.horas_sentado)  profCtx += `\nHoras sentado/dia: ${prof.horas_sentado}h`;
      if (prof.estresse_ocup)  profCtx += `\nEstresse ocupacional: ${prof.estresse_ocup}`;
      if (prof.turno_trabalho) profCtx += `\nTurno: ${prof.turno_trabalho}`;
    }
    let loadCtx = '';
    try {
      const { data: recentLogs } = await supabase
        .from('exercise_logs')
        .select('exercise_name, set_number, load_kg, reps, completed_at')
        .eq('user_id', state.user.id)
        .order('completed_at', { ascending: false })
        .limit(40);
      if (recentLogs && recentLogs.length > 0) {
        const lines = recentLogs.map(l =>
          `${l.exercise_name} | série ${l.set_number} | ${l.load_kg ?? '—'}kg x ${l.reps ?? '—'} reps`
        ).join('\n');
        loadCtx = `\n\n## HISTÓRICO RECENTE DE CARGAS (últimas sessões)\n${lines}`;
      }
    } catch(e) {
      console.warn('[chat] Falha ao carregar exercise_logs:', e);
    }

    const systemPrompt = CORE_PROMPT + profileCtx + fmsCtx + flagCtx + healthCtx + nutriCtx + profCtx + readinessCtx + loadCtx + (needsReference ? REF_TABLES : '');

    const historico = Array.isArray(state.chatHistory) ? state.chatHistory : [];
    let mensagensParaEnviar = historico.slice(-10);
    if (mensagensParaEnviar.length > 1 && mensagensParaEnviar[0]?.role === 'assistant') {
      mensagensParaEnviar = mensagensParaEnviar.slice(1);
    }
    const ultimaMensagem = mensagensParaEnviar[mensagensParaEnviar.length - 1];
    if (!ultimaMensagem || ultimaMensagem.role !== 'user' || ultimaMensagem.content !== text) {
      mensagensParaEnviar.push({ role: 'user', content: text });
    }
    if (mensagensParaEnviar.length > 10) {
      mensagensParaEnviar = mensagensParaEnviar.slice(-10);
      if (mensagensParaEnviar.length > 1 && mensagensParaEnviar[0]?.role === 'assistant') {
        mensagensParaEnviar = mensagensParaEnviar.slice(1);
      }
    }

    console.log('[chat] Enviando para /api/chat:', { messages: mensagensParaEnviar.length, messagesTotal: state.chatHistory.length, model: 'claude-sonnet-4-20250514', readinessScore: rdToday?.readiness_score ?? 'n/a' });
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: mensagensParaEnviar,
        readiness: state.readiness || null,
        checkin: state.checkin || null,
        profile: state.profile || null,
        fmsLatest: state.fmsLatest || null
      })
    });
    console.log('[chat] Resposta HTTP status:', response.status, response.ok);
    const data = await response.json();
    if (!response.ok) {
      console.error('[chat] Erro da API:', response.status, data);
      // ── FIX BUG 2: Show specific error for API failures ──
      document.getElementById(typingId)?.remove();
      let apiErrMsg;
      if (response.status === 401 || response.status === 403) {
        apiErrMsg = 'Erro de autenticação com o servidor de IA. Tente fazer logout e login novamente.';
      } else if (response.status === 429) {
        apiErrMsg = 'Muitas requisições. Aguarde um momento e tente novamente.';
      } else if (response.status >= 500) {
        apiErrMsg = 'O servidor de IA está temporariamente indisponível. Tente novamente em alguns instantes.';
      } else {
        apiErrMsg = 'Erro na resposta do servidor (código ' + response.status + '). Tente novamente.';
      }
      appendMsg('bot', apiErrMsg);
      return;
    } else {
      console.log('[chat] API data recebida:', data);
    }
    const reply = data.content?.[0]?.text || 'Desculpe, não consegui processar sua mensagem.';
    document.getElementById(typingId)?.remove();
    const axisMatch = reply.match(/<AXIS_WORKOUT>([\s\S]*?)<\/AXIS_WORKOUT>/);
    const cleanReply = reply.replace(/<AXIS_WORKOUT>[\s\S]*?<\/AXIS_WORKOUT>/g, '').trim();
    appendMsg('bot', cleanReply);
    state.chatHistory.push({ role: 'assistant', content: reply });
    // Persistir resposta do assistente no Supabase
    if (state.user?.id) {
      supabase.from('chat_messages').insert({ user_id: state.user.id, role: 'assistant', content: reply }).then(({ error }) => { if (error) console.warn('chat_messages insert error:', error); });
    }
    if (axisMatch) {
      try {
        renderWorkoutConfirmCard(JSON.parse(axisMatch[1].trim()));
      } catch(e) {
        // AI sometimes outputs literal newlines inside JSON string values — escape them and retry
        console.warn('[chat] AXIS_WORKOUT parse error, tentando corrigir newlines:', e.message);
        try {
          const fixed = axisMatch[1].trim().replace(/\r?\n/g, '\\n');
          renderWorkoutConfirmCard(JSON.parse(fixed));
        } catch(e2) {
          console.error('[chat] AXIS_WORKOUT parse falhou após correção:', e2.message, axisMatch[1].slice(0, 300));
        }
      }
    }
  } catch (err) {
    console.error('sendMessage error:', err);
    document.getElementById(typingId)?.remove();
    // ── FIX BUG 2: Differentiated error messages ──
    let errorMsg;
    if (!navigator.onLine) {
      errorMsg = 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
    } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
      errorMsg = 'Não foi possível conectar ao servidor. Tente novamente em instantes.';
    } else if (err.message?.includes('auth') || err.message?.includes('session') || err.message?.includes('401')) {
      errorMsg = 'Sessão expirada. Faça logout e login novamente.';
    } else {
      errorMsg = 'Erro ao processar sua mensagem. Tente novamente. (' + (err.message || 'erro desconhecido') + ')';
    }
    appendMsg('bot', errorMsg);
  }
}

function sanitizarMensagem(texto) {
  return texto
    .replace(/^#{1,6}\s+.*/gm, '')       // remove ## heading lines entirely
    .replace(/\*\*(.*?)\*\*/g, '$1')      // remove **bold**
    .replace(/__(.*?)__/g, '$1')          // remove __underline__
    .replace(/^\s*\*\s+/gm, '')           // remove * at line start (bullets)
    .replace(/\*([^*\n]+)\*/g, '$1')      // remove *italic*
    .replace(/_([^_\n]+)_/g, '$1')        // remove _italic_
    .replace(/`([^`\n]+)`/g, '$1')        // remove `code`
    .trim();
}

function appendMsg(role, text) {
  const box = document.getElementById('chat-messages');
  const isUser = role === 'user';
  const uid = 'mg' + Date.now();
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'bot'}`;
  const botSvg = `<img src="${NEW_LOGO}" alt="Axis" style="width:26px; height:26px; object-fit:contain; background:transparent; flex-shrink:0;">`;
  const displayText = isUser ? text : sanitizarMensagem(text);
  div.innerHTML = `<div class="msg-avatar" style="${isUser?'':'background:transparent;'}">${isUser?'👤':botSvg}</div><div class="msg-bubble">${displayText.replace(/\n/g,'<br>')}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function offerSaveWorkout() {
  const box = document.getElementById('chat-messages');
  const id = 'save-' + Date.now();
  const div = document.createElement('div');
  div.className = 'msg bot'; div.id = id;
  div.innerHTML = `<div class="msg-avatar">💾</div><div class="msg-bubble" style="background:rgba(0,255,135,0.08);border-color:rgba(0,255,135,0.2);"><strong>Salvar este treino?</strong><br><small style="color:var(--muted)">Ele vai aparecer na sua lista de treinos.</small><br><br><button onclick="saveWorkoutFromChat('${id}')" style="padding:8px 20px;background:var(--green);color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;margin-right:8px;">✅ SALVAR</button><button onclick="document.getElementById('${id}').remove()" style="padding:8px 16px;background:none;border:1px solid var(--border);color:var(--muted);border-radius:8px;cursor:pointer;font-size:13px;">Não</button></div>`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}

function saveWorkoutFromChat(cardId) {
  state.workouts.unshift({ title: 'Treino — ' + new Date().toLocaleDateString('pt-BR'), phase: 'Fase 1 · Acumulação', date: new Date().toISOString(), completed: false });
  saveWorkouts(); refreshDashboard();
  document.getElementById(cardId)?.remove();
  appendMsg('bot', '✅ Treino salvo! Acesse **Meus Treinos** para ver.');
  showToast('Treino salvo! 🏋️');
}

function refreshChatSidebar() {
  const p = state.profile;
  // ── FIX BUG 2: Show loading state if profile is not yet available ──
  if (!p) {
    document.getElementById('ps-phase').textContent = 'Carregando...';
    document.getElementById('ps-level').textContent = '...';
    document.getElementById('ps-goal').textContent = '...';
    document.getElementById('ps-gym').textContent = '...';
    document.getElementById('ps-equip').textContent = '...';
    const rfSummary = document.getElementById('risk-flags-summary');
    rfSummary.innerHTML = '<span style="font-size:13px;color:var(--muted);">Carregando perfil...</span>';
    return;
  }
  const phaseLabel = state.phase?.name || 'Fase 1';
  document.getElementById('ps-phase').textContent = phaseLabel;
  document.getElementById('ps-level').textContent = p.level || '—';
  document.getElementById('ps-goal').textContent = p.objective || '—';
  const gym = state.profile?.gym || p?.gym || '';
  document.getElementById('ps-gym').textContent = gym ? gym : '—';
  const equipArr = Array.isArray(p?.equipment)
    ? p.equipment
    : (() => { try { return JSON.parse(p?.equipment || '[]'); } catch(_) { return []; } })();
  const equipLabel = equipArr.length > 0
    ? (equipArr.length > 2 ? equipArr.slice(0,2).join(', ') + '...' : equipArr.join(', '))
    : '—';
  document.getElementById('ps-equip').textContent = equipLabel;
  const activeFlags = (p.risk_flags || []).filter(f => f !== 'none');
  const rfSummary = document.getElementById('risk-flags-summary');
  const labels = { squat_dysfunction:'⚠️ Disfunção de Agachamento', lunge_dysfunction:'⚠️ Disfunção de Avanço', hip_instability:'⚠️ Instabilidade de Quadril', shoulder_restriction:'⚠️ Restrição de Ombro', hamstring_restriction:'⚠️ Restrição de Isquiotibiais', apt:'⚠️ Hiperlordose (APT)', rib_flare:'⚠️ Costelas Abertas', knee_valgus:'⚠️ Valgo de Joelho', toe_touch_negative:'⚠️ Toe Touch Negativo' };
  const fms = p.fms || {};
  const fmsKeys = ['dos','il','hs','sm','aslr','tspu'];
  const fmsLabels = { dos:'DOS', il:'IL', hs:'HS', sm:'SM', aslr:'ASLR', tspu:'TSPU' };
  const hasFms = fmsKeys.some(k => fms[k] !== undefined && fms[k] !== null);

  if (!hasFms) {
    rfSummary.innerHTML = `Nenhum diagnóstico ainda. <button onclick="navigate('diagnosis')" style="color:var(--green);background:none;border:none;cursor:pointer;font-size:13px;">Fazer avaliação →</button>`;
  } else {
    const total = fmsKeys.reduce((acc, k) => acc + (Number.isInteger(fms[k]) ? fms[k] : 0), 0);
    const max = fmsKeys.filter(k => Number.isInteger(fms[k])).length * 3;
    const pct = max > 0 ? total / max : 0;
    const riskLabel = pct >= 0.83 ? '✅ Baixo risco' : pct >= 0.67 ? '⚠️ Risco moderado' : '🔴 Alto risco';
    const riskColor = pct >= 0.83 ? 'var(--green)' : pct >= 0.67 ? '#fbbf24' : '#ef4444';

    const scoresHtml = fmsKeys
      .filter(k => Number.isInteger(fms[k]))
      .map(k => {
        const score = fms[k];
        const color = score === 3 ? 'var(--green)' : score === 2 ? '#fbbf24' : '#ef4444';
        return `<span style="font-size:12px;color:var(--muted);">${fmsLabels[k]}: <strong style="color:${color};">${score}</strong></span>`;
      }).join('<span style="color:var(--muted);margin:0 4px;">·</span>');

    const flagsHtml = activeFlags.length > 0
      ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">${activeFlags.map(f => `<span style="display:block;font-size:12px;color:#fca5a5;margin-bottom:3px;">${labels[f]||f}</span>`).join('')}</div>`
      : '';

    rfSummary.innerHTML = `
      <div style="margin-bottom:6px;font-size:12px;font-weight:700;color:${riskColor};">${riskLabel} — ${total}/${max}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;">${scoresHtml}</div>
      ${fms.tt ? `<div style="font-size:12px;color:var(--muted);">Toe Touch: <strong style="color:${fms.tt==='positive'?'var(--green)':'#ef4444'}">${fms.tt==='positive'?'Positivo':'Negativo'}</strong></div>` : ''}
      ${flagsHtml}
    `;
  }
}

// ═══════════════════════════════════════════════
//  DIAGNOSIS
function _getMovementPattern(exerciseName) {
  var name = exerciseName.toLowerCase();
  if (name.includes('squat') && !name.includes('split') && !name.includes('rfess')) return 'knee_dominant_bilateral';
  if (name.includes('split squat') || name.includes('rfess') || name.includes('step')) return 'knee_dominant_unilateral';
  if (name.includes('deadlift') && (name.includes('sldl') || name.includes('unilateral') || name.includes('1 db'))) return 'hip_dominant_unilateral';
  if (name.includes('deadlift') || name.includes('hip hinge') || name.includes('toe touch')) return 'hip_dominant_bilateral';
  if (name.includes('push-up') || name.includes('push up') || (name.includes('press') && name.includes('bench'))) return 'push_horizontal';
  if (name.includes('press') && (name.includes('shoulder') || name.includes('overhead') || name.includes('db press'))) return 'push_vertical';
  if (name.includes('row') && !name.includes('chin') && !name.includes('pull')) return 'pull_horizontal';
  if (name.includes('chin') || name.includes('pull-up') || name.includes('pulldown')) return 'pull_vertical';
  if (name.includes('plank') && name.includes('lateral')) return 'anti_lateral_flexion';
  if (name.includes('plank') || name.includes('rollout') || name.includes('ab wheel')) return 'anti_extension';
  if (name.includes('chop') || name.includes('lift') || name.includes('rotation') || name.includes('bird')) return 'anti_rotation';
  if (name.includes('snatch') || name.includes('clean') || name.includes('jump squat')) return 'power_sagittal';
  if (name.includes('bound') || name.includes('lateral jump') || name.includes('med ball')) return 'power_frontal';
  if (name.includes('carry') || name.includes('march') || name.includes('walk') || name.includes('farmer')) return 'carry';
  return null;
}

async function fetchExerciseVideo(exerciseName, movementPattern) {
  // CAMADA 1: Match exato por nome
  var r1 = await supabase
    .from('exercise_library')
    .select('name, youtube_id, cues, thumbnail_url, movement_pattern')
    .ilike('name', exerciseName)
    .maybeSingle();
  if (r1.data?.youtube_id) return r1.data;

  // CAMADA 2: Match por name_aliases (contém o nome buscado)
  var r2 = await supabase
    .from('exercise_library')
    .select('name, youtube_id, cues, thumbnail_url, movement_pattern')
    .contains('name_aliases', [exerciseName])
    .not('youtube_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (r2.data?.youtube_id) return r2.data;

  // CAMADA 3: Fallback por movement_pattern
  if (movementPattern) {
    var r3 = await supabase
      .from('exercise_library')
      .select('name, youtube_id, cues, thumbnail_url, movement_pattern')
      .eq('movement_pattern', movementPattern)
      .not('youtube_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (r3.data?.youtube_id) return r3.data;
  }

  return r1.data || null;
}

// ═══════════════════════════════════════════════
//  ADMIN — EXERCISE LIBRARY (ETAPA 3)
// ═══════════════════════════════════════════════
const ADMIN_USER_ID = '385d1288-b060-45c1-bfaf-4e90ba615c3e';
var _adminSelectedId = null;
var _adminExercises  = [];

async function loadAdminPage() {
  var res = await supabase.auth.getUser();
  var user = res?.data?.user;
  if (!user || user.id !== ADMIN_USER_ID) { navigate('dashboard'); return; }
  await _adminLoadList();
}

async function _adminLoadList() {
  var listEl = document.getElementById('admin-exercise-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding:12px;color:#444;font-size:11px;font-family:var(--font-mono);">Carregando...</div>';
  var res = await supabase.from('exercise_library').select('id, name, category').order('name', { ascending: true });
  if (res.error) { listEl.innerHTML = '<div style="padding:12px;color:#ef4444;font-size:11px;">Erro ao carregar</div>'; return; }
  _adminExercises = res.data || [];
  listEl.innerHTML = _adminExercises.map(function(ex) {
    var sel = _adminSelectedId === ex.id ? ' selected' : '';
    return '<div class="admin-ex-item' + sel + '" id="admin-item-' + ex.id + '" onclick="adminSelectExercise(\'' + ex.id + '\')">'
      + '<div class="admin-ex-name">' + _escapeWorkoutHTML(ex.name) + '</div>'
      + '<div class="admin-ex-cat">' + _escapeWorkoutHTML(ex.category || '—') + '</div>'
      + '</div>';
  }).join('');
}

async function adminSelectExercise(id) {
  _adminSelectedId = id;
  document.querySelectorAll('.admin-ex-item').forEach(function(el) { el.classList.remove('selected'); });
  var item = document.getElementById('admin-item-' + id);
  if (item) item.classList.add('selected');
  var res = await supabase.from('exercise_library').select('*').eq('id', id).maybeSingle();
  if (res.error || !res.data) return;
  _adminRenderForm(res.data);
}

function adminNewExercise() {
  _adminSelectedId = null;
  document.querySelectorAll('.admin-ex-item').forEach(function(el) { el.classList.remove('selected'); });
  _adminRenderForm(null);
}

function _adminRenderForm(ex) {
  var container = document.getElementById('admin-form-container');
  if (!container) return;
  var v = function(val) { return _escapeWorkoutHTML(String(val || '')); };
  var arr2csv = function(arr) { return Array.isArray(arr) ? arr.join(', ') : (arr || ''); };
  var ytId = ex && ex.youtube_id ? ex.youtube_id : '';
  container.innerHTML =
    '<div class="admin-form-title">' + (ex ? 'Editar exercício' : 'Novo exercício') + '</div>'
    + '<div class="admin-field-row">'
      + '<div class="admin-field"><div class="admin-label">Nome *</div><input class="admin-input" id="af-name" value="' + v(ex && ex.name) + '" placeholder="Ex: Back Squat"></div>'
      + '<div class="admin-field"><div class="admin-label">Categoria</div><input class="admin-input" id="af-category" value="' + v(ex && ex.category) + '" placeholder="Ex: Força"></div>'
    + '</div>'
    + '<div class="admin-field-row">'
      + '<div class="admin-field"><div class="admin-label">Padrão de Movimento</div><input class="admin-input" id="af-movement_pattern" value="' + v(ex && ex.movement_pattern) + '" placeholder="Ex: knee_dominant_bilateral"></div>'
      + '<div class="admin-field"><div class="admin-label">Dificuldade</div><input class="admin-input" id="af-difficulty" value="' + v(ex && ex.difficulty) + '" placeholder="Ex: Intermediário"></div>'
    + '</div>'
    + '<div class="admin-field-row">'
      + '<div class="admin-field"><div class="admin-label">Grupos Musculares (vírgula)</div><input class="admin-input" id="af-muscle_groups" value="' + v(arr2csv(ex && ex.muscle_groups)) + '" placeholder="Ex: Quadríceps, Glúteos"></div>'
      + '<div class="admin-field"><div class="admin-label">Equipamento (vírgula)</div><input class="admin-input" id="af-equipment" value="' + v(arr2csv(ex && ex.equipment)) + '" placeholder="Ex: Barra, Rack"></div>'
    + '</div>'
    + '<div class="admin-field"><div class="admin-label">Cues (vírgula)</div><input class="admin-input" id="af-cues" value="' + v(arr2csv(ex && ex.cues)) + '" placeholder="Ex: Peito aberto, Core ativado"></div>'
    + '<div class="admin-field"><div class="admin-label">Instruções</div><textarea class="admin-textarea" id="af-instructions" rows="4" placeholder="Descrição detalhada do exercício...">' + v(ex && ex.instructions) + '</textarea></div>'
    + '<div class="admin-field"><div class="admin-label">YouTube ID</div><input class="admin-input" id="af-youtube_id" value="' + v(ytId) + '" placeholder="Ex: dQw4w9WgXcQ" oninput="adminPreviewYT(this.value)"></div>'
    + '<div class="admin-yt-preview" id="admin-yt-preview" style="' + (ytId ? 'display:block;' : 'display:none;') + '">'
      + '<iframe id="admin-yt-iframe" src="' + (ytId ? 'https://www.youtube.com/embed/' + v(ytId) : '') + '" style="width:100%;aspect-ratio:16/9;border:none;border-radius:6px;" allowfullscreen></iframe>'
    + '</div>'
    + '<div class="admin-btns">'
      + '<button class="admin-btn-save" onclick="adminSave()">Salvar</button>'
      + (ex ? '<button class="admin-btn-delete" onclick="adminDelete(\'' + ex.id + '\')">Excluir</button>' : '')
      + '<button style="padding:8px 14px;background:none;border:0.5px solid #2a2a2a;color:#555;font-size:12px;border-radius:6px;cursor:pointer;" onclick="adminNewExercise()">Novo</button>'
    + '</div>';
}

function adminPreviewYT(ytId) {
  var preview = document.getElementById('admin-yt-preview');
  var iframe  = document.getElementById('admin-yt-iframe');
  if (!preview || !iframe) return;
  var clean = String(ytId || '').trim();
  if (clean) { iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(clean); preview.style.display = 'block'; }
  else { preview.style.display = 'none'; iframe.src = ''; }
}

function _adminCsvToArr(val) {
  return String(val || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
}

async function adminSave() {
  var name = (document.getElementById('af-name')?.value || '').trim();
  if (!name) { showToast('Nome é obrigatório.', true); return; }
  var payload = {
    name:             name,
    category:         (document.getElementById('af-category')?.value || '').trim() || null,
    movement_pattern: (document.getElementById('af-movement_pattern')?.value || '').trim() || null,
    difficulty:       (document.getElementById('af-difficulty')?.value || '').trim() || null,
    muscle_groups:    _adminCsvToArr(document.getElementById('af-muscle_groups')?.value),
    equipment:        _adminCsvToArr(document.getElementById('af-equipment')?.value),
    cues:             _adminCsvToArr(document.getElementById('af-cues')?.value),
    instructions:     (document.getElementById('af-instructions')?.value || '').trim() || null,
    youtube_id:       (document.getElementById('af-youtube_id')?.value || '').trim() || null,
  };
  var error;
  if (_adminSelectedId) {
    var upd = await supabase.from('exercise_library').update(payload).eq('id', _adminSelectedId);
    error = upd.error;
  } else {
    var ins = await supabase.from('exercise_library').insert(payload).select('id').single();
    error = ins.error;
    if (!error && ins.data) _adminSelectedId = ins.data.id;
  }
  if (error) { showToast('Erro ao salvar: ' + error.message, true); return; }
  showToast('Exercício salvo!');
  await _adminLoadList();
}

async function adminDelete(id) {
  if (!confirm('Excluir este exercício?')) return;
  var del = await supabase.from('exercise_library').delete().eq('id', id);
  if (del.error) { showToast('Erro ao excluir: ' + del.error.message, true); return; }
  _adminSelectedId = null;
  showToast('Exercício excluído.');
  var container = document.getElementById('admin-form-container');
  if (container) container.innerHTML = '<div style="color:#444;font-size:13px;text-align:center;padding:40px 0;">Selecione um exercício ou clique em ＋ Novo</div>';
  await _adminLoadList();
}

// ═══════════════════════════════════════════════
//  EXERCISE MODAL — bottom-sheet (ETAPA 4)
// ═══════════════════════════════════════════════
async function openExerciseModal(nomeBuscado) {
  if (!nomeBuscado) return;
  document.querySelector('.exercise-modal-overlay')?.remove();

  var overlay = document.createElement('div');
  overlay.className = 'exercise-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML =
    '<div class="exercise-modal-sheet">'
    + '<div class="modal-drag-handle"></div>'
    + '<div class="modal-header">'
      + '<span class="modal-title">' + _escapeWorkoutHTML(nomeBuscado) + '</span>'
      + '<button class="modal-close" onclick="this.closest(\'.exercise-modal-overlay\').remove()">×</button>'
    + '</div>'
    + '<div class="modal-body"><div style="color:#444;font-size:12px;text-align:center;padding:20px;">Carregando...</div></div>'
    + '</div>';
  document.body.appendChild(overlay);

  var res = await supabase
    .from('exercise_library')
    .select('*')
    .or('name.ilike.' + nomeBuscado + ',name_aliases.cs.{"' + nomeBuscado + '"}')
    .maybeSingle();

  var sheet = overlay.querySelector('.exercise-modal-sheet');
  if (!sheet) return;

  var headerHtml =
    '<div class="modal-drag-handle"></div>'
    + '<div class="modal-header">'
      + '<span class="modal-title">' + _escapeWorkoutHTML(nomeBuscado) + '</span>'
      + '<button class="modal-close" onclick="this.closest(\'.exercise-modal-overlay\').remove()">×</button>'
    + '</div>';

  if (res.error || !res.data) {
    sheet.innerHTML = headerHtml + '<div class="modal-body"><div class="modal-empty">Exercício ainda não cadastrado na biblioteca</div></div>';
    return;
  }

  var d = res.data;
  var ytEmbed = d.youtube_id
    ? '<iframe src="https://www.youtube.com/embed/' + _escapeWorkoutHTML(d.youtube_id) + '?rel=0&modestbranding=1" style="width:100%;aspect-ratio:16/9;border:none;border-radius:6px;display:block;" allowfullscreen></iframe>'
    : '';

  var tags = [
    d.category        ? '<span class="modal-tag modal-tag-cat">'     + _escapeWorkoutHTML(d.category) + '</span>' : '',
    d.difficulty      ? '<span class="modal-tag modal-tag-diff">'    + _escapeWorkoutHTML(d.difficulty) + '</span>' : '',
    d.movement_pattern? '<span class="modal-tag modal-tag-pattern">' + _escapeWorkoutHTML(d.movement_pattern.replace(/_/g,' ')) + '</span>' : '',
  ].filter(Boolean).join('');

  var instructionsHtml = d.instructions
    ? '<div><div class="modal-section-label">Instruções</div><div class="modal-section-text">' + _escapeWorkoutHTML(d.instructions) + '</div></div>'
    : '';

  var cuesHtml = Array.isArray(d.cues) && d.cues.length
    ? '<div><div class="modal-section-label">Cues</div><div class="modal-cues-list">'
        + d.cues.map(function(c) { return '<div class="modal-cue-item">' + _escapeWorkoutHTML(c) + '</div>'; }).join('')
      + '</div></div>'
    : '';

  sheet.innerHTML =
    '<div class="modal-drag-handle"></div>'
    + '<div class="modal-header">'
      + '<span class="modal-title">' + _escapeWorkoutHTML(d.name) + '</span>'
      + '<button class="modal-close" onclick="this.closest(\'.exercise-modal-overlay\').remove()">×</button>'
    + '</div>'
    + ytEmbed
    + '<div class="modal-body">'
      + (tags ? '<div class="modal-tags">' + tags + '</div>' : '')
      + instructionsHtml
      + cuesHtml
    + '</div>';
}

async function abrirVideoModal(exerciseName) {
  if (!exerciseName) return;
  var blocos = _normalizePlanBlocks(window.__currentTreino?.conteudo || '');
  var bloco = blocos.find(function(b) { return b.exercicios.some(function(e) { return e.includes(exerciseName); }); });
  var pattern = bloco ? _getMovementPattern(exerciseName) : null;
  var data = await fetchExerciseVideo(exerciseName, pattern);

  var existing = document.getElementById('exercise-video-modal');
  if (existing) existing.remove();

  var youtubeEmbed = data?.youtube_id
    ? '<iframe width="100%" height="220" src="https://www.youtube.com/embed/' + _escapeWorkoutHTML(data.youtube_id) + '?rel=0&modestbranding=1" frameborder="0" allowfullscreen style="border-radius:8px;display:block;"></iframe>'
    : '<div style="height:120px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.35);font-size:13px;">Vídeo não disponível</div>';

  var cuesHtml = Array.isArray(data?.cues) && data.cues.length
    ? '<ul style="margin:10px 0 0;padding-left:18px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.7;">' +
        data.cues.map(function(c) { return '<li>' + _escapeWorkoutHTML(c) + '</li>'; }).join('') +
      '</ul>'
    : '';

  var modal = document.createElement('div');
  modal.id = 'exercise-video-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center;';
  modal.onclick = function(ev) { if (ev.target === modal) modal.remove(); };

  modal.innerHTML =
    '<div style="background:#0f1420;border-radius:16px 16px 0 0;width:100%;max-width:540px;padding:20px 20px 32px;max-height:85vh;overflow-y:auto;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<div style="font-family:var(--font-display);font-size:16px;letter-spacing:1px;color:#f0f0f0;">' + _escapeWorkoutHTML(data?.name || exerciseName) + '</div>' +
        '<button onclick="document.getElementById(\'exercise-video-modal\').remove()" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#a3acbb;border-radius:8px;padding:5px 10px;cursor:pointer;">✕</button>' +
      '</div>' +
      youtubeEmbed +
      cuesHtml +
    '</div>';

  document.body.appendChild(modal);
}
