const LIB_AND_MODULE_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js',
  '/js/auth.js',
  '/js/onboarding.js',
  '/js/dashboard.js',
  '/js/profile.js',
  '/js/coach.js',
  '/js/performance.js',
  '/js/athletes.js',
];

function queueScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-axis-module-src="${src}"]`);
    if (existing) {
      if (existing.dataset.axisLoaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.defer = false;
    script.dataset.axisModuleSrc = src;
    script.onload = () => {
      script.dataset.axisLoaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}

let _sessionModulesBootstrapped = false;

async function waitForSupabaseClient(maxAttempts = 40, delayMs = 150) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (window.supabase?.auth) return window.supabase;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

async function initSessionDependentModules(session) {
  if (!session?.user) return;
  if (typeof window.initDashboard === 'function') {
    try {
      await window.initDashboard();
    } catch (err) {
      console.warn('[initDashboard]', err?.message || err);
    }
  }
  if (typeof window.initProfile === 'function') {
    try {
      await window.initProfile();
    } catch (err) {
      console.warn('[initProfile]', err?.message || err);
    }
  }
}

async function initModuleByTab(tabName) {
  switch (tabName) {
    case 'dashboard':
      if (typeof window.initDashboard === 'function') await window.initDashboard();
      break;
    case 'perfil':
    case 'profile':
      if (typeof window.initProfile === 'function') await window.initProfile();
      break;
    case 'treinos':
    case 'workouts':
      if (typeof window.initTreinos === 'function') await window.initTreinos();
      break;
    case 'performance':
      if (typeof window.initPerformance === 'function') await window.initPerformance();
      break;
    default:
      break;
  }
}

window.initModuleByTab = initModuleByTab;

async function setupSessionBootstrap() {
  const supabaseClient = await waitForSupabaseClient();
  if (!supabaseClient) {
    console.warn('[app] Supabase client indisponível para bootstrap de sessão');
    return;
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      if (event === 'INITIAL_SESSION' && _sessionModulesBootstrapped) return;
      if (event === 'SIGNED_IN') _sessionModulesBootstrapped = false;
      await initSessionDependentModules(session);
      _sessionModulesBootstrapped = true;
    }

    if (event === 'SIGNED_OUT') {
      _sessionModulesBootstrapped = false;
      if (typeof window._showOnly === 'function') {
        window._showOnly('screen-auth');
      }
    }
  });

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user && !_sessionModulesBootstrapped) {
    await initSessionDependentModules(session);
    _sessionModulesBootstrapped = true;
  }
}

for (const src of LIB_AND_MODULE_SCRIPTS) {
  await queueScript(src);
}

function mountAthletesPanel() {
  const nav = document.querySelector('.sidebar-nav');
  if (nav && !document.getElementById('nav-athletes-btn')) {
    const section = document.createElement('div');
    section.className = 'nav-section-label';
    section.id = 'nav-coach-section';
    section.style.display = 'none';
    section.textContent = 'Treinador';
    nav.appendChild(section);

    const button = document.createElement('button');
    button.className = 'nav-item';
    button.id = 'nav-athletes-btn';
    button.style.display = 'none';
    button.innerHTML = '<span class="icon">👥</span><span class="label">Atletas</span>';
    button.addEventListener('click', () => window.navigate?.('athletes'));
    nav.appendChild(button);
  }

  const main = document.querySelector('main');
  if (main && !document.getElementById('page-athletes')) {
    const page = document.createElement('div');
    page.className = 'page';
    page.id = 'page-athletes';
    page.innerHTML = '<div class="page-header"><h1>SEUS <span style="color:var(--green)">ATLETAS</span></h1><p style="color:var(--muted);font-size:13px;">Acompanhe prontidão, FMS e histórico em tempo real.</p></div><div id="athletes-list-view"><div id="athletes-list-container"></div></div><div id="athlete-detail-view" style="display:none"></div>';
    main.appendChild(page);
  }
}

mountAthletesPanel();
if (typeof window.__axisInitApp === 'function') {
  await window.__axisInitApp();
}

await setupSessionBootstrap();
