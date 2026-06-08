// ═══════════════════════════════════════════════
//  TREINOS CONCLUÍDOS
// ═══════════════════════════════════════════════
function _fmtDuration(secs) {
  if (!secs) return '00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2,'0');
  const ss = String(s).padStart(2,'0');
  return h > 0 ? `${String(h).padStart(2,'0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

function _fmtDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function _resolveProfileSex(profile) {
  if (!profile || typeof profile !== 'object') return '';
  return String(profile.sex || profile.gender || '').trim();
}

function _isFemaleProfile(profile) {
  const sex = _resolveProfileSex(profile).toLowerCase();
  return sex === 'female' || sex === 'feminino';
}

async function renderCompletedSessions() {
  const container = document.getElementById('completed-sessions-section');
  if (!container) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { container.innerHTML = ''; return; }
  const userId = user.id;

  container.innerHTML = `<div style="color:var(--muted);font-size:12px;font-family:var(--font-mono);padding:16px 0;letter-spacing:1px;">Carregando sessões...</div>`;

  const { data: logs, error } = await supabase
    .from('session_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.warn('[completed sessions] session_logs indisponível:', error.message);
    container.innerHTML = '';
    return;
  }

  const rpeLabels = ['','Muito leve','Muito leve','Muito leve','Moderado','Moderado','Difícil','Difícil','Muito difícil','Muito difícil','Máximo'];
  const treinos   = loadTreinosIA();
  const grpId     = 'completed-sessions-body';

  if (!logs || !logs.length) {
    container.innerHTML = `
      <div class="phase-group">
        <div class="phase-header-bar" style="cursor:default;">
          <div class="phase-header-left">
            <span class="phase-header-name">TREINOS CONCLUÍDOS</span>
            <span class="phase-header-meta">0 sessões</span>
          </div>
        </div>
        <div style="padding:24px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--border);border-radius:10px;margin-top:4px;">
          Nenhum treino concluído ainda.
        </div>
      </div>`;
    return;
  }

  let cards = '';
  logs.forEach(log => {
    const treino   = treinos.find(t => String(t.id) === String(log.workout_id));
    const titulo   = treino?.titulo || 'Treino sem título';
    const cat      = treino?.categoria || 'fullbody';
    const rpe      = parseInt(log.rpe) || 0;
    const rpeLabel = rpeLabels[rpe] || '—';
    const ua       = parseFloat(log.ua || 0).toFixed(1);
    const logId    = log.id || log.created_at?.replace(/\W/g,'');

    // Exercises + Notes (expandable)
    let expandableHTML = '';
    if (treino?.conteudo) {
      const blocks = _normalizePlanBlocks(treino.conteudo);
      if (blocks.length > 1) {
        expandableHTML += `
          <div style="padding:12px 16px;border-top:1px solid var(--border);">
            <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">Exercícios</div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              ${blocks.map(b => `<div style="padding:7px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:7px;font-size:12px;color:var(--text);line-height:1.4;">${_escapeWorkoutHTML(b.nome)}${b.exercicios.length ? ': ' + _escapeWorkoutHTML(b.exercicios.join(' + ')) : ''}</div>`).join('')}
            </div>
          </div>`;
      }
    }
    if (log.notes) {
      expandableHTML += `<div style="padding:10px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);line-height:1.5;">📝 <em>${log.notes}</em></div>`;
    }

    const hasExpand  = expandableHTML.length > 0;
    const toggleBtn  = hasExpand
      ? `<button onclick="event.stopPropagation();toggleCompletedCard('${logId}')" id="csd-arrow-${logId}"
           style="background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;padding:4px 6px;border-radius:6px;flex-shrink:0;line-height:1;transition:color 0.2s;" title="Ver detalhes">▼</button>`
      : '';

    cards += `
      <div class="session-card completed" style="margin-bottom:8px;">
        <div style="padding:14px 18px;display:flex;align-items:flex-start;gap:12px;${hasExpand ? 'cursor:pointer;' : ''}"
             ${hasExpand ? `onclick="toggleCompletedCard('${logId}')"` : ''}>
          <div class="session-status-dot done" style="flex-shrink:0;margin-top:1px;">✅</div>
          <div style="flex:1;min-width:0;">
            <div class="session-title-row">
              ${titulo}
              <span class="s-badge cat-${cat}" style="text-transform:uppercase;">${cat.toUpperCase()}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono);margin-top:3px;">${_fmtDateTime(log.created_at)}</div>
          </div>
          ${toggleBtn}
        </div>
        <div style="display:flex;border-top:1px solid var(--border);">
          <div style="flex:1;padding:10px 14px;text-align:center;border-right:1px solid var(--border);">
            <div style="font-size:10px;color:var(--muted);font-family:var(--font-mono);letter-spacing:1px;margin-bottom:3px;">⏱ DURAÇÃO</div>
            <div style="font-family:var(--font-display);font-size:15px;letter-spacing:1px;">${_fmtDuration(log.duration_seconds)}</div>
          </div>
          <div style="flex:1;padding:10px 14px;text-align:center;border-right:1px solid var(--border);">
            <div style="font-size:10px;color:var(--muted);font-family:var(--font-mono);letter-spacing:1px;margin-bottom:3px;">💪 RPE</div>
            <div style="font-family:var(--font-display);font-size:15px;letter-spacing:1px;">${rpe} <span style="font-size:11px;font-family:var(--font-body);color:var(--muted);">${rpeLabel}</span></div>
          </div>
          <div style="flex:1;padding:10px 14px;text-align:center;">
            <div style="font-size:10px;color:var(--muted);font-family:var(--font-mono);letter-spacing:1px;margin-bottom:3px;">⚡ UA</div>
            <div style="font-family:var(--font-display);font-size:15px;letter-spacing:1px;">${ua}</div>
          </div>
        </div>
        ${hasExpand ? `<div id="csd-body-${logId}" style="display:none;">${expandableHTML}</div>` : ''}
      </div>`;
  });

  container.innerHTML = `
    <div class="phase-group">
      <div class="phase-header-bar" onclick="toggleFaseBody('${grpId}')">
        <div class="phase-header-left">
          <span class="phase-header-name">TREINOS CONCLUÍDOS</span>
          <span class="phase-header-meta">${logs.length} sessão${logs.length !== 1 ? 'ões' : ''} · últimas 10</span>
        </div>
        <span class="fase-toggle-icon">▼</span>
      </div>
      <div class="fase-body" id="${grpId}">${cards}</div>
    </div>`;
}

function toggleCompletedCard(id) {
  const body  = document.getElementById('csd-body-' + id);
  const arrow = document.getElementById('csd-arrow-' + id);
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display  = open ? 'block' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
}

async function getSupaToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('[getSupaToken]', error.message);
    return null;
  }
  return data?.session?.access_token || null;
}

async function fetchTrainingSessions() {
  const token = await getSupaToken();
  if (!token) return [];

  try {
    const res = await fetch('/api/sessions?type=sessions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[fetchSessions]', err.message);
    return [];
  }
}

async function fetchReadinessHistory() {
  const token = await getSupaToken();
  if (!token) return [];

  try {
    const res = await fetch('/api/sessions?type=readiness', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[fetchReadiness]', err.message);
    return [];
  }
}

function updateFirstWorkoutCTA() {
  const treinos = loadTreinosIA();
  const cta = document.getElementById('first-workout-cta');
  if (!cta) return;
  cta.style.display = treinos.length > 0 ? 'none' : '';
}

async function renderFmsPreviewCard() {
  const container = document.getElementById('fms-preview-card');
  if (!container) return;

  const profileKey = getProfileKey();
  const fmsKey = getFmsLatestKey();
  const profile = profileKey ? JSON.parse(_lsGet(profileKey) || '{}') : {};
  let fmsLatest = fmsKey ? JSON.parse(_lsGet(fmsKey) || '{}') : {};
  if (state.user?.id) {
    try {
      const { data: fmsRow } = await supabase
        .from('fms_assessments')
        .select('fms, date, photos')
        .eq('user_id', state.user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fmsRow?.fms) {
        fmsLatest = fmsRow;
        if (fmsKey) localStorage.setItem(fmsKey, JSON.stringify(fmsRow));
      }
    } catch(e) {
      console.warn('[dashboard] FMS fallback para localStorage:', e);
    }
  }
  const fms = fmsLatest.fms || profile.fms || null;

  if (!fms || Object.keys(fms).length === 0) {
    container.innerHTML = `
      <div style="color:#555;font-size:12px;text-align:center;padding:8px 0">
        Nenhuma avaliação registrada
      </div>
      <button class="btn-action" onclick="navigate('diagnosis')"
        style="margin-top:8px;width:100%;font-size:11px">
        FAZER AVALIAÇÃO
      </button>`;
    return;
  }

  const labels = { dos: 'DOS', il: 'IL', hs: 'HS', sm: 'SM', aslr: 'ASLR' };
  const scores = Object.entries(labels).map(([key, label]) => ({
    key, label, score: parseInt(fms[key], 10) || 0
  }));
  const total = scores.reduce((sum, s) => sum + s.score, 0);
  const maxTotal = scores.length * 3;

  let riskLabel, riskColor, riskBg;
  if (total >= 14) {
    riskLabel = 'BAIXO RISCO'; riskColor = '#4CAF50'; riskBg = '#0a1f0a';
  } else if (total >= 10) {
    riskLabel = 'RISCO MODERADO'; riskColor = '#FFC107'; riskBg = '#1f1a00';
  } else {
    riskLabel = 'ALTO RISCO'; riskColor = '#f44336'; riskBg = '#1f0a0a';
  }

  function scoreColor(s) {
    if (s === 3) return '#4CAF50';
    if (s === 2) return '#FFC107';
    if (s === 1) return '#f44336';
    return '#333';
  }

  const barsHTML = scores.map(({ label, score }) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
      <span style="color:#fff;font-size:13px;font-weight:700">${score}</span>
      <div style="width:100%;border-radius:4px;overflow:hidden;background:#1a1a1a;height:36px;
                  display:flex;flex-direction:column;justify-content:flex-end">
        <div style="
          width:100%;
          height:${Math.round((score / 3) * 36)}px;
          background:${scoreColor(score)};
          border-radius:4px;
          transition:height 0.3s ease;
        "></div>
      </div>
      <span style="color:#666;font-size:10px;font-weight:600">${label}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="display:flex;gap:6px;align-items:flex-end;margin-bottom:12px">
      ${barsHTML}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="
        background:${riskBg};color:${riskColor};
        padding:3px 10px;border-radius:20px;
        font-size:10px;font-weight:700;
        border:1px solid ${riskColor}44;
      ">${riskLabel}</span>
      <span style="color:#555;font-size:11px">${total}/${maxTotal}</span>
    </div>
  `;
}

function renderRecentWorkouts() {
  const container = document.getElementById('recent-workouts');
  if (!container) return;

  const treinos = loadTreinosIA();

  if (treinos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏋️</div>
        <div class="empty-title">SEM TREINOS AINDA</div>
        <div class="empty-desc">Use o Coach IA para gerar seu plano personalizado.</div>
        <button class="btn-action" onclick="navigate('chat')">FALAR COM O COACH</button>
      </div>`;
    return;
  }

  const sorted = [...treinos].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  const recent = sorted.slice(0, 3);

  container.innerHTML = recent.map(t => {
    const hasPillar = t.conteudo?.includes('PILLAR') || t.conteudo?.includes('Pillar');
    const hasPower = t.conteudo?.includes('POD 1') || t.conteudo?.includes('Power');
    const hasESD = t.conteudo?.includes('ESD');
    const blocks = [
      hasPillar ? 'Pillar Prep' : null,
      hasPower ? 'Strength' : null,
      hasESD ? 'ESD' : null
    ].filter(Boolean);

    return `
      <div onclick="navigate('workouts')" style="
        background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;
        padding:16px;cursor:pointer;transition:border-color 0.2s;margin-bottom:10px"
        onmouseenter="this.style.borderColor='#444'"
        onmouseleave="this.style.borderColor='#2a2a2a'">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="color:#fff;font-weight:700;font-size:14px;margin-bottom:2px">${t.titulo || 'Treino'}</div>
            <div style="color:#666;font-size:12px">${t.data || ''}</div>
          </div>
          <span style="background:#1f2a00;color:#e8ff4b;padding:3px 10px;border-radius:20px;
                       font-size:11px;font-weight:700;border:1px solid #e8ff4b33">
            ${t.categoria?.toUpperCase() || 'TREINO'}
          </span>
        </div>
        ${blocks.length > 0 ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${blocks.map(b => `
              <span style="background:#222;color:#888;padding:2px 8px;border-radius:6px;font-size:11px">
                ${b}
              </span>`).join('')}
          </div>` : ''}
        <div style="margin-top:10px;color:#e8ff4b;font-size:12px;font-weight:600">
          VER TREINO →
        </div>
      </div>
    `;
  }).join('');
}

function renderStreakGrid(sessionDates) {
  const grid = document.getElementById('streak-grid');
  if (!grid) return;

  const sessionSet = new Set(sessionDates);
  const days = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let html = '';

  for (let i = 27; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const hasSession = sessionSet.has(dateStr);
    const isToday = i === 0;
    const dayName = days[date.getDay()];

    html += `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="
          width:24px;height:24px;border-radius:6px;
          background:${hasSession ? '#e8ff4b' : '#1a1a1a'};
          border:1px solid ${isToday ? '#e8ff4b88' : hasSession ? '#e8ff4b' : '#2a2a2a'};
          ${isToday && !hasSession ? 'border-style:dashed;' : ''}
        " title="${dateStr}"></div>
        ${i % 7 === 0 ? `<span style="color:#555;font-size:9px">${dayName}</span>` : ''}
      </div>
    `;
  }

  grid.innerHTML = html;
}

async function updateStreakAndConsistency() {
  const sessionsCountEl = document.getElementById('sessions-count');
  const streakCount = document.getElementById('streak-count');
  const adherenceEl = document.getElementById('adherence-pct');
  const streakBadge = document.getElementById('streak-badge');

  const setEmptyState = () => {
    if (sessionsCountEl) sessionsCountEl.textContent = '0';
    if (streakCount) streakCount.textContent = '0';
    if (adherenceEl) adherenceEl.textContent = '0%';
    if (streakBadge) {
      streakBadge.className = 'insight-card-badge badge-muted';
      streakBadge.textContent = 'Últimos 28 dias';
    }
    renderStreakGrid([]);
  };

  try {
    const userId = state.user?.id;
    if (!userId) { setEmptyState(); return; }

    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
    const sinceIso = twentyEightDaysAgo.toISOString();

    const [recentResp, totalResp] = await Promise.all([
      supabase
        .from('session_logs')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false }),
      supabase
        .from('session_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
    ]);

    if (recentResp.error || totalResp.error) {
      console.warn('[updateStreakAndConsistency] session_logs error — usando estado vazio',
        recentResp.error?.message || totalResp.error?.message);
      setEmptyState();
      return;
    }

    const recentLogs = Array.isArray(recentResp.data) ? recentResp.data : [];
    const totalSessions = typeof totalResp.count === 'number' ? totalResp.count : 0;

    if (sessionsCountEl) sessionsCountEl.textContent = String(totalSessions);

    const sessionDates = [...new Set(
      recentLogs
        .map(s => (s.created_at || '').split('T')[0])
        .filter(Boolean)
    )];

    const sessionSet = new Set(sessionDates);
    let streak = 0;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 28; i++) {
      const expectedDate = new Date(todayDate);
      expectedDate.setDate(todayDate.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      if (sessionSet.has(expectedDateStr)) {
        streak++;
      } else {
        break;
      }
    }

    const adherence = Math.round((sessionSet.size / 28) * 100);

    if (streakCount) streakCount.textContent = String(streak);
    if (adherenceEl) adherenceEl.textContent = `${adherence}%`;

    if (streakBadge) {
      if (adherence >= 70) {
        streakBadge.className = 'insight-card-badge badge-green';
        streakBadge.textContent = `${adherence}% aderência`;
      } else if (adherence >= 40) {
        streakBadge.className = 'insight-card-badge badge-amber';
        streakBadge.textContent = `${adherence}% aderência`;
      } else {
        streakBadge.className = 'insight-card-badge badge-muted';
        streakBadge.textContent = 'Últimos 28 dias';
      }
    }

    renderStreakGrid(sessionDates);
  } catch (err) {
    console.warn('[updateStreakAndConsistency]', err?.message || err);
    setEmptyState();
  }
}

async function updateReadinessCard() {
  const history = await fetchReadinessHistory();
  const historyContainer = document.getElementById('readiness-history');
  if (!historyContainer) return;

  if (history.length === 0) {
    historyContainer.innerHTML = `
      <div style="color:#555;font-size:12px;text-align:center;padding:10px">
        Nenhum check-in nos últimos 7 dias
      </div>`;
    return;
  }

  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const byDate = {};
  history.forEach(h => {
    if (h.date) byDate[h.date] = h;
  });

  let html = '<div style="display:flex;gap:6px;align-items:flex-end;justify-content:space-between">';
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const entry = byDate[dateStr];
    const score = entry?.readiness_score || entry?.readiness || 0;
    const dayName = days[date.getDay()];
    const isToday = i === 0;
    const barColor = score >= 70 ? '#4CAF50' : score >= 40 ? '#FFC107' : score > 0 ? '#f44' : '#2a2a2a';
    const barHeight = score > 0 ? Math.max(8, Math.round(score * 0.4)) : 4;

    html += `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
        ${score > 0 ? `<span style="color:#888;font-size:10px">${score}</span>` : ''}
        <div style="
          width:100%;height:${barHeight}px;border-radius:4px;
          background:${barColor};opacity:${isToday ? 1 : 0.7};
        "></div>
        <span style="color:${isToday ? '#e8ff4b' : '#555'};font-size:10px;font-weight:${isToday ? '700' : '400'}">
          ${isToday ? 'Hoje' : dayName}
        </span>
      </div>`;
  }
  html += '</div>';
  historyContainer.innerHTML = html;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntry = byDate[todayStr];
  if (todayEntry) {
    const score = todayEntry.readiness_score || todayEntry.readiness || 0;
    const readinessNum = document.getElementById('readiness-num');
    const readinessBadge = document.getElementById('readiness-badge');
    if (readinessNum) readinessNum.textContent = String(score);
    if (readinessBadge) {
      const badge = score >= 70 ? 'Alta' : score >= 40 ? 'Média' : 'Baixa';
      const color = score >= 70 ? '#4CAF50' : score >= 40 ? '#FFC107' : '#f44';
      readinessBadge.textContent = badge;
      readinessBadge.style.color = color;
    }
  }
}

async function _waitForSessionDashboard() {
  let session = null;
  let tentativas = 0;
  while (!session && tentativas < 5) {
    const { data } = await supabase.auth.getSession();
    session = data?.session;
    if (!session) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      tentativas++;
    }
  }
  return session;
}

const DASHBOARD_ACTIVE_WORKOUT_STATUSES = ['active', 'em_andamento', 'pending', 'ativo'];

function _isDashboardActiveStatus(status) {
  return DASHBOARD_ACTIVE_WORKOUT_STATUSES.includes(String(status || '').toLowerCase());
}

function _hasDashboardFms(profile) {
  const fmsScores = profile?.fms_scores;
  const fms = profile?.fms;
  const hasFmsScores = !!(fmsScores && typeof fmsScores === 'object' && Object.keys(fmsScores).length > 0);
  const hasFms = !!(fms && typeof fms === 'object' && Object.keys(fms).length > 0);
  return hasFmsScores || hasFms;
}

function _getDashboardRoot() {
  return document.querySelector('#page-dashboard, #dashboard, [id*="dashboard"], .dashboard-content');
}

async function _prefetchDashboardData(userId) {
  const _safeQuery = (promise) => promise.catch(err => ({ data: null, error: err }));

  const [profileRes, workoutsRes, sessionLogsRes] = await Promise.all([
    _safeQuery(supabase
      .from('profiles')
      .select('weight, objective, sex, fms, fms_scores, comorbidities, phase, day, risk_flags')
      .eq('user_id', userId)
      .maybeSingle()),
    _safeQuery(supabase
      .from('workouts')
      .select('id, titulo, status, created_at')
      .eq('user_id', userId)
      .in('status', DASHBOARD_ACTIVE_WORKOUT_STATUSES)),
    _safeQuery(supabase
      .from('session_logs')
      .select('id, created_at, duration_seconds')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30))
  ]);

  return {
    profileRes,
    workoutsRes,
    sessionLogsRes
  };
}

async function initDashboard() {
  if (typeof authReady !== 'undefined') {
    await authReady;
  }
  const session = await _waitForSessionDashboard();
  if (!session?.user?.id) {
    console.warn('initDashboard: sessão não disponível');
    return;
  }
  if (!state.user?.id) {
    state.user = {
      ...(state.user || {}),
      id: session.user.id,
      email: session.user.email || state.user?.email || ''
    };
  }

  try {
    const { profileRes, workoutsRes, sessionLogsRes } = await _prefetchDashboardData(session.user.id);

    if (!profileRes?.error && profileRes?.data) {
      const profile = profileRes.data;
      if (!profile.fms_scores && profile.fms) {
        profile.fms_scores = profile.fms;
      }
      if (!profile.fms && profile.fms_scores) {
        profile.fms = profile.fms_scores;
      }
      state.profile = { ...(state.profile || {}), ...profile };
      if (_hasDashboardFms(state.profile)) {
        state.fmsLatest = {
          ...(state.fmsLatest || {}),
          fms: state.profile.fms_scores || state.profile.fms || state.fmsLatest?.fms || null
        };
      }
    }

    const remoteWorkouts = !workoutsRes?.error && Array.isArray(workoutsRes?.data) ? workoutsRes.data : [];
    const activeRemoteWorkouts = remoteWorkouts.filter((workout) => _isDashboardActiveStatus(workout?.status));
    if (!workoutsRes?.error && Array.isArray(workoutsRes?.data)) {
      state.workouts = activeRemoteWorkouts.map((workout) => ({
        ...workout,
        completed: false,
        date: workout?.created_at || null
      }));
    }

    state.dashboard_session_logs = !sessionLogsRes?.error && Array.isArray(sessionLogsRes?.data)
      ? sessionLogsRes.data
      : [];

    const hasFms = _hasDashboardFms(state.profile);
    const banner = document.querySelector('#fms-pending-alert, .fms-pending-alert');
    if (banner) banner.style.display = hasFms ? 'none' : 'flex';

    const planosAtivos = activeRemoteWorkouts.length;
    const treinosIA = loadTreinosIA();
    const planosEl = document.querySelector('#stat-workouts, [class*="plano-count"], [id*="planos"]');
    if (planosEl) planosEl.textContent = String(planosAtivos + treinosIA.length);

    const temPerfil = !!(state.profile?.weight && state.profile?.objective);
    const nutriEl = document.getElementById('nutri-dash-phrase');
    if (nutriEl && !temPerfil) {
      nutriEl.textContent = 'Consulte a aba Nutrição para orientações';
    }

    await refreshDashboard();
  } catch (err) {
    console.warn('[initDashboard]', err?.message || err);
  }
}

async function refreshDashboard() {
  if (typeof authReady !== 'undefined') {
    await authReady;
  }
  const session = await _waitForSessionDashboard();
  if (!session?.user?.id) {
    console.warn('refreshDashboard: sessão não disponível');
    return;
  }
  if (!state.user?.id) {
    state.user = {
      ...(state.user || {}),
      id: session.user.id,
      email: session.user.email || state.user?.email || ''
    };
  }

  const treinosIA = loadTreinosIA();
  const active = state.workouts.filter(w => !w.completed);
  const riskCount = (state.profile?.risk_flags || []).filter(f => f !== 'none').length;
  const statRisks = document.getElementById('stat-risks');
  document.getElementById('stat-workouts').textContent = active.length + treinosIA.length;
  if (statRisks) statRisks.textContent = String(riskCount);

  renderRecentWorkouts();
  updateFirstWorkoutCTA();
  await renderFmsPreviewCard();
  refreshDashboardCards();
  refreshPendingAlert();
  renderDashboardNutritionCard();

  await Promise.all([
    updateStreakAndConsistency(),
    updateReadinessCard()
  ]);
}

//  DASHBOARD INSIGHT CARDS
// ═══════════════════════════════════════════════

// ── Check-in helpers (legacy — mantém escrita em 'checkins' para compatibilidade) ──
function getCheckinData() {
  return JSON.parse(_lsGet('axisai_checkin') || 'null');
}
async function saveCheckinData(data) {
  const profileKey = typeof getProfileKey === 'function' ? getProfileKey() : '';
  const cachedProfile = profileKey ? JSON.parse(_lsGet(profileKey) || '{}') : {};
  const isFemale = _isFemaleProfile(cachedProfile);
  const menstrualVal = data?.menstrual_phase ?? null;
  const payload = { ...data, ...(isFemale && menstrualVal != null ? { menstrual_phase: menstrualVal } : {}), user_id: state.user?.id, date: today() };
  if (!isFemale) delete payload.menstrual_phase;
  await saveData('checkins', payload, 'axisai_checkin');
  // Também persiste em readiness_logs (tabela canônica para dados diários de prontidão)
  try {
    const rlPayload = { ...payload };
    delete rlPayload.id;
    await supabase.from('readiness_logs').upsert(rlPayload, { onConflict: 'user_id,date' });
  } catch (e) { console.warn('[saveCheckinData readiness_logs]', e); }
}

// ── Readiness Score (nova fórmula, escala 1-5) ──
function calculateReadinessScore({ sleep_quality, energy_level, muscle_soreness, stress_level }) {
  const soreness_inverted = 6 - muscle_soreness;
  const stress_inverted   = 6 - stress_level;
  const raw = (sleep_quality + energy_level + soreness_inverted + stress_inverted) / 4;
  return Math.round((raw / 5) * 100);
}

function getReadinessBand(score) {
  if (score >= 70) return { label: 'Alta',     color: 'var(--green)',  cls: 'badge-green' };
  if (score >= 40) return { label: 'Moderada', color: 'var(--orange)', cls: 'badge-amber' };
  return              { label: 'Baixa',    color: 'var(--red)',    cls: 'badge-red'   };
}

// ── Card 1: Readiness Score ──
function renderReadinessCard() {
  const container = document.getElementById('readiness-content');
  const badge     = document.getElementById('readiness-badge');
  const r         = state.readiness;

  if (!r) {
    badge.textContent = 'Não avaliado';
    badge.className = 'insight-card-badge badge-muted';
    container.innerHTML = `
      <div class="readiness-cta">
        <p>Faça seu check-in diário para calcular sua prontidão.</p>
        <button onclick="openCheckinFlow()">CHECK-IN DIÁRIO</button>
      </div>`;
    renderReadinessHistory();
    return;
  }

  const score = r.readiness_score;
  const band  = getReadinessBand(score);
  badge.textContent = band.label;
  badge.className   = 'insight-card-badge ' + band.cls;

  const circumference = 2 * Math.PI * 48;
  const offset        = circumference - (score / 100) * circumference;

  // Barras: sleep e energy diretos; soreness e stress invertidos (quanto maior, pior)
  const bars = [
    { icon: '😴', label: 'Sono',    value: (r.sleep_quality   / 5) * 100, color: '#818cf8' },
    { icon: '⚡',  label: 'Energia', value: (r.energy_level    / 5) * 100, color: '#22d3ee' },
    { icon: '💪', label: 'Dor',     value: ((6 - r.muscle_soreness) / 5) * 100, color: '#fb923c' },
    { icon: '🧠', label: 'Estresse',value: ((6 - r.stress_level)    / 5) * 100, color: '#f472b6' }
  ];

  const recText = score >= 70 ? 'Treinar normal' : score >= 40 ? 'Reduzir volume 20%' : 'Recuperação ativa';

  container.innerHTML = `
    <div class="readiness-body">
      <div class="readiness-ring-wrap">
        <svg viewBox="0 0 120 120">
          <circle class="readiness-ring-bg" cx="60" cy="60" r="48"/>
          <circle class="readiness-ring-fg" cx="60" cy="60" r="48"
            stroke="${band.color}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${circumference}"
            data-target="${offset}"/>
        </svg>
        <div class="readiness-score-num">
          <span id="readiness-num" style="color:${band.color}">0</span>
          <span class="readiness-score-label">SCORE</span>
        </div>
      </div>
      <div class="readiness-detail">
        ${bars.map(b => `
          <div class="readiness-row">
            <span class="readiness-row-icon">${b.icon}</span>
            <span class="readiness-row-label">${b.label}</span>
            <div class="readiness-row-bar">
              <div class="readiness-row-fill" style="width:0%;background:${b.color}" data-width="${b.value}%"></div>
            </div>
          </div>`).join('')}
        <div class="readiness-rec" style="color:${band.color}">${recText}</div>
        <div style="margin-top:8px;text-align:right;">
          <button onclick="openCheckinFlow()" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;font-family:var(--font-mono);letter-spacing:0.5px;">✏️ EDITAR</button>
        </div>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const ring = container.querySelector('.readiness-ring-fg');
      if (ring) ring.style.strokeDashoffset = ring.dataset.target;
      container.querySelectorAll('.readiness-row-fill').forEach(el => {
        el.style.width = el.dataset.width;
      });
      animateCounter('readiness-num', score, 800);
    }, 50);
  });

  renderReadinessHistory();
}

async function renderReadinessHistory() {
  await updateReadinessCard();
}

function animateCounter(id, target, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(progress * target);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Check-in de Prontidão (readiness_logs) ──
function _updateCheckinPreview() {
  const vals = {
    sleep_quality:   parseInt(document.getElementById('ci-sleep').value),
    energy_level:    parseInt(document.getElementById('ci-energy').value),
    muscle_soreness: parseInt(document.getElementById('ci-soreness').value),
    stress_level:    parseInt(document.getElementById('ci-stress').value)
  };
  const score = calculateReadinessScore(vals);
  const band  = getReadinessBand(score);
  const el    = document.getElementById('ci-score-preview');
  if (el) {
    el.textContent = score + '/100';
    el.style.color = band.color;
  }
  const lbl = document.getElementById('ci-score-label');
  if (lbl) { lbl.textContent = band.label; lbl.style.color = band.color; }
}

const READINESS_FIELDS = [
  { key: 'sleep', field: 'sleep_quality', icon: '😴', label: 'Qualidade do sono', hint: '1 = péssimo · 5 = ótimo' },
  { key: 'energy', field: 'energy_level', icon: '⚡', label: 'Nível de energia', hint: '1 = sem energia · 5 = energizado' },
  { key: 'soreness', field: 'muscle_soreness', icon: '💪', label: 'Dor muscular', hint: '1 = sem dor · 5 = muito dolorido' },
  { key: 'stress', field: 'stress_level', icon: '🧠', label: 'Nível de estresse', hint: '1 = calmo · 5 = muito estressado' },
  { key: 'menstrual', field: 'menstrual_phase', icon: '🔴', label: 'Período menstrual', hint: 'Você está no período menstrual hoje?' }
];

function openCheckinFlow() {
  const existing = document.getElementById('checkin-modal');
  if (existing) existing.remove();

  // Pré-preenche com valores do dia se já existe
  const r = state.readiness;
  const defaults = {
    sleep_quality:   r ? r.sleep_quality   : 3,
    energy_level:    r ? r.energy_level    : 3,
    muscle_soreness: r ? r.muscle_soreness : 2,
    stress_level:    r ? r.stress_level    : 2,
    menstrual_phase: r ? (r.menstrual_phase === true || r.menstrual_phase === 'true') : false,
    notes:           r ? (r.notes || '')   : ''
  };

  const readinessFields = READINESS_FIELDS.filter(s => {
    if (s.key !== 'menstrual') return true;
    const sex = _resolveProfileSex(state.profile).toLowerCase();
    return sex === 'female' || sex === 'feminino';
  });

  const modal = document.createElement('div');
  modal.id = 'checkin-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);padding:20px;';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:420px;width:100%;animation:fadeUp 0.3s ease;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <h3 style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;">${r ? 'EDITAR CHECK-IN' : 'CHECK-IN DIÁRIO'}</h3>
        <div style="text-align:right;">
          <div id="ci-score-preview" style="font-family:var(--font-display);font-size:28px;letter-spacing:1px;line-height:1;">—</div>
          <div id="ci-score-label" style="font-size:10px;font-family:var(--font-mono);letter-spacing:1px;">PRONTIDÃO</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px;">
        ${readinessFields.map(s => {
          if (s.key === 'menstrual') {
            return `
          <div id="ci-menstrual-field">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
              <span style="font-size:13px;color:var(--muted);">${s.icon} ${s.label}</span>
            </div>
            <select id="ci-${s.key}" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);font-size:13px;">
              <option value="false" ${defaults[s.field] ? '' : 'selected'}>Não</option>
              <option value="true" ${defaults[s.field] ? 'selected' : ''}>Sim</option>
            </select>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">${s.hint}</div>
          </div>`;
          }
          return `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
              <span style="font-size:13px;color:var(--muted);">${s.icon} ${s.label}</span>
              <span id="ci-${s.key}-val" style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--text);">${defaults[s.field]}</span>
            </div>
            <input type="range" id="ci-${s.key}" min="1" max="5" step="1" value="${defaults[s.field]}"
              style="width:100%;accent-color:var(--green);">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-family:var(--font-mono);margin-top:2px;">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">${s.hint}</div>
          </div>`;
        }).join('')}
        <div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">📝 Observações (opcional)</div>
          <textarea id="ci-notes" rows="2" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);font-size:13px;resize:none;" placeholder="Ex: pernas doloridas do treino anterior...">${defaults.notes}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:24px;">
        <button onclick="submitCheckin()" style="flex:1;background:linear-gradient(135deg,var(--green),#00c8ff);color:#000;border:none;padding:10px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">SALVAR</button>
        <button onclick="document.getElementById('checkin-modal').remove()" style="flex:1;background:none;border:1px solid var(--border);color:var(--muted);padding:10px;border-radius:8px;cursor:pointer;font-size:13px;">CANCELAR</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // Oculta campo menstrual para usuários não femininos (segurança adicional ao filtro de renderização)
  const profileKey = typeof getProfileKey === 'function' ? getProfileKey() : '';
  const cachedProfile = profileKey ? JSON.parse(_lsGet(profileKey) || '{}') : {};
  const isFemale = _isFemaleProfile(cachedProfile);
  const menstrualField = document.getElementById('ci-menstrual-field');
  if (menstrualField) menstrualField.style.display = isFemale ? '' : 'none';

  // Live labels + score preview
  readinessFields
    .filter(s => s.key !== 'menstrual')
    .forEach(s => {
      const input = document.getElementById('ci-' + s.key);
      const label = document.getElementById('ci-' + s.key + '-val');
      if (!input || !label) return;
      input.addEventListener('input', () => {
        label.textContent = input.value;
        _updateCheckinPreview();
      });
    });
  _updateCheckinPreview();
}

async function submitCheckin() {
  // Guard 1: sessão em memória
  if (!state.user?.id) {
    showToast('Sessão expirada. Faça login novamente.');
    return;
  }

  // Guard 2: confirmar sessão ativa no Supabase
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    showToast('Sessão expirada. Faça login novamente.');
    return;
  }

  const vals = {
    sleep_quality:   parseInt(document.getElementById('ci-sleep').value),
    energy_level:    parseInt(document.getElementById('ci-energy').value),
    muscle_soreness: parseInt(document.getElementById('ci-soreness').value),
    stress_level:    parseInt(document.getElementById('ci-stress').value)
  };
  const profileKey = typeof getProfileKey === 'function' ? getProfileKey() : '';
  const cachedProfile = profileKey ? JSON.parse(_lsGet(profileKey) || '{}') : {};
  const isFemale = _isFemaleProfile(cachedProfile);
  const menstrualEl = document.getElementById('ci-menstrual');
  const menstrualVal = menstrualEl ? (menstrualEl.value === 'true') : null;
  const notes           = (document.getElementById('ci-notes')?.value || '').trim();
  const readiness_score = calculateReadinessScore(vals);

  const payload = {
    user_id: session.user.id,   // usa ID da sessão ativa, não do state (mais seguro)
    date:    today(),
    ...vals,
    ...(isFemale && menstrualVal != null ? { menstrual_phase: menstrualVal } : {}),
    readiness_score,
    notes: notes || null
  };

  let data = null;
  let error = null;

  // Caminho principal: upsert por (user_id, date)
  ({ data, error } = await supabase
    .from('readiness_logs')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single());

  // Fallback para ambientes sem UNIQUE(user_id, date):
  // atualiza o registro de hoje (mais recente) se existir; senão, insere.
  const missingConflictConstraint =
    error &&
    (error.code === '42P10' ||
      /no unique|on conflict specification/i.test(error.message || ''));

  if (missingConflictConstraint) {
    const existingToday = await supabase
      .from('readiness_logs')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('date', today())
      .order('created_at', { ascending: false })
      .limit(1);

    if (!existingToday.error && Array.isArray(existingToday.data) && existingToday.data.length > 0) {
      ({ data, error } = await supabase
        .from('readiness_logs')
        .update(payload)
        .eq('id', existingToday.data[0].id)
        .select()
        .single());
    } else if (!existingToday.error) {
      ({ data, error } = await supabase
        .from('readiness_logs')
        .insert(payload)
        .select()
        .single());
    } else {
      error = existingToday.error;
      data = null;
    }
  }

  if (error) {
    // Log diagnóstico completo para facilitar debugging
    console.error('[readiness] Erro Supabase:', error.code, '|', error.message);
    console.error('[readiness] Detalhes:', error.details, '| Hint:', error.hint);

    // Mensagem amigável por código de erro
    let msg = 'Erro ao salvar check-in.';
    if (error.code === '42P01')  msg = 'Tabela readiness_logs não encontrada — rode a migration no Supabase.';
    else if (error.code === '42501' || error.code === 'PGRST301') msg = 'Sem permissão — verifique as policies RLS da tabela readiness_logs.';
    else if (error.code === '23505') msg = 'Registro duplicado — tente recarregar a página.';
    else if (error.message)      msg = 'Erro: ' + error.message;
    showToast(msg);
    return;
  }

  state.readiness = data;
  document.getElementById('checkin-modal').remove();
  await refreshDashboard();
  showToast('Check-in salvo! Score: ' + readiness_score + '/100');
}

// ── Card 2: Streak & Consistency ──
function renderStreakCard() {
  const allWorkouts = [...state.workouts, ...loadTreinosIA()];
  const completedDates = new Set();
  allWorkouts.forEach(w => {
    if (w.completed && w.date) {
      completedDates.add(new Date(w.date).toISOString().slice(0, 10));
    }
    if (w.data) {
      completedDates.add(new Date(w.data).toISOString().slice(0, 10));
    }
  });

  // Calculate streak (consecutive days backwards from today)
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (completedDates.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // 28-day adherence
  let completedLast28 = 0;
  const days28 = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const done = completedDates.has(key);
    if (done) completedLast28++;
    days28.push(done);
  }
  const adherence = Math.round((completedLast28 / 28) * 100);

  document.getElementById('streak-count').textContent = streak;
  document.getElementById('adherence-pct').textContent = adherence + '%';

  // Render dot grid (4 rows × 7 cols)
  const grid = document.getElementById('streak-grid');
  grid.innerHTML = '';
  days28.forEach((done, i) => {
    const dot = document.createElement('div');
    dot.className = 'streak-dot';
    if (done) {
      dot.classList.add('filled');
      if (i < 14) dot.classList.add('dim');
    }
    // Animate: stagger appearance
    dot.style.opacity = '0';
    dot.style.transition = `opacity 0.3s ease ${i * 20}ms, background 0.3s ease`;
    grid.appendChild(dot);
    requestAnimationFrame(() => {
      setTimeout(() => { dot.style.opacity = '1'; }, 10);
    });
  });

  // Update badge color based on adherence
  const streakBadge = document.getElementById('streak-badge');
  if (adherence >= 70) {
    streakBadge.className = 'insight-card-badge badge-green';
    streakBadge.textContent = adherence + '% aderência';
  } else if (adherence >= 40) {
    streakBadge.className = 'insight-card-badge badge-amber';
    streakBadge.textContent = adherence + '% aderência';
  } else {
    streakBadge.className = 'insight-card-badge badge-muted';
    streakBadge.textContent = 'Últimos 28 dias';
  }
}

// ── Card 3: Current Phase Summary ──
function getPhaseData() {
  return JSON.parse(_lsGet('axisai_phase') || 'null');
}
async function savePhaseData(data) {
  const payload = { ...data, user_id: state.user?.id, started_at: data.started_at || new Date().toISOString() };
  await saveData('training_phases', payload, 'axisai_phase');
}

function inferPhaseFromWorkouts() {
  const treinos = loadTreinosIA();
  if (!treinos.length) return null;

  // Try to extract phase info from AI-generated workouts
  const latest = treinos[treinos.length - 1];
  const faseNum = latest.faseNum || 1;
  const faseNome = latest.faseNome || 'Acumulação';
  const planoTitulo = latest.planoTitulo || 'Plano de Treino';

  // Default phase structure
  const phases = [
    { num: 1, name: 'Acumulação', focus: 'Alto volume, intensidade moderada', weeks: 4 },
    { num: 2, name: 'Transmutação', focus: 'Volume moderado, intensidade alta', weeks: 3 },
    { num: 3, name: 'Realização', focus: 'Volume baixo, intensidade máxima', weeks: 2 },
    { num: 4, name: 'Deload', focus: 'Recuperação ativa, volume reduzido', weeks: 1 }
  ];

  const currentPhase = phases.find(p => p.num === faseNum) || phases[0];

  // Estimate current week based on workout dates in this phase
  const phaseWorkouts = treinos.filter(t => (t.faseNum || 1) === faseNum);
  const firstDate = phaseWorkouts.length ? new Date(phaseWorkouts[0].data || phaseWorkouts[0].date || Date.now()) : new Date();
  const daysSinceStart = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const currentWeek = Math.min(Math.max(Math.floor(daysSinceStart / 7) + 1, 1), currentPhase.weeks);

  // Sessions remaining until deload
  const sessionsPerWeek = parseInt(state.profile?.frequency) || 4;
  const weeksLeft = currentPhase.weeks - currentWeek;
  const sessionsUntilDeload = Math.max(weeksLeft * sessionsPerWeek, 0);

  // Next phase
  const nextPhaseIdx = phases.findIndex(p => p.num === faseNum) + 1;
  const nextPhase = phases[nextPhaseIdx] || phases[0];

  return {
    name: `F${currentPhase.num} — ${currentPhase.name}`,
    currentWeek,
    totalWeeks: currentPhase.weeks,
    focus: currentPhase.focus,
    sessionsUntilDeload,
    nextPhase: `${nextPhase.name}: ${nextPhase.focus}`,
    planTitle: planoTitulo
  };
}

// ═══════════════════════════════════════════════
//  NUTRITION PAGE
// ═══════════════════════════════════════════════
// ── Shared nutrition data helper ───────────────────────────────────────────
function getNutritionData() {
  const phase = getPhaseData() || inferPhaseFromWorkouts();
  const treinos = loadTreinosIA();

  let dayType = 'treino_normal';
  let phaseName = '—';
  let phaseObjective = '—';
  let volumeLabel = 'Moderado';

  if (phase) {
    phaseName = phase.name || phase.phaseName || '—';
    phaseObjective = phase.focus || phase.objective || '—';
    const nameLC = phaseName.toLowerCase();
    if (nameLC.includes('deload') || nameLC.includes('recuper')) {
      dayType = 'deload'; volumeLabel = 'Baixo';
    } else if (nameLC.includes('realização') || nameLC.includes('intensid') || nameLC.includes('transmut')) {
      dayType = 'treino_pesado'; volumeLabel = 'Alto';
    }
  }

  const dayLabel = dayType === 'deload' ? 'Deload / Recuperação'
                 : dayType === 'treino_pesado' ? 'Treino Intenso'
                 : 'Treino Moderado';
  const dayIcon  = dayType === 'deload' ? '🔄' : dayType === 'treino_pesado' ? '🔥' : '💪';

  const phrase = phase
    ? dayType === 'treino_pesado'
      ? 'Dia pesado — priorize carboidrato pré e proteína pós'
      : dayType === 'deload'
      ? 'Semana de deload — foco em recuperação e proteína distribuída'
      : 'Dia de treino — mantenha proteína e carboidrato equilibrados'
    : 'Consulte a aba Nutrição para orientações';

  const weight = parseFloat(state.profile?.weight) || null;
  const sex = _resolveProfileSex(state.profile);
  const objetivo = state.profile?.objective || state.profile?.level || phaseObjective || '';

  let proteinMin = null, proteinMax = null;
  let carbMin = null, carbMax = null;
  let waterL = null;
  const isRestDay = dayType === 'descanso' || dayType === 'leve';

  if (weight) {
    // Proteína por perfil
    if (/força|hipertrofia|strength/i.test(objetivo)) {
      proteinMin = (weight * 1.4).toFixed(0);
      proteinMax = (weight * 1.7).toFixed(0);
    } else if (/endurance|aeróbic|resistência/i.test(objetivo)) {
      proteinMin = (weight * 1.0).toFixed(0);
      proteinMax = (weight * 1.6).toFixed(0);
    } else if (/emagrecimento|déficit|definição/i.test(objetivo)) {
      proteinMin = (weight * 1.8).toFixed(0);
      proteinMax = (weight * 2.7).toFixed(0);
    } else {
      // Default força/condicionamento
      proteinMin = (weight * 1.4).toFixed(0);
      proteinMax = (weight * 1.7).toFixed(0);
    }

    const phaseNameForCarbs = phase?.name || '';
    let carbMultiplierMin, carbMultiplierMax;
    if (/deload|recupera/i.test(phaseNameForCarbs)) {
      carbMultiplierMin = 3; carbMultiplierMax = 4;
    } else if (/realiza/i.test(phaseNameForCarbs)) {
      carbMultiplierMin = 4; carbMultiplierMax = 5;
    } else if (/transmuta/i.test(phaseNameForCarbs)) {
      carbMultiplierMin = 4; carbMultiplierMax = 6;
    } else {
      // Acumulação ou default
      carbMultiplierMin = 5; carbMultiplierMax = 7;
    }
    // Dia de descanso reduz em 1 g/kg
    if (isRestDay) { carbMultiplierMin -= 1; carbMultiplierMax -= 1; }
    carbMin = weight ? (weight * carbMultiplierMin).toFixed(0) : null;
    carbMax = weight ? (weight * carbMultiplierMax).toFixed(0) : null;

    // Hidratação por sexo
    waterL = sex === 'Feminino' ? '2,7' : '3,7';
  }

  const macroTargets = { weight, proteinMin, proteinMax, carbMin, carbMax, waterL, isRestDay };

  const suggestions = {
    treino_pesado: [
      { icon: '🍚', title: 'Carboidrato pré-treino', desc: 'Priorize carboidratos de fácil digestão antes da sessão para garantir energia disponível durante o esforço de alta intensidade.' },
      { icon: '🥚', title: 'Proteína pós-treino — prioridade alta', desc: 'A janela pós-treino é crítica em sessões intensas. Inclua uma fonte proteica de qualidade na refeição seguinte ao treino.' },
      { icon: '💧', title: 'Hidratação aumentada', desc: 'Sessões de alta intensidade elevam a perda de líquidos e eletrólitos. Hidrate-se bem antes, durante e após o treino.' },
    ],
    treino_normal: [
      { icon: '🍠', title: 'Carboidrato moderado', desc: 'Mantenha um aporte adequado de carboidratos para sustentar o desempenho, sem exageros em dias de treino moderado.' },
      { icon: '🥩', title: 'Proteína de manutenção', desc: 'Distribua proteína ao longo do dia para suportar a recuperação e preservar a massa muscular.' },
      { icon: '💧', title: 'Hidratação normal', desc: 'Mantenha o padrão habitual de ingestão de líquidos ao longo do dia.' },
    ],
    deload: [
      { icon: '🧘', title: 'Foco em recuperação', desc: 'O deload é o momento ideal para nutrir a recuperação. Alimentos anti-inflamatórios (peixes, vegetais coloridos, frutas) são bem-vindos.' },
      { icon: '🥗', title: 'Proteína distribuída ao longo do dia', desc: 'Mesmo com volume reduzido de treino, mantenha a ingestão proteica para preservar a musculatura construída.' },
      { icon: '🚫', title: 'Evite déficit calórico acentuado', desc: 'O corpo está em recuperação — cortar calorias drasticamente nesta fase pode prejudicar a regeneração muscular.' },
    ],
  };

  let lastDate = '—';
  if (treinos.length) lastDate = treinos[0].data || treinos[0].date || '—';

  return { dayType, phaseName, phaseObjective, volumeLabel, dayLabel, dayIcon, phrase, suggestions, lastDate, macroTargets };
}

// ── Única fonte de verdade do HTML de nutrição ────────────────────────────
function buildNutritionBodyHTML() {
  const { dayType, phaseName, phaseObjective, volumeLabel, dayLabel, dayIcon, suggestions, lastDate, macroTargets } = getNutritionData();
  const items = suggestions[dayType] || suggestions.treino_normal;
  const { weight, proteinMin, proteinMax, carbMin, carbMax, waterL, isRestDay } = macroTargets || {};

  const contextCardsHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;">
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-family:var(--font-mono);letter-spacing:1px;">FASE ATUAL</div>
      <div style="font-size:15px;font-weight:700;">${phaseName}</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;">
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-family:var(--font-mono);letter-spacing:1px;">TIPO DE DIA</div>
      <div style="font-size:15px;font-weight:700;">${dayIcon} ${dayLabel}</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;">
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-family:var(--font-mono);letter-spacing:1px;">VOLUME ESPERADO</div>
      <div style="font-size:15px;font-weight:700;">${volumeLabel}</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;">
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-family:var(--font-mono);letter-spacing:1px;">OBJETIVO DA SESSÃO</div>
      <div style="font-size:13px;font-weight:600;line-height:1.4;">${phaseObjective}</div>
    </div>`;

  const suggestionsHTML = items.map(s => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:flex-start;gap:12px;">
      <span style="font-size:20px;flex-shrink:0;">${s.icon}</span>
      <div>
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${s.title}</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.6;">${s.desc}</div>
      </div>
    </div>`).join('');

  const macroTargetsHTML = weight ? `
    <!-- Suas Metas de Referência -->
    <div style="margin-bottom:28px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:12px;">Suas Metas de Referência</div>
      <div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:12px;padding:14px 18px;font-size:12px;color:var(--muted);margin-bottom:10px;">
        ⚠️ Estimativas baseadas em evidências (NSCA/ACSM) e no seu perfil. Consulte um nutricionista para prescrição individualizada.
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:6px;">PROTEÍNA / DIA</div>
          <div style="font-size:20px;font-weight:700;color:var(--green);">${proteinMin}–${proteinMax}g</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">baseado em ${weight}kg</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:6px;">CARBOIDRATO / DIA</div>
          <div style="font-size:20px;font-weight:700;color:var(--green);">${carbMin}–${carbMax}g</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">${isRestDay ? 'dia de descanso' : 'dia de treino'}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:6px;">HIDRATAÇÃO</div>
          <div style="font-size:20px;font-weight:700;color:var(--green);">${waterL}L</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">mínimo diário</div>
        </div>
      </div>
    </div>
  ` : `
    <div style="margin-bottom:28px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;font-size:13px;color:var(--muted);">
        Complete seu perfil para ver suas metas personalizadas.
      </div>
    </div>
  `;

  return `
    <div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.35);border-radius:14px;padding:18px 22px;margin-bottom:28px;display:flex;align-items:flex-start;gap:14px;">
      <span style="font-size:22px;flex-shrink:0;margin-top:1px;">⚠️</span>
      <p style="font-size:13px;color:#fbbf24;line-height:1.7;margin:0;">As informações nutricionais apresentadas aqui são sugestões geradas com base no tipo e volume de treino recomendado pela plataforma. Elas não substituem a avaliação de um nutricionista habilitado. Consulte um profissional antes de fazer alterações significativas na sua dieta.</p>
    </div>
    <div style="margin-bottom:28px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:12px;">Contexto do Treino</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">${contextCardsHTML}</div>
    </div>
    ${macroTargetsHTML}
    <div style="margin-bottom:28px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:12px;">Sugestões para o Período Atual</div>
      <div style="display:flex;flex-direction:column;gap:10px;">${suggestionsHTML}</div>
    </div>
    <div style="margin-bottom:28px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:12px;">Dicas Gerais</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:flex-start;gap:12px;"><span style="font-size:18px;flex-shrink:0;">🥩</span><p style="font-size:13px;line-height:1.6;margin:0;"><strong style="color:var(--text);">Priorize proteína em todas as refeições</strong><br><span style="color:var(--muted);">Proteína é o principal nutriente para reparação muscular e saciedade. Inclua uma fonte em cada refeição do dia.</span></p></div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:flex-start;gap:12px;"><span style="font-size:18px;flex-shrink:0;">💧</span><p style="font-size:13px;line-height:1.6;margin:0;"><strong style="color:var(--text);">Hidratação — monitore a cor da urina</strong><br><span style="color:var(--muted);">Urina amarela clara indica boa hidratação. Cor escura sinaliza necessidade de aumentar a ingestão de líquidos.</span></p></div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:flex-start;gap:12px;"><span style="font-size:18px;flex-shrink:0;">⏱️</span><p style="font-size:13px;line-height:1.6;margin:0;"><strong style="color:var(--text);">Evite treinar em jejum prolongado (&gt;16h) se o objetivo é performance</strong><br><span style="color:var(--muted);">Jejuns muito longos podem comprometer força e foco durante sessões intensas. Considere uma refeição leve antes.</span></p></div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:flex-start;gap:12px;"><span style="font-size:18px;flex-shrink:0;">😴</span><p style="font-size:13px;line-height:1.6;margin:0;"><strong style="color:var(--text);">Sono e nutrição são complementares</strong><br><span style="color:var(--muted);">Déficit de sono aumenta o catabolismo muscular e desregula hormônios da fome. Dormir bem é parte do protocolo.</span></p></div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:flex-start;gap:12px;"><span style="font-size:18px;flex-shrink:0;">🌾</span><p style="font-size:13px;line-height:1.6;margin:0;"><strong style="color:var(--text);">Alimentos integrais &gt; suplementos como base da dieta</strong><br><span style="color:var(--muted);">Suplementos complementam, mas não substituem uma alimentação variada e rica em nutrientes reais.</span></p></div>
      </div>
    </div>
    <p style="font-size:11px;color:var(--muted);font-family:var(--font-mono);text-align:center;padding-top:8px;border-top:1px solid var(--border);">Conteúdo gerado automaticamente com base no protocolo de treino ativo. Última atualização: ${lastDate}</p>`;
}

function renderNutrition() {
  const body = document.getElementById('nutri-page-body');
  if (body) body.innerHTML = buildNutritionBodyHTML();
}

function renderDashboardNutritionCard() {
  const el = document.getElementById('nutri-dash-phrase');
  if (!el) return;
  const { macroTargets, phrase } = getNutritionData();
  if (macroTargets?.weight) {
    el.innerHTML = `
      <span style="color:var(--green);font-weight:700;">🥩 ${macroTargets.proteinMin}–${macroTargets.proteinMax}g</span>
      <span style="color:var(--muted);margin:0 6px;">·</span>
      <span style="color:var(--green);font-weight:700;">🍚 ${macroTargets.carbMin}–${macroTargets.carbMax}g</span>
      <span style="color:var(--muted);margin:0 6px;">·</span>
      <span style="color:var(--green);font-weight:700;">💧 ${macroTargets.waterL}L</span>
    `;
  } else {
    el.textContent = phrase;
  }
}

function openNutritionModal() {
  if (document.getElementById('nutri-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'nutri-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;background:rgba(0,0,0,0.7);overflow-y:auto;';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;width:100%;max-width:640px;display:flex;flex-direction:column;animation:fadeUp 0.3s ease;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <div style="font-family:var(--font-display);font-size:22px;letter-spacing:2px;">🥗 NUTRIÇÃO</div>
        <button onclick="closeNutritionModal()" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:4px 8px;border-radius:8px;line-height:1;">✕</button>
      </div>
      <div id="nutri-modal-body" style="padding:24px;overflow-y:auto;max-height:70vh;"></div>
      <div style="padding:16px 24px;border-top:1px solid var(--border);flex-shrink:0;">
        <button onclick="closeNutritionModal();navigate('nutrition');" style="width:100%;padding:12px;background:var(--green);color:#000;font-family:var(--font-display);font-size:16px;letter-spacing:2px;border:none;border-radius:10px;cursor:pointer;">ABRIR ABA COMPLETA →</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) closeNutritionModal(); });
  document.body.appendChild(modal);
  document.getElementById('nutri-modal-body').innerHTML = buildNutritionBodyHTML();
}

function closeNutritionModal() {
  const m = document.getElementById('nutri-modal');
  if (m) m.remove();
}

function renderPhaseCard() {
  const container = document.getElementById('phase-content');
  const badge = document.getElementById('phase-badge');

  // Try saved phase data, then infer from workouts
  let phase = getPhaseData() || inferPhaseFromWorkouts();

  if (!phase) {
    badge.textContent = 'Sem plano';
    badge.className = 'insight-card-badge badge-muted';
    container.innerHTML = `
      <div class="phase-cta">
        <p>Converse com o Coach IA para receber seu plano periodizado.</p>
      </div>`;
    return;
  }

  const progress = Math.round((phase.currentWeek / phase.totalWeeks) * 100);
  badge.textContent = `Semana ${phase.currentWeek}/${phase.totalWeeks}`;
  badge.className = 'insight-card-badge badge-green';

  container.innerHTML = `
    <div class="phase-body">
      <div>
        <div class="phase-name">${phase.name}</div>
        <div class="phase-week">Semana ${phase.currentWeek} de ${phase.totalWeeks}</div>
      </div>
      <div class="phase-progress-wrap">
        <div class="phase-progress-bar">
          <div class="phase-progress-fill" style="width:0%" data-width="${progress}%"></div>
        </div>
        <div class="phase-progress-pct">${progress}%</div>
      </div>
      <div class="phase-info-grid">
        <div class="phase-info-item">
          <span class="phase-info-label">Foco</span>
          <span class="phase-info-value">${phase.focus}</span>
        </div>
        <div class="phase-info-item">
          <span class="phase-info-label">Até deload</span>
          <span class="phase-info-value">${phase.sessionsUntilDeload} sessões</span>
        </div>
        <div class="phase-info-item" style="grid-column:1/-1;">
          <span class="phase-info-label">Próxima fase</span>
          <span class="phase-info-value">${phase.nextPhase}</span>
        </div>
      </div>
    </div>`;

  // Animate progress bar
  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = container.querySelector('.phase-progress-fill');
      if (fill) fill.style.width = fill.dataset.width;
    }, 50);
  });
}

// ── Render all dashboard cards ──
function refreshDashboardCards() {
  renderReadinessCard();
  renderPhaseCard();
}

// ═══════════════════════════════════════════════
