/**
 * ZenMarket Home Page
 * Hero + วิธีการสั่งซื้อ + รีวิว + FAQ + ติดต่อ
 */

import { initApp, state, requireSupabase } from '/src/app.js';
import { translatePage } from '/src/core/i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  translatePage();
  if (!requireSupabase()) return;

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-q');
    const ans = item.querySelector('.faq-a');
    if (!btn || !ans) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(o => {
        o.classList.remove('open');
        o.querySelector('.faq-a').style.maxHeight = '0';
      });
      if (!isOpen) {
        item.classList.add('open');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });

  // Load shop info into hero meta
  try {
    const s = state.storeSettings || {};
    const el = document.getElementById('hero-shop-name');
    if (el && s.shop_name) el.textContent = s.shop_name;
    const tag = document.getElementById('hero-tagline');
    if (tag && s.tagline) tag.textContent = s.tagline;
  } catch {}

  // Load real reviews ผ่าน RPC (คัดเฉพาะรีวิว 4 ดาวขึ้นไป)
  try {
    const { data: reviews, error } = await state.supabase.rpc('get_home_reviews');
    const grid = document.getElementById('home-reviews');
    if (!error && grid && Array.isArray(reviews) && reviews.length) {
      grid.innerHTML = reviews.slice(0, 3).map(r => `
        <div class="review-card reveal">
          <div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
          <blockquote>“${escapeHtml(r.comment || '')}”</blockquote>
          <div class="who">— ${escapeHtml(r.reviewer_name || 'ลูกค้า')}</div>
        </div>
      `).join('');
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
      }, { threshold: 0.12 });
      grid.querySelectorAll('.reveal').forEach(el => io.observe(el));
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
