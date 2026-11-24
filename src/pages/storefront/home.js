import { initApp, state, requireSupabase } from '/src/app.js';
import { translatePage, t, onLanguageChange } from '/src/core/i18n.js';

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

  // The hero shows the shop's own name and tagline. They are plain text (no
  // data-i18n) so a language switch must not overwrite them with a generic
  // translation — re-apply them whenever the language changes.
  const paintHeroCopy = () => {
    const s = state.storeSettings || {};
    const nameEl = document.getElementById('hero-shop-name');
    if (nameEl) nameEl.textContent = s.shop_name || t('home.eyebrow');
    const tagEl = document.getElementById('hero-tagline');
    if (tagEl) tagEl.textContent = s.tagline || t('home.hero_lead');
  };
  paintHeroCopy();
  onLanguageChange(paintHeroCopy);

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
