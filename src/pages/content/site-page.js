import { initApp, state } from '/src/app.js';
import { getLanguage, translatePage, onLanguageChange } from '/src/core/i18n.js';
import { normalizePath } from '/src/core/routes.js';
import { escapeHTML } from '/src/core/lib.js';

/**
 * หน้า About / Help / Privacy ใช้ข้อความเริ่มต้นในโค้ดก็ได้
 * แต่ถ้าเจ้าของร้านแก้ข้อความผ่านหลังบ้าน (ตาราง site_pages) ให้ใช้ข้อความนั้นแทน
 */
const SLUGS = {
  '/pages/about': 'about',
  '/pages/help': 'help',
  '/pages/privacy': 'privacy',
};

function paragraphs(text) {
  return String(text || '')
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHTML(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function render() {
  const slug = SLUGS[normalizePath(window.location.pathname)];
  if (!slug || !state.supabase) return;

  const main = document.querySelector('main.container.page');
  if (!main) return;

  let row = null;
  try {
    const { data } = await state.supabase.from('site_pages').select('*').eq('slug', slug).maybeSingle();
    row = data || null;
  } catch (err) {
    console.warn('[ZenMarket] site page unavailable', err);
    return;
  }

  const lang = getLanguage() === 'en' ? 'en' : 'th';
  const title = (lang === 'en' ? row?.title_en : row?.title_th) || '';
  const body = (lang === 'en' ? row?.body_en : row?.body_th) || '';

  let box = document.getElementById('site-page-custom');
  if (!box) {
    box = document.createElement('div');
    box.id = 'site-page-custom';
    box.className = 'panel reveal';
  }

  const head = main.querySelector('.page-head');

  if (!body) {
    // ไม่มีข้อความที่แก้เอง → ใช้เนื้อหาเดิมในหน้าเว็บ
    box.remove();
    main.querySelectorAll('.page-head').forEach((el) => el.classList.remove('hidden'));
    Array.from(main.children).forEach((el) => el.classList.remove('hidden', 'is-replaced'));
    return;
  }

  box.innerHTML = `
    ${title ? `<h2 class="site-page-custom-title">${escapeHTML(title)}</h2>` : ''}
    <div class="site-page-body">${paragraphs(body)}</div>
  `;

  if (head && head.nextElementSibling !== box) head.after(box);

  Array.from(main.children).forEach((el) => {
    if (el === head || el === box) return;
    el.classList.add('hidden', 'is-replaced');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  translatePage();
  await render();
  onLanguageChange(async () => {
    translatePage();
    await render();
  });
});
