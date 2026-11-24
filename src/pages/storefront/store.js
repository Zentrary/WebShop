import {
  initApp,
  state,
  addToCart,
  updateCartBadge,
  requireSupabase,
  renderGuestGate,
  applyMemberGating,
} from '/src/app.js';
import { isSignedIn } from '/src/core/audience.js';
import { translatePage } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import { formatTHB, safeImage, escapeHTML, bindOnce } from '/src/core/lib.js';
import { getStockStatusText, getStockStatusClass } from '/src/core/customer.js';
import { observeReveals } from '/src/core/reveal.js';
import { loadFavorites, toggleFavorite, isFavorite, canUseFavorites } from '/src/core/favorites.js';
import { t, applyDocumentTitle, onLanguageChange } from '/src/core/i18n.js';

let currentProduct = null;
let currentPage = 1;
const PRODUCTS_PER_PAGE = 12;
const productCache = new Map();

let currentRenderer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  translatePage();

  if (!requireSupabase()) return;

  const path = window.location.pathname;

  if (!isSignedIn()) {
    sessionStorage.setItem('zenmarket_return_path', path + window.location.search);
    const gate = document.getElementById('shop-gate');
    const content = document.getElementById('shop-content');
    if (content) content.classList.add('hidden');
    if (gate) {
      renderGuestGate('shop-gate');
      applyMemberGating(gate);
    }
    return;
  }

  await loadFavorites();

  if (path.includes('/shop/index.html') || path === '/shop') {
    currentRenderer = initStorePage;
  } else if (path.includes('/shop/categories.html')) {
    currentRenderer = initCategoriesPage;
  } else if (path.includes('/shop/product.html')) {
    currentRenderer = initProductPage;
  }

  if (currentRenderer) await currentRenderer();

  onLanguageChange(() => {
    translatePage();
    if (currentRenderer) currentRenderer();
  });
});

function productImages(product) {
  const urls = [];
  if (Array.isArray(product.image_urls)) urls.push(...product.image_urls.filter(Boolean));
  if (product.image_url) urls.unshift(product.image_url);
  return [...new Set(urls)];
}

const HEART_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.7-7.8 1.1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>';

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'card product-card reveal';
  const images = productImages(product);
  const firstImage = images.length ? safeImage(images[0]) : '/images/placeholder.svg';
  const stockStatus = getStockStatusText(product.stock);
  const stockClass = getStockStatusClass(product.stock);
  productCache.set(product.id, product);

  const favActive = isFavorite(product.id);
  card.innerHTML = `
    <div class="thumb">
      <img src="${firstImage}" alt="${escapeHTML(product.name)}" loading="lazy">
      <button class="favorite-btn ${favActive ? 'active' : ''}" data-favorite="${product.id}"
        title="${t(favActive ? 'product.favorite_remove' : 'product.favorite_add')}"
        aria-label="${t(favActive ? 'product.favorite_remove' : 'product.favorite_add')}">${HEART_SVG}</button>
      <button class="btn btn-primary btn-sm quick-add" data-add-to-cart="${product.id}">${t('product.add_to_cart')}</button>
    </div>
    <div class="body">
      <span class="cat">${escapeHTML(product.category || '')}</span>
      <h3 class="name">${escapeHTML(product.name)}</h3>
      <div class="foot">
        <span class="price">${formatTHB(product.price)}</span>
        <span class="stock-tag ${stockClass}">${stockStatus}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-to-cart]')) return;
    const favBtn = e.target.closest('[data-favorite]');
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      handleFavoriteClick(favBtn, product.id);
      return;
    }
    window.location.href = `/shop/product.html?id=${product.id}`;
  });

  return card;
}

async function handleFavoriteClick(button, productId) {
  if (!canUseFavorites()) {
    notify(t('toast.login_required'), 'warning');
    sessionStorage.setItem('zenmarket_return_path', window.location.pathname + window.location.search);
    setTimeout(() => {
      window.location.href = '/auth/login.html';
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
  const categorySelect = document.getElementById('category-filter');
  if (!grid) return;

  showSkeletons(grid);

  try {
    const { data: categories } = await state.supabase.from('categories').select('name').order('name');
    categorySelect.innerHTML = `<option value="">${t('shop.filter_all')}</option>`;
    categories?.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      categorySelect.appendChild(opt);
    });
  } catch {}

  const params = new URLSearchParams(window.location.search);
  const presetCat = params.get('category');
  if (presetCat) categorySelect.value = presetCat;

  await loadProducts(grid, countEl, searchInput.value, categorySelect.value || null);

  let debounce;
  bindOnce(searchInput, 'input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentPage = 1;
      loadProducts(grid, countEl, searchInput.value, categorySelect.value || null);
    }, 300);
  });

  bindOnce(categorySelect, 'change', () => {
    currentPage = 1;
    loadProducts(grid, countEl, searchInput.value, categorySelect.value || null);
  });
}

async function loadProducts(grid, countEl, search = '', category = null) {
  let query = state.supabase.from('products').select('*', { count: 'exact' }).eq('active', true);

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
      loadProducts(
        grid,
        countEl,
        document.getElementById('product-search').value,
        document.getElementById('category-filter').value || null,
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    el.appendChild(btn);
  }
}

async function initCategoriesPage() {
  const grid = document.getElementById('categories-grid');
  const featuredGrid = document.getElementById('featured-grid');
  if (!grid) return;

  try {
    const { data: categories } = await state.supabase.from('categories').select('*').order('name');

    grid.innerHTML = '';
    categories?.forEach((cat, idx) => {
      const a = document.createElement('a');
      a.className = 'cat-card reveal';
      a.href = `/shop/index.html?category=${encodeURIComponent(cat.name)}`;
      a.innerHTML = `
        <span class="idx">${String(idx + 1).padStart(2, '0')}</span>
        <h3>${escapeHTML(cat.name)}</h3>
        <p>${t('shop.cat_view')}</p>
        <span class="go">${t('shop.cat_view')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </span>
      `;
      grid.appendChild(a);
    });
    observeRevealsLocal(grid);

    const { data: featured } = await state.supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(8);

    featuredGrid.innerHTML = '';
    featured?.forEach((product) => featuredGrid.appendChild(createProductCard(product)));
    observeRevealsLocal(featuredGrid);
  } catch (err) {
    notify(t('shop.categories_error'), 'error');
  }
}

async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    window.location.href = '/shop/index.html';
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

    document.getElementById('product-title').textContent = product.name;
    document.getElementById('product-price').textContent = formatTHB(product.price);
    document.getElementById('product-cat').textContent = product.category || '';
    document.getElementById('product-stock').innerHTML = `
      <span class="${getStockStatusClass(product.stock)} font-medium">${getStockStatusText(product.stock)}</span>
    `;
    document.getElementById('product-description').textContent = product.description || t('product.no_description');

    const images = productImages(product);
    const mainImg = document.getElementById('main-product-img');
    const thumbs = document.getElementById('thumbnail-list');
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
            window.location.href = '/auth/login.html';
          }, 900);
          return;
        }
        const result = await toggleFavorite(product.id);
        if (result !== null) paintFavorite(result);
      });
    }

    bindOnce(document.getElementById('buy-now-btn'), 'click', () => {
      const qty = parseInt(qtyInput.value) || 1;
      addToCart(product, qty);
      updateCartBadge();
      window.location.href = '/shop/checkout.html';
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
          <div class="stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
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
