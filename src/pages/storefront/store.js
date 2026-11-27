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
  formatDate,
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
/** ตัวเรียงลำดับที่เลือกอยู่: newest | price_asc | price_desc */
let activeSort = 'newest';
/** กรองเฉพาะสินค้าที่มีราคาโปรโมชั่น */
let onlyPromo = false;
const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc'];
/** listener ระดับ document ของแผงหมวดหมู่ ผูกครั้งเดียวพอ (สลับภาษาจะ init หน้าใหม่) */
let shopPanelDocBound = false;
const PRODUCTS_PER_PAGE = 12;
const productCache = new Map();
/** หมวด "สินค้าใหม่" เป็นของระบบ ไม่ได้อยู่ในตาราง categories */
const NEW_CATEGORY = '__new';
const NEW_DEFAULT_DAYS = 7;

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
 * "ใหม่" = ยังไม่พ้นเวลาที่ตั้งไว้ (products.new_until ที่ฐานข้อมูลคำนวณให้จาก
 * created_at + new_days) ครบกำหนดแล้วสินค้าจะหลุดจากหมวด "ใหม่"
 * แล้วกลับไปอยู่หมวดจริงของมันเองโดยอัตโนมัติ
 */
function isNewArrival(product) {
  if (product.new_until) return new Date(product.new_until).getTime() > Date.now();
  const stamp = product.created_at;
  if (!stamp) return false;
  const days = Number.isFinite(Number(product.new_days)) ? Number(product.new_days) : NEW_DEFAULT_DAYS;
  return new Date(stamp).getTime() + days * 24 * 60 * 60 * 1000 > Date.now();
}

/** วันที่โพสต์แบบสั้นตามที่ร้านขอ: 24/11/2569 (ไม่ต้องมีเวลา) */
function formatPostDate(product) {
  return formatDate(product.created_at);
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
      <span class="posted">${escapeHTML(formatPostDate(product))}</span>
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

  // อ่านค่าจาก URL (?category= / ?sort= / ?promo=1) เพื่อให้ลิงก์แชร์กันได้
  const params = new URLSearchParams(window.location.search);
  const presetCat = params.get('category');
  if (presetCat) activeCategory = presetCat;
  const presetSort = params.get('sort');
  activeSort = SORT_OPTIONS.includes(presetSort) ? presetSort : 'newest';
  onlyPromo = params.get('promo') === '1';
  if (presetCat || params.get('q')) currentPage = 1;
  if (params.get('q') && searchInput) searchInput.value = params.get('q');

  const refresh = () => {
    syncShopUrl(searchInput?.value || '');
    paintFilterState();
    loadProducts(grid, countEl, searchInput.value, activeCategory || null);
  };

  // ---------- แถบตัวกรอง ----------
  const categoryToggle = document.getElementById('category-toggle');
  const categoryPanel = document.getElementById('category-panel');
  const categorySearch = document.getElementById('category-search');
  const sortSelect = document.getElementById('sort-select');
  const promoBtn = document.getElementById('promo-toggle');
  const resetBtn = document.getElementById('filter-reset');

  /** ปุ่ม "เรียงตาม" โชว์ค่าที่เลือก (select ตัวจริงโปร่งใสอยู่ข้างหลัง) */
  function paintSortLabel() {
    const el = document.getElementById('sort-current');
    if (!el) return;
    const option = sortSelect?.selectedOptions?.[0];
    el.textContent = (option?.textContent || t('shop.sort_newest')).trim();
    el.classList.toggle('is-filtered', activeSort !== 'newest');
  }

  if (sortSelect) sortSelect.value = activeSort;
  if (promoBtn) promoBtn.setAttribute('aria-pressed', onlyPromo ? 'true' : 'false');

  /** อัปเดตข้อความบนปุ่ม/ป้ายให้ตรงกับตัวกรองที่ใช้อยู่ และโชว์ปุ่ม "ล้างตัวกรอง" เมื่อจำเป็น */
  function paintFilterState() {
    const currentEl = document.getElementById('category-current');
    const label = activeCategory === NEW_CATEGORY ? t('shop.new_chip') : activeCategory || t('shop.filter_all');
    if (currentEl) {
      currentEl.textContent = label;
      currentEl.classList.toggle('is-filtered', !!activeCategory);
    }
    if (categoryToggle) categoryToggle.classList.toggle('is-active', !!activeCategory);
    paintSortLabel();
    if (promoBtn) {
      promoBtn.classList.toggle('active', onlyPromo);
      promoBtn.setAttribute('aria-pressed', onlyPromo ? 'true' : 'false');
    }
    if (resetBtn) {
      const dirty = !!activeCategory || onlyPromo || activeSort !== 'newest' || !!searchInput?.value.trim();
      resetBtn.hidden = !dirty;
    }
  }

  const categoryEmpty = document.getElementById('category-empty');

  function resetCategorySearch() {
    if (!categorySearch || !categorySearch.value) return;
    categorySearch.value = '';
    chipsEl?.querySelectorAll('.category-chip').forEach((chip) => {
      chip.hidden = false;
    });
    if (categoryEmpty) categoryEmpty.hidden = true;
  }

  function setPanel(open) {
    if (!categoryPanel || !categoryToggle) return;
    categoryPanel.hidden = !open;
    categoryToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    categoryToggle.classList.toggle('is-open', open);
    if (!open) resetCategorySearch();
    if (open && categorySearch && categories.length > 6) {
      requestAnimationFrame(() => categorySearch.focus({ preventScroll: true }));
    }
  }

  renderCategoryChips(chipsEl, categories, {
    onSelect: () => {
      setPanel(false);
      categoryToggle?.focus({ preventScroll: true });
      currentPage = 1;
      refresh();
    },
  });

  if (categoryCountEl) {
    categoryCountEl.textContent = categories.length
      ? t('shop.categories_count', { n: categories.length })
      : t('shop.no_categories');
  }

  if (categoryToggle) {
    bindOnce(categoryToggle, 'click', (e) => {
      e.stopPropagation();
      setPanel(categoryPanel?.hidden !== false);
    });
  }
  if (categorySearch) {
    bindOnce(categorySearch, 'input', () => {
      const term = categorySearch.value.trim().toLowerCase();
      let shown = 0;
      chipsEl?.querySelectorAll('.category-chip').forEach((chip) => {
        chip.hidden = !!term && !chip.textContent.toLowerCase().includes(term);
        if (!chip.hidden) shown += 1;
      });
      // ค้นหาในแผงแล้วไม่เจอ ต้องบอก ไม่ใช่ปล่อยว่างเปล่า
      if (categoryEmpty) categoryEmpty.hidden = !term || shown > 0;
    });
    bindOnce(categorySearch, 'keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPanel(false);
        categoryToggle?.focus({ preventScroll: true });
      }
    });
  }
  // ปิดแผงเมื่อคลิกข้างนอก หรือกด Escape (ผูกครั้งเดียวต่อการโหลดหน้า
  // — สลับภาษาจะเรียก initStorePage ซ้ำ ไม่ควรผูก listener ซ้ำ)
  if (!shopPanelDocBound) {
    shopPanelDocBound = true;
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('category-panel');
      const toggle = document.getElementById('category-toggle');
      if (!panel || panel.hidden) return;
      if (panel.contains(e.target) || toggle?.contains(e.target)) return;
      panel.hidden = true;
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.classList.remove('is-open');
    });
    document.addEventListener('keydown', (e) => {
      const panel = document.getElementById('category-panel');
      if (e.key !== 'Escape' || !panel || panel.hidden) return;
      panel.hidden = true;
      const toggle = document.getElementById('category-toggle');
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.classList.remove('is-open');
      toggle?.focus({ preventScroll: true });
    });
  }

  if (sortSelect) {
    bindOnce(sortSelect, 'change', () => {
      activeSort = SORT_OPTIONS.includes(sortSelect.value) ? sortSelect.value : 'newest';
      currentPage = 1;
      paintSortLabel();
      refresh();
    });
    // แตะที่คำว่า "เรียงตาม" หรือไอคอนลูกศรก็ควรเปิดรายการ ไม่ใช่ต้องเล็งที่ตัวอักษร select
    const sortWrap = sortSelect.closest('.filter-btn-select');
    if (sortWrap) {
      bindOnce(sortWrap, 'click', (e) => {
        if (e.target === sortSelect) return;
        sortSelect.focus({ preventScroll: true });
        if (typeof sortSelect.showPicker === 'function') {
          try {
            sortSelect.showPicker();
          } catch {
            /* เบราว์เซอร์บางตัวไม่อนุญาตให้เรียกนอกเหตุการณ์ผู้ใช้ */
          }
        }
      });
    }
  }

  if (promoBtn) {
    bindOnce(promoBtn, 'click', () => {
      onlyPromo = !onlyPromo;
      currentPage = 1;
      refresh();
    });
  }

  if (resetBtn) {
    bindOnce(resetBtn, 'click', () => {
      activeCategory = '';
      activeSort = 'newest';
      onlyPromo = false;
      currentPage = 1;
      if (sortSelect) sortSelect.value = 'newest';
      if (searchInput) searchInput.value = '';
      if (categorySearch) categorySearch.value = '';
      chipsEl?.querySelectorAll('.category-chip').forEach((chip) => {
        chip.hidden = false;
      });
      if (categoryEmpty) categoryEmpty.hidden = true;
      paintFilterState();
      syncShopUrl('');
      loadProducts(grid, countEl, '', null);
    });
  }

  paintFilterState();
  await loadProducts(grid, countEl, searchInput.value, activeCategory || null);

  let debounce;
  bindOnce(searchInput, 'input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentPage = 1;
      paintFilterState();
      syncShopUrl(searchInput.value);
      loadProducts(grid, countEl, searchInput.value, activeCategory || null);
    }, 300);
  });
}

/** เขียนตัวกรองลง URL เพื่อแชร์/กดย้อนกลับได้ (ไม่โหลดหน้าใหม่) */
function syncShopUrl(search = '') {
  try {
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key, value) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete('category', activeCategory || '');
    setOrDelete('sort', activeSort === 'newest' ? '' : activeSort);
    setOrDelete('promo', onlyPromo ? '1' : '');
    setOrDelete('q', search.trim());
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState({}, '', next);
  } catch {
    /* ไม่เป็นไรถ้าเขียน URL ไม่ได้ */
  }
}

/**
 * รายการหมวดหมู่ในแผง dropdown — แสดงทีละบรรทัด มีเครื่องหมายถูกที่ตัวที่เลือกอยู่
 * (เดิมวางเป็นชิปเรียงกันเต็มหน้า พอมี 30-40 หมวดก็รกและยาวไม่เท่ากัน)
 */
function renderCategoryChips(container, categories, { onSelect } = {}) {
  if (!container) return;

  container.innerHTML = '';

  const addChip = (value, label, hint = '') => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'category-chip';
    chip.setAttribute('role', 'option');
    const selected = activeCategory === value;
    chip.classList.toggle('active', selected);
    chip.setAttribute('aria-selected', selected ? 'true' : 'false');
    if (hint) chip.title = hint;

    const check = document.createElement('span');
    check.className = 'chip-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const text = document.createElement('span');
    text.className = 'chip-label';
    text.textContent = label;

    chip.append(text, check);
    chip.addEventListener('click', () => {
      activeCategory = value;
      currentPage = 1;
      container.querySelectorAll('.category-chip').forEach((el) => {
        const isActive = el === chip;
        el.classList.toggle('active', isActive);
        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      onSelect?.(value);
    });
    container.appendChild(chip);
  };

  addChip('', t('shop.filter_all'));
  addChip(NEW_CATEGORY, t('shop.new_chip'), t('shop.new_chip_hint'));
  categories.forEach((cat) => addChip(cat.name, cat.name));
}

async function loadProducts(grid, countEl, search = '', category = null) {
  const nowIso = new Date().toISOString();
  let query = state.supabase.from('products').select('*', { count: 'exact' }).eq('active', true);

  if (category === NEW_CATEGORY) query = query.gt('new_until', nowIso);
  else if (category) query = query.eq('category', category);
  if (search) query = query.ilike('name', `%${search}%`);
  // คอลัมน์ generated ในฐานข้อมูล: effective_price = ราคาที่ลูกค้าเห็นจริง, on_sale = มีโปร
  if (onlyPromo) query = query.eq('on_sale', true);

  const from = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const to = from + PRODUCTS_PER_PAGE - 1;
  query = query.range(from, to);
  if (activeSort === 'price_asc') query = query.order('effective_price', { ascending: true }).order('name');
  else if (activeSort === 'price_desc') query = query.order('effective_price', { ascending: false }).order('name');
  else query = query.order('created_at', { ascending: false });

  const { data: products, error, count } = await query;

  if (error) {
    notify(t('shop.load_error'), 'error');
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${escapeHTML(t('shop.load_failed'))}</div>`;
    return;
  }

  countEl.textContent = t('shop.count', { n: count || 0 });
  grid.innerHTML = '';

  if (!products || products.length === 0) {
    // บอกให้ตรงสาเหตุ: กรองเฉพาะลดราคาอยู่ / หมวด "สินค้าใหม่" / ค้นหาไม่เจอ
    let emptyTitle = t('shop.empty');
    let emptyHint = t('shop.empty_hint');
    if (onlyPromo) {
      emptyTitle = t('shop.empty_promo');
      emptyHint = t('shop.empty_promo_hint');
    } else if (category === NEW_CATEGORY) {
      emptyTitle = t('shop.empty_new');
      emptyHint = t('shop.empty_new_hint');
    } else if (search) {
      emptyTitle = t('shop.empty_search');
      emptyHint = t('shop.empty_search_hint');
    }
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <p>${emptyTitle}</p>
      <p class="text-muted text-sm">${emptyHint}</p>
    </div>`;
    renderPagination(document.getElementById('pagination'), 0);
    return;
  }

  products.forEach((product) => grid.appendChild(createProductCard(product)));
  observeRevealsLocal(grid);
  renderPagination(document.getElementById('pagination'), count || 0);
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
