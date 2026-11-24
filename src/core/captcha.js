/**
 * ZenMarket Captcha — Cloudflare Turnstile
 * รองรับการเรนเดอร์ก่อนสคริปต์โหลดเสร็จ (รอ event 'turnstile-ready')
 */

let turnstileLoaded = false;
let turnstileSiteKey = null;
const pending = [];

function ensureScript() {
  if (turnstileLoaded) return;
  if (document.querySelector('script[data-turnstile]')) return;

  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady&render=explicit';
  script.async = true;
  script.defer = true;
  script.dataset.turnstile = 'true';
  document.head.appendChild(script);

  window.onTurnstileReady = () => {
    turnstileLoaded = true;
    window.dispatchEvent(new Event('turnstile-ready'));
    while (pending.length) {
      const job = pending.shift();
      job();
    }
  };
}

export function initCaptcha() {
  turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!turnstileSiteKey) return false;
  ensureScript();
  return true;
}

export function renderTurnstile(containerId, onVerify, onExpire) {
  if (!turnstileSiteKey) {
    if (onExpire) onExpire();
    return null;
  }

  const run = () => {
    const el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!el) return;
    try {
      window.turnstile.render(el, {
        sitekey: turnstileSiteKey,
        theme: 'dark',
        callback: (token) => { if (onVerify) onVerify(token); },
        'expired-callback': () => { if (onExpire) onExpire(); },
        'error-callback': () => { if (onExpire) onExpire(); },
      });
    } catch (err) {
      console.warn('[ZenMarket] turnstile render failed', err);
      if (onExpire) onExpire();
    }
  };

  if (turnstileLoaded) {
    run();
  } else {
    ensureScript();
    pending.push(run);
  }
  return null;
}

export function resetTurnstile(widgetId) {
  if (turnstileLoaded && widgetId && window.turnstile) {
    window.turnstile.reset(widgetId);
  }
}

export function removeTurnstile(widgetId) {
  if (turnstileLoaded && widgetId && window.turnstile) {
    window.turnstile.remove(widgetId);
  }
}

export function hasCaptcha() {
  return !!turnstileSiteKey;
}
