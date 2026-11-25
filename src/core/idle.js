import { t } from '/src/core/i18n.js';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

export function idleLimitMs() {
  const minutes = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || 30);
  if (!Number.isFinite(minutes) || minutes <= 0) return 30 * 60 * 1000;
  return Math.max(5000, minutes * 60 * 1000);
}

export function initIdleTimeout(options = {}) {
  const { onTimeout, limitMs = idleLimitMs(), target = window } = options;
  if (typeof onTimeout !== 'function') return () => {};

  const warnAt = Math.max(1000, limitMs - Math.min(60 * 1000, limitMs * 0.2));
  let timeoutId = null;
  let warnId = null;
  let banner = null;

  const clearBanner = () => {
    banner?.remove();
    banner = null;
  };

  const arm = () => {
    clearTimeout(timeoutId);
    clearTimeout(warnId);
    clearBanner();
    warnId = setTimeout(() => {
      banner = document.createElement('div');
      banner.id = 'idle-warning';
      banner.className = 'idle-warning';
      banner.setAttribute('role', 'alert');
      banner.setAttribute('aria-live', 'assertive');
      banner.setAttribute('aria-atomic', 'true');
      banner.innerHTML = `<span>${t('session.idle_warning')}</span><button type="button" class="btn btn-primary btn-sm">${t('session.idle_stay')}</button>`;
      banner.querySelector('button')?.addEventListener('click', () => reset());
      document.body.appendChild(banner);
    }, warnAt);
    timeoutId = setTimeout(() => {
      clearBanner();
      teardown();
      onTimeout();
    }, limitMs);
  };

  const reset = () => arm();

  const teardown = () => {
    clearTimeout(timeoutId);
    clearTimeout(warnId);
    clearBanner();
    ACTIVITY_EVENTS.forEach((name) => target.removeEventListener(name, reset, true));
    target.removeEventListener('visibilitychange', onVisible);
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') arm();
  };

  ACTIVITY_EVENTS.forEach((name) => target.addEventListener(name, reset, { capture: true, passive: true }));
  target.addEventListener('visibilitychange', onVisible);
  arm();

  return teardown;
}
