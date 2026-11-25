import { initApp, state, addToCart, updateCartBadge, requireSupabase } from '/src/app.js';
import { isSignedIn } from '/src/core/audience.js';
import { translatePage } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import {
  formatTHB,
  safeImage,
  escapeHTML,
  bindOnce,
  ratingStars,
  effectivePrice,
  hasSalePrice,
} from '/src/core/lib.js';
import { getStockStatusText, getStockStatusClass } from '/src/core/customer.js';
import { observeReveals } from '/src/core/reveal.js';
import { loadFavorites, toggleFavorite, isFavorite, canUseFavorites } from '/src/core/favorites.js';
import { t, applyDocumentTitle, onLanguageChange } from '/src/core/i18n.js';
import { normalizePath } from '/src/core/routes.js';
import { applyPageMeta } from '/src/core/brand.js';

let currentProduct = null;
let currentPage = 1;
let activeCategory = '';
const PRODUCTS_PER_PAGE = 12;
const productCache = new Map();
const NEW_BADGE_DAYS = 7;
const COMING_SOON_LIMIT = 4;
let comingSoonTimer = null;

let currentRenderer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  translatePage();

  if (!requireSupabase()) return;

  const path = window.location.pathname;

  if (isSignedIn()) await loadFavorites();

  const route = normalizePath(path);
  if (route.startsWith('/shop/product')) {
    currentRenderer = initProductPage;
  } else if (route === '/shop') {
    currentRenderer = initStorePage;
  }

  initGuestGate(route);

  if (currentRenderer) await currentRenderer();

  onLanguageChange(() => {
    translatePage();
    if (currentRenderer) currentRenderer();
  });
});

const GUEST_GATE_KEY = 'zenmarket_guest_gate_seen';
const GATE_CLOSE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/**
 * ป๊อปอัปบอกผู้เยี่ยมชมว่าดูสินค้าได้เลย แต่ต้องเข้าสู่ระบบก่อนสั่งซื้อ
 * แสดงเฉพาะหน้ารายการสินค้า ปิดได้ และไม่เด้งซ้ำในรอบการใช้งานเดียวกัน
 */
function initGuestGate(route) {
  if (isSignedIn() || route !== '/shop') return;
  try {
    if (sessionStorage.getItem(GUEST_GATE_KEY)) return;
  } catch {}
  if (document.getElementById('guest-gate')) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'guest-gate';
  dialog.className = 'guest-gate';
  dialog.setAttribute('tabindex', '-1');
  dialog.setAttribute('aria-labelledby', 'guest-gate-title');
  dialog.setAttribute('aria-describedby', 'guest-gate-desc');
  dialog.innerHTML = `
    <button type="button" class="guest-gate-close" data-guest-gate-close aria-label="${escapeHTML(
      t('common.close'),
    )}" data-i18n-aria-label="common.close">${GATE_CLOSE_SVG}</button>
    <span class="guest-gate-eyebrow" data-i18n="shop.gate_eyebrow">${escapeHTML(t('shop.gate_eyebrow'))}</span>
    <h2 id="guest-gate-title" class="guest-gate-title" data-i18n="shop.gate_title">${escapeHTML(t('shop.gate_title'))}</h2>
    <p id="guest-gate-desc" class="guest-gate-desc" data-i18n="shop.gate_desc">${escapeHTML(t('shop.gate_desc'))}</p>
    <div class="guest-gate-actions">
      <a class="btn btn-primary" href="/auth/login" data-i18n="shop.gate_login">${escapeHTML(t('shop.gate_login'))}</a>
      <button type="button" class="btn btn-ghost" data-guest-gate-close data-i18n="shop.gate_browse">${escapeHTML(
        t('shop.gate_browse'),
      )}</button>
    </div>`;
  document.body.appendChild(dialog);

  const remember = () => {
    try {
      sessionStorage.setItem(GUEST_GATE_KEY, '1');
    } catch {}
  };
  const close = () => {
    remember();
    if (dialog.open) dialog.close();
  };

  dialog.querySelectorAll('[data-guest-gate-close]').forEach((btn) => btn.addEventListener('click', close));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', remember);
  setTimeout(() => {
    try {
      dialog.showModal();
      dialog.focus();
    } catch {}
  }, 450);
}

/**
 * การสั่งซื้อต้องมีบัญชี — ถ้ายังไม่ล็อกอินให้พาไปหน้าล็อกอิน
 * แล้วพากลับมาหน้าเดิมหลังเข้าสู่ระบบ
 */
function requireMemberForOrder() {
  if (isSignedIn()) return true;
  notify(t('toast.login_to_buy'), 'warning');
  sessionStorage.setItem('zenmarket_return_path', window.location.pathname + window.location.search);
  setTimeout(() => {
    window.location.href = '/auth/login';
  }, 900);
  return false;
}

function productImages(product) {
  const urls = [];
  if (Array.isArray(product.image_urls)) urls.push(...product.image_urls.filter(Boolean));
  if (product.image_url) urls.unshift(product.image_url);
  return [...new Set(urls)];
}

const HEART_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.7-7.8 1.1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>';

/**
 * "ใหม่" = สินค้าที่เพิ่งขึ้นเว็บภายใน 7 วัน ใช้วันที่ตั้งเวลา (publish_at) ถ้ามี
 * ไม่งั้นใช้วันที่สร้าง — สินค้าที่ลงไว้ล่วงหน้าจะได้ไม่ขึ้นป้ายตั้งแต่ยังไม่เปิดขาย
 */
function isNewArrival(product) {
  const stamp = product.publish_at || product.created_at;
  if (!stamp) return false;
  const age = Date.now() - new Date(stamp).getTime();
  return age >= 0 && age < NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;
}

/** เวลาที่เหลือก่อนเปิดขาย แบบอ่านง่าย: "2 วัน 4 ชม." / "4 ชม. 20 นาที" */
function formatCountdown(target) {
  const ms = new Date(target).getTime() - Date.now();
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return t('shop.coming_now');
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return t('shop.countdown_dhm', { d: days, h: hours });
  if (hours > 0) return t('shop.countdown_hm', { h: hours, m: minutes });
  return t('shop.countdown_m', { m: minutes });
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'card product-card reveal';
  const images = productImages(product);
  const firstImage = images.length ? safeImage(images[0]) : '/images/placeholder.svg';
  const stockStatus = getStockStatusText(product.stock);
  const stockClass = getStockStatusClass(product.stock);
  productCache.set(product.id, product);

  const favActive = isFavorite(product.id);
  const onSale = hasSalePrice(product);
  const price = effectivePrice(product);
  card.innerHTML = `
    <div class="thumb">
      <img src="${firstImage}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async">
      ${onSale ? `<span class="sale-badge">${escapeHTML(t('product.sale'))}</span>` : ''}
      ${isNewArrival(product) ? `<span class="new-badge">${escapeHTML(t('shop.new_badge'))}</span>` : ''}
      <button class="favorite-btn ${favActive ? 'active' : ''}" data-favorite="${product.id}"
        title="${t(favActive ? 'product.favorite_remove' : 'product.favorite_add')}"
        aria-label="${t(favActive ? 'product.favorite_remove' : 'product.favorite_add')}">${HEART_SVG}</button>
      <button class="btn btn-primary btn-sm quick-add" data-add-to-cart="${product.id}">${t('product.add_to_cart')}</button>
    </div>
    <div class="body">
      <span class="cat">${escapeHTML(product.category || '')}</span>
      <h3 class="name">${escapeHTML(product.name)}</h3>
      <div class="foot">
        <span class="price">${formatTHB(price)}${
          onSale ? `<s class="price-was">${formatTHB(product.price)}</s>` : ''
        }</span>
        <span class="stock-tag ${stockClass}">${stockStatus}</span>
      </div>
    </div>
  `;

  const thumbImg = card.querySelector('.thumb img');
  if (thumbImg) {
    const markLoaded = () => {
      thumbImg.classList.add('is-loaded');
      thumbImg.closest('.thumb')?.classList.add('is-loaded');
    };
    if (thumbImg.complete && thumbImg.naturalWidth > 0) markLoaded();
    else thumbImg.addEventListener('load', markLoaded, { once: true });
    thumbImg.addEventListener('error', markLoaded, { once: true });
  }

  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-to-cart]')) return;
    const favBtn = e.target.closest('[data-favorite]');
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      handleFavoriteClick(favBtn, product.id);
      return;
    }
    window.location.href = `/shop/product?id=${product.id}`;
  });

  return card;
}

async function handleFavoriteClick(button, productId) {
  if (!canUseFavorites()) {
    notify(t('toast.login_required'), 'warning');
    sessionStorage.setItem('zenmarket_return_path', window.location.pathname + window.location.search);
    setTimeout(() => {
      window.location.href = '/auth/login';
    }, 900);
    return;
  }
  const result = await toggleFavorite(productId);
  if (result === null) return;
  button.classList.toggle('active', result);
  button.title = t(result ? 'product.favorite_remove' : 'product.favorite_add');
  button.setAttribute('aria-label', button.title);
}

function observeRevealsLocal(container) {
  observeReveals(container);
}

function showSkeletons(grid, n = 8) {
  grid.innerHTML = Array.from(
    { length: n },
    () =>
      '<div class="card"><div class="skeleton" style="aspect-ratio:4/5"></div><div style="padding:1rem"><div class="skeleton" style="height:14px;width:60%;margin-bottom:8px"></div><div class="skeleton" style="height:18px;width:40%"></div></div></div>',
  ).join('');
}

async function initStorePage() {
  const grid = document.getElementById('product-grid');
  const countEl = document.getElementById('product-count');
  const searchInput = document.getElementById('product-search');
  const chipsEl = document.getElementById('category-chips');
  const categoryCountEl = document.getElementById('category-count');
  if (!grid) return;

  showSkeletons(grid);

  let categories = [];
  try {
    const { data } = await state.supabase.from('categories').select('name').order('name');
    categories = data || [];
  } catch {
    categories = [];
  }

  const params = new URLSearchParams(window.location.search);
  const presetCat = params.get('category');
  if (presetCat) activeCategory = presetCat;

  renderCategoryChips(chipsEl, categories, grid, countEl, searchInput);

  if (categoryCountEl) categoryCountEl.textContent = t('shop.categories_count', { n: categories.length });

  await loadProducts(grid, countEl, searchInput.value, activeCategory || null);
  await initComingSoon(grid, countEl, searchInput);

  let debounce;
  bindOnce(searchInput, 'input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentPage = 1;
      loadProducts(grid, countEl, searchInput.value, activeCategory || null);
    }, 300);
  });
}

/**
 * The category chips double as the filter: one click narrows the grid down,
 * clicking the same chip again brings every product back.
 */
function renderCategoryChips(container, categories, grid, countEl, searchInput) {
  if (!container) return;

  container.innerHTML = '';

  const addChip = (value, label) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'category-chip';
    if (activeCategory === value) chip.classList.add('active');
    chip.textContent = label;
    chip.addEventListener('click', () => {
      const next = activeCategory === value ? '' : value;
      activeCategory = next;
      currentPage = 1;
      container.querySelectorAll('.category-chip').forEach((el) => el.classList.remove('active'));
      if (next) chip.classList.add('active');
      loadProducts(grid, countEl, searchInput.value, activeCategory || null);
    });
    container.appendChild(chip);
  };

  addChip('', t('shop.filter_all'));
  categories.forEach((cat) => addChip(cat.name, cat.name));
}

async function loadProducts(grid, countEl, search = '', category = null) {
  const nowIso = new Date().toISOString();
  let query = state.supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('active', true)
    .or(`publish_at.is.null,publish_at.lte.${nowIso}`);

  if (category) query = query.eq('category', category);
  if (search) query = query.ilike('name', `%${search}%`);

  const from = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const to = from + PRODUCTS_PER_PAGE - 1;
  query = query.range(from, to).order('created_at', { ascending: false });

  const { data: products, error, count } = await query;

  if (error) {
    notify(t('shop.load_error'), 'error');
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${escapeHTML(t('shop.load_failed'))}</div>`;
    return;
  }

  countEl.textContent = t('shop.count', { n: count || 0 });
  grid.innerHTML = '';

  if (!products || products.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <p>${t('shop.empty')}</p>
      <p class="text-muted text-sm">${t('shop.empty_hint')}</p>
    </div>`;
    renderPagination(document.getElementById('pagination'), 0);
    return;
  }

  products.forEach((product) => grid.appendChild(createProductCard(product)));
  observeRevealsLocal(grid);
  renderPagination(document.getElementById('pagination'), count || 0);
}

/**
 * แถบ "กำลังจะมา" — สินค้าที่เจ้าของร้านตั้งเวลาเปิดขายไว้ล่วงหน้า
 * ลูกค้าเห็นล่วงหน้าได้ (ถ้าเปิดตัวเลือก show_soon) พร้อมเวลานับถอยหลัง
 * พอถึงเวลา การ์ดจะย้ายไปอยู่ในรายการสินค้าจริงเองพร้อมแจ้งเตือน
 */
async function initComingSoon(grid, countEl, searchInput) {
  const section = document.getElementById('coming-soon');
  const gridEl = document.getElementById('coming-soon-grid');
  if (comingSoonTimer) {
    clearInterval(comingSoonTimer);
    comingSoonTimer = null;
  }
  if (!section || !gridEl) return;

  const nowIso = new Date().toISOString();
  let items = [];
  try {
    const { data } = await state.supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .eq('show_soon', true)
      .gt('publish_at', nowIso)
      .order('publish_at', { ascending: true })
      .limit(COMING_SOON_LIMIT);
    items = data || [];
  } catch {
    items = [];
  }

  if (!items.length) {
    section.classList.add('hidden');
    gridEl.innerHTML = '';
    return;
  }

  section.classList.remove('hidden');
  gridEl.innerHTML = '';
  items.forEach((product) => gridEl.appendChild(createComingSoonCard(product)));
  observeRevealsLocal(gridEl);

  comingSoonTimer = setInterval(() => {
    const due = [];
    gridEl.querySelectorAll('[data-countdown]').forEach((el) => {
      const target = el.getAttribute('data-countdown');
      el.textContent = `${t('shop.coming_in')} ${formatCountdown(target)}`;
      if (new Date(target).getTime() <= Date.now()) due.push(target);
    });
    if (!due.length) return;

    const goneLive = items.find((p) => new Date(p.publish_at).getTime() <= Date.now());
    clearInterval(comingSoonTimer);
    comingSoonTimer = null;
    if (goneLive) notify(t('shop.new_arrival_toast', { name: goneLive.name }), 'success');
    loadProducts(grid, countEl, searchInput ? searchInput.value : '', activeCategory || null);
    initComingSoon(grid, countEl, searchInput);
  }, 30000);
}

function createComingSoonCard(product) {
  const card = document.createElement('article');
  card.className = 'card product-card coming-card';
  const images = productImages(product);
  const firstImage = images.length ? safeImage(images[0]) : '/images/placeholder.svg';
  card.innerHTML = `
    <div class="thumb">
      <img src="${firstImage}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async">
      <span class="soon-badge">${escapeHTML(t('shop.coming_title'))}</span>
    </div>
    <div class="body">
      <span class="cat">${escapeHTML(product.category || '')}</span>
      <h3 class="name">${escapeHTML(product.name)}</h3>
      <div class="foot">
        <span class="price">${formatTHB(effectivePrice(product))}</span>
        <span class="coming-countdown" data-countdown="${escapeHTML(product.publish_at)}">
          ${escapeHTML(t('shop.coming_in'))} ${formatCountdown(product.publish_at)}
        </span>
      </div>
    </div>
  `;
  return card;
}

function renderPagination(el, total) {
  if (!el) return;
  const pages = Math.ceil(total / PRODUCTS_PER_PAGE);
  el.innerHTML = '';
  if (pages <= 1) return;
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentPage = i;
      const grid = document.getElementById('product-grid');
      const countEl = document.getElementById('product-count');
      loadProducts(grid, countEl, document.getElementById('product-search').value, activeCategory || null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    el.appendChild(btn);
  }
}

async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    window.location.href = '/shop';
    return;
  }

  try {
    const { data: product, error } = await state.supabase.from('products').select('*').eq('id', productId).single();

    if (error || !product) {
      notify(t('product.not_found'), 'error');
      return;
    }

    currentProduct = product;
    applyDocumentTitle(`${product.name}`);
    const seoImages = productImages(product);
    applyPageMeta({
      title: `${product.name} | ${state.storeSettings?.shop_name || 'ZenMarket'}`,
      description: (product.description || '').trim().slice(0, 160) || undefined,
      image: seoImages[0] ? safeImage(seoImages[0]) : state.storeSettings?.logo_url || undefined,
      type: 'product',
    });

    document.getElementById('product-title').textContent = product.name;
    const unitPrice = effectivePrice(product);
    document.getElementById('product-price').innerHTML = hasSalePrice(product)
      ? `${formatTHB(unitPrice)} <s class="price-was">${formatTHB(product.price)}</s>`
      : formatTHB(unitPrice);
    document.getElementById('product-cat').textContent = product.category || '';
    document.getElementById('product-stock').innerHTML = `
      <span class="${getStockStatusClass(product.stock)} font-medium">${getStockStatusText(product.stock)}</span>
    `;
    document.getElementById('product-description').textContent = product.description || t('product.no_description');

    const images = productImages(product);
    const mainImg = document.getElementById('main-product-img');
    const thumbs = document.getElementById('thumbnail-list');
    if (thumbs) thumbs.hidden = images.length < 2;
    if (images.length > 0) {
      mainImg.src = safeImage(images[0]);
      thumbs.innerHTML = '';
      images.forEach((img, idx) => {
        const thumb = document.createElement('img');
        thumb.src = safeImage(img);
        thumb.alt = `${product.name} ${idx + 1}`;
        if (idx === 0) thumb.classList.add('active');
        thumb.addEventListener('click', () => {
          mainImg.src = safeImage(img);
          thumbs.querySelectorAll('img').forEach((t) => t.classList.remove('active'));
          thumb.classList.add('active');
        });
        thumbs.appendChild(thumb);
      });
    }

    const qtyInput = document.getElementById('qty-input');
    bindOnce(document.getElementById('qty-decrease'), 'click', () => {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value) || 1) - 1);
    });
    bindOnce(document.getElementById('qty-increase'), 'click', () => {
      qtyInput.value = Math.min(product.stock, (parseInt(qtyInput.value) || 1) + 1);
    });

    bindOnce(document.getElementById('add-to-cart-btn'), 'click', () => {
      const qty = parseInt(qtyInput.value) || 1;
      addToCart(product, qty);
      updateCartBadge();
      notify(t('product.added_to_cart', { name: product.name }), 'success');
    });

    const favBtn = document.getElementById('product-favorite-btn');
    const favLabel = document.getElementById('product-favorite-label');
    const paintFavorite = (active) => {
      if (!favBtn) return;
      favBtn.classList.toggle('active', active);
      favBtn.style.color = active ? '#dc2626' : '';
      if (favLabel) favLabel.textContent = t(active ? 'product.favorite_remove' : 'product.favorite_add');
    };
    paintFavorite(isFavorite(product.id));
    if (favBtn) {
      favBtn.addEventListener('click', async () => {
        if (!canUseFavorites()) {
          notify(t('toast.login_required'), 'warning');
          sessionStorage.setItem('zenmarket_return_path', window.location.pathname + window.location.search);
          setTimeout(() => {
            window.location.href = '/auth/login';
          }, 900);
          return;
        }
        const result = await toggleFavorite(product.id);
        if (result !== null) paintFavorite(result);
      });
    }

    bindOnce(document.getElementById('buy-now-btn'), 'click', () => {
      if (!requireMemberForOrder()) return;
      const qty = parseInt(qtyInput.value) || 1;
      addToCart(product, qty);
      updateCartBadge();
      window.location.href = '/shop/checkout';
    });

    const { data: reviews } = await state.supabase
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    const reviewsList = document.getElementById('reviews-list');
    reviewsList.innerHTML = '';
    if (!reviews || reviews.length === 0) {
      reviewsList.innerHTML = `<p class="text-muted text-sm">${t('product.no_reviews')}</p>`;
    } else {
      reviews.forEach((review) => {
        const el = document.createElement('div');
        el.className = 'review-card';
        el.innerHTML = `
          ${ratingStars(review.rating)}
          <blockquote>“${escapeHTML(review.comment || '')}”</blockquote>
          <div class="who">— ${escapeHTML(review.reviewer_name || t('common.customer'))}</div>
        `;
        reviewsList.appendChild(el);
      });
    }

    const { data: related } = await state.supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .eq('category', product.category)
      .neq('id', productId)
      .limit(4);

    const relatedGrid = document.getElementById('related-grid');
    relatedGrid.innerHTML = '';
    related?.forEach((p) => relatedGrid.appendChild(createProductCard(p)));
    observeRevealsLocal(relatedGrid);
  } catch (err) {
    console.error(err);
    notify(t('shop.load_error'), 'error');
  }
}
