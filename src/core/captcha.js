let turnstileLoaded = false;
let turnstileSiteKey = null;

export function initCaptcha() {
  turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!turnstileSiteKey) return false;

  if (!turnstileLoaded) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?async=defer';
    script.defer = true;
    script.onload = () => {
      turnstileLoaded = true;
      window.dispatchEvent(new Event('turnstile-ready'));
    };
    document.head.appendChild(script);
  }
  return !!turnstileSiteKey;
}

export function renderTurnstile(containerId, onVerify, onExpire) {
  if (!turnstileLoaded || !turnstileSiteKey) {
    if (onVerify) onVerify('');
    return null;
  }

  const widgetId = window.turnstile.render(containerId, {
    sitekey: turnstileSiteKey,
    theme: 'dark',
    callback: (token) => {
      if (onVerify) onVerify(token);
    },
    'expired-callback': () => {
      if (onExpire) onExpire();
    },
  });
  return widgetId;
}

export function resetTurnstile(widgetId) {
  if (turnstileLoaded && widgetId) {
    window.turnstile.reset(widgetId);
  }
}

export function removeTurnstile(widgetId) {
  if (turnstileLoaded && widgetId) {
    window.turnstile.remove(widgetId);
  }
}

export function hasCaptcha() {
  return !!turnstileSiteKey;
}