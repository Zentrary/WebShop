import { initApp, state, requireSupabase } from '/src/app.js';
import { translatePage, t, onLanguageChange } from '/src/core/i18n.js';
import { ratingStars } from '/src/core/lib.js';

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

  paintHomeReviews();

  // Switching language re-renders the review cards so their labels follow too.
  onLanguageChange(paintHomeReviews);
});

/**
 * Reviews on the home page always come from the database — never from mock
 * copy, so what the customer reads here is exactly what the shop can moderate
 * on /admin/reviews.html. An empty table means an honest empty state.
 */
async function paintHomeReviews() {
  const grid = document.getElementById('home-reviews');
  if (!grid || !state.supabase) return;

  let reviews = [];
  try {
    const { data, error } = await state.supabase.rpc('get_home_reviews');
    if (!error && Array.isArray(data)) reviews = data;
  } catch (err) {
    console.warn('[ZenMarket] reviews rpc failed', err);
  }

  // Older projects may not have the RPC — fall back to the table itself.
  if (!reviews.length) {
    try {
      const { data } = await state.supabase
        .from('product_reviews')
        .select('reviewer_name,product_name,rating,comment,created_at')
        .gt('rating', 3)
        .order('created_at', { ascending: false })
        .limit(3);
      if (Array.isArray(data)) reviews = data;
    } catch (err) {
      console.warn('[ZenMarket] reviews query failed', err);
    }
  }

  if (!reviews.length) {
    grid.innerHTML = `<p class="empty-state" data-i18n="admin.no_reviews">${t('admin.no_reviews')}</p>`;
    return;
  }

  grid.innerHTML = reviews
    .slice(0, 3)
    .map((r) => {
      const rating = Math.max(0, Math.min(5, Number(r.rating) || 0));
      return `
        <div class="review-card reveal visible">
          ${ratingStars(rating)}
          <blockquote>“${escapeHtml(r.comment || '')}”</blockquote>
          <div class="who">— ${escapeHtml(r.reviewer_name || t('common.customer'))}</div>
        </div>
      `;
    })
    .join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
