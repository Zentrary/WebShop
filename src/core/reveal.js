let observer = null;
let watcher = null;
let reduced = false;

function reveal(el) {
  if (!el || el.classList.contains('visible')) return;
  el.classList.add('visible');
  if (observer) observer.unobserve(el);
}

function inViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.top < (window.innerHeight || 0) && rect.bottom > -200;
}

function queue(el) {
  if (!el || !el.classList || el.classList.contains('visible')) return;
  if (reduced || !observer || inViewport(el)) reveal(el);
  else observer.observe(el);
}

function ensureObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) reveal(entry.target);
      });
    },
    { threshold: 0, rootMargin: '0px 0px -8% 0px' },
  );
  return observer;
}

function watchNewNodes() {
  if (watcher || typeof MutationObserver === 'undefined' || !document.body) return;
  watcher = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.classList?.contains('reveal')) queue(node);
        node.querySelectorAll?.('.reveal').forEach(queue);
      });
    });
  });
  watcher.observe(document.body, { childList: true, subtree: true });
}

export function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    els.forEach(reveal);
    return;
  }

  ensureObserver();
  els.forEach(queue);
  watchNewNodes();
}

export function observeReveals(container) {
  if (!container) return;
  if (!observer) initReveal();
  if (container.classList?.contains('reveal')) queue(container);
  container.querySelectorAll('.reveal').forEach(queue);
}

export function revealAll() {
  document.querySelectorAll('.reveal').forEach(reveal);
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e && e.error) revealAll();
  });
  window.addEventListener('unhandledrejection', () => revealAll());
}
