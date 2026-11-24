/**
 * ZenMarket Store — หน้าร้าน / หมวดหมู่ / รายละเอียดสินค้า
 * ใช้ schema จริง: products(stock, active, category, image_url/image_urls)
 */

import { initApp, state, addToCart, updateCartBadge, requireSupabase } from '/src/app.js';
import { translatePage } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import { formatTHB, safeImage, escapeHTML } from '/src/core/lib.js';
import { getStockStatusText, getStockStatusClass } from '/src/core/customer.js';
import { observeReveals } from '/src/core/reveal.js';

let currentProduct = null;
let currentPage = 1;
const PRODUCTS_PER_PAGE = 12;
const productCache = new Map();

// ปุ่ม "หยิบใส่ตะกร้า" ในการ์ดสินค้า (ส่งผ่าน event กลางจาก app.js)
window.addEventListener('zenmarket:add-to-cart', async (e) => {
  const productId = e.detail?.productId;
  if (!productId) return;

  let product = productCache.get(productId);
  if (!product) {
    const { data } = await state.supabase.from('products').select('*').eq('id', productId).maybeSingle();
    product = data;
    if (product) productCache.set(productId, product);
  }
  if (!product) {
    notify('ไม่พบสินค้า', 'error');
    return;
  }
  if (!product.active || product.stock <= 0) {
    notify('สินค้านี้หมดชั่วคราว', 'warning');
    return;
  }
  addToCart(product, 1);
  updateCartBadge();
  notify(`เพิ่ม "${product.name}" ลงในตะกร้าแล้ว`, 'success');
});

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  translatePage();

  if (!requireSupabase()) return;

  const path = window.location.pathname;

  if (path.includes('/shop/index.html') || path === '/shop') {
    initStorePage();
  } else if (path.includes('/shop/categories.html')) {
    initCategoriesPage();
  } else if (path.includes('/shop/product.html')) {
    initProductPage();
  }
});

function productImages(product) {
  const urls = [];
  if (Array.isArray(product.image_urls)) urls.push(...product.image_urls.filter(Boolean));
  if (product.image_url) urls.unshift(product.image_url);
  return [...new Set(urls)];
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'card product-card reveal';
  const images = productImages(product);
  const firstImage = images.length ? safeImage(images[0]) : '/images/placeholder.svg';
  const stockStatus = getStockStatusText(product.stock);
  const stockClass = getStockStatusClass(product.stock);
  productCache.set(product.id, product);

  card.innerHTML = `
    <div class="thumb">
      <img src="${firstImage}" alt="${escapeHTML(product.name)}" loading="lazy">
      <button class="btn btn-primary btn-sm quick-add" data-add-to-cart="${product.id}">หยิบใส่ตะกร้า</button>
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
    window.location.href = `/shop/product.html?id=${product.id}`;
  });

  return card;
}

function observeRevealsLocal(container) {
  observeReveals(container);
}

function showSkeletons(grid, n = 8) {
  grid.innerHTML = Array.from({ length: n }, () =>
    '<div class="card"><div class="skeleton" style="aspect-ratio:4/5"></div><div style="padding:1rem"><div class="skeleton" style="height:14px;width:60%;margin-bottom:8px"></div><div class="skeleton" style="height:18px;width:40%"></div></div></div>'
  ).join('');
}

/* ================= หน้าร้าน ================= */
async function initStorePage() {
  const grid = document.getElementById('product-grid');
  const countEl = document.getElementById('product-count');
  const searchInput = document.getElementById('product-search');
  const categorySelect = document.getElementById('category-filter');
  if (!grid) return;

  showSkeletons(grid);

  // โหลดหมวดหมู่จากตาราง categories
  try {
    const { data: categories } = await state.supabase
      .from('categories')
      .select('name')
      .order('name');
    categorySelect.innerHTML = '<option value="">ทุกหมวดหมู่</option>';
    categories?.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      categorySelect.appendChild(opt);
    });
  } catch {}

  // รองรับ ?category= จากหน้าหมวดหมู่
  const params = new URLSearchParams(window.location.search);
  const presetCat = params.get('category');
  if (presetCat) categorySelect.value = presetCat;

  await loadProducts(grid, countEl, searchInput.value, categorySelect.value || null);

  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentPage = 1;
      loadProducts(grid, countEl, searchInput.value, categorySelect.value || null);
    }, 300);
  });

  categorySelect.addEventListener('change', () => {
    currentPage = 1;
    loadProducts(grid, countEl, searchInput.value, categorySelect.value || null);
  });
}

async function loadProducts(grid, countEl, search = '', category = null) {
  let query = state.supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('active', true);

  if (category) query = query.eq('category', category);
  if (search) query = query.ilike('name', `%${search}%`);

  const from = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const to = from + PRODUCTS_PER_PAGE - 1;
  query = query.range(from, to).order('created_at', { ascending: false });

  const { data: products, error, count } = await query;

  if (error) {
    notify('เกิดข้อผิดพลาดในการโหลดสินค้า', 'error');
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</div>';
    return;
  }

  countEl.textContent = `พบสินค้า ${count || 0} รายการ`;
  grid.innerHTML = '';

  if (!products || products.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <p>ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
    </div>`;
    renderPagination(document.getElementById('pagination'), 0);
    return;
  }

  products.forEach(product => grid.appendChild(createProductCard(product)));
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
      loadProducts(grid, countEl, document.getElementById('product-search').value, document.getElementById('category-filter').value || null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    el.appendChild(btn);
  }
}

/* ================= หมวดหมู่ ================= */
async function initCategoriesPage() {
  const grid = document.getElementById('categories-grid');
  const featuredGrid = document.getElementById('featured-grid');
  if (!grid) return;

  try {
    const { data: categories } = await state.supabase
      .from('categories')
      .select('*')
      .order('name');

    grid.innerHTML = '';
    categories?.forEach((cat, idx) => {
      const a = document.createElement('a');
      a.className = 'cat-card reveal';
      a.href = `/shop/index.html?category=${encodeURIComponent(cat.name)}`;
      a.innerHTML = `
        <span class="idx">${String(idx + 1).padStart(2, '0')}</span>
        <h3>${escapeHTML(cat.name)}</h3>
        <p>ดูสินค้าในหมวดหมู่นี้</p>
        <span class="go">ดูสินค้า
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
    featured?.forEach(product => featuredGrid.appendChild(createProductCard(product)));
    observeRevealsLocal(featuredGrid);
  } catch (err) {
    notify('ไม่สามารถโหลดหมวดหมู่ได้', 'error');
  }
}

/* ================= รายละเอียดสินค้า ================= */
async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    window.location.href = '/shop/index.html';
    return;
  }

  try {
    const { data: product, error } = await state.supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !product) {
      notify('ไม่พบสินค้าที่ระบุ', 'error');
      return;
    }

    currentProduct = product;
    document.title = `${product.name} - ZenMarket`;

    document.getElementById('product-title').textContent = product.name;
    document.getElementById('product-price').textContent = formatTHB(product.price);
    document.getElementById('product-cat').textContent = product.category || '';
    document.getElementById('product-stock').innerHTML = `
      <span class="${getStockStatusClass(product.stock)} font-medium">${getStockStatusText(product.stock)}</span>
    `;
    document.getElementById('product-description').textContent = product.description || 'ไม่มีรายละเอียดสินค้า';

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
          thumbs.querySelectorAll('img').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
        });
        thumbs.appendChild(thumb);
      });
    }

    const qtyInput = document.getElementById('qty-input');
    document.getElementById('qty-decrease').addEventListener('click', () => {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value) || 1) - 1);
    });
    document.getElementById('qty-increase').addEventListener('click', () => {
      qtyInput.value = Math.min(product.stock, (parseInt(qtyInput.value) || 1) + 1);
    });

    document.getElementById('add-to-cart-btn').addEventListener('click', () => {
      const qty = parseInt(qtyInput.value) || 1;
      addToCart(product, qty);
      updateCartBadge();
      notify(`เพิ่ม "${product.name}" ลงในตะกร้าแล้ว`, 'success');
    });

    document.getElementById('buy-now-btn').addEventListener('click', () => {
      const qty = parseInt(qtyInput.value) || 1;
      addToCart(product, qty);
      updateCartBadge();
      window.location.href = '/shop/checkout.html';
    });

    // รีวิวจาก product_reviews
    const { data: reviews } = await state.supabase
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    const reviewsList = document.getElementById('reviews-list');
    reviewsList.innerHTML = '';
    if (!reviews || reviews.length === 0) {
      reviewsList.innerHTML = '<p class="text-muted text-sm">ยังไม่มีรีวิวสำหรับสินค้านี้</p>';
    } else {
      reviews.forEach(review => {
        const el = document.createElement('div');
        el.className = 'review-card';
        el.innerHTML = `
          <div class="stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
          <blockquote>“${escapeHTML(review.comment || '')}”</blockquote>
          <div class="who">— ${escapeHTML(review.reviewer_name || 'ลูกค้า')}</div>
        `;
        reviewsList.appendChild(el);
      });
    }

    // สินค้าที่เกี่ยวข้อง (หมวดเดียวกัน)
    const { data: related } = await state.supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .eq('category', product.category)
      .neq('id', productId)
      .limit(4);

    const relatedGrid = document.getElementById('related-grid');
    relatedGrid.innerHTML = '';
    related?.forEach(p => relatedGrid.appendChild(createProductCard(p)));
    observeRevealsLocal(relatedGrid);
  } catch (err) {
    console.error(err);
    notify('เกิดข้อผิดพลาดในการโหลดสินค้า', 'error');
  }
}
