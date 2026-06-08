// ═══════════════════════════════════════════════
function previewFMS(input, zoneId, prevId, iconId) {
  const file = input.files[0]; if (!file) return;
  const zone = document.getElementById(zoneId);
  const icon = document.getElementById(iconId);
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => { const prev = document.getElementById(prevId); prev.src = e.target.result; prev.style.display = 'block'; };
    reader.readAsDataURL(file);
  }
  zone.classList.add('has-file');
  if (icon) icon.style.display = 'none';
}

function setToeTouch(val) {
  state.toeTouch = val;
  document.getElementById('toe-btn-pos').className = 'toe-btn' + (val === 'positive' ? ' active-pos' : '');
  document.getElementById('toe-btn-neg').className = 'toe-btn' + (val === 'negative' ? ' active-neg' : '');
}

function collectDiagnosisFmsPhotos() {
  const photos = {};
  FMS_TESTS.forEach((test) => {
    if (!Array.isArray(test.photos) || test.photos.length === 0) return;
    const testPhotos = {};
    test.photos.forEach((slot) => {
      const img = document.getElementById(`fms-prev-${test.id}-${slot.key}`);
      if (img && img.src && img.style.display !== 'none') {
        testPhotos[slot.key] = img.src;
      }
    });
    if (Object.keys(testPhotos).length > 0) photos[test.id] = testPhotos;
  });
  return photos;
}

function mergeFmsPhotos(basePhotos, incomingPhotos) {
  const merged = { ...(basePhotos || {}) };
  Object.entries(incomingPhotos || {}).forEach(([movement, slots]) => {
    merged[movement] = { ...(merged[movement] || {}), ...(slots || {}) };
  });
  return merged;
}

function normalizeProfileSex(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const normalized = { ...profile };
  if (!normalized.sex && normalized.gender) {
    normalized.sex = normalized.gender;
  }
  delete normalized.gender;
  return normalized;
}

function runDiagnosis() {
  const scores = {
    dos:  parseInt(document.getElementById('fms-score-dos')?.value)  || 0,
    il:   parseInt(document.getElementById('fms-score-il')?.value)   || 0,
    hs:   parseInt(document.getElementById('fms-score-hs')?.value)   || 0,
    sm:   parseInt(document.getElementById('fms-score-sm')?.value)   || 0,
    aslr: parseInt(document.getElementById('fms-score-aslr')?.value) || 0,
    tspu: parseInt(document.getElementById('fms-score-tspu')?.value) || 0,
    tt:   state.toeTouch || null,
  };
  const totalScore = scores.dos + scores.il + scores.hs + scores.sm + scores.aslr + scores.tspu;
  const hasMedia = document.querySelector('.fms-grid .upload-zone.has-file');
  if (totalScore === 0 && !hasMedia && !scores.tt) return showToast('Preencha ao menos uma nota FMS, envie uma foto ou faça o Toe Touch.', true);

  showToast('Analisando seus scores FMS…');
  const resultCard = document.getElementById('diagnosis-result');
  resultCard.classList.remove('visible');

  const issues = [];
  const feedback = [];
  if (scores.dos <= 1) { issues.push('squat_dysfunction'); feedback.push(`Deep Squat nota ${scores.dos}: Disfunção de agachamento. Use Goblet Squat to Box; evite Back Squat.`); }
  if (scores.il <= 1) { issues.push('lunge_dysfunction'); feedback.push(`Inline Lunge nota ${scores.il}: Disfunção de avanço. Use Split Squat estático.`); }
  if (scores.hs <= 1) { issues.push('hip_instability'); feedback.push(`Hurdle Step nota ${scores.hs}: Instabilidade de quadril. Regrida para Bridge.`); }
  if (scores.sm <= 1) { issues.push('shoulder_restriction'); feedback.push(`Shoulder Mobility nota ${scores.sm}: Restrição de ombro. Use Floor Slides.`); }
  if (scores.aslr <= 1) { issues.push('hamstring_restriction'); feedback.push(`ASLR nota ${scores.aslr}: Restrição de isquiotibiais. Use Reaching SLDL BW.`); }
  if (scores.tspu <= 1) { issues.push('trunk_instability'); feedback.push(`Trunk Push-Up nota ${scores.tspu}: Instabilidade de tronco. Priorizar ativação de core antes de pressing.`); }
  if (scores.tt === 'negative') { issues.push('toe_touch_negative'); feedback.push('Toe Touch negativo: Indica restrição posterior. Incluir Toe Touch Sequence no aquecimento.'); }
  if (issues.length === 0) { issues.push('none'); feedback.push(`Todos os testes OK. Score total: ${totalScore}/18. Pode progredir normalmente.`); }

  if (!state.profile) state.profile = {};
  state.profile.fms = scores;
  const diagnosisPhotos = collectDiagnosisFmsPhotos();
  if (Object.keys(diagnosisPhotos).length > 0) {
    state.profile.fmsPhotos = mergeFmsPhotos(state.profile.fmsPhotos, diagnosisPhotos);
  }
  state.profile.risk_flags = issues;
  saveProfile(true);
  setFmsLatest(scores, undefined, state.profile.fmsPhotos || null);

  // Sync profile selects
  ['dos','il','hs','sm','aslr','tspu'].forEach(k => { const el = document.getElementById('p-fms-' + k); if (el) el.value = scores[k]; });
  if (scores.tt) { const el = document.getElementById('p-fms-tt'); if (el) el.value = scores.tt; }

  const statRisks = document.getElementById('stat-risks');
  if (statRisks) statRisks.textContent = String(issues.filter(f => f !== 'none').length);
  refreshChatSidebar();

  document.getElementById('result-feedback').textContent = feedback.join('\n\n');
  const issueLabels = { squat_dysfunction:'Disfunção de Agachamento', lunge_dysfunction:'Disfunção de Avanço', hip_instability:'Instabilidade de Quadril', shoulder_restriction:'Restrição de Ombro', hamstring_restriction:'Restrição de Isquiotibiais', trunk_instability:'Instabilidade de Tronco', toe_touch_negative:'Toe Touch Negativo', none:'Sem alterações' };
  document.getElementById('result-issues').innerHTML = issues.map(i => `<div class="issue-chip ${i==='none'?'ok':'risk'}">${i==='none'?'✅':'⚠️'} ${issueLabels[i]||i}</div>`).join('');
  const badge = document.getElementById('result-badge');
  const rc = issues.filter(f => f !== 'none').length;
  if (rc > 0) { badge.textContent = rc + ' FLAG' + (rc>1?'S':''); badge.style.background = 'rgba(239,68,68,0.1)'; badge.style.color = '#fca5a5'; }
  else { badge.textContent = 'APROVADO'; badge.style.background = 'rgba(0,255,135,0.1)'; badge.style.color = 'var(--green)'; }
  resultCard.classList.add('visible');
  showToast(`Diagnóstico FMS concluído! Score: ${totalScore}/18`);
}

// ═══════════════════════════════════════════════
//  PROFILE HEALTH (comorbidades, medicações, nome)
// ═══════════════════════════════════════════════
function loadProfileHealth() {
  const profileKey = getProfileKey();
  const profile = profileKey ? JSON.parse(_lsGet(profileKey) || '{}') : {};

  const displayNameEl = document.getElementById('profile-display-name');
  const fullNameEl = document.getElementById('profile-full-name-edit');
  if (displayNameEl) displayNameEl.value = profile.display_name || '';
  if (fullNameEl) fullNameEl.value = profile.full_name || profile.display_name || '';

  const comorbidities = profile.comorbidities || [];
  document.querySelectorAll('#profile-comorbidities-grid input[type="checkbox"]').forEach(cb => {
    cb.checked = comorbidities.includes(cb.value);
  });
  const knownComorbidities = Array.from(document.querySelectorAll('#profile-comorbidities-grid input')).map(i => i.value);
  const otherComorbidities = comorbidities.filter(c => !knownComorbidities.includes(c));
  const otherComorbiditiesEl = document.getElementById('profile-comorbidities-other');
  if (otherComorbiditiesEl) otherComorbiditiesEl.value = otherComorbidities.join(', ');

  const medications = profile.medications || [];
  document.querySelectorAll('#profile-medications-grid input[type="checkbox"]').forEach(cb => {
    cb.checked = medications.includes(cb.value);
  });
  const knownMeds = Array.from(document.querySelectorAll('#profile-medications-grid input')).map(i => i.value);
  const otherMeds = medications.filter(m => !knownMeds.includes(m));
  const otherMedsEl = document.getElementById('profile-medications-other');
  if (otherMedsEl) otherMedsEl.value = otherMeds.join(', ');

  const injuriesEl = document.getElementById('profile-injuries-edit');
  if (injuriesEl) injuriesEl.value = profile.injuries || '';
}

async function saveProfileHealth() {
  const profileKey = getProfileKey();
  const profile = normalizeProfileSex(profileKey ? JSON.parse(_lsGet(profileKey) || '{}') : {});

  const displayName = document.getElementById('profile-display-name')?.value?.trim();
  const fullName = document.getElementById('profile-full-name-edit')?.value?.trim();

  const comorbiditiesChecked = Array.from(
    document.querySelectorAll('#profile-comorbidities-grid input:checked')
  ).map(el => el.value);
  const comorbiditiesOther = document.getElementById('profile-comorbidities-other')?.value?.trim();
  if (comorbiditiesOther) comorbiditiesChecked.push(...comorbiditiesOther.split(',').map(s => s.trim()).filter(Boolean));

  const medicationsChecked = Array.from(
    document.querySelectorAll('#profile-medications-grid input:checked')
  ).map(el => el.value);
  const medicationsOther = document.getElementById('profile-medications-other')?.value?.trim();
  if (medicationsOther) medicationsChecked.push(...medicationsOther.split(',').map(s => s.trim()).filter(Boolean));

  const injuries = document.getElementById('profile-injuries-edit')?.value?.trim();

  const updatedProfile = normalizeProfileSex({
    ...profile,
    display_name:  displayName || profile.display_name,
    full_name:     fullName    || profile.full_name,
    comorbidities: comorbiditiesChecked,
    medications:   medicationsChecked,
    injuries:      injuries !== undefined ? injuries : profile.injuries,
  });
  state.profile = updatedProfile;
  const profilePayload = { ...updatedProfile, user_id: state.user?.id };
  delete profilePayload.id;
  delete profilePayload.fmsPhotos; // keep photos local to avoid oversized profile payloads
  delete profilePayload.role;
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(sanitizeProfilePayload(profilePayload), { onConflict: 'user_id' });
    if (error) console.warn('[saveProfileHealth] Supabase error:', error.message);
    else if (profileKey) localStorage.setItem(profileKey, JSON.stringify(updatedProfile));
  } catch(e) {
    console.warn('[saveProfileHealth] fallback localStorage:', e);
    if (profileKey) localStorage.setItem(profileKey, JSON.stringify(updatedProfile));
  }

  // Update greeting in sidebar/dashboard
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = getDisplayName();
  const greetingEl = document.getElementById('greeting-name');
  if (greetingEl) greetingEl.textContent = getDisplayName();

  showToast('Dados de saúde salvos com sucesso!');
}

// ═══════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════
async function _waitForSessionProfile() {
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

async function initProfile() {
  const session = await _waitForSessionProfile();
  if (!session?.user?.id) {
    console.warn('initProfile: sessão não disponível');
    return;
  }
  if (!state.user?.id) {
    state.user = {
      ...(state.user || {}),
      id: session.user.id,
      email: session.user.email || state.user?.email || ''
    };
  }
  await loadProfile();
}

async function loadProfile() {
  const session = await _waitForSessionProfile();
  if (!session?.user?.id) {
    console.warn('loadProfile: sessão não disponível');
    return;
  }
  if (!state.user?.id) {
    state.user = {
      ...(state.user || {}),
      id: session.user.id,
      email: session.user.email || state.user?.email || ''
    };
  }

  const profileKey = getProfileKey();
  const fmsKey = getFmsLatestKey();
  // Restore fmsLatest from dedicated localStorage key
  if (!state.fmsLatest) {
    const savedFms = fmsKey ? _lsGet(fmsKey) : null;
    if (savedFms) {
      try { state.fmsLatest = JSON.parse(savedFms); } catch(e) {}
    }
  }
  // Bootstrap from profile if no dedicated entry yet
  if (!state.fmsLatest) {
    const profileRaw = profileKey ? _lsGet(profileKey) : null;
    if (profileRaw) {
      try {
        const prof = JSON.parse(profileRaw);
        if (prof.fms && Object.keys(prof.fms).length > 0) {
          state.fmsLatest = { fms: prof.fms, date: null };
        }
      } catch(e) {}
    }
  }

  if (state.user?.id) {
    try {
      const { data: remoteProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', state.user.id)
        .maybeSingle();
      if (remoteProfile) {
        const normalizedRemoteProfile = normalizeProfileSex(remoteProfile);
        if (!normalizedRemoteProfile.fms_scores && normalizedRemoteProfile.fms) {
          const hasFmsData = typeof normalizedRemoteProfile.fms === 'object' &&
            Object.keys(normalizedRemoteProfile.fms).length > 0;
          if (hasFmsData) {
            const { error: syncFmsScoresError } = await supabase
              .from('profiles')
              .update({ fms_scores: normalizedRemoteProfile.fms })
              .eq('user_id', state.user.id);
            if (syncFmsScoresError) {
              console.warn('[loadProfile] sync fms_scores:', syncFmsScoresError.message);
            } else {
              normalizedRemoteProfile.fms_scores = normalizedRemoteProfile.fms;
            }
          }
        }
        if (!normalizedRemoteProfile.fms && normalizedRemoteProfile.fms_scores) {
          normalizedRemoteProfile.fms = normalizedRemoteProfile.fms_scores;
        }
        state.profile = { ...state.profile, ...normalizedRemoteProfile };
        // Normalizar equipment para array
        if (typeof state.profile.equipment === 'string') {
          try { state.profile.equipment = JSON.parse(state.profile.equipment); } catch(e) { state.profile.equipment = []; }
        }
        if (!Array.isArray(state.profile.equipment)) state.profile.equipment = [];
        if (profileKey) localStorage.setItem(profileKey, JSON.stringify(state.profile));
        // ── FIX: garantir que nomes no DOM reflitam o perfil recém carregado ──
        if (typeof window._refreshNameElements === 'function') window._refreshNameElements();
      }
    } catch(e) {
      console.warn('[loadProfile] Supabase fallback para localStorage:', e);
    }
  }

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
        // Calcular risk_flags a partir do fms
        const f = fmsRow.fms;
        const flags = [];
        if (!state.profile) state.profile = {};
        if (f.dos !== undefined && f.dos <= 1) flags.push('squat_dysfunction');
        if (f.il  !== undefined && f.il  <= 1) flags.push('lunge_dysfunction');
        if (f.hs  !== undefined && f.hs  <= 1) flags.push('hip_instability');
        if (f.sm  !== undefined && f.sm  <= 1) flags.push('shoulder_restriction');
        if (f.aslr !== undefined && f.aslr <= 1) flags.push('hamstring_restriction');
        if (f.tt === 'negative') flags.push('toe_touch_negative');
        state.profile.fms = f;
        state.profile.risk_flags = flags.length > 0 ? flags : ['none'];
        state.fmsLatest = { fms: f, date: fmsRow.date, photos: fmsRow.photos };
        if (profileKey) localStorage.setItem(profileKey, JSON.stringify(state.profile));
        if (fmsKey) localStorage.setItem(fmsKey, JSON.stringify(state.fmsLatest));
      }
    } catch(e) {
      console.warn('[loadProfile] fms_assessments fallback:', e);
    }
  }

  const saved = profileKey ? _lsGet(profileKey) : null;
  if (saved) {
    state.profile = normalizeProfileSex(JSON.parse(saved));
    if (!state.profile.fms && state.profile.fms_scores) {
      state.profile.fms = state.profile.fms_scores;
    }
    // Normalizar equipment para array
    if (typeof state.profile.equipment === 'string') {
      try { state.profile.equipment = JSON.parse(state.profile.equipment); } catch(e) { state.profile.equipment = []; }
    }
    if (!Array.isArray(state.profile.equipment)) state.profile.equipment = [];
    const p = state.profile;
    if (p.age) document.getElementById('p-age').value = p.age;
    if (p.weight) document.getElementById('p-weight').value = p.weight;
    if (p.height) document.getElementById('p-height').value = p.height;
    if (p.level) document.getElementById('p-level').value = p.level;
    if (p.objective) document.getElementById('p-goal').value = p.objective;
    if (p.gym) document.getElementById('p-gym').value = p.gym;
    if (p.frequency) {
      const el = document.getElementById('p-frequency');
      if (el) el.value = p.frequency;
    }
    if (p.session_time) {
      const el = document.getElementById('p-session-time');
      if (el) el.value = p.session_time;
    }
    document.querySelectorAll('.p-equipment').forEach(el => {
      el.checked = Array.isArray(p.equipment) && p.equipment.includes(el.value);
    });
    if (p.injuries) document.getElementById('p-injuries').value = p.injuries;
    if (p.fms) {
      ['dos','il','hs','sm','aslr','tspu'].forEach(k => { if (p.fms[k] !== undefined) { const el = document.getElementById('p-fms-' + k); if (el) el.value = p.fms[k]; } });
      if (p.fms.tt) { const el = document.getElementById('p-fms-tt'); if (el) el.value = p.fms.tt; }
    }
    // Rotina profissional
    if (p.profissao)     { const el = document.getElementById('p-profissao');     if (el) el.value = p.profissao; }
    if (p.horas_trabalho){ const el = document.getElementById('p-horas-trabalho'); if (el) el.value = p.horas_trabalho; }
    if (p.perfil_postural){ const el = document.getElementById('p-perfil-postural'); if (el) { el.value = p.perfil_postural; toggleHorasSentado(el,'p-horas-sentado-group'); } }
    if (p.horas_sentado) { const el = document.getElementById('p-horas-sentado');  if (el) el.value = p.horas_sentado; }
    if (p.estresse_ocup) { const el = document.getElementById('p-estresse-ocup');  if (el) el.value = p.estresse_ocup; }
    if (p.turno_trabalho){ const el = document.getElementById('p-turno');           if (el) el.value = p.turno_trabalho; }
    if (p.modalidade)    { const el = document.getElementById('p-modalidade');       if (el) el.value = p.modalidade; }
  }
  // Chamar refreshChatSidebar após tudo carregado
  if (typeof refreshChatSidebar === 'function') refreshChatSidebar();
  updateCoachNavIndicator();
}

const ALLOWED_PROFILE_FIELDS = [
  'user_id', 'display_name', 'full_name', 'age', 'weight', 'height',
  'sex', 'objective', 'level', 'gym', 'equipment', 'injuries',
  'frequency', 'session_time', 'parq', 'onboarding_done',
  'risk_flags', 'fms', 'fms_scores', 'fms_photos',
  'profissao', 'horas_trabalho', 'perfil_postural', 'horas_sentado',
  'estresse_ocup', 'turno_trabalho', 'comorbidities', 'medications',
  'modalidade', 'toe_touch', 'parq_approved', 'parq_answers',
];

function sanitizeProfilePayload(payload) {
  const clean = {};
  ALLOWED_PROFILE_FIELDS.forEach(field => {
    if (payload[field] !== undefined) clean[field] = payload[field];
  });

  // Campos que devem ser INTEGER no banco
  const INTEGER_FIELDS = ['age', 'horas_trabalho', 'horas_sentado'];

  INTEGER_FIELDS.forEach(field => {
    if (field in clean) {
      const val = clean[field];
      if (val === '' || val === null || val === undefined) {
        delete clean[field]; // omitir em vez de enviar string vazia
      } else {
        const parsed = parseInt(val, 10);
        clean[field] = isNaN(parsed) ? null : parsed;
      }
    }
  });

  return clean;
}

async function saveProfile(silent = false) {
  const profileKey = getProfileKey();
  let equipmentArray = Array.from(document.querySelectorAll('.p-equipment:checked')).map(e => e.value);

  const p = {
    age: document.getElementById('p-age')?.value || state.profile?.age,
    weight: document.getElementById('p-weight')?.value || state.profile?.weight,
    height: document.getElementById('p-height')?.value || state.profile?.height,
    sex: document.getElementById('p-sex')?.value || state.profile?.sex,
    level: document.getElementById('p-level')?.value || state.profile?.level,
    objective: document.getElementById('p-goal')?.value || state.profile?.objective,
    gym: document.getElementById('p-gym')?.value || state.profile?.gym,
    frequency: document.getElementById('p-frequency')?.value || state.profile?.frequency,
    session_time: document.getElementById('p-session-time')?.value || state.profile?.session_time,
    equipment: equipmentArray,
    injuries: document.getElementById('p-injuries')?.value || state.profile?.injuries,
    risk_flags: state.profile?.risk_flags || [],
    fms: state.profile?.fms || {},
    profissao:     document.getElementById('p-profissao')?.value     || state.profile?.profissao    || '',
    horas_trabalho: document.getElementById('p-horas-trabalho')?.value || state.profile?.horas_trabalho || '',
    perfil_postural: document.getElementById('p-perfil-postural')?.value || state.profile?.perfil_postural || '',
    horas_sentado:  document.getElementById('p-horas-sentado')?.value  || state.profile?.horas_sentado  || '',
    estresse_ocup:  document.getElementById('p-estresse-ocup')?.value  || state.profile?.estresse_ocup  || '',
    turno_trabalho: document.getElementById('p-turno')?.value          || state.profile?.turno_trabalho || '',
    modalidade:     document.getElementById('p-modalidade')?.value?.trim() || state.profile?.modalidade || '',
  };
  // Normalizar equipment para array antes do upsert
  if (equipmentArray.length === 0 && state.profile?.equipment) {
    if (typeof state.profile.equipment === 'string') {
      try { equipmentArray = JSON.parse(state.profile.equipment); } catch(e) { equipmentArray = []; }
    } else if (Array.isArray(state.profile.equipment)) {
      equipmentArray = state.profile.equipment;
    }
  }
  state.profile = normalizeProfileSex({ ...state.profile, ...p, equipment: equipmentArray });
  const profilePayload = { ...state.profile, user_id: state.user?.id };
  if (profilePayload.fms && !profilePayload.fms_scores) profilePayload.fms_scores = profilePayload.fms;
  if (profilePayload.fms_scores && !profilePayload.fms) profilePayload.fms = profilePayload.fms_scores;
  // Garantias de tipo antes do upsert
  if (typeof profilePayload.equipment === 'string') {
    try { profilePayload.equipment = JSON.parse(profilePayload.equipment); } catch(e) { profilePayload.equipment = []; }
  }
  if (!Array.isArray(profilePayload.equipment)) profilePayload.equipment = equipmentArray;
  if (!profilePayload.session_time && p.session_time) profilePayload.session_time = p.session_time;
  delete profilePayload.id;
  delete profilePayload.fmsPhotos; // keep photos local to avoid oversized profile payloads
  delete profilePayload.role; // never overwrite role from client-side profile save
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(sanitizeProfilePayload(profilePayload), { onConflict: 'user_id' });
    if (error) console.warn('[saveProfile] Supabase error:', error.message);
    else if (profileKey) localStorage.setItem(profileKey, JSON.stringify(state.profile));
  } catch(e) {
    console.warn('[saveProfile] fallback localStorage:', e);
    if (profileKey) localStorage.setItem(profileKey, JSON.stringify(state.profile));
  }
  refreshChatSidebar();
  if (!silent) showToast('Perfil salvo com sucesso! ✅');
}

async function saveFMS() {
  const vals = {};
  ['dos','il','hs','sm','aslr','tspu'].forEach(k => { const v = document.getElementById('p-fms-' + k).value; if (v !== '') vals[k] = parseInt(v); });
  const tt = document.getElementById('p-fms-tt').value;
  if (tt) vals.tt = tt;
  if (Object.keys(vals).length === 0) return showToast('Preencha ao menos um score.', true);
  if (!state.profile) state.profile = {};
  state.profile.fms = { ...state.profile.fms, ...vals };
  state.profile.fms_scores = state.profile.fms;

  const flags = [];
  const fms = state.profile.fms;
  if (fms.dos !== undefined && fms.dos <= 1) flags.push('squat_dysfunction');
  if (fms.il !== undefined && fms.il <= 1) flags.push('lunge_dysfunction');
  if (fms.hs !== undefined && fms.hs <= 1) flags.push('hip_instability');
  if (fms.sm !== undefined && fms.sm <= 1) flags.push('shoulder_restriction');
  if (fms.aslr !== undefined && fms.aslr <= 1) flags.push('hamstring_restriction');
  if (fms.tt === 'negative') flags.push('toe_touch_negative');
  state.profile.risk_flags = flags.length > 0 ? flags : ['none'];

  await setFmsLatest(state.profile.fms);
  await saveProfile(true);
  refreshDashboard();
  showToast('FMS salvo! ' + (flags.length > 0 ? flags.length + ' flag(s) ⚠️' : 'Sem disfunções ✅'));
}

// ═══════════════════════════════════════════════
//  FMS RESULTS
// ═══════════════════════════════════════════════
async function setFmsLatest(fms, date, photos) {
  const fmsKey = getFmsLatestKey();
  state.fmsLatest = { fms, date: date || new Date().toISOString(), photos: photos || state.fmsLatest?.photos || null };
  if (state.user?.id) {
    if (fmsKey) {
      await saveData('fms_assessments', { user_id: state.user.id, fms, photos: state.fmsLatest.photos, date: state.fmsLatest.date }, fmsKey);
    }
  } else {
    if (fmsKey) localStorage.setItem(fmsKey, JSON.stringify(state.fmsLatest));
  }
  renderFmsResults();
  refreshPendingAlert();
}

function _fmsScoreColor(score) {
  if (score === null || score === undefined) return 'muted';
  if (score === 3) return 'green';
  if (score === 2) return 'yellow';
  return 'red'; // 0 or 1
}

function renderFmsResults() {
  const container = document.getElementById('fms-results-container');
  if (!container) return;
  if (!state.fmsLatest?.fms) { container.innerHTML = ''; return; }

  const fms  = state.fmsLatest.fms;
  const date = state.fmsLatest.date
    ? new Date(state.fmsLatest.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
    : '';

  // Sum all 6 scored movements (DOS, HS, IL, SM, ASLR, TSPU)
  const scoredIds = ['dos','hs','il','sm','aslr','tspu'];
  const scores = scoredIds.map(id => fms[id] ?? null);
  const total  = scores.reduce((sum, s) => sum + (s ?? 0), 0);
  const max    = scoredIds.length * 3; // 18

  let classLabel, classColor;
  if (total >= 14)      { classLabel = 'Padrões funcionais — baixo risco de lesão'; classColor = 'green'; }
  else if (total >= 10) { classLabel = 'Atenção — assimetrias ou limitações presentes'; classColor = 'yellow'; }
  else                  { classLabel = 'Alto risco — disfunções de movimento identificadas'; classColor = 'red'; }

  const cardsHtml = FMS_RESULT_DEFS.map(def => {
    const score = fms[def.id] ?? null;
    const isNA  = score === null;
    const color = isNA ? 'muted' : _fmsScoreColor(score);
    const descText = isNA
      ? `<div class="fms-result-na">Não avaliado nesta versão</div>`
      : `<div class="fms-result-desc">${score} — ${def.desc[score]}</div>`;
    const scoreDisplay = isNA ? '—' : score;
    const scoreStyle   = isNA ? 'color:var(--muted)' : `color:${color === 'green' ? 'var(--green)' : color === 'yellow' ? '#f59e0b' : '#ef4444'}`;
    return `<div class="fms-result-card">
      <div class="fms-result-dot ${color}"></div>
      <div class="fms-result-body">
        <div class="fms-result-names">
          <span class="fms-result-en">${def.nameEn}</span>
          <span class="fms-result-pt">${def.namePt}</span>
          <span class="fms-result-score" style="${scoreStyle}">${scoreDisplay}</span>
        </div>
        ${descText}
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="fms-results-section">
    <div class="fms-results-header">RESULTADO DA AVALIAÇÃO</div>
    ${cardsHtml}
    <div class="fms-total-card">
      <div class="fms-total-score" style="color:${classColor === 'green' ? 'var(--green)' : classColor === 'yellow' ? '#f59e0b' : '#ef4444'}">${total}</div>
      <div class="fms-total-label">PONTOS / ${max} (6 MOVIMENTOS AVALIADOS)</div>
      <div class="fms-total-class ${classColor}">${classLabel}</div>
      ${date ? `<div class="fms-result-date">Avaliação realizada em ${date}</div>` : ''}
    </div>
  </div>`;

  // Medication alerts
  const profileKey = getProfileKey();
  const _healthProfile = profileKey ? JSON.parse(_lsGet(profileKey) || '{}') : {};
  const _medications = _healthProfile.medications || [];
  if (_medications.length > 0) {
    const medAlerts = [];
    if (_medications.includes('betabloqueador')) medAlerts.push('⚠️ Betabloqueador detectado — FC não é parâmetro confiável de intensidade. Usar PSE (escala de Borg) como referência principal.');
    if (_medications.includes('anticoagulante')) medAlerts.push('⚠️ Anticoagulante detectado — evitar exercícios de impacto e contato. Risco de sangramento aumentado.');
    if (_medications.includes('corticoide')) medAlerts.push('⚠️ Corticoide em uso — atenção ao volume de treino e recuperação. Pode mascarar dor e inflamação.');
    if (_medications.includes('insulina') || _medications.includes('metformina')) medAlerts.push('⚠️ Medicação para diabetes — nunca treinar em jejum. Monitorar sintomas de hipoglicemia.');
    if (_medications.includes('ozempic')) medAlerts.push('⚠️ GLP-1 (Ozempic/Mounjaro) — possível redução de massa magra. Priorizar volume de treino de força. Monitorar composição corporal.');
    if (_medications.includes('antidepressivo') || _medications.includes('ansiolitico')) medAlerts.push('⚠️ Medicação psiquiátrica — dados de sono/energia/humor do check-in podem ser influenciados. Interpretar prontidão com contexto clínico.');
    if (medAlerts.length > 0) {
      container.innerHTML += `<div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px;margin-top:12px">
        <h4 style="color:#FFC107;margin:0 0 10px;font-size:14px">⚕️ ALERTAS POR MEDICAÇÃO</h4>
        ${medAlerts.map(a => `<p style="color:#aaa;font-size:13px;margin:0 0 8px;line-height:1.5">${a}</p>`).join('')}
      </div>`;
    }
  }
}

function refreshPendingAlert() {
  const el = document.getElementById('fms-pending-alert');
  if (!el) return;
  const hasData = state.fmsLatest?.fms &&
    ['dos','hs','il','sm','aslr'].some(k => state.fmsLatest.fms[k] !== null && state.fmsLatest.fms[k] !== undefined);
  el.style.display = hasData ? 'none' : 'flex';
}

// ── FIX BUG 3: FMS Preview — shows FMS scores and risk flags from dashboard CTA ──
function showFmsPreview() {
  // If no FMS data, go to diagnosis page to do the assessment
  if (!state.fmsLatest?.fms && !state.profile?.fms) {
    navigate('diagnosis');
    return;
  }

  const fms = state.fmsLatest?.fms || state.profile?.fms || {};
  const riskFlags = (state.profile?.risk_flags || []).filter(f => f !== 'none');
  const scoredIds = ['dos','hs','il','sm','aslr','tspu'];
  const total = scoredIds.reduce((sum, id) => sum + (fms[id] ?? 0), 0);
  const max = scoredIds.length * 3; // 18

  let classLabel, classColor;
  if (total >= 14)     { classLabel = 'Boa base de movimento'; classColor = 'var(--green)'; }
  else if (total >= 10) { classLabel = 'Atenção — limitações presentes'; classColor = '#f59e0b'; }
  else                 { classLabel = 'Alto risco — disfunções identificadas'; classColor = '#ef4444'; }

  const flagLabels = {
    squat_dysfunction:'Disfunção de Agachamento', lunge_dysfunction:'Disfunção de Avanço',
    hip_instability:'Instabilidade de Quadril', shoulder_restriction:'Restrição de Ombro',
    hamstring_restriction:'Restrição de Isquiotibiais', toe_touch_negative:'Toe Touch Negativo',
    trunk_instability:'Instabilidade de Tronco'
  };

  const movementNames = { dos:'Deep Squat', hs:'Hurdle Step', il:'Inline Lunge', sm:'Shoulder Mobility', aslr:'ASLR', tspu:'Trunk Push-Up' };

  const scoresHtml = scoredIds.map(id => {
    const score = fms[id] ?? null;
    const color = score === null ? 'var(--muted)' : score >= 3 ? 'var(--green)' : score >= 2 ? '#f59e0b' : '#ef4444';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;color:var(--text);">${movementNames[id]}</span>
      <span style="font-family:var(--font-mono);font-weight:700;font-size:16px;color:${color};">${score ?? '—'}</span>
    </div>`;
  }).join('');

  const toeTouch = fms.tt;
  const ttHtml = toeTouch ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
    <span style="font-size:13px;color:var(--text);">Toe Touch</span>
    <span style="font-family:var(--font-mono);font-weight:700;font-size:14px;color:${toeTouch === 'positive' ? 'var(--green)' : '#ef4444'};">${toeTouch === 'positive' ? 'POSITIVO' : 'NEGATIVO'}</span>
  </div>` : '';

  const flagsHtml = riskFlags.length > 0
    ? riskFlags.map(f => `<div style="padding:6px 10px;background:rgba(239,68,68,0.1);border-radius:8px;font-size:12px;color:#fca5a5;margin-bottom:4px;">⚠️ ${flagLabels[f]||f}</div>`).join('')
    : '<div style="padding:6px 10px;background:rgba(0,255,135,0.1);border-radius:8px;font-size:12px;color:var(--green);">Nenhuma disfunção identificada</div>';

  // Remove any existing preview modal
  const existing = document.getElementById('fms-preview-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fms-preview-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;padding:28px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div style="font-family:var(--font-display);font-size:18px;letter-spacing:1px;">AVALIAÇÃO FMS</div>
      <button onclick="document.getElementById('fms-preview-modal').remove()" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;">✕</button>
    </div>
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-family:var(--font-mono);font-size:42px;font-weight:700;color:${classColor};">${total}<span style="font-size:18px;color:var(--muted);">/${max}</span></div>
      <div style="font-size:12px;color:${classColor};margin-top:4px;">${classLabel}</div>
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted);margin-bottom:8px;">SCORES POR MOVIMENTO</div>
      ${scoresHtml}
      ${ttHtml}
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted);margin-bottom:8px;">FLAGS DE RISCO</div>
      ${flagsHtml}
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="document.getElementById('fms-preview-modal').remove();navigate('diagnosis')" style="flex:1;padding:10px;background:none;border:1px solid var(--border);color:var(--text);border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">REFAZER AVALIAÇÃO</button>
      <button onclick="document.getElementById('fms-preview-modal').remove()" style="flex:1;padding:10px;background:var(--green);color:#000;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">FECHAR</button>
    </div>
  </div>`;
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function _escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _buildFmsReportSource() {
  const onboardingVisible = document.getElementById('screen-onboarding')?.style.display === 'flex' &&
    document.getElementById('wizard-step-5')?.style.display !== 'none';
  if (onboardingVisible) {
    return {
      scores: { ..._fmsScores, tt: _fmsToeTouch === true ? 'positive' : _fmsToeTouch === false ? 'negative' : null },
      photos: { ..._fmsPhotos },
      date: new Date().toISOString(),
      origin: 'onboarding',
    };
  }
  const profileKey = getProfileKey();
  const cachedProfile = profileKey ? JSON.parse(_lsGet(profileKey) || '{}') : {};
  const profile = state.profile || cachedProfile || {};
  return {
    scores: profile.fms || state.fmsLatest?.fms || {},
    photos: profile.fmsPhotos || state.fmsLatest?.photos || {},
    date: state.fmsLatest?.date || null,
    origin: 'app',
  };
}

function showFmsPhotoReport() {
  const source = _buildFmsReportSource();
  const scores = source.scores || {};
  const photos = source.photos || {};
  const hasAnyPhoto = Object.values(photos).some((slots) => slots && Object.keys(slots).length > 0);
  if (!hasAnyPhoto) {
    return showToast('Ainda não há fotos salvas para gerar o relatório.', true);
  }

  const total = ['dos','hs','il','sm','aslr','tspu'].reduce((sum, key) => sum + (Number(scores[key]) || 0), 0);
  const dateLabel = source.date ? new Date(source.date).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const movementCards = FMS_MOVEMENTS.map((movement) => {
    const score = scores[movement.stateKey];
    const meta = Number.isInteger(score) ? FMS_SCORE_META[score] : null;
    const slots = movement.photoSlots || [];
    const movementPhotos = photos[movement.stateKey] || photos[movement.dbKey] || {};
    const slotHtml = slots.map((slot) => {
      const src = movementPhotos[slot.key];
      if (src) {
        return `<div style="border:1px solid #2f2f2f;border-radius:10px;padding:8px;background:#111;">
          <div style="font-size:10px;color:#8a8a8a;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${_escapeHtml(slot.label)}</div>
          <img src="${src}" alt="${_escapeHtml(slot.label)}" style="width:100%;height:140px;object-fit:cover;border-radius:8px;border:1px solid #2f2f2f;">
        </div>`;
      }
      return `<div style="border:1px dashed #2f2f2f;border-radius:10px;padding:8px;background:#0f0f0f;">
        <div style="font-size:10px;color:#8a8a8a;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${_escapeHtml(slot.label)}</div>
        <div style="height:140px;display:flex;align-items:center;justify-content:center;color:#5e5e5e;font-size:12px;border-radius:8px;background:#111;">Sem foto</div>
      </div>`;
    }).join('');

    return `<section style="border:1px solid #2a2a2a;border-radius:14px;padding:14px;background:#0c0c0c;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-size:18px;line-height:1;">${movement.icon}</div>
          <h3 style="margin:6px 0 0;font-size:17px;color:#fff;">${_escapeHtml(movement.technicalName)}</h3>
          <p style="margin:2px 0 0;font-size:12px;color:#9a9a9a;">${_escapeHtml(movement.popularName)}</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#8a8a8a;letter-spacing:1px;text-transform:uppercase;">Score</div>
          <div style="font-size:28px;font-weight:800;color:${meta ? meta.color : '#a0a0a0'};">${Number.isInteger(score) ? score : '—'}</div>
        </div>
      </div>
      ${meta ? `<p style="margin:0 0 10px;font-size:12px;color:${meta.color};font-weight:700;">${_escapeHtml(meta.text)}</p>` : '<p style="margin:0 0 10px;font-size:12px;color:#7a7a7a;">Score não informado.</p>'}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">${slotHtml}</div>
    </section>`;
  }).join('');

  const toeTouch = scores.tt;
  const toeTouchPhotos = photos.tt || {};
  const toeTouchPhotosHtml = ['front', 'side'].map((k) => {
    const label = k === 'front' ? 'Frente' : 'Lado';
    const src = toeTouchPhotos[k];
    if (src) {
      return `<div style="border:1px solid #2f2f2f;border-radius:10px;padding:8px;background:#111;">
        <div style="font-size:10px;color:#8a8a8a;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${label}</div>
        <img src="${src}" alt="${label}" style="width:100%;height:140px;object-fit:cover;border-radius:8px;border:1px solid #2f2f2f;">
      </div>`;
    }
    return '';
  }).join('');
  const toeTouchHtml = toeTouch || toeTouchPhotosHtml ? `<section style="border:1px solid #2a2a2a;border-radius:14px;padding:14px;background:#0c0c0c;margin-bottom:14px;">
    <h3 style="margin:0 0 8px;font-size:16px;color:#fff;">Toe Touch Screening</h3>
    ${toeTouch ? `<p style="margin:0 0 10px;font-size:12px;color:${toeTouch === 'positive' ? '#00FF88' : '#FFC61E'};font-weight:700;">Resultado: ${toeTouch === 'positive' ? 'Positivo' : 'Negativo'}</p>` : ''}
    ${toeTouchPhotosHtml ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">${toeTouchPhotosHtml}</div>` : ''}
  </section>` : '';

  const win = window.open('', '_blank');
  if (!win) return showToast('Não foi possível abrir o relatório. Permita pop-ups neste domínio.', true);

  win.document.open();
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório FMS com Fotos</title></head>
  <body style="margin:0;background:#060606;color:#f4f4f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:22px;">
    <header style="margin-bottom:16px;border-bottom:1px solid #1c1c1c;padding-bottom:10px;">
      <h1 style="margin:0;font-size:24px;">Relatório FMS com Fotos</h1>
      <p style="margin:6px 0 0;color:#9a9a9a;font-size:13px;">Data: ${_escapeHtml(dateLabel)} | Score total: <strong style="color:#00FF88;">${total}/18</strong></p>
    </header>
    ${movementCards}
    ${toeTouchHtml}
    <footer style="margin-top:18px;color:#6f6f6f;font-size:12px;">Gerado pelo AXIS Performance OS.</footer>
  </body></html>`);
  win.document.close();
}

// ═══════════════════════════════════════════════
//  AVATAR
// ═══════════════════════════════════════════════
function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    resizeAndSaveAvatar(e.target.result); // always resize to guarantee <100KB
  };
  reader.readAsDataURL(file);
}

function resizeAndSaveAvatar(dataUrl) {
  const img = new Image();
  img.onload = function() {
    const MAX = 200;
    let w = img.width, h = img.height;
    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
    else { w = Math.round(w * MAX / h); h = MAX; }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    saveAndDisplayAvatar(canvas.toDataURL('image/jpeg', 0.7));
  };
  img.src = dataUrl;
}

function saveAndDisplayAvatar(dataUrl) {
  localStorage.setItem('axisai_avatar', dataUrl);
  displayAvatar(dataUrl);
  showToast('Foto de perfil atualizada! 📸');
}

function displayAvatar(dataUrl) {
  if (!dataUrl) return;
  const bigAvatar = document.getElementById('profile-avatar-big');
  if (bigAvatar) bigAvatar.innerHTML = `<img src="${dataUrl}" class="avatar-img" alt="Foto">`;
  const sideAvatar = document.getElementById('user-avatar-letter');
  if (sideAvatar) {
    sideAvatar.innerHTML = `<img src="${dataUrl}" class="avatar-img" alt="Foto">`;
    sideAvatar.style.background = 'none';
  }
}

function loadAvatar() {
  const saved = _lsGet('axisai_avatar');
  if (saved) displayAvatar(saved);
}

// ═══════════════════════════════════════════════
//  LGPD — CONSENT & PRIVACY
// ═══════════════════════════════════════════════
const LGPD_CONSENT_KEY = 'axisai_lgpd_consent';
const LGPD_VERSION = '1.0';

function getLGPDConsent() {
  return JSON.parse(_lsGet(LGPD_CONSENT_KEY) || 'null');
}

async function saveLGPDConsent(consent) {
  const payload = { ...consent, user_id: state.user?.id };
  await saveData('user_consents', payload, LGPD_CONSENT_KEY);
}

// Show blocking consent modal if no consent stored (checks localStorage then Supabase)
async function checkLGPDConsent() {
  const consent = getLGPDConsent();
  if (consent && consent.version === LGPD_VERSION) return;

  // Secondary check: Supabase (only if user is authenticated)
  if (state.user?.id) {
    try {
      const { data } = await supabase.from('user_consents')
        .select('*').eq('user_id', state.user.id).maybeSingle();
      if (data) {
        localStorage.setItem(LGPD_CONSENT_KEY, JSON.stringify(data));
        return;
      }
    } catch (e) {
      console.warn('Supabase consent check offline:', e);
    }
  }

  // No valid consent found — show blocking modal
  document.getElementById('lgpd-consent-modal').style.display = 'flex';
}

// Called by "ACEITAR E CONTINUAR" button in the modal
async function acceptLGPDConsent() {
  const consent = {
    version: LGPD_VERSION,
    essential: true,
    fms_data: document.getElementById('lgpd-fms').checked,
    training_history: document.getElementById('lgpd-training').checked,
    analytics: document.getElementById('lgpd-analytics').checked,
    marketing: document.getElementById('lgpd-marketing').checked,
    date: new Date().toISOString()
  };
  await saveLGPDConsent(consent);
  document.getElementById('lgpd-consent-modal').style.display = 'none';
  loadPrivacyToggles();
  showToast('Consentimento registrado com sucesso.');
}

// Prevent ESC and background-click dismissal while consent modal is visible
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('lgpd-consent-modal');
    if (modal && modal.style.display !== 'none') {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
}, true);

// Load saved consent into the Privacy Settings toggles on Profile page
function loadPrivacyToggles() {
  const consent = getLGPDConsent();
  if (!consent) return;
  const map = { 'priv-fms': 'fms_data', 'priv-training': 'training_history', 'priv-analytics': 'analytics', 'priv-marketing': 'marketing' };
  Object.entries(map).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) el.checked = !!consent[key];
  });
}

// Called when any privacy toggle changes on the Profile page
async function updatePrivacyConsent() {
  const consent = getLGPDConsent() || { version: LGPD_VERSION, essential: true, date: new Date().toISOString() };
  consent.fms_data = document.getElementById('priv-fms').checked;
  consent.training_history = document.getElementById('priv-training').checked;
  consent.analytics = document.getElementById('priv-analytics').checked;
  consent.marketing = document.getElementById('priv-marketing').checked;
  consent.updated_at = new Date().toISOString();
  await saveLGPDConsent(consent);
  showToast('Preferências de privacidade atualizadas.');
}

// Export all user data from localStorage as JSON
function exportUserData() {
  const keys = ['axisai_user', 'axisai_workouts', 'axisai_checkin', 'axisai_phase', 'axisai_lgpd_consent'];
  const dynamicKeys = [getProfileKey(), getTreinosKey(), getFmsLatestKey(), getOnboardingKey(), getParqCacheKey()].filter(Boolean);
  const data = {};
  [...keys, ...dynamicKeys, 'axisai_profile', 'axisai_treinos', 'axisai_fms_latest', 'axisai_onboarding_done'].forEach(k => {
    const val = _lsGet(k);
    if (val) {
      try { data[k] = JSON.parse(val); } catch { data[k] = val; }
    }
  });
  data._export_date = new Date().toISOString();
  data._export_version = '1.0';

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `axisai-dados-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Dados exportados com sucesso.');
}

// Double-confirmation account deletion
function requestAccountDeletion() {
  // First confirmation
  const existing = document.getElementById('delete-confirm-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'delete-confirm-modal';
  overlay.className = 'delete-confirm-overlay';
  overlay.innerHTML = `
    <div class="delete-confirm-modal">
      <h3>EXCLUIR MINHA CONTA</h3>
      <p>Tem certeza de que deseja excluir sua conta? Todos os seus dados serão permanentemente removidos. Esta ação é <strong>irreversível</strong>.</p>
      <div class="confirm-actions">
        <button class="btn-cancel" onclick="document.getElementById('delete-confirm-modal').remove()">CANCELAR</button>
        <button class="btn-danger" onclick="confirmAccountDeletion()">SIM, EXCLUIR</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function confirmAccountDeletion() {
  // Second confirmation
  const modal = document.querySelector('#delete-confirm-modal .delete-confirm-modal');
  modal.innerHTML = `
    <h3>CONFIRMAÇÃO FINAL</h3>
    <p>Esta é sua última chance. Digite <strong>EXCLUIR</strong> para confirmar a exclusão permanente de todos os seus dados.</p>
    <input type="text" id="delete-confirm-input" placeholder="Digite EXCLUIR" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font-mono);font-size:14px;text-align:center;margin-bottom:16px;">
    <div class="confirm-actions">
      <button class="btn-cancel" onclick="document.getElementById('delete-confirm-modal').remove()">CANCELAR</button>
      <button class="btn-danger" onclick="executeAccountDeletion()">CONFIRMAR EXCLUSÃO</button>
    </div>`;
}

function executeAccountDeletion() {
  const input = document.getElementById('delete-confirm-input');
  if (input.value.trim() !== 'EXCLUIR') {
    input.style.borderColor = 'var(--red)';
    input.placeholder = 'Você precisa digitar EXCLUIR';
    return;
  }

  // Clear all localStorage data
  const keysToRemove = [
    'axisai_user', 'axisai_users', 'axisai_profile', 'axisai_workouts',
    'axisai_treinos', 'axisai_checkin', 'axisai_phase', 'axisai_lgpd_consent',
    'axisai_fms_latest', 'axisai_onboarding_done', 'axisai_avatar'
  ];
  const dynamicKeys = [getProfileKey(), getTreinosKey(), getFmsLatestKey(), getOnboardingKey(), getParqCacheKey()].filter(Boolean);
  [...keysToRemove, ...dynamicKeys].forEach(k => localStorage.removeItem(k));

  // Reset state
  state.user = null;
  state.workouts = [];
  state.profile = null;
  state.chatHistory = [];
  _appEntered = false; // Reset auth guard

  // Remove modal and redirect to auth
  document.getElementById('delete-confirm-modal').remove();
  _showOnly('screen-auth');
  showToast('Conta excluída com sucesso. Todos os dados foram removidos.');
}

// ═══════════════════════════════════════════════
//  PRIVACY POLICY MODAL
// ═══════════════════════════════════════════════
function openPrivacyPolicy() {
  document.getElementById('privacy-policy-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePrivacyPolicy() {
  document.getElementById('privacy-policy-modal').style.display = 'none';
  document.body.style.overflow = '';
}

// ── Terms of Use ──
function openTerms() {
  document.getElementById('terms-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeTerms() {
  document.getElementById('terms-modal').style.display = 'none';
  document.body.style.overflow = '';
}

// ESC key closes privacy policy or terms modal
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (document.getElementById('privacy-policy-modal').style.display === 'flex') closePrivacyPolicy();
  if (document.getElementById('terms-modal').style.display === 'flex') closeTerms();
});

// Auto-wire Privacy Policy and Terms of Use links/buttons
document.addEventListener('click', function(e) {
  const target = e.target.closest('a, button, [id="btn-privacy"], [id="btn-terms"], .open-privacy, .open-terms');
  if (!target) return;
  if (target.id === 'btn-privacy' || target.classList.contains('open-privacy')) {
    e.preventDefault(); openPrivacyPolicy(); return;
  }
  if (target.id === 'btn-terms' || target.classList.contains('open-terms')) {
    e.preventDefault(); openTerms(); return;
  }
  if (target.tagName === 'A' && target.getAttribute('href') === '/privacidade') {
    e.preventDefault(); openPrivacyPolicy(); return;
  }
  if (target.tagName === 'A' && target.getAttribute('href') === '/termos') {
    e.preventDefault(); openTerms();
  }
});

// ═══════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════
let toastTimer;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ═══════════════════════════════════════════════
//  EXERCISE LIBRARY — VIDEO LOOKUP
// ═══════════════════════════════════════════════
