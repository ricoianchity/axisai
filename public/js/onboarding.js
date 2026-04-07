// ═══════════════════════════════════════════════
//  ONBOARDING WIZARD
// ═══════════════════════════════════════════════
let _wizardStep = 1;
const WIZARD_TOTAL_STEPS = 5;
const WIZARD_STEP_NAMES = ['SOBRE VOCÊ', 'SEU TREINO', 'SEU ESPAÇO', 'SAÚDE E OBJETIVO', 'RAIO-X DO MOVIMENTO'];

function showOnboarding() {
  if (window._showingLanding) {
    window._showingLanding = false;
    return;
  }
  document.getElementById('screen-app').classList.remove('visible');
  _showOnly('screen-onboarding');
  _goToWizardStep(1);
}

function _goToWizardStep(n) {
  _wizardStep = n;
  for (let i = 1; i <= WIZARD_TOTAL_STEPS; i++) {
    document.getElementById('wizard-step-' + i).style.display = i === n ? 'block' : 'none';
    const dot = document.getElementById('wdot-' + i);
    if (dot) dot.className = 'wizard-dot' + (i < n ? ' done' : i === n ? ' active' : '');
  }
  const pct = Math.round((n / WIZARD_TOTAL_STEPS) * 100);
  document.getElementById('wizard-progress-fill').style.width = pct + '%';
  document.getElementById('wizard-step-label').textContent = 'ETAPA ' + n + ' DE ' + WIZARD_TOTAL_STEPS;
  document.getElementById('wizard-step-name').textContent = WIZARD_STEP_NAMES[n - 1];

  // Step 5 uses its own nav; steps 1-4 use the standard nav
  const isFms = n === 5;
  document.getElementById('wizard-nav-std').style.display = isFms ? 'none' : 'flex';
  document.getElementById('wizard-nav-fms').style.display = isFms ? 'block' : 'none';
  if (isFms) {
    _renderCurrentFmsMovement();
    _updateFmsTotal();
  }

  // Standard nav back/next controls
  if (!isFms) {
    document.getElementById('wizard-back').style.display = n > 1 ? '' : 'none';
    document.getElementById('wizard-next').textContent = 'PRÓXIMO';
  }

  // Scroll wizard card to top when changing steps
  document.querySelector('.wizard-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function wizardBack() {
  if (_wizardStep > 1) _goToWizardStep(_wizardStep - 1);
}

function wizardNext() {
  if (_wizardStep < WIZARD_TOTAL_STEPS) {
    _goToWizardStep(_wizardStep + 1);
  } else {
    _finishWizard();
  }
}

function toggleParqWarning(val) {
  document.getElementById('parq-warning').style.display = val === 'yes' ? 'block' : 'none';
}

// ── FMS wizard state ──────────────────────────
const FMS_SCORE_META = {
  0: { color: '#FF4444', text: 'Padrão muito prejudicado (não consegue fazer o movimento)' },
  1: { color: '#FFC61E', text: 'Padrão prejudicado (faz com compensação óbvia)' },
  2: { color: '#77DD77', text: 'Padrão aceitável (faz com leve assimetria)' },
  3: { color: '#00FF88', text: 'Padrão normal (movimento simétrico e controlado)' },
};

const FMS_MOVEMENTS = [
  {
    icon: '🦵',
    technicalName: 'Deep Squat',
    popularName: 'Agachamento Profundo',
    description: 'Você desce os joelhos enquanto segura os braços esticados para o teto. Vamos ver se consegue fazer isso de forma simétrica.',
    criterion: 'Execução com limitação: necessita de elevação de calcanhares ou compensação de tronco',
    instructions: [
      'Fica em pé, pés afastados na largura do ombro',
      'Coloca as mãos juntas acima da cabeça (como se rezasse para o teto)',
      'Respira fundo e lentamente desce os joelhos',
      'Desce o máximo que conseguir sem dor (pode parar a meio caminho)',
      'Volta para cima de forma controlada'
    ],
    photoTips: [
      { label: 'Posição', text: 'Perpendicular a uma parede branca (câmera vê você de lado)' },
      { label: 'Distância', text: 'Uns 2 metros da câmera' },
      { label: 'Altura', text: 'Câmera ao nível do seu quadril' },
      { label: 'Iluminação', text: 'Luz natural na frente (janela é perfeita)' },
      { label: 'Roupa', text: 'Algo ajustado para ver seus joelhos e coluna' },
      { label: 'Momento', text: 'Tirar a foto quando estiver no ponto mais baixo' }
    ],
    photoSlots: [
      { label: 'Frente', key: 'front' },
      { label: 'Lado', key: 'side' }
    ],
    dbKey: 'deep_squat',
    stateKey: 'dos',
  },
  {
    icon: '📍',
    technicalName: 'Hurdle Step',
    popularName: 'Passada com Obstáculo',
    description: 'Você caminha em direção a um degrau imaginário (altura do joelho), levanta a perna e desce do outro lado. Testa estabilidade ao pisar em algo elevado.',
    criterion: 'Quadril, joelho e tornozelo alinhados, pelve e coluna estáveis',
    instructions: [
      'Fica em pé, em frente a um degrau ou objeto da altura do joelho',
      'Levanta uma perna e coloca o pé em cima do degrau',
      'Sobe o corpo todo para cima do degrau',
      'Desce o outro pé do outro lado do degrau',
      'Repete com controle'
    ],
    photoTips: [
      { label: 'Posição', text: 'Perfil (câmera vê você de lado)' },
      { label: 'Distância', text: 'Uns 2 metros da câmera' },
      { label: 'Altura', text: 'Câmera ao nível do seu quadril' },
      { label: 'Iluminação', text: 'Luz natural na frente' },
      { label: 'Roupa', text: 'Algo ajustado para ver o movimento da perna' },
      { label: 'Momento', text: 'Foto no auge do movimento (perna levantada)' }
    ],
    photoSlots: [
      { label: 'Frente Esq', key: 'frente-esq' },
      { label: 'Frente Dir', key: 'frente-dir' },
      { label: 'Lado Esq', key: 'lado-esq' },
      { label: 'Lado Dir', key: 'lado-dir' }
    ],
    dbKey: 'hurdle_step',
    stateKey: 'hs',
  },
  {
    icon: '🚶',
    technicalName: 'Inline Lunge',
    popularName: 'Avanço em Linha',
    description: 'Um passo comprido para a frente mantendo o pé traseiro em linha reta atrás de você. Testa o equilíbrio e controle de movimento.',
    criterion: 'Movimento realizado com perda de estabilidade ou desvio do bastão',
    instructions: [
      'Fica em pé, pés juntos',
      'Dá um passo bem comprido para a frente',
      'Mantém o pé traseiro em linha reta atrás (não aberto para o lado)',
      'Desce o joelho traseiro em direção ao chão',
      'Volta para a posição inicial de forma controlada'
    ],
    photoTips: [
      { label: 'Posição', text: 'Vista frontal (câmera vê você de frente)' },
      { label: 'Distância', text: 'Uns 2 metros da câmera' },
      { label: 'Altura', text: 'Câmera ao nível do seu quadril' },
      { label: 'Iluminação', text: 'Luz natural na frente' },
      { label: 'Roupa', text: 'Algo ajustado para ver pernas' },
      { label: 'Momento', text: 'Foto quando o joelho traseiro está perto do chão' }
    ],
    photoSlots: [
      { label: 'Lado Esquerdo', key: 'lado-esq' },
      { label: 'Lado Direito', key: 'lado-dir' }
    ],
    dbKey: 'inline_lunge',
    stateKey: 'il',
  },
  {
    icon: '💪',
    technicalName: 'Shoulder Mobility',
    popularName: 'Mobilidade de Ombro',
    description: 'Com uma vara ou bastão leve, você traz as mãos de frente para trás sobre a cabeça. Avalia se seus ombros têm amplitude suficiente.',
    criterion: 'Punhos entre 1 e 1,5 palmo de distância',
    instructions: [
      'Fica em pé, segurando uma vara ou bastão leve (cabo de vassoura funciona)',
      'Traz o bastão de frente para o peito com os braços esticados',
      'Levanta o bastão acima da cabeça',
      'Traz o bastão para trás da coluna, o máximo que conseguir',
      'Volta para frente de forma controlada'
    ],
    photoTips: [
      { label: 'Posição', text: 'Vista frontal (câmera vê você de frente)' },
      { label: 'Distância', text: 'Uns 1,5 metros da câmera' },
      { label: 'Altura', text: 'Câmera ao nível do seu peito' },
      { label: 'Iluminação', text: 'Luz natural clara' },
      { label: 'Roupa', text: 'Algo ajustado para ver os ombros' },
      { label: 'Momento', text: 'Foto quando o bastão está atrás da cabeça' }
    ],
    photoSlots: [
      { label: 'Costas Lado E', key: 'costas-e' },
      { label: 'Costas Lado D', key: 'costas-d' }
    ],
    dbKey: 'shoulder_mobility',
    stateKey: 'sm',
  },
  {
    icon: '🔺',
    technicalName: 'Active Straight Leg Raise',
    popularName: 'Elevação Ativa da Perna Estendida',
    description: 'Você fica deitado no chão e levanta uma perna esticada em direção ao teto. Avalia sua mobilidade de quadril e força de core.',
    criterion: 'Tornozelo entre joelho e linha média da coxa oposta',
    instructions: [
      'Deita no chão, de costas, pernas esticadas',
      'Levanta uma perna bem alta em direção ao teto (perna fica esticada)',
      'A outra perna fica apoiada no chão (não dobra)',
      'Levanta o máximo que conseguir mantendo a perna esticada',
      'Baixa a perna de forma controlada e repete do outro lado'
    ],
    photoTips: [
      { label: 'Posição', text: 'Perfil (câmera vê você de lado)' },
      { label: 'Distância', text: 'Uns 1,5 metros da câmera' },
      { label: 'Altura', text: 'Câmera ao nível da sua cintura' },
      { label: 'Iluminação', text: 'Luz natural clara' },
      { label: 'Roupa', text: 'Shorts ou calça curta para ver a perna' },
      { label: 'Momento', text: 'Foto com a perna bem levantada' }
    ],
    photoSlots: [
      { label: 'Lado Esquerdo', key: 'lado-esq' },
      { label: 'Lado Direito', key: 'lado-dir' }
    ],
    dbKey: 'aslr',
    stateKey: 'aslr',
  },
  {
    icon: '📐',
    technicalName: 'Trunk Stability Push-Up',
    popularName: 'Estabilidade de Tronco',
    description: 'Você fica em posição de flexão e lentamente tira um pé do chão. Avalia se seu corpo fica rígido como uma tábua.',
    criterion: 'Corpo mantém estabilidade rígida, sem rotação ou queda de quadril',
    instructions: [
      'Deita no chão, de barriga para baixo',
      'Coloca as mãos embaixo dos ombros',
      'Sobe o corpo todo, ficando em posição de flexão (pés juntos)',
      'Mantém o corpo rígido como uma tábua',
      'Lentamente, tira um pé do chão e sustenta por alguns segundos'
    ],
    photoTips: [
      { label: 'Posição', text: 'Perfil (câmera vê você de lado)' },
      { label: 'Distância', text: 'Uns 1,5 metros da câmera' },
      { label: 'Altura', text: 'Câmera ao nível do seu tronco' },
      { label: 'Iluminação', text: 'Luz natural clara' },
      { label: 'Roupa', text: 'Algo ajustado para ver o corpo todo' },
      { label: 'Momento', text: 'Foto com um pé levantado, corpo rígido' }
    ],
    photoSlots: [
      { label: 'Lateral', key: 'lateral' }
    ],
    dbKey: 'trunk_stability_pushup',
    stateKey: 'tspu',
  }
];

const _fmsScores = { dos: null, hs: null, il: null, sm: null, aslr: null, tspu: null };
let _fmsToeTouch = null;
let _wizardFmsData = null; // set by _saveFmsAndFinish before calling _finishWizard
const _fmsPhotos = {}; // { dos: { front: base64, side: base64 }, hs: {...}, ... }
let _fmsCurrentIndex = 0;
let _fmsDragActive = false;

function _currentFmsMovement() {
  return FMS_MOVEMENTS[_fmsCurrentIndex] || FMS_MOVEMENTS[0];
}

function _renderFmsProgressDots() {
  const dots = document.getElementById('fms-rx-dots');
  if (!dots) return;
  dots.innerHTML = FMS_MOVEMENTS.map((_, i) => {
    const cls = i < _fmsCurrentIndex ? 'fms-rx-dot done' : i === _fmsCurrentIndex ? 'fms-rx-dot active' : 'fms-rx-dot';
    return `<span class="${cls}"></span>`;
  }).join('');
}

function _renderCurrentFmsMovement() {
  const movement = _currentFmsMovement();
  if (!movement) return;

  const idx = _fmsCurrentIndex + 1;
  const total = FMS_MOVEMENTS.length;

  const counter = document.getElementById('fms-rx-counter');
  if (counter) counter.textContent = `Movimento ${idx} de ${total}`;
  const icon = document.getElementById('fms-rx-icon');
  if (icon) icon.textContent = movement.icon;
  const tech = document.getElementById('fms-rx-tech');
  if (tech) tech.textContent = movement.technicalName;
  const pop = document.getElementById('fms-rx-popular');
  if (pop) pop.textContent = movement.popularName;
  const desc = document.getElementById('fms-rx-description');
  if (desc) desc.textContent = movement.description;
  const criterion = document.getElementById('fms-rx-criterion');
  if (criterion) criterion.textContent = `Critério: ${movement.criterion}`;

  const instructions = document.getElementById('fms-rx-instructions');
  if (instructions) instructions.innerHTML = movement.instructions.map(line => `<li>${line}</li>`).join('');

  const photoTips = document.getElementById('fms-rx-photo-tips');
  if (photoTips) photoTips.innerHTML = movement.photoTips.map(tip => `<li><strong>${tip.label}:</strong> ${tip.text}</li>`).join('');

  const prevBtn = document.getElementById('fms-rx-prev');
  const nextBtn = document.getElementById('fms-rx-next');
  if (prevBtn) prevBtn.disabled = _fmsCurrentIndex === 0;
  if (nextBtn) {
    nextBtn.disabled = _fmsCurrentIndex === total - 1;
    nextBtn.textContent = _fmsCurrentIndex === total - 1 ? 'Último Movimento ✓' : 'Próximo Movimento →';
  }

  _renderCurrentFmsPhotoSlots();
  _renderFmsProgressDots();
  _renderCurrentFmsScore();
}

function _renderCurrentFmsPhotoSlots() {
  const movement = _currentFmsMovement();
  const container = document.getElementById('fms-rx-photo-slots');
  if (!movement || !container) return;
  const slots = movement.photoSlots || [];
  const saved = _fmsPhotos[movement.stateKey] || {};
  container.innerHTML = slots.map((slot) => {
    const src = saved[slot.key] || '';
    const hasPhoto = Boolean(src);
    return `<div class="fms-rx-photo-slot ${hasPhoto ? 'has-file' : ''}">
      <div class="fms-rx-photo-label">${slot.label}</div>
      ${hasPhoto ? `<img class="fms-rx-photo-preview" src="${src}" alt="${slot.label}">` : ''}
      <label class="fms-rx-photo-action">
        ${hasPhoto ? 'Trocar Foto' : 'Adicionar Foto'}
        <input type="file" accept="image/*" capture="environment" style="display:none" onchange="fmsPhotoSelected('${movement.stateKey}','${slot.key}',this)">
      </label>
    </div>`;
  }).join('');
}

function fmsPhotoSelected(movementKey, slotKey, input) {
  if (!input?.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    if (!_fmsPhotos[movementKey]) _fmsPhotos[movementKey] = {};
    _fmsPhotos[movementKey][slotKey] = e.target.result;
    if (_currentFmsMovement().stateKey === movementKey) _renderCurrentFmsPhotoSlots();
  };
  reader.readAsDataURL(input.files[0]);
}

function _renderCurrentFmsScore() {
  const movement = _currentFmsMovement();
  const score = _fmsScores[movement.stateKey];

  const fill = document.getElementById('fms-rx-track-fill');
  const thumb = document.getElementById('fms-rx-track-thumb');
  const label = document.getElementById('fms-rx-score-label');
  const pct = score === null ? 0 : Math.round((score / 3) * 100);
  const color = score === null ? '#545454' : FMS_SCORE_META[score].color;

  if (fill) {
    fill.style.width = `${pct}%`;
    fill.style.background = color;
  }
  if (thumb) {
    thumb.style.left = `${pct}%`;
    thumb.style.borderColor = color;
    thumb.style.boxShadow = `0 0 0 3px ${score === null ? 'rgba(140,140,140,0.16)' : `${color}33`}`;
  }

  [0, 1, 2, 3].forEach((val) => {
    const btn = document.getElementById(`fms-rx-btn-${val}`);
    if (!btn) return;
    btn.classList.toggle('selected', score === val);
  });

  if (label) {
    if (score === null) {
      label.textContent = 'Arraste a barra ou clique em 0-3 para registrar o score.';
      label.style.color = 'var(--muted)';
    } else {
      label.textContent = `Score ${score}: ${FMS_SCORE_META[score].text}`;
      label.style.color = FMS_SCORE_META[score].color;
    }
  }
}

function setCurrentFmsScore(score) {
  const movement = _currentFmsMovement();
  if (!movement) return;
  _fmsScores[movement.stateKey] = Math.max(0, Math.min(3, Number(score)));
  _renderCurrentFmsScore();
  _updateFmsTotal();
}

// Backward-compatible signature for old calls: fmsSetScore(id, score, el)
function fmsSetScore(id, score) {
  if (typeof id === 'number' && score === undefined) return setCurrentFmsScore(id);
  if (typeof score === 'number' && (!id || id === _currentFmsMovement().stateKey)) return setCurrentFmsScore(score);
  if (typeof id === 'string' && typeof score === 'number' && _fmsScores[id] !== undefined) {
    _fmsScores[id] = score;
    _updateFmsTotal();
    _renderCurrentFmsScore();
  }
}

function nextFMS() {
  if (_fmsCurrentIndex < FMS_MOVEMENTS.length - 1) {
    _fmsCurrentIndex += 1;
    _renderCurrentFmsMovement();
  }
}

function previousFMS() {
  if (_fmsCurrentIndex > 0) {
    _fmsCurrentIndex -= 1;
    _renderCurrentFmsMovement();
  }
}

function clickDragScore(ev) {
  _updateScoreFromPointer(ev);
}

function startDragScore(ev) {
  if (_fmsDragActive) return;
  _fmsDragActive = true;
  document.getElementById('fms-rx-track')?.classList.add('dragging');
  _updateScoreFromPointer(ev);
  window.addEventListener('mousemove', moveDragScore);
  window.addEventListener('mouseup', stopDragScore);
  window.addEventListener('touchmove', moveDragScore, { passive: false });
  window.addEventListener('touchend', stopDragScore);
}

function moveDragScore(ev) {
  if (!_fmsDragActive) return;
  _updateScoreFromPointer(ev);
  if (ev.cancelable) ev.preventDefault();
}

function stopDragScore() {
  _fmsDragActive = false;
  document.getElementById('fms-rx-track')?.classList.remove('dragging');
  window.removeEventListener('mousemove', moveDragScore);
  window.removeEventListener('mouseup', stopDragScore);
  window.removeEventListener('touchmove', moveDragScore);
  window.removeEventListener('touchend', stopDragScore);
}

function _updateScoreFromPointer(ev) {
  const track = document.getElementById('fms-rx-track');
  if (!track) return;
  const rect = track.getBoundingClientRect();
  const touch = ev.touches?.[0] || ev.changedTouches?.[0];
  const clientX = touch ? touch.clientX : ev.clientX;
  if (typeof clientX !== 'number' || rect.width <= 0) return;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const score = Math.round(ratio * 3);
  setCurrentFmsScore(score);
}

function fmsSetToeTouch(val) {
  _fmsToeTouch = val;
  document.getElementById('fms-tt-pos').className = 'fms-tt-btn' + (val === true  ? ' active-pos' : '');
  document.getElementById('fms-tt-neg').className = 'fms-tt-btn' + (val === false ? ' active-neg' : '');
  document.getElementById('fms-tt-warning').style.display = val === false ? 'block' : 'none';
  _updateFmsSaveBtn();
}

function _updateFmsTotal() {
  const vals = Object.values(_fmsScores).filter(v => v !== null);
  const total = vals.reduce((a, b) => a + b, 0);
  document.getElementById('fms-total-num').textContent = total;

  const cls = document.getElementById('fms-classification');
  if (vals.length > 0 && cls) {
    if (total <= 9) {
      cls.textContent = 'Alto risco — prioridade em mobilidade e padrões básicos';
      cls.style.color  = FMS_SCORE_META[0].color;
    } else if (total <= 12) {
      cls.textContent = 'Atenção — disfunções presentes, progressão cautelosa';
      cls.style.color  = FMS_SCORE_META[1].color;
    } else {
      cls.textContent = 'Boa base de movimento — pode progredir com segurança';
      cls.style.color  = FMS_SCORE_META[3].color;
    }
    cls.style.display = 'block';
  } else if (cls) {
    cls.style.display = 'none';
  }
  _updateFmsSaveBtn();
}

function _updateFmsSaveBtn() {
  const allScored  = Object.values(_fmsScores).every(v => v !== null);
  const btn = document.getElementById('fms-save-btn');
  if (btn) btn.disabled = !allScored;
}

function _computeFmsRiskFlags() {
  const flags = [];
  if (_fmsScores.dos  !== null && _fmsScores.dos  <= 1) flags.push('squat_dysfunction');
  if (_fmsScores.il   !== null && _fmsScores.il   <= 1) flags.push('lunge_dysfunction');
  if (_fmsScores.hs   !== null && _fmsScores.hs   <= 1) flags.push('hip_instability');
  if (_fmsScores.sm   !== null && _fmsScores.sm   <= 1) flags.push('shoulder_restriction');
  if (_fmsScores.aslr !== null && _fmsScores.aslr <= 1) flags.push('hamstring_restriction');
  if (_fmsScores.tspu !== null && _fmsScores.tspu <= 1) flags.push('trunk_instability');
  if (_fmsToeTouch === false) flags.push('toe_touch_negative');
  return flags.length > 0 ? flags : ['none'];
}

async function _saveFmsAndFinish() {
  const sessionResult = await supabase.auth.getSession();
  const userId = state.user?.id
    || sessionResult?.data?.session?.user?.id
    || getCurrentUserId();

  if (!userId) {
    showToast('Erro de autenticação. Faça login novamente.');
    return;
  }

  if (!state.user && userId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      state.user = { id: session.user.id, email: session.user.email };
    }
  }

  if (_fmsToeTouch === null) {
    const toeTouchCard = document.querySelector('.fms-toe-touch-card, [data-toe-touch], #fms-toe-touch-section');
    if (toeTouchCard) {
      toeTouchCard.style.outline = '2px solid var(--neon, #00FF88)';
      toeTouchCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => toeTouchCard.style.outline = '', 2500);
    }
    // Mostrar hint abaixo dos botões do Toe Touch
    const hint = document.getElementById('toe-touch-hint');
    if (hint) {
      hint.textContent = '⚠️ Responda o Screening Eliminatório para continuar';
      hint.style.display = 'block';
    }
    return;
  }

  _wizardFmsData = {
    fms: {
      dos:  _fmsScores.dos,
      il:   _fmsScores.il,
      hs:   _fmsScores.hs,
      sm:   _fmsScores.sm,
      aslr: _fmsScores.aslr,
      tspu: _fmsScores.tspu,
      tt:   _fmsToeTouch === true ? 'positive' : _fmsToeTouch === false ? 'negative' : null,
    },
    toeTouch:   _fmsToeTouch,
    riskFlags:  _computeFmsRiskFlags(),
    photos:     { ..._fmsPhotos },
  };
  // Sync app-level toeTouch used by the diagnosis page
  if (_fmsToeTouch !== null) state.toeTouch = _wizardFmsData.fms.tt;
  await _finishWizard();
}

function _skipFms() {
  const msg = document.getElementById('fms-skip-msg');
  msg.textContent = 'Tudo bem! Você pode fazer a avaliação FMS depois em Avaliações. Lembre que ela melhora muito a precisão do seu plano.';
  msg.style.display = 'block';
  document.getElementById('fms-skip-btn').disabled = true;
  setTimeout(() => _finishWizard(), 2000);
}

async function _finishWizard() {
  const sessionResult = await supabase.auth.getSession();
  const userId = state.user?.id
    || sessionResult?.data?.session?.user?.id
    || getCurrentUserId();

  if (!userId) {
    showToast('Erro de autenticação. Faça login novamente.');
    return;
  }

  if (!state.user && userId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      state.user = { id: session.user.id, email: session.user.email };
    }
  }

  const equipment = [...document.querySelectorAll('.w-equipment:checked')].map(e => e.value);
  const comorbiditiesChecked = Array.from(document.querySelectorAll('#comorbidities-grid input:checked')).map(el => el.value);
  const comorbiditiesOther = document.getElementById('w-comorbidities-other')?.value?.trim();
  if (comorbiditiesOther) comorbiditiesChecked.push(...comorbiditiesOther.split(',').map(s => s.trim()).filter(Boolean));
  const medicationsChecked = Array.from(document.querySelectorAll('#medications-grid input:checked')).map(el => el.value);
  const medicationsOther = document.getElementById('w-medications-other')?.value?.trim();
  if (medicationsOther) medicationsChecked.push(...medicationsOther.split(',').map(s => s.trim()).filter(Boolean));
  const newData = {
    age:           document.getElementById('w-age').value,
    weight:        document.getElementById('w-weight').value,
    height:        document.getElementById('w-height').value,
    sex:           document.getElementById('w-sex').value,
    frequency:     document.getElementById('w-frequency').value,
    session_time:  document.getElementById('w-session-time').value,
    level:         document.getElementById('w-level').value,
    gym:           document.getElementById('w-gym').value,
    equipment:     equipment,
    objective:     document.getElementById('w-goal').value,
    modalidade:    (document.getElementById('w-modalidade')?.value || document.getElementById('w-modalidade-opt')?.value || '').trim(),
    injuries:      document.getElementById('w-injuries').value,
    parq:          document.getElementById('w-parq').value,
    profissao:     document.getElementById('w-profissao')?.value || '',
    horas_trabalho: document.getElementById('w-horas-trabalho')?.value || '',
    perfil_postural: document.getElementById('w-perfil-postural')?.value || '',
    horas_sentado: document.getElementById('w-horas-sentado')?.value || '',
    estresse_ocup: document.getElementById('w-estresse-ocup')?.value || '',
    turno_trabalho: document.getElementById('w-turno')?.value || '',
    comorbidities: comorbiditiesChecked,
    medications:   medicationsChecked,
  };
  // Merge FMS data if collected in step 5
  if (_wizardFmsData) {
    newData.fms        = _wizardFmsData.fms;
    newData.fms_scores = _wizardFmsData.fms;
    newData.fmsPhotos  = _wizardFmsData.photos;   // deletado antes do upsert
    newData.toe_touch  = _wizardFmsData.toeTouch;
    newData.risk_flags = _wizardFmsData.riskFlags;
    setFmsLatest(_wizardFmsData.fms, undefined, _wizardFmsData.photos);
    _wizardFmsData = null;
  }
  const profileKey = getProfileKey();
  const onboardingKey = getOnboardingKey();
  const existing = profileKey ? JSON.parse(_lsGet(profileKey) || '{}') : {};
  const merged = { ...existing };
  Object.keys(newData).forEach(k => {
    const v = newData[k];
    if (Array.isArray(v) ? v.length > 0 : v !== '' && v !== undefined && v !== null) {
      merged[k] = v;
    }
  });
  if (!merged.sex && merged.gender) merged.sex = merged.gender;
  delete merged.gender;
  merged.onboarding_done = true;
  state.profile = merged;
  if (onboardingKey) localStorage.setItem(onboardingKey, '1');
  const profilePayload = { ...merged, user_id: userId, onboarding_done: true };
  delete profilePayload.id; // nunca enviar o id integer ao banco
  delete profilePayload.gender;
  delete profilePayload.fmsPhotos; // keep photos local to avoid oversized profile payloads
  if (profileKey) localStorage.setItem(profileKey, JSON.stringify(merged));
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'user_id' });
    if (error) console.warn('[_finishWizard] profiles upsert:', error.message);
  } catch (e) {
    console.warn('[_finishWizard] profiles upsert fallback localStorage:', e);
  }
  loadProfile();
  completeEnterApp();
}

// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════
const PARQ_QUESTIONS = [
  'Algum médico já disse que você tem algum problema cardíaco e recomendou que você só pratique atividade física com supervisão médica?',
  'Você sente dor no peito ao praticar atividade física?',
  'No último mês, você sentiu dor no peito sem estar praticando atividade física?',
  'Você perde o equilíbrio por causa de tontura ou alguma vez perdeu a consciência?',
  'Você tem algum problema ósseo ou articular que poderia ser agravado pela prática de atividade física?',
  'Algum médico está atualmente prescrevendo medicamentos para sua pressão arterial ou para o coração?',
  'Você tem conhecimento de alguma outra razão pela qual não deveria praticar atividade física?'
];

function parqHasPositiveAnswers(answers) {
  if (!answers || typeof answers !== 'object') return false;
  return Object.values(answers).some(v => String(v).toLowerCase() === 'yes');
}

function getParqDecision(profileLike) {
  if (!profileLike || typeof profileLike !== 'object') return null;
  const out = {
    parq_cleared: profileLike.parq_cleared === true,
    parq_completed_at: profileLike.parq_completed_at || null,
    parq_answers: profileLike.parq_answers || null
  };
  const hasDecision = out.parq_cleared || parqHasPositiveAnswers(out.parq_answers) || !!out.parq_completed_at;
  return hasDecision ? out : null;
}

function applyLocalParqDecision() {
  const key = getParqCacheKey();
  if (!key) return;
  try {
    const cached = JSON.parse(_lsGet(key) || 'null');
    const decision = getParqDecision(cached);
    if (!decision) return;
    state.profile = { ...(state.profile || {}), ...decision };
    const profileKey = getProfileKey();
    if (profileKey) localStorage.setItem(profileKey, JSON.stringify(state.profile));
  } catch (_) {}
}

function persistParqDecisionLocal(payload) {
  const decision = getParqDecision(payload) || {
    parq_cleared: payload?.parq_cleared === true,
    parq_completed_at: payload?.parq_completed_at || new Date().toISOString(),
    parq_answers: payload?.parq_answers || null
  };
  state.profile = { ...(state.profile || {}), ...decision };
  const profileKey = getProfileKey();
  if (profileKey) localStorage.setItem(profileKey, JSON.stringify(state.profile));
  const key = getParqCacheKey();
  if (key) localStorage.setItem(key, JSON.stringify(decision));
}

function updateCoachNavIndicator() {
  const icon = document.getElementById('nav-chat-icon');
  const btn = document.getElementById('nav-chat-btn');
  if (!icon || !btn) return;

  if (!state.user?.id) {
    icon.textContent = '🤖';
    btn.title = 'Axis Coach IA';
    return;
  }

  const cleared = state.profile?.parq_cleared === true;
  const positive = parqHasPositiveAnswers(state.profile?.parq_answers);

  if (cleared) {
    icon.textContent = '🤖';
    btn.title = 'Axis Coach IA liberado';
  } else if (positive) {
    icon.textContent = '⚠️';
    btn.title = 'PAR-Q com resposta positiva';
  } else {
    icon.textContent = '🔒';
    btn.title = 'PAR-Q pendente';
  }
}

async function syncParqStatusFromSupabase() {
  if (!state.user?.id) return true;
  applyLocalParqDecision();

  try {
    const token = await getSupaToken();
    if (!token) {
      updateCoachNavIndicator();
      return true;
    }

    const res = await fetch('/api/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      updateCoachNavIndicator();
      return true;
    }

    const data = await res.json().catch(() => null);
    if (data && typeof data === 'object') {
      const remoteProfile = {
        parq_cleared: data.parq_cleared === true,
        parq_completed_at: data.parq_completed_at || null,
        parq_answers: data.parq_answers || null
      };
      const localDecision = getParqDecision(state.profile);
      const remoteDecision = getParqDecision(remoteProfile);
      let mergedDecision = remoteDecision || localDecision;
      if (localDecision && remoteDecision) {
        const localTs = Date.parse(localDecision.parq_completed_at || '');
        const remoteTs = Date.parse(remoteDecision.parq_completed_at || '');
        if (!Number.isNaN(localTs) && !Number.isNaN(remoteTs)) {
          mergedDecision = localTs >= remoteTs ? localDecision : remoteDecision;
        }
      }
      state.profile = { ...(state.profile || {}), ...(mergedDecision || {}) };
      const profileKey = getProfileKey();
      if (profileKey) localStorage.setItem(profileKey, JSON.stringify(state.profile));
      if (mergedDecision) {
        const key = getParqCacheKey();
        if (key) localStorage.setItem(key, JSON.stringify(mergedDecision));
      }
    }

    updateCoachNavIndicator();
    return true;
  } catch (err) {
    console.warn('[PAR-Q sync]', err.message);
    updateCoachNavIndicator();
    return true;
  }
}

async function saveParqToProfile(payload) {
  if (!state.user?.id) {
    showToast('Sessão expirada. Faça login novamente.', true);
    return false;
  }

  // Persist locally first so PAR-Q is never re-prompted in this device/session.
  persistParqDecisionLocal(payload);
  updateCoachNavIndicator();

  try {
    const token = await getSupaToken();
    if (!token) return true;

    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn('[PAR-Q save] remote sync failed:', errData.error || res.statusText);
      return true;
    }
    return true;
  } catch (err) {
    console.warn('[PAR-Q save]', err.message);
    return true;
  }
}

function openParqModal() {
  return new Promise(resolve => {
    const existing = document.getElementById('parq-modal');
    if (existing) {
      resolve(null);
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'parq-modal';
    overlay.className = 'parq-overlay';

    const questionsHtml = PARQ_QUESTIONS.map((q, idx) => `
      <div class="parq-question">
        <div class="parq-question-text">${idx + 1}. ${q}</div>
        <div class="parq-choices">
          <label class="parq-choice">
            <input type="radio" name="parq-q${idx + 1}" value="yes">
            <span>Sim</span>
          </label>
          <label class="parq-choice">
            <input type="radio" name="parq-q${idx + 1}" value="no">
            <span>Não</span>
          </label>
        </div>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="parq-modal" onclick="event.stopPropagation()">
        <div class="parq-title">Triagem de Prontidão — PAR-Q</div>
        <div class="parq-subtitle">Antes de iniciar sua prescrição, precisamos de algumas informações de segurança.</div>
        <div class="parq-list">${questionsHtml}</div>
        <div class="parq-actions">
          <button class="parq-btn-secondary" id="parq-cancel-btn">Cancelar</button>
          <button class="parq-btn-primary" id="parq-submit-btn">Enviar</button>
        </div>
      </div>
    `;

    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      overlay.remove();
      resolve(value);
    };

    overlay.addEventListener('click', () => finish(null));

    document.body.appendChild(overlay);

    const cancelBtn = document.getElementById('parq-cancel-btn');
    const submitBtn = document.getElementById('parq-submit-btn');

    if (cancelBtn) cancelBtn.onclick = () => finish(null);
    if (submitBtn) {
      submitBtn.onclick = () => {
        const answers = {};
        for (let i = 1; i <= PARQ_QUESTIONS.length; i++) {
          const checked = overlay.querySelector(`input[name="parq-q${i}"]:checked`);
          if (!checked) {
            showToast('Responda todas as perguntas do PAR-Q.', true);
            return;
          }
          answers[`q${i}`] = checked.value;
        }

        if (parqHasPositiveAnswers(answers)) {
          const modal = overlay.querySelector('.parq-modal');
          modal.innerHTML = `
            <div class="parq-title">Triagem de Prontidão — PAR-Q</div>
            <div class="parq-warning">
              Por precaução, recomendamos que você obtenha liberação médica antes de iniciar um programa de treino. Você pode continuar explorando o app, mas a prescrição de treino estará desabilitada até a liberação.
            </div>
            <div class="parq-actions">
              <button class="parq-btn-primary" id="parq-understood-btn">Entendido</button>
            </div>
          `;
          const understoodBtn = document.getElementById('parq-understood-btn');
          if (understoodBtn) understoodBtn.onclick = () => finish({ cleared: false, answers });
          return;
        }

        finish({ cleared: true, answers });
      };
    }
  });
}

function openParqBlockedModal() {
  return new Promise(resolve => {
    const existing = document.getElementById('parq-modal');
    if (existing) {
      resolve(false);
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'parq-modal';
    overlay.className = 'parq-overlay';
    overlay.innerHTML = `
      <div class="parq-modal" onclick="event.stopPropagation()">
        <div class="parq-title">Triagem de Prontidão — PAR-Q</div>
        <div class="parq-warning">
          Por precaução, recomendamos que você obtenha liberação médica antes de iniciar um programa de treino. Você pode continuar explorando o app, mas a prescrição de treino estará desabilitada até a liberação.
        </div>
        <div class="parq-actions">
          <button class="parq-btn-primary" id="parq-understood-btn">Entendido</button>
        </div>
      </div>
    `;

    const finish = () => {
      overlay.remove();
      resolve(false);
    };

    overlay.addEventListener('click', finish);
    document.body.appendChild(overlay);
    const btn = document.getElementById('parq-understood-btn');
    if (btn) btn.onclick = finish;
  });
}

async function ensureParqBeforeCoach() {
  if (!state.user?.id) return true;
  applyLocalParqDecision();

  await syncParqStatusFromSupabase();

  if (state.profile?.parq_cleared === true) return true;
  if (parqHasPositiveAnswers(state.profile?.parq_answers)) {
    await openParqBlockedModal();
    return false;
  }

  const result = await openParqModal();
  if (!result) return false;

  const now = new Date().toISOString();
  if (result.cleared) {
    const saved = await saveParqToProfile({
      parq_cleared: true,
      parq_completed_at: now,
      parq_answers: result.answers
    });
    return saved;
  }

  const saved = await saveParqToProfile({
    parq_cleared: false,
    parq_completed_at: now,
    parq_answers: result.answers
  });
  if (!saved) return false;
  return false;
}

async function navigate(page) {
  if (page === 'landing') {
    window._showingLanding = true;
    // Fechar qualquer modal ativo antes de mostrar a landing
    const authModal = document.getElementById('screen-auth');
    if (authModal) authModal.style.display = 'none';
    const onboardingModal = document.querySelector('.wizard-overlay, #onboarding-overlay, #screen-onboarding');
    if (onboardingModal) onboardingModal.style.display = 'none';
    // Mostrar a landing diretamente
    document.querySelectorAll('.page, .screen').forEach(p => p.classList.remove('visible', 'active'));
    const landingEl = document.getElementById('landing-page');
    if (typeof showLandingPage === 'function') {
      showLandingPage();
    } else if (landingEl) {
      landingEl.classList.add('visible');
      window.scrollTo(0, 0);
      if (typeof initLandingAnimations === 'function') initLandingAnimations();
    }
    closeSidebar();
    return;
  }

  if (page === 'chat') {
    const canOpenChat = await ensureParqBeforeCoach();
    if (!canOpenChat) {
      closeSidebar();
      return;
    }
    if (typeof preloadCoachLoadCtx === 'function') {
      try {
        await preloadCoachLoadCtx();
      } catch (e) {
        console.warn('[navigate/chat] preloadCoachLoadCtx:', e);
      }
    }
  }

  if (page !== 'performance' && _perfChartInstance) {
    try { _perfChartInstance.destroy(); } catch (_) {}
    _perfChartInstance = null;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  if (page === 'profile') await loadProfile();
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes("'" + page + "'")) n.classList.add('active');
  });
  closeSidebar();
  if (page === 'dashboard') await refreshDashboard();
  if (page === 'workouts') {
    renderWorkouts();
    await renderCompletedWorkouts();
    switchWorkoutsTab(_workoutsActiveTab || 'active');
  }
  if (page === 'performance') await loadPerformanceTab();
  if (page === 'diagnosis') renderFmsResults();
  if (page === 'profile') loadProfileHealth();
  if (page === 'nutrition') renderNutrition();
  if (page === 'admin') await loadAdminPage();

  // Reset de scroll — deve ser a ÚLTIMA coisa na função
  window.scrollTo(0, 0);
  const activePageEl = document.querySelector('.page.active') ||
                       document.getElementById('page-' + page);
  if (activePageEl) activePageEl.scrollTop = 0;
  const mainEl = document.querySelector('main');
  if (mainEl) mainEl.scrollTop = 0;
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('mobile-open'); document.getElementById('overlay').classList.toggle('mobile-open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('mobile-open'); document.getElementById('overlay').classList.remove('mobile-open'); }
