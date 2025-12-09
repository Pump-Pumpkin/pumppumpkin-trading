const GA_MEASUREMENT_ID =
  import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-P4Z9X0PTGR';

const GA_SCRIPT_ID = 'ga4-base-script';

const isBrowser = () => typeof window !== 'undefined';

const hasExistingGaScript = () =>
  isBrowser() &&
  !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]');

const shouldInitAnalytics = () =>
  isBrowser() &&
  !!GA_MEASUREMENT_ID &&
  !window.__GA_INITIALIZED__ &&
  !hasExistingGaScript() &&
  typeof window.gtag !== 'function' &&
  import.meta.env.PROD;

const injectGaScript = () => {
  if (!isBrowser()) return;

  const existing = document.getElementById(GA_SCRIPT_ID);
  if (existing) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.id = GA_SCRIPT_ID;
  document.head.appendChild(script);
};

export const initAnalytics = () => {
  if (!isBrowser()) return;

  // If the base snippet is already present (e.g., injected in index.html), honor it.
  if (typeof window.gtag === 'function') {
    window.__GA_INITIALIZED__ = true;
    return;
  }

  if (!shouldInitAnalytics()) return;

  injectGaScript();

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: true,
  });

  window.__GA_INITIALIZED__ = true;
};

export const trackEvent = (
  name: string,
  params: Record<string, unknown> = {}
) => {
  if (!isBrowser() || !window.gtag) return;
  window.gtag('event', name, params);
};
