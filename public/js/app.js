const LIB_AND_MODULE_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js',
  '/js/performance.js',
  '/js/dashboard.js',
  '/js/profile.js',
  '/js/coach.js',
  '/js/onboarding.js',
  '/js/auth.js',
];

function loadScriptSequentially(src) {
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

for (const src of LIB_AND_MODULE_SCRIPTS) {
  await loadScriptSequentially(src);
}
