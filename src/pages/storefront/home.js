import { initApp, state, requireSupabase } from '/src/app.js';
import { translatePage, t } from '/src/core/i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  translatePage();
  if (!requireSupabase()) return;

  document.querySelectorAll('.faq-item').forEach((item) => {
    const btn = item.querySelector('.faq-q');
    const ans = item.querySelector('.faq-a');
    if (!btn || !ans) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((o) => {
        o.classList.remove('open');
        o.querySelector('.faq-a').style.maxHeight = '0';
      });
      if (!isOpen) {
        item.classList.add('open');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });

  try {
    const s = state.storeSettings || {};
    const el = document.getElementById('hero-shop-name');
    if (el && s.shop_name) el.textContent = s.shop_name;
    const tag = document.getElementById('hero-tagline');
    if (tag && s.tagline) tag.textContent = s.tagline;
  } catch {}

  try {
    const { data: reviews, error } = await state.supabase.rpc('get_home_reviews');
    const grid = document.getElementById('home-reviews');
    if (!error && grid && Array.isArray(reviews) && reviews.length) {
      grid.innerHTML = reviews
        .slice(0, 3)
        .map(
          (r) => `
        <div class="review-card reveal">
          <div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
          <blockquote>“${escapeHtml(r.comment || '')}”</blockquote>
          <div class="who">— ${escapeHtml(r.reviewer_name || t('common.customer'))}</div>
        </div>
      `,
        )
        .join('');
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('visible');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12 },
      );
      grid.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    }
  } catch (err) {
    console.error(err);
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
