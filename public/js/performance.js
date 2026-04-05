async function loadPerformanceTab() {
  const emptyEl = document.getElementById('perf-empty');
  const chartWrap = document.getElementById('perf-chart-wrap');
  const statsWrap = document.getElementById('perf-stats-wrap');
  const exSel = document.getElementById('perf-exercise-select');
  const periodSel = document.getElementById('perf-period-select');
  if (!emptyEl || !chartWrap || !statsWrap || !exSel || !periodSel) return;

  emptyEl.style.display = 'block';
  chartWrap.style.display = 'none';
  statsWrap.style.display = 'none';

  if (!state.user?.id) {
    emptyEl.innerHTML = '<p>Faça login novamente para ver performance.</p>';
    return;
  }

  try {
    const { data: logs, error } = await window.supabase
      .from('exercise_logs')
      .select('exercise_name, load_kg, logged_at')
      .eq('user_id', state.user.id)
      .not('load_kg', 'is', null)
      .order('logged_at', { ascending: true });

    if (error || !Array.isArray(logs) || logs.length === 0) {
      emptyEl.innerHTML = '<p>Complete alguns treinos para ver a progressão de carga.</p>';
      return;
    }

    const uniqueExercises = [...new Set(logs.map(l => l.exercise_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    exSel.innerHTML = '<option value="">Selecionar exercício...</option>';
    uniqueExercises.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      exSel.appendChild(opt);
    });

    if (!_perfListenersBound) {
      exSel.addEventListener('change', () => {
        if (exSel.value) renderPerformanceChart(exSel.value);
      });
      periodSel.addEventListener('change', () => {
        if (exSel.value) renderPerformanceChart(exSel.value);
      });
      _perfListenersBound = true;
    }

    if (uniqueExercises.length > 0) {
      exSel.value = uniqueExercises[0];
      await renderPerformanceChart(uniqueExercises[0]);
    }
  } catch (err) {
    console.error('[loadPerformanceTab]', err);
    emptyEl.innerHTML = '<p>Erro ao carregar dados de performance.</p>';
  }
}

async function renderPerformanceChart(exerciseName) {
  const exSel = document.getElementById('perf-exercise-select');
  const periodSel = document.getElementById('perf-period-select');
  const emptyEl = document.getElementById('perf-empty');
  const chartWrap = document.getElementById('perf-chart-wrap');
  const statsWrap = document.getElementById('perf-stats-wrap');
  const statsEl = document.getElementById('perf-stats');
  const canvas = document.getElementById('perf-chart');
  if (!exSel || !periodSel || !emptyEl || !chartWrap || !statsWrap || !statsEl || !canvas) return;
  if (!exerciseName || !state.user?.id) return;

  const token = ++_perfLoadingToken;
  const periodDays = Number(periodSel.value || 28);

  let query = window.supabase
    .from('exercise_logs')
    .select('load_kg, actual_rpe, logged_at, session_id')
    .eq('user_id', state.user.id)
    .eq('exercise_name', exerciseName)
    .not('load_kg', 'is', null)
    .order('logged_at', { ascending: true });

  if (periodDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    query = query.gte('logged_at', cutoff.toISOString());
  }

  const { data: logs, error } = await query;
  if (token !== _perfLoadingToken) return;

  if (error || !Array.isArray(logs) || logs.length === 0) {
    emptyEl.innerHTML = `<p>${periodDays > 0 ? 'Sem dados neste período.' : 'Sem dados para este exercício.'}</p>`;
    emptyEl.style.display = 'block';
    chartWrap.style.display = 'none';
    statsWrap.style.display = 'none';
    if (_perfChartInstance) {
      try { _perfChartInstance.destroy(); } catch (_) {}
      _perfChartInstance = null;
    }
    return;
  }

  const byDate = {};
  logs.forEach(log => {
    const weight = Number(log.load_kg);
    if (!Number.isFinite(weight)) return;
    const dateObj = new Date(log.logged_at);
    const dateKey = dateObj.toISOString().slice(0, 10);
    const label = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    if (!byDate[dateKey] || weight > byDate[dateKey].weight) {
      byDate[dateKey] = { label, weight, rpe: log.actual_rpe, date: log.logged_at };
    }
  });

  const dateKeys = Object.keys(byDate).sort();
  const labels = dateKeys.map(k => byDate[k].label);
  const weights = dateKeys.map(k => byDate[k].weight).filter(v => Number.isFinite(v));
  const rpes = dateKeys.map(k => Number(byDate[k].rpe)).filter(v => Number.isFinite(v));

  if (!weights.length) {
    emptyEl.innerHTML = '<p>Sem cargas válidas para exibir.</p>';
    emptyEl.style.display = 'block';
    chartWrap.style.display = 'none';
    statsWrap.style.display = 'none';
    return;
  }

  if (typeof Chart === 'undefined') {
    emptyEl.innerHTML = '<p>Chart.js não carregado no app.</p>';
    emptyEl.style.display = 'block';
    chartWrap.style.display = 'none';
    statsWrap.style.display = 'none';
    return;
  }

  if (_perfChartInstance) {
    try { _perfChartInstance.destroy(); } catch (_) {}
    _perfChartInstance = null;
  }

  const ctx = canvas.getContext('2d');
  _perfChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Carga Máxima (kg)',
        data: weights,
        borderColor: '#00FF88',
        backgroundColor: 'rgba(0,255,136,0.07)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#00FF88',
        pointBorderColor: '#0A0A0F',
        pointBorderWidth: 2,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8A8A9A', font: { size: 12 } } },
        tooltip: {
          backgroundColor: 'rgba(10,10,15,0.95)',
          titleColor: '#00FF88',
          bodyColor: '#F0F0F0',
          borderColor: '#1E1E2A',
          borderWidth: 1,
          callbacks: {
            label: (ctx2) => `Carga: ${ctx2.parsed.y} kg`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: { color: '#6A6A7A', callback: v => `${v} kg` },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: '#6A6A7A', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });

  const maxWeight = Math.max(...weights);
  const firstWeight = weights[0];
  const lastWeight = weights[weights.length - 1];
  const progression = firstWeight > 0
    ? ((lastWeight - firstWeight) / firstWeight * 100).toFixed(1)
    : '0.0';
  const avgRpe = (rpes.reduce((a, b) => a + b, 0) / (rpes.length || 1)).toFixed(1);
  const uniqueSessions = new Set(logs.map(l => l.session_id).filter(Boolean)).size;

  statsEl.innerHTML = `
    <div class="stat-card-performance"><div class="stat-val">${maxWeight}kg</div><div class="stat-lbl">Máximo</div></div>
    <div class="stat-card-performance"><div class="stat-val">${Number(progression) > 0 ? '+' : ''}${progression}%</div><div class="stat-lbl">Progressão</div></div>
    <div class="stat-card-performance"><div class="stat-val">${uniqueSessions}</div><div class="stat-lbl">Sessões</div></div>
    <div class="stat-card-performance"><div class="stat-val">${avgRpe}</div><div class="stat-lbl">RPE Médio</div></div>
  `;

  emptyEl.style.display = 'none';
  chartWrap.style.display = 'block';
  statsWrap.style.display = 'block';
}

