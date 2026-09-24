// ═══════════════════════════════════════════════
//  ATHLETES — Painel do Treinador
//  Visível apenas para usuários com role = 'coach'
// ═══════════════════════════════════════════════

let _athletesInitialized = false;
let _selectedAthleteId = null;

function _athleteText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function _athleteFmsTotal(scores) {
  if (!scores || typeof scores !== 'object') return null;
  const total = Number(scores.total);
  if (scores.total != null && Number.isFinite(total)) return total;
  const values = ['dos', 'il', 'hs', 'sm', 'aslr'].map(key => Number(scores[key]));
  return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null;
}

// ── Utilitários ──────────────────────────────────────────────

function _readinessColor(score) {
  if (score === null || score === undefined) return 'var(--muted)';
  if (score >= 75) return 'var(--green)';
  if (score >= 50) return 'var(--orange)';
  return 'var(--red)';
}

function _readinessLabel(score) {
  if (score === null || score === undefined) return 'Não avaliado';
  if (score >= 75) return 'Alta';
  if (score >= 50) return 'Moderada';
  return 'Baixa';
}

function _fmsColor(score) {
  if (!score) return 'var(--muted)';
  if (score >= 12) return 'var(--green)';
  if (score >= 9) return 'var(--orange)';
  return 'var(--red)';
}

function _daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  return diff;
}

function _daysAgoLabel(dateStr) {
  const d = _daysAgo(dateStr);
  if (d === null) return '—';
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `${d}d atrás`;
}

function _today() {
  return new Date().toISOString().split('T')[0];
}

// ── Fetch data ───────────────────────────────────────────────

async function _fetchAthletes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('coach_id', user.id)
    .order('full_name', { ascending: true });

  if (error) { console.warn('[athletes] fetch profiles:', error); return []; }
  return data || [];
}

async function _fetchTodayReadiness(athleteIds) {
  if (!athleteIds.length) return {};
  const today = _today();
  const { data, error } = await supabase
    .from('readiness_logs')
    .select('user_id, score, readiness_score, date')
    .in('user_id', athleteIds)
    .eq('date', today);
  if (error) { console.warn('[athletes] readiness today:', error); return {}; }
  const map = {};
  (data || []).forEach(r => { map[r.user_id] = r; });
  return map;
}

function _fetchLastFms(athletes) {
  return Object.fromEntries(athletes.map(athlete => [athlete.user_id, {
    fms_total: _athleteFmsTotal(athlete.fms_scores),
    created_at: athlete.fms_date,
  }]));
}

async function _fetchLastCheckin(athleteIds) {
  if (!athleteIds.length) return {};
  const { data, error } = await supabase
    .from('readiness_logs')
    .select('user_id, date')
    .in('user_id', athleteIds)
    .order('date', { ascending: false });
  if (error) { console.warn('[athletes] last checkin:', error); return {}; }
  const map = {};
  (data || []).forEach(r => {
    if (!map[r.user_id]) map[r.user_id] = r;
  });
  return map;
}

async function _fetchAthleteDetail(athleteId) {
  const [
    profileRes,
    readinessRes,
    workoutsRes
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', athleteId).maybeSingle(),
    supabase.from('readiness_logs').select('*').eq('user_id', athleteId).order('date', { ascending: false }).limit(30),
    supabase.from('workouts').select('id, titulo, categoria, created_at, status').eq('user_id', athleteId).order('created_at', { ascending: false }).limit(10),
  ]);
  const profile = profileRes.data;
  const fms = profile?.fms_scores;
  return {
    profile,
    readiness: readinessRes.data || [],
    assessments: fms ? [{
      type: 'fms', fms_total: _athleteFmsTotal(fms), created_at: profile.fms_date,
      deep_squat: fms.dos, hurdle_step: fms.hs, inline_lunge: fms.il,
      shoulder_mobility: fms.sm, active_leg: fms.aslr,
    }] : [],
    workouts: workoutsRes.data || [],
  };
}

// ── Render: lista de atletas ─────────────────────────────────

async function renderAthletesList() {
  const container = document.getElementById('athletes-list-container');
  if (!container) return;

  container.innerHTML = `<div style="color:var(--muted);font-size:12px;font-family:var(--font-mono);padding:24px;letter-spacing:1px;">Carregando atletas...</div>`;

  const athletes = await _fetchAthletes();

  if (!athletes.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 24px;color:var(--muted);">
        <div style="font-size:40px;margin-bottom:12px;">👥</div>
        <div style="font-size:14px;">Nenhum atleta vinculado ainda.</div>
        <div style="font-size:12px;margin-top:8px;font-family:var(--font-mono);">
          Peça ao administrador para vincular seus atletas.
        </div>
      </div>`;
    return;
  }

  const ids = athletes.map(a => a.user_id);
  const [todayReadiness, lastFms, lastCheckin] = await Promise.all([
    _fetchTodayReadiness(ids),
    _fetchLastFms(athletes),
    _fetchLastCheckin(ids),
  ]);

  const cards = athletes.map(athlete => {
    const readiness = todayReadiness[athlete.user_id];
    const fms = lastFms[athlete.user_id];
    const checkin = lastCheckin[athlete.user_id];
    const score = readiness?.readiness_score ?? readiness?.score ?? null;
    const checkinDays = checkin ? _daysAgo(checkin.date) : null;
    const noCheckinWarning = checkinDays === null || checkinDays > 3;

    const initials = (athlete.full_name || athlete.display_name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    const sport = athlete.modalidade || athlete.sport || '—';
    const age = Number.isInteger(athlete.age) ? `${athlete.age} anos` : '';

    return `
      <div class="athlete-card" data-athlete-id="${_athleteText(athlete.user_id)}" style="
        background:var(--surface);
        border:1px solid var(--border);
        border-radius:var(--radius);
        padding:16px;
        cursor:pointer;
        transition:all 0.2s;
        display:flex;
        align-items:center;
        gap:14px;
        margin-bottom:10px;
      ">
        <div style="
          width:44px;height:44px;border-radius:50%;
          background:linear-gradient(135deg,var(--green),#00c8ff);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;font-weight:700;color:#000;flex-shrink:0;
        ">${_athleteText(initials)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${_athleteText(athlete.full_name || athlete.display_name || 'Sem nome')}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;font-family:var(--font-mono);">
            ${_athleteText(sport)}${age ? ' · ' + age : ''}
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-shrink:0;">
          <!-- Prontidão hoje -->
          <div style="text-align:center;min-width:52px;">
            <div style="font-size:18px;font-weight:700;color:${_readinessColor(score)};font-family:var(--font-mono);">
              ${Number.isFinite(Number(score)) && score !== null ? Number(score) : '—'}
            </div>
            <div style="font-size:9px;color:${_readinessColor(score)};letter-spacing:1px;text-transform:uppercase;">
              ${_readinessLabel(score)}
            </div>
          </div>
          <!-- FMS -->
          <div style="text-align:center;min-width:44px;">
            <div style="font-size:15px;font-weight:700;color:${_fmsColor(fms?.fms_total)};font-family:var(--font-mono);">
              ${fms?.fms_total ?? '—'}
            </div>
            <div style="font-size:9px;color:var(--muted);letter-spacing:1px;">FMS</div>
          </div>
          <!-- Check-in -->
          <div style="text-align:center;min-width:48px;">
            <div style="font-size:12px;font-weight:600;color:${noCheckinWarning ? 'var(--red)' : 'var(--muted)'};font-family:var(--font-mono);">
              ${_daysAgoLabel(checkin?.date)}
            </div>
            <div style="font-size:9px;color:var(--muted);letter-spacing:1px;">CHECK-IN</div>
          </div>
          <div style="color:var(--muted);font-size:16px;">›</div>
        </div>
      </div>`;
  });

  // Alerta de sem check-in
  const noCheckinCount = athletes.filter(a => {
    const c = lastCheckin[a.user_id];
    return !c || _daysAgo(c.date) > 3;
  }).length;

  const alertBanner = noCheckinCount > 0 ? `
    <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius);padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;">⚠️</span>
      <span style="font-size:13px;color:var(--red);">${noCheckinCount} atleta${noCheckinCount > 1 ? 's' : ''} sem check-in há mais de 3 dias</span>
    </div>` : '';

  container.innerHTML = alertBanner + cards.join('');
  container.querySelectorAll('[data-athlete-id]').forEach(card => {
    card.addEventListener('click', () => window.openAthleteDetail(card.dataset.athleteId));
  });
}

// ── Render: detalhe do atleta ────────────────────────────────

window.openAthleteDetail = async function(athleteId) {
  _selectedAthleteId = athleteId;
  const listView = document.getElementById('athletes-list-view');
  const detailView = document.getElementById('athlete-detail-view');
  if (!listView || !detailView || !/^[0-9a-f-]{36}$/i.test(athleteId)) return;

  listView.style.display = 'none';
  detailView.style.display = 'block';
  detailView.innerHTML = `<div style="color:var(--muted);font-size:12px;font-family:var(--font-mono);padding:24px;letter-spacing:1px;">Carregando...</div>`;

  const { profile, readiness, assessments, workouts } = await _fetchAthleteDetail(athleteId);
  if (!profile) {
    detailView.innerHTML = `<div style="color:var(--red);padding:24px;">Erro ao carregar perfil.</div>`;
    return;
  }

  const initials = (profile.full_name || profile.display_name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  const latestReadiness = readiness[0] || null;
  const latestFms = assessments.find(a => a.type === 'fms') || null;

  // ── Seção: info básica
  const age = Number.isInteger(profile.age) ? `${profile.age} anos` : '—';
  const weight = profile.weight ? `${profile.weight} kg` : '—';
  const height = profile.height ? `${profile.height} cm` : '—';
  const sex = profile.sex || profile.gender || '—';

  // ── Seção: histórico readiness (últimos 7)
  const last7 = readiness.slice(0, 7).reverse();
  const readinessChart = last7.map(r => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);width:70px;flex-shrink:0;">
        ${new Date(r.date).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'})}
      </div>
      <div style="flex:1;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden;">
        <div style="width:${Math.max(0, Math.min(100, Number(r.readiness_score ?? r.score) || 0))}%;height:100%;background:${_readinessColor(r.readiness_score ?? r.score)};border-radius:3px;"></div>
      </div>
      <div style="font-size:12px;font-weight:700;color:${_readinessColor(r.readiness_score ?? r.score)};font-family:var(--font-mono);width:28px;text-align:right;">${_athleteText(r.readiness_score ?? r.score ?? '—')}</div>
    </div>`).join('');

  // ── Seção: lesões / comorbidades
  const injuries = Array.isArray(profile.injuries) ? profile.injuries :
    (profile.injuries ? [profile.injuries] : []);
  const comorb = profile.comorbidities || profile.health_conditions || '—';
  const parq = profile.parq_answers ? '✅ Respondido' : '—';

  // ── Seção: treinos recentes
  const workoutsList = workouts.slice(0,5).map(w => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);width:70px;flex-shrink:0;">
        ${new Date(w.created_at).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'})}
      </div>
      <div style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_athleteText(w.titulo || 'Sem título')}</div>
      <div style="font-size:11px;color:var(--muted);">${_athleteText(w.categoria || '')}</div>
    </div>`).join('') || '<div style="color:var(--muted);font-size:12px;">Nenhum treino registrado</div>';

  // ── Seção: FMS
  const fmsDisplay = latestFms ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
      ${Object.entries({
        'DP': latestFms.deep_squat, 'HB': latestFms.hurdle_step_l || latestFms.hurdle_step,
        'IL': latestFms.inline_lunge_l || latestFms.inline_lunge, 'SM': latestFms.shoulder_mobility_l || latestFms.shoulder_mobility,
        'ASLR': latestFms.active_leg_l || latestFms.active_leg, 'TSPU': latestFms.trunk_stability,
        'RS': latestFms.rotary_stability_l || latestFms.rotary_stability
      }).map(([k,v]) => v !== undefined && v !== null ? `
        <div style="background:var(--bg2);border-radius:6px;padding:6px 10px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);">${k}</div>
          <div style="font-size:15px;font-weight:700;color:${_fmsColor((v||0)*3)};">${_athleteText(v ?? '—')}</div>
        </div>` : '').join('')}
    </div>
    <div style="margin-top:8px;font-family:var(--font-mono);font-size:13px;">
      Total: <span style="color:${_fmsColor(latestFms.fms_total)};font-weight:700;">${latestFms.fms_total ?? '—'}</span>
      <span style="color:var(--muted);font-size:11px;margin-left:8px;">${latestFms.created_at ? new Date(latestFms.created_at).toLocaleDateString('pt-BR') : '—'}</span>
    </div>` : '<div style="color:var(--muted);font-size:12px;">Nenhuma avaliação FMS</div>';

  detailView.innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:4px;margin-bottom:20px;">
      <button id="athlete-back-button" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:22px;padding:4px 8px 4px 0;">‹</button>
      <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--green),#00c8ff);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#000;flex-shrink:0;">${_athleteText(initials)}</div>
      <div style="margin-left:10px;">
        <div style="font-size:18px;font-weight:700;">${_athleteText(profile.full_name || profile.display_name || 'Sem nome')}</div>
        <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">${_athleteText(profile.modalidade || profile.sport || '')} ${age !== '—' ? '· ' + age : ''}</div>
      </div>
    </div>

    <!-- Grid info básica -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px;">
      ${[
        ['Peso', weight], ['Altura', height], ['Sexo', sex],
        ['FMS', latestFms?.fms_total ?? '—'],
        ['Prontidão', latestReadiness?.readiness_score ?? latestReadiness?.score ?? '—'], ['Check-in', _daysAgoLabel(readiness[0]?.date)],
        ['PAR-Q', parq],['Modalidade', profile.modalidade || '—']
      ].map(([label, val]) => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px;text-align:center;">
          <div style="font-size:13px;font-weight:700;color:var(--text);">${_athleteText(val)}</div>
          <div style="font-size:9px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-top:2px;">${label}</div>
        </div>`).join('')}
    </div>

    <!-- Prontidão últimos 7 dias -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Prontidão — últimos 7 dias</div>
      ${readinessChart || '<div style="color:var(--muted);font-size:12px;">Sem registros</div>'}
    </div>

    <!-- FMS -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Avaliação FMS</div>
      ${fmsDisplay}
    </div>

    <!-- Lesões / Saúde -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Saúde & Restrições</div>
      <div style="font-size:13px;margin-bottom:6px;">
        <span style="color:var(--muted);font-size:11px;">Lesões: </span>
        ${_athleteText(injuries.length ? injuries.join(', ') : '—')}
      </div>
      <div style="font-size:13px;margin-bottom:6px;">
        <span style="color:var(--muted);font-size:11px;">Comorbidades: </span>
        ${_athleteText(typeof comorb === 'object' ? JSON.stringify(comorb) : comorb)}
      </div>
      <div style="font-size:13px;">
        <span style="color:var(--muted);font-size:11px;">PAR-Q: </span>${parq}
      </div>
    </div>

    <!-- Nutrição -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Nutrição</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        ${[
          ['Meta Cal.', profile.calorie_goal ? profile.calorie_goal + ' kcal' : '—'],
          ['Proteína', profile.protein_goal ? profile.protein_goal + ' g' : '—'],
          ['Objetivo', profile.objective || '—'],
        ].map(([label, val]) => `
          <div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:13px;font-weight:600;">${_athleteText(val)}</div>
            <div style="font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:1px;">${label}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Treinos recentes -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Treinos recentes</div>
      ${workoutsList}
    </div>

    <!-- Esporte / modalidade detalhado -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Esporte & Perfil</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${[
          ['Modalidade', profile.modalidade || '—'],
          ['Nível', profile.fitness_level || profile.level || '—'],
          ['Frequência', profile.frequency ? profile.frequency + 'x/sem' : '—'],
          ['Equipamento', Array.isArray(profile.equipment) ? profile.equipment.join(', ') : (profile.equipment || '—')],
        ].map(([label, val]) => `
          <div>
            <div style="font-size:9px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;">${label}</div>
            <div style="font-size:13px;margin-top:2px;">${_athleteText(val)}</div>
          </div>`).join('')}
      </div>
    </div>
  `;
  detailView.querySelector('#athlete-back-button')?.addEventListener('click', window.closeAthleteDetail);
};

window.closeAthleteDetail = function() {
  document.getElementById('athletes-list-view').style.display = 'block';
  document.getElementById('athlete-detail-view').style.display = 'none';
  _selectedAthleteId = null;
};

// ── Init ─────────────────────────────────────────────────────

async function initAthletes() {
  if (_athletesInitialized) return;
  _athletesInitialized = true;
  await renderAthletesList();
}

window.initAthletes = initAthletes;
window.renderAthletesList = renderAthletesList;
