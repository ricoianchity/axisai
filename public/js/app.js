const LIB_AND_MODULE_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js',
  '/js/auth.js',
  '/js/onboarding.js',
  '/js/dashboard.js',
  '/js/profile.js',
  '/js/coach.js',
  '/js/performance.js',
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
    await window.initDashboard();
  }
  if (typeof window.initProfile === 'function') {
    await window.initProfile();
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

await setupSessionBootstrap();
