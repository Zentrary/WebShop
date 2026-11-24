/**
 * ZenMarket Reveal — เผยเนื้อหาแบบเลื่อนเข้าหน้าจอ
 */

let observer = null;

export function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  }

  els.forEach(el => {
    if (!el.classList.contains('visible')) observer.observe(el);
  });
}

export function observeReveals(container) {
  if (!container) return;
  if (!observer) {
    initReveal();
    return;
  }
  container.querySelectorAll('.reveal').forEach(el => {
    if (!el.classList.contains('visible')) observer.observe(el);
  });
}

/**
 * เผยเนื้อหาทั้งหมดทันที (ใช้เมื่อมี error หรือผู้ใช้ปิด JavaScript)
 */
export function revealAll() {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}

// เปิดตาข่ายนิรภัย: ถ้ามี JS error ให้แสดงเนื้อหาทั้งหมดทันที
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e && e.error) revealAll();
  });
  window.addEventListener('unhandledrejection', () => revealAll());
}
