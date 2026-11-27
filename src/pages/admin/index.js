import { isOwner, setAudience } from '/src/core/audience.js';
import { askText, confirmAction, formSheet, notify } from '/src/core/ui.js';
import {
  formatTHB,
  escapeHTML,
  createPromptPayPayload,
  createPromptPayQRDataURL,
  getPrivateImageUrl,
  bindOnce,
  ratingStars,
  formatDate,
  formatDateTime,
} from '/src/core/lib.js';
import { validateSocialUrl, getOrderStatusBadge } from '/src/core/experience.js';
import { normalizePath } from '/src/core/routes.js';
import { initReveal } from '/src/core/reveal.js';
import { promptPayCardHTML, promptPayCardDataURL } from '/src/core/payment.js';
import { initAdminLayout } from '/src/pages/admin/layout.js';
import { initI18n, t, translatePage, onLanguageChange, getLanguage } from '/src/core/i18n.js';
import {
  uploadStoreLogo,
  removeStoreLogo,
  uploadShippingImage,
  uploadProductImage,
  publicAssetUrl,
  BUCKETS,
  LOGO_ACCEPT,
} from '/src/core/storage.js';
import { reportClientError } from '/src/core/errors.js';
import { fillCarrierSelect, detectCarrier } from '/src/core/carriers.js';
import { mergeStoreSettings } from '/src/core/settings.js';
import { validateStoreSettings, validateProduct, validateCategory, validatePromptPay } from '/src/core/validation.js';
import { openImageEditor, hasImageEditor } from '/src/pages/admin/image-editor.js';
import { dHash, urlToImage } from '/src/core/image.js';
import {
  loadProductIndex,
  detectDuplicates,
  bestImageMatch,
  normalizeName,
  normalizeSku,
} from '/src/core/duplicates.js';

let supabase;

document.addEventListener('DOMContentLoaded', async () => {
  initI18n();
  translatePage();

  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

  let allowed = isOwner();
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (sessionUser) {
      const { data: adminRow } = await supabase
        .from('store_admin')
        .select('user_id')
        .eq('user_id', sessionUser.id)
        .maybeSingle();
      if (adminRow) {
        setAudience('owner', { id: sessionUser.id, email: sessionUser.email });
        allowed = true;
      }
    }
  } catch (err) {
    console.warn('[ZenMarket] admin auth check failed', err);
  }

  if (!allowed) {
    window.location.href = '/admin/login';
    return;
  }

  // ใช้ path แบบ clean URL: /admin/orders กับ /admin/order ต้องแยกกันให้ชัด
  const path = normalizePath(window.location.pathname);
  const active =
    {
      '/admin/dashboard': '/admin/dashboard',
      '/admin/products': '/admin/products',
      '/admin/categories': '/admin/categories',
      '/admin/reviews': '/admin/reviews',
      '/admin/settings': '/admin/settings',
      '/admin/payments': '/admin/payments',
      '/admin/operations': '/admin/operations',
      '/admin/coupons': '/admin/coupons',
      '/admin/reports': '/admin/reports',
      '/admin/order': '/admin/orders',
      '/admin/orders': '/admin/orders',
    }[path] || '/admin/dashboard';

  let storeSettings = {};
  try {
    const { data: s } = await supabase.from('store_settings').select('*').eq('singleton', true).maybeSingle();
    storeSettings = mergeStoreSettings(s);
  } catch {}

  initAdminLayout(active, storeSettings);
  initReveal();

  let renderer = null;
  if (path === '/admin/dashboard') renderer = initDashboard;
  else if (path === '/admin/products') renderer = initProducts;
  else if (path === '/admin/categories') renderer = initCategories;
  else if (path === '/admin/reviews') renderer = initReviews;
  else if (path === '/admin/settings') renderer = initSettings;
  else if (path === '/admin/payments') renderer = initPayments;
  else if (path === '/admin/orders') renderer = initAdminOrders;
  else if (path === '/admin/order') renderer = initAdminOrderDetail;
  else if (path === '/admin/coupons') renderer = initCoupons;
  else if (path === '/admin/reports') renderer = initReports;

  if (renderer) await renderer();

  onLanguageChange(() => {
    translatePage();
    if (renderer) renderer();
  });
});

async function initDashboard() {
  try {
    const { data: d, error } = await supabase.rpc('get_admin_dashboard');
    if (error) throw error;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('kpi-sales', formatTHB(d.revenue || 0));
    set('kpi-pending', d.awaiting_review || 0);
    set('kpi-products', d.product_count || 0);
    set('kpi-rating', (d.average_rating || 0).toFixed(1));

    renderSalesChart(Array.isArray(d.daily_revenue) ? d.daily_revenue : []);

    // แจ้งเตือนสต็อกตามเกณฑ์ที่ร้านตั้งไว้ (ไม่ใช่ค่าคงที่ในโค้ด)
    const { data: cfg } = await supabase
      .from('store_settings')
      .select('low_stock_threshold')
      .eq('singleton', true)
      .maybeSingle();
    const threshold = Number(cfg?.low_stock_threshold ?? 5);

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .lte('stock', threshold)
      .order('stock', { ascending: true })
      .limit(8);
    const lowStockList = document.getElementById('low-stock-list');
    if (lowStockList) {
      lowStockList.innerHTML =
        products && products.length
          ? products
              .map(
                (p) => `
        <div class="flex justify-between items-center text-sm" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border-soft)">
          <span>${escapeHTML(p.name)}</span>
          <span class="${p.stock <= 0 ? 'text-danger' : 'text-warning'} font-bold">${
            p.stock <= 0 ? t('product.out_of_stock') : t('admin.low_stock_left', { n: p.stock })
          }</span>
        </div>
      `,
              )
              .join('')
          : `<p class="text-muted text-sm">${t('admin.low_stock_empty')}</p>`;
    }

    const { data: reviews } = await supabase
      .from('product_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    const recentReviews = document.getElementById('recent-reviews');
    if (recentReviews && reviews) {
      recentReviews.innerHTML =
        reviews
          .map(
            (r) => `
        <div style="padding:0.5rem 0;border-bottom:1px solid var(--color-border-soft)">
          <div>${ratingStars(r.rating, 12)}</div>
          <div class="text-sm">${escapeHTML(r.comment || '')} <span class="text-muted">— ${escapeHTML(r.reviewer_name || '')}</span></div>
        </div>
      `,
          )
          .join('') || `<p class="text-muted text-sm">${t('admin.no_reviews')}</p>`;
    }
  } catch (err) {
    console.error(err);
    notify(t('admin.system_error'), 'error');
  }
}

/**
 * Draws the "last 7 days" chart from the dashboard RPC payload.
 *
 * The chart draws itself with plain markup and CSS variables: a soft grid, one
 * column per day, a value label above every bar and the date underneath. When
 * the week has no sales at all it says so instead of showing seven flat bars.
 */
function renderSalesChart(days) {
  const chart = document.getElementById('sales-chart');
  const totalEl = document.getElementById('sales-chart-total');
  if (!chart) return;

  const rows = days.map((d) => ({ day: d.day, total: Number(d.total) || 0 }));
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const max = Math.max(...rows.map((r) => r.total), 0);
  const axisMax = niceAxisMax(max);

  if (totalEl) {
    if (!rows.length) totalEl.textContent = '';
    else if (!total) totalEl.textContent = t('admin.chart_no_data');
    else
      totalEl.textContent = t('admin.chart_summary', {
        total: formatTHB(total),
        avg: formatTHB(Math.round(total / rows.length)),
      });
  }

  if (!rows.length) {
    chart.innerHTML = `<div class="sales-chart-empty"><span>${t('admin.chart_no_data')}</span></div>`;
    return;
  }

  const todayKey = new Date().toLocaleDateString('sv-SE');
  const label = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(getLanguage() === 'th' ? 'th-TH' : 'en-GB', {
      day: 'numeric',
      month: 'short',
    });

  // ยอดขายเป็นศูนย์ทั้งสัปดาห์: ไม่ต้องมีแกนซ้ำสองบรรทัด "฿0" ให้รก
  const axis = axisMax
    ? `<div class="sales-chart-axis">
      <span>${formatTHB(axisMax)}</span>
      <span>฿0</span>
    </div>`
    : '';

  chart.classList.toggle('is-flat', !axisMax);
  chart.innerHTML = `
    ${axis}
    <div class="sales-chart-plot${axisMax ? '' : ' is-flat'}">
      ${rows
        .map((r, i) => {
          const height = axisMax ? Math.max(2, Math.round((r.total / axisMax) * 100)) : 2;
          const key = String(r.day).slice(0, 10);
          const classes = ['sales-day'];
          if (key === todayKey) classes.push('is-today');
          if (!r.total) classes.push('is-empty');
          // จอเล็กซ่อนป้ายวันที่ส่วนใหญ่ไว้ โชว์ทุกวันที่ 5 และวันนี้ แต่ถ้าป้ายวันนี้
          // ไปติดกับป้ายอื่น (ห่างกัน 1 วัน) ให้ซ่อนป้ายวันนี้ก่อน ป้ายจะได้ไม่ทับกัน
          const neighborLabeled = rows.some((rr, j) => j % 5 === 0 && Math.abs(j - i) === 1);
          if (i % 5 === 0 || (key === todayKey && !neighborLabeled)) classes.push('is-labeled');
          return `
        <div class="${classes.join(' ')}" style="--h:${height}%" title="${label(key)} — ${formatTHB(r.total)}">
          <span class="sales-value">${r.total ? formatTHB(r.total) : ''}</span>
          <span class="sales-bar"></span>
          <span class="sales-day-label">${label(key)}</span>
        </div>`;
        })
        .join('')}
    </div>
  `;
}

/** Rounds a maximum up to a friendly value so the axis shows round numbers. */
function niceAxisMax(value) {
  if (!value || value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => magnitude * s >= value) || 10;
  return magnitude * step;
}

/**
 * คำนวณลายนิ้วมือรูปจาก URL (ใช้กับรูปที่พิมพ์ URL เอง หรือรูปเก่าที่บันทึกไว้ก่อนมีระบบนี้)
 * ถ้ารูปต่างโดเมนและไม่มี CORS จะคืน '' แล้วข้ามไปเงียบ ๆ
 */
async function hashImageUrl(url) {
  if (!url) return '';
  try {
    const img = await urlToImage(url);
    return dHash(img);
  } catch {
    return '';
  }
}

/**
 * สินค้าที่ลงไว้ก่อนมีระบบตรวจรูปซ้ำจะยังไม่มีลายนิ้วมือ
 * เปิดหน้าสินค้าครั้งแรกจึงคำนวณให้ครั้งเดียวแล้วเก็บลงฐานข้อมูล
 * (ทำทีละรูป จำกัดจำนวน เพื่อไม่ให้ช้าหรือกินเน็ตตอนเปิดหน้า)
 */
async function backfillImageHashes(index, max = 30) {
  const targets = index.filter((item) => !item.hashes.length && item.imageUrl).slice(0, max);
  for (const item of targets) {
    const hash = await hashImageUrl(item.imageUrl);
    if (!hash) continue;
    try {
      const { error } = await supabase
        .from('products')
        .update({ image_hashes: [hash] })
        .eq('id', item.id);
      if (!error) item.hashes = [hash];
    } catch {
      /* เก็บไม่ได้ก็ยังตรวจรูปใหม่ได้ปกติ */
    }
  }
}

async function initProducts() {
  const tbody = document.getElementById('admin-products-list');
  const searchInput = document.getElementById('admin-product-search');
  const addBtn = document.getElementById('admin-add-product-btn');
  const form = document.getElementById('admin-product-form');
  const formTitle = document.getElementById('admin-product-form-title');
  const sheet = formSheet({
    dialog: document.getElementById('product-sheet'),
    form,
    titleEl: formTitle,
    subEl: document.getElementById('admin-product-form-sub'),
    closeBtn: document.getElementById('admin-product-close'),
  });
  let editingId = null;

  function renderStockCell(stock) {
    const qty = Number(stock) || 0;
    if (qty > 0) return `<span class="stock-qty">${qty}</span>`;
    return `<span class="badge badge-error">${t('admin.stock_out')}</span>`;
  }

  function renderStatusCell(p) {
    // สถานะของ "สินค้า" ใช้คำของร้าน (วางขาย/ซ่อน) ไม่ใช่คำกลาง ๆ ว่า "ใช้งาน"
    return `<span class="badge badge-${p.active ? 'success' : 'error'}">${
      p.active ? t('admin.product_on_sale') : t('admin.hidden')
    }</span>`;
  }

  /** บอกใต้ชื่อสินค้าว่า "ใหม่ถึง 26/11/2026" จะได้รู้ว่าอีกกี่วันจะกลับเข้าหมวด */
  function renderNewWindow(p) {
    if (!p.new_until) return '';
    const d = new Date(p.new_until);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return '';
    const date = formatDate(d);
    return `<span class="cell-sub">${escapeHTML(t('admin.new_until_label', { date }))}</span>`;
  }

  // แผงแก้ไขบังอยู่ข้างบนจอ: ข้อความ error ต้องอยู่ในแผงด้วย ไม่ใช่แค่ toast
  const formError = document.getElementById('product-form-error');
  const showFormError = (message) => {
    if (!formError) return;
    formError.textContent = message;
    formError.hidden = false;
  };
  const clearFormError = () => {
    if (!formError) return;
    formError.textContent = '';
    formError.hidden = true;
  };
  const focusField = (key) => {
    if (!key) return;
    const el = document.getElementById(`product-${key}`);
    if (el && typeof el.focus === 'function') el.focus({ preventScroll: false });
  };
  // แปลง error ของ Postgres/PostgREST เป็นข้อความที่ร้านอ่านรู้เรื่อง
  const productErrorMessage = (error) => {
    const code = String(error?.code || '');
    const text = String(error?.message || '');
    if (code === '23505' || /duplicate key|unique/i.test(text)) return t('admin.product_sku_duplicate');
    if (code === '23503' || /foreign key/i.test(text)) return t('admin.product_category_missing');
    if (code === '23502' || /not-null|null value/i.test(text)) return t('admin.product_incomplete');
    if (code === '42501' || /permission denied|row-level security/i.test(text)) return t('admin.product_no_permission');
    return text || t('toast.error_generic');
  };

  /* ---------------------------------------------------------------- *
   * ตรวจสินค้าซ้ำ (รูป / ชื่อ / รหัสสินค้า)
   * ใช้รายการสินค้าที่โหลดมาครั้งเดียวเทียบในหน่วยความจำ
   * ---------------------------------------------------------------- */
  let dupIndex = [];
  let dupAcknowledged = '';
  let stagedFile = null;
  let stagedHash = '';
  let stagedUrl = '';
  let hashesDirty = false;
  let hintedUrl = '';
  let originalImage = { url: '', hashes: [] };

  const nameHint = document.getElementById('product-name-duplicate');
  const skuHint = document.getElementById('product-sku-duplicate');
  const imageHint = document.getElementById('product-image-duplicate');
  const dupWarning = document.getElementById('product-dup-warning');
  const dupList = document.getElementById('product-dup-list');
  const submitBtn = form?.closest('dialog')?.querySelector('button[type="submit"]') || null;

  const setHint = (node, text) => {
    if (!node) return;
    node.textContent = text || '';
    node.hidden = !text;
  };

  function currentHashes() {
    return [stagedHash].filter(Boolean);
  }

  function clearDupWarning() {
    dupAcknowledged = '';
    if (dupWarning) dupWarning.hidden = true;
    if (dupList) dupList.innerHTML = '';
    if (submitBtn) submitBtn.textContent = t('admin.save_product');
  }

  /** คำใบ้สด ๆ ใต้ช่องชื่อ/SKU ระหว่างพิมพ์ */
  function paintLiveHints() {
    const name = document.getElementById('product-name')?.value || '';
    const sku = document.getElementById('product-sku')?.value || '';
    const nameKey = normalizeName(name);
    const skuKey = normalizeSku(sku);
    const others = dupIndex.filter((item) => item.id !== editingId);

    const sameName = nameKey ? others.find((item) => item.nameKey === nameKey) : null;
    if (sameName) {
      setHint(nameHint, t('admin.dup_name_hint', { name: sameName.name, sku: sameName.sku || '-' }));
    } else {
      const close = name ? detectDuplicates(dupIndex, { name, excludeId: editingId || '' }).similar[0] : null;
      setHint(
        nameHint,
        close
          ? t('admin.dup_name_similar_hint', {
              name: close.product.name,
              score: Math.round(close.score * 100),
            })
          : '',
      );
    }

    const sameSku = skuKey ? others.find((item) => item.skuKey === skuKey) : null;
    setHint(skuHint, sameSku ? t('admin.dup_sku_hint', { name: sameSku.name }) : '');

    const imageMatch = stagedHash ? bestMatchForHash(stagedHash) : null;
    setHint(
      imageHint,
      imageMatch ? t('admin.dup_image_hint', { name: imageMatch.product.name, score: imageMatch.score }) : '',
    );
  }

  const bestMatchForHash = (hash) => bestImageMatch(dupIndex, hash, editingId || '');

  /** แสดงกล่อง "พบสินค้าที่อาจซ้ำ" พร้อมเหตุผลและสินค้าที่ชนกัน */
  function showDupWarning(result) {
    if (!dupWarning || !dupList) return;
    const rows = [];
    if (result.sku) {
      rows.push({ badge: t('admin.dup_reason_sku'), tone: 'sku', product: result.sku, meta: '' });
    }
    result.names.forEach((match) => {
      rows.push({
        badge: match.exact ? t('admin.dup_reason_name') : t('admin.dup_reason_name_similar'),
        tone: 'name',
        product: match.product,
        meta: match.exact ? '' : `${Math.round(match.score * 100)}%`,
      });
    });
    result.images.forEach((match) => {
      rows.push({
        badge: t('admin.dup_reason_image'),
        tone: 'image',
        product: match.product,
        meta: `${match.score}%`,
      });
    });

    dupList.innerHTML = rows
      .map(
        (row) => `
        <li class="dup-item">
          <img class="dup-thumb" src="${escapeHTML(row.product.imageUrl || '/images/placeholder.svg')}" alt="" loading="lazy" />
          <span class="dup-body">
            <span class="dup-badge dup-badge-${row.tone}">${escapeHTML(row.badge)}${row.meta ? ` ${escapeHTML(row.meta)}` : ''}</span>
            <span class="dup-name">${escapeHTML(row.product.name || '-')}</span>
            <span class="dup-meta">SKU ${escapeHTML(row.product.sku || '-')} · ${
              row.product.active ? t('admin.product_on_sale') : t('admin.hidden')
            }</span>
          </span>
          <a class="dup-link" href="/shop/product?id=${encodeURIComponent(row.product.id)}" target="_blank" rel="noopener">${escapeHTML(
            t('admin.dup_open'),
          )}</a>
        </li>`,
      )
      .join('');

    dupWarning.hidden = false;
    if (submitBtn) submitBtn.textContent = t('admin.dup_confirm_save');
    dupWarning.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function refreshDupIndex() {
    try {
      dupIndex = await loadProductIndex(supabase);
    } catch (err) {
      console.warn('[ZenMarket] duplicate index failed', err);
      dupIndex = [];
    }
    paintLiveHints();
    return dupIndex;
  }

  /**
   * hash ของรูปที่กำลังจะบันทึก
   * - อัปโหลดใหม่ → ใช้ hash ของไฟล์ที่ตัดแล้ว
   * - แก้ไขสินค้าโดยไม่ได้แตะรูป → ใช้ค่าเดิมในฐานข้อมูล ไม่ต้องคำนวณซ้ำ
   * - พิมพ์ URL เอง → ลองคำนวณจาก URL (ถ้าเซิร์ฟเวอร์ไม่ให้อ่านพิกเซลจะได้ '')
   */
  async function resolveCurrentHashes() {
    const url = (document.getElementById('product-image')?.value || '').trim();
    if (stagedHash && (!url || url === stagedUrl)) return currentHashes();
    if (editingId && url && url === originalImage.url && !stagedFile) return originalImage.hashes;
    if (!url) return [];
    if (url === hintedUrl) return currentHashes();
    hintedUrl = url;
    const hash = await hashImageUrl(url);
    stagedHash = hash;
    hashesDirty = Boolean(hash);
    paintLiveHints();
    return currentHashes();
  }

  /**
   * เติม dropdown หมวดหมู่จากรายการที่สร้างไว้ในหน้า "หมวดหมู่"
   * ไม่ให้พิมพ์ชื่อเองในฟอร์มสินค้า เพื่อกันพิมพ์ผิดแล้วกลายเป็นหมวดใหม่
   */
  async function loadCategorySelect(selected = '') {
    const select = document.getElementById('product-category');
    if (!select) return;
    const chosen = String(selected || '').trim();
    let names = [];
    try {
      const { data } = await supabase.from('categories').select('name').order('name');
      names = (data || []).map((row) => row.name).filter(Boolean);
    } catch (err) {
      console.warn('[ZenMarket] load categories failed', err);
    }
    // สินค้าเก่าที่ใช้ชื่อหมวดซึ่งถูกลบ/เปลี่ยนไปแล้ว ต้องยังเลือกค่านั้นได้ ไม่ให้หลุดเป็นว่าง
    if (chosen && !names.includes(chosen)) names.push(chosen);
    names.sort((a, b) => a.localeCompare(b, 'th'));
    select.innerHTML = [
      `<option value="">${escapeHTML(t('admin.category_none'))}</option>`,
      ...names.map((name) => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`),
    ].join('');
    select.value = chosen;
    // ยังไม่มีหมวดหมู่เลย → เลือกไม่ได้ และบันทึกไม่ได้ (คอลัมน์ category เป็น NOT NULL)
    if (!names.length) showFormError(t('admin.product_category_empty'));
  }

  async function loadProducts() {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      notify(t('admin.system_error'), 'error');
      return;
    }

    tbody.innerHTML = '';
    products?.forEach((p) => {
      const tr = document.createElement('tr');
      tr.dataset.rowId = p.id;
      const saleOn = Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price);
      tr.innerHTML =
        `<td class="cell-thumb-cell" data-label="${t('admin.product_image')}"><img class="cell-thumb" src="${p.image_url || '/images/placeholder.svg'}" alt=""></td>` +
        `<td data-label="${t('admin.product_name')}" class="font-semibold" style="color:var(--color-text)">${escapeHTML(
          p.name,
        )}${renderNewWindow(p)}</td>` +
        `<td data-label="${t('admin.product_category')}">${escapeHTML(p.category || '-')}</td>` +
        `<td data-label="${t('common.price')}" class="num">${formatTHB(saleOn ? p.sale_price : p.price)}${
          saleOn ? ` <s class="price-was">${formatTHB(p.price)}</s>` : ''
        }</td>` +
        `<td data-label="${t('admin.product_stock')}" class="num">${renderStockCell(p.stock)}</td>` +
        `<td data-label="${t('common.status')}">${renderStatusCell(p)}</td>` +
        `<td class="cell-actions"><button class="btn btn-outline btn-sm" data-edit="${p.id}">${t('common.edit')}</button> ` +
        `<button class="btn btn-outline btn-sm" data-toggle="${p.id}">${p.active ? t('admin.hide') : t('admin.show')}</button> ` +
        `<button class="btn btn-danger btn-sm" data-del="${p.id}">${t('common.delete')}</button></td>`;
      tbody.appendChild(tr);
    });

    // ข้อมูลสำหรับตรวจสินค้าซ้ำ (โหลดครั้งเดียวหลังตารางเสร็จ)
    await refreshDupIndex();
    backfillImageHashes(dupIndex);
  }

  /** กะพริบแถวที่เพิ่งบันทึก เพื่อให้เห็นว่าการแก้ไขไปลงที่แถวไหน */
  /**
   * โหลดตารางใหม่หลังบันทึก แล้วไฮไลต์แถวที่เพิ่งบันทึก
   * เดิมถ้าเป็นการ "เพิ่มสินค้า" (ยังไม่มี id) จะ return ออกก่อน ⇒ ตารางไม่รีเฟรช
   * ผู้ใช้จึงเห็นเหมือนสินค้าไม่ถูกบันทึกทั้งที่บันทึกแล้ว
   */
  async function flashSavedRow(id, name = '') {
    await loadProducts();
    const row = id
      ? tbody.querySelector(`tr[data-row-id="${id}"]`)
      : name
        ? [...tbody.querySelectorAll('tr')].find((r) => r.textContent.includes(name))
        : null;
    if (!row) return;
    row.classList.add('is-saved');
    row.scrollIntoView({ block: 'nearest' });
    setTimeout(() => row.classList.remove('is-saved'), 1800);
  }

  loadProducts();
  loadCategorySelect(document.getElementById('product-category')?.value || '');

  bindOnce(tbody, 'click', async (e) => {
    const edit = e.target.closest('[data-edit]');
    const toggle = e.target.closest('[data-toggle]');
    const del = e.target.closest('[data-del]');

    if (edit) {
      const { data: p } = await supabase.from('products').select('*').eq('id', edit.getAttribute('data-edit')).single();
      if (!p) return;
      editingId = p.id;
      clearFormError();
      clearDupWarning();
      stagedFile = null;
      stagedHash = '';
      stagedUrl = '';
      hintedUrl = '';
      hashesDirty = false;
      originalImage = {
        url: p.image_url || '',
        hashes: Array.isArray(p.image_hashes) ? p.image_hashes.filter(Boolean) : [],
      };
      if (imageEditBtn) imageEditBtn.hidden = !p.image_url;
      if (imageStatus) imageStatus.textContent = '';
      document.getElementById('product-name').value = p.name || '';
      document.getElementById('product-sku').value = p.sku || '';
      await loadCategorySelect(p.category || '');
      document.getElementById('product-price').value = p.price || 0;
      document.getElementById('product-sale-price').value = p.sale_price ?? '';
      document.getElementById('product-stock').value = p.stock || 0;
      document.getElementById('product-image').value = p.image_url || '';
      document.getElementById('product-description').value = p.description || '';
      document.getElementById('product-active').checked = !!p.active;
      const newDaysInput = document.getElementById('product-new-days');
      if (newDaysInput) newDaysInput.value = String(p.new_days ?? 7);
      sheet?.open({
        titleKey: 'admin.edit_product',
        sub: [p.name, p.sku].filter(Boolean).join(' · '),
      });
      paintLiveHints();
      return;
    }

    if (toggle) {
      const id = toggle.getAttribute('data-toggle');
      const { data: p } = await supabase.from('products').select('active').eq('id', id).single();
      const { error } = await supabase.from('products').update({ active: !p?.active }).eq('id', id);
      if (error) notify(error.message || t('toast.error_generic'), 'error');
      await loadProducts();
    }

    if (del) {
      const confirmed = await confirmAction(t('admin.delete_confirm'), {
        danger: true,
        confirmText: t('common.delete'),
      });
      if (!confirmed) return;
      const { error } = await supabase.from('products').delete().eq('id', del.getAttribute('data-del'));
      if (error) {
        notify(error.message || t('toast.error_generic'), 'error');
        return;
      }
      notify(t('toast.deleted'), 'success');
      await loadProducts();
    }
  });

  if (addBtn) {
    bindOnce(addBtn, 'click', async () => {
      editingId = null;
      form.reset();
      document.getElementById('product-active').checked = true;
      const newDaysInput = document.getElementById('product-new-days');
      if (newDaysInput) newDaysInput.value = '7';
      clearFormError();
      stagedFile = null;
      stagedHash = '';
      stagedUrl = '';
      hintedUrl = '';
      hashesDirty = false;
      originalImage = { url: '', hashes: [] };
      clearDupWarning();
      if (imageEditBtn) imageEditBtn.hidden = true;
      if (imageStatus) imageStatus.textContent = '';
      await loadCategorySelect();
      sheet?.open({ titleKey: 'admin.new_product' });
      paintLiveHints();
    });
  }

  const imageUploadBtn = document.getElementById('product-image-upload-btn');
  const imageEditBtn = document.getElementById('product-image-edit-btn');
  const imageFileInput = document.getElementById('product-image-file');
  const imageStatus = document.getElementById('product-image-status');
  const imageUrlInput = document.getElementById('product-image');

  /** ดึงรูปเดิมกลับมาเป็นไฟล์ เพื่อเปิดตัวแก้ไขรูปซ้ำได้ (แก้รูปที่เคยอัปโหลดไปแล้ว) */
  async function fileFromUrl(url) {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!/^image\//.test(blob.type || '')) throw new Error('not an image');
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    return new File([blob], `product-${Date.now()}.${ext}`, { type: blob.type });
  }

  /** อัปโหลดไฟล์ (ผ่านตัวแก้ไขก่อนถ้าหน้านี้มี) แล้วจำ hash ไว้ตรวจรูปซ้ำ */
  async function uploadPickedImage(file) {
    if (!file) return;
    let payloadFile = file;
    let hash = '';

    if (hasImageEditor()) {
      const edited = await openImageEditor(file);
      // ผู้ใช้กดยกเลิกในตัวแก้ไข → ไม่ต้องทำอะไรต่อ
      if (!edited) {
        if (imageFileInput) imageFileInput.value = '';
        return;
      }
      const ext = edited.type === 'image/png' ? 'png' : 'jpg';
      payloadFile = new File([edited.blob], `${edited.name || 'product'}.${ext}`, { type: edited.type });
      hash = edited.hash;
      if (imageStatus) {
        imageStatus.textContent =
          edited.width && edited.height
            ? t('admin.image_uploading', { w: edited.width, h: edited.height })
            : t('admin.image_uploading_plain');
      }
    }

    imageUploadBtn.disabled = true;
    if (imageEditBtn) imageEditBtn.disabled = true;
    if (imageStatus && !hash) imageStatus.textContent = t('admin.image_uploading_plain');
    try {
      const { url } = await uploadProductImage(supabase, payloadFile);
      if (imageUrlInput) imageUrlInput.value = url;
      if (!hash) hash = await hashImageUrl(url);
      stagedFile = file;
      stagedUrl = url;
      stagedHash = hash;
      hashesDirty = true;
      if (imageStatus) imageStatus.textContent = t('admin.product_upload_done');
      if (imageEditBtn) {
        imageEditBtn.hidden = false;
        imageEditBtn.disabled = false;
      }
      clearDupWarning();
      paintLiveHints();
    } catch (err) {
      console.error(err);
      if (imageStatus) imageStatus.textContent = t('toast.error_generic');
      notify(err.message || t('toast.error_generic'), 'error');
    } finally {
      imageUploadBtn.disabled = false;
      if (imageFileInput) imageFileInput.value = '';
    }
  }

  if (imageUploadBtn && imageFileInput) {
    bindOnce(imageUploadBtn, 'click', () => imageFileInput.click());
    bindOnce(imageFileInput, 'change', () => uploadPickedImage(imageFileInput.files?.[0]));
    bindOnce(imageEditBtn, 'click', async () => {
      const url = (imageUrlInput?.value || '').trim();
      if (stagedFile) {
        uploadPickedImage(stagedFile);
        return;
      }
      if (!url) return;
      imageEditBtn.disabled = true;
      if (imageStatus) imageStatus.textContent = t('admin.image_loading');
      try {
        await uploadPickedImage(await fileFromUrl(url));
      } catch (err) {
        console.error(err);
        if (imageStatus) imageStatus.textContent = '';
        notify(t('admin.image_editor_load_failed'), 'error');
      } finally {
        imageEditBtn.disabled = false;
      }
    });
    // พิมพ์ URL เอง = เปลี่ยนรูป → hash เดิมใช้ไม่ได้แล้ว
    bindOnce(imageUrlInput, 'input', () => {
      const url = (imageUrlInput.value || '').trim();
      if (url === stagedUrl) return;
      stagedFile = null;
      stagedHash = '';
      if (imageEditBtn) imageEditBtn.hidden = !url;
      clearDupWarning();
      paintLiveHints();
    });
  }

  if (form) {
    bindOnce(form, 'submit', async (e) => {
      e.preventDefault();
      clearFormError();
      const checked = validateProduct({
        name: document.getElementById('product-name').value,
        sku: document.getElementById('product-sku').value,
        category: document.getElementById('product-category').value,
        price: document.getElementById('product-price').value,
        stock: document.getElementById('product-stock').value,
        image_url: document.getElementById('product-image').value,
        description: document.getElementById('product-description').value,
        sale_price: document.getElementById('product-sale-price')?.value ?? '',
        active: document.getElementById('product-active').checked,
      });
      if (!checked.ok) {
        const message = t(checked.errorKey);
        showFormError(message);
        notify(message, 'error');
        focusField(checked.fieldKey);
        return;
      }

      // ห้ามส่ง null ลงคอลัมน์ NOT NULL (category/sku/image_url) — validateProduct จัดการแล้ว
      const payload = { ...checked.value };
      if (!payload.name) {
        const message = t('admin.product_name_required');
        showFormError(message);
        notify(message, 'error');
        focusField('name');
        return;
      }

      const newDaysInput = document.getElementById('product-new-days');
      const rawNewDays = newDaysInput ? newDaysInput.value.trim() : '';
      const newDays = rawNewDays === '' ? 7 : Number(rawNewDays);
      if (!Number.isInteger(newDays) || newDays < 0 || newDays > 365) {
        const message = t('admin.new_days_invalid');
        showFormError(message);
        notify(message, 'error');
        focusField('new-days');
        return;
      }
      payload.new_days = newDays;

      /* ---------- ตรวจสินค้าซ้ำ (รูป / ชื่อ / รหัสสินค้า) ---------- */
      await resolveCurrentHashes();
      const hashes = currentHashes();
      const dupSignature = JSON.stringify({
        name: normalizeName(payload.name),
        sku: normalizeSku(payload.sku),
        hashes: [...hashes].sort(),
      });
      if (dupSignature !== dupAcknowledged) {
        const found = detectDuplicates(dupIndex, {
          name: payload.name,
          sku: payload.sku,
          hashes,
          excludeId: editingId || '',
        });
        if (found.sku) {
          const message = t('admin.dup_sku_blocked', { sku: found.sku.sku, name: found.sku.name });
          showFormError(message);
          notify(message, 'error');
          setHint(skuHint, t('admin.dup_sku_hint', { name: found.sku.name }));
          focusField('sku');
          return;
        }
        if (found.hasIssue) {
          // เตือนก่อน ไม่บล็อก: ชื่อหรือรูปซ้ำอาจเป็นสินค้าคนละชิ้นที่หน้าตาคล้ายกัน
          dupAcknowledged = dupSignature;
          showDupWarning(found);
          return;
        }
      }

      if (hashes.length || hashesDirty || !editingId) payload.image_hashes = hashes;

      let error;
      if (editingId) {
        ({ error } = await supabase.from('products').update(payload).eq('id', editingId));
      } else {
        payload.image_urls = payload.image_url ? [payload.image_url] : [];
        ({ error } = await supabase.from('products').insert(payload));
      }
      if (error) {
        const message = productErrorMessage(error);
        showFormError(message);
        notify(message, 'error');
        return;
      }

      const savedId = editingId;
      const savedName = payload.name || '';
      clearFormError();
      clearDupWarning();
      stagedFile = null;
      stagedHash = '';
      stagedUrl = '';
      hashesDirty = false;
      if (imageEditBtn) imageEditBtn.hidden = true;
      if (imageStatus) imageStatus.textContent = '';
      notify(editingId ? t('admin.product_saved') : t('admin.product_added'), 'success');
      editingId = null;
      sheet?.closeNow();
      form.reset();
      await flashSavedRow(savedId, savedName);
    });

    const cancelBtn = document.getElementById('admin-product-cancel');
    if (cancelBtn) {
      bindOnce(cancelBtn, 'click', async () => {
        const closed = await sheet?.requestClose();
        if (closed) editingId = null;
      });
    }
  }

  // ตรวจชื่อ/SKU ซ้ำแบบสด ๆ ระหว่างพิมพ์ (หน่วงนิดเดียว ไม่กระพริบ)
  let hintTimer = 0;
  const onFieldInput = () => {
    clearDupWarning();
    clearTimeout(hintTimer);
    hintTimer = setTimeout(paintLiveHints, 220);
  };
  bindOnce(document.getElementById('product-name'), 'input', onFieldInput);
  bindOnce(document.getElementById('product-sku'), 'input', onFieldInput);

  if (searchInput) {
    bindOnce(searchInput, 'input', () => {
      const term = searchInput.value.toLowerCase();
      tbody.querySelectorAll('tr').forEach((row) => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  }
}

async function initCategories() {
  const list = document.getElementById('admin-categories-list');
  const form = document.getElementById('admin-category-form');
  if (!list) return;

  let categories = [];
  let counts = {};
  let editing = null;

  const paint = () => {
    if (!categories.length) {
      list.innerHTML = `<p class="empty-state" data-i18n="admin.no_categories">${t('admin.no_categories')}</p>`;
      return;
    }

    list.innerHTML = categories
      .map((name) => {
        const count = counts[name] || 0;
        const rows =
          editing === name
            ? `<form class="category-row is-editing" data-rename-form="${escapeHTML(name)}">
                 <label class="sr-only" for="rename-${escapeHTML(name)}">${t('admin.category_name_label')}</label>
                 <input type="text" id="rename-${escapeHTML(name)}" class="form-input form-input-sm" value="${escapeHTML(name)}" maxlength="80" required />
                 <div class="category-row-actions">
                   <button type="submit" class="btn btn-primary btn-sm">${t('admin.category_rename_save')}</button>
                   <button type="button" class="btn btn-ghost btn-sm" data-cancel-rename>${t('admin.category_cancel')}</button>
                 </div>
               </form>`
            : `<div class="category-row">
                 <div class="category-row-text">
                   <span class="category-row-name">${escapeHTML(name)}</span>
                   <span class="category-row-meta">${count ? t('admin.category_products', { count }) : t('admin.category_empty')}</span>
                 </div>
                 <div class="category-row-actions">
                   <button type="button" class="btn btn-outline btn-sm" data-rename="${escapeHTML(name)}">${t('admin.category_rename')}</button>
                   <button type="button" class="btn btn-danger btn-sm" data-del="${escapeHTML(name)}">${t('common.delete')}</button>
                 </div>
               </div>`;
        return rows;
      })
      .join('');

    const input = list.querySelector('.category-row.is-editing input');
    if (input) {
      input.focus();
      input.select();
    }
  };

  async function loadCategories() {
    try {
      const [{ data: rows }, { data: products }] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('products').select('category'),
      ]);
      categories = (rows || []).map((r) => r.name).filter(Boolean);
      counts = {};
      (products || []).forEach((p) => {
        if (!p.category) return;
        counts[p.category] = (counts[p.category] || 0) + 1;
      });
    } catch (err) {
      console.warn('[ZenMarket] category load failed', err);
      categories = [];
      counts = {};
    }
    paint();
  }

  const rename = async (oldName, newName) => {
    const checked = validateCategory(newName);
    if (!checked.ok) {
      notify(t(checked.errorKey), 'error');
      return false;
    }
    if (checked.value === oldName) {
      editing = null;
      paint();
      return true;
    }
    if (categories.includes(checked.value)) {
      notify(t('admin.category_exists'), 'error');
      return false;
    }
    const { error } = await supabase.rpc('admin_rename_category', {
      p_old: oldName,
      p_new: checked.value,
    });
    if (error) {
      notify(error.message || t('toast.error_generic'), 'error');
      return false;
    }
    notify(t('admin.category_renamed'), 'success');
    editing = null;
    await loadCategories();
    return true;
  };

  loadCategories();

  bindOnce(list, 'click', async (e) => {
    const renameBtn = e.target.closest('[data-rename]');
    if (renameBtn) {
      editing = renameBtn.getAttribute('data-rename');
      paint();
      return;
    }

    if (e.target.closest('[data-cancel-rename]')) {
      editing = null;
      paint();
      return;
    }

    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      const name = delBtn.getAttribute('data-del');
      const count = counts[name] || 0;
      const question = count ? t('admin.category_delete_has_products', { count }) : t('admin.delete_confirm');
      const confirmed = await confirmAction(question, { danger: true, confirmText: t('common.delete') });
      if (!confirmed) return;
      const { error } = await supabase.rpc('admin_delete_category', { p_name: name });
      if (error) {
        notify(error.message || t('toast.error_generic'), 'error');
        return;
      }
      notify(t('admin.category_deleted'), 'success');
      await loadCategories();
    }
  });

  bindOnce(list, 'submit', async (e) => {
    const renameForm = e.target.closest('[data-rename-form]');
    if (!renameForm) return;
    e.preventDefault();
    const oldName = renameForm.getAttribute('data-rename-form');
    const input = renameForm.querySelector('input');
    await rename(oldName, input ? input.value : '');
  });

  if (form) {
    bindOnce(form, 'submit', async (e) => {
      e.preventDefault();
      const checked = validateCategory(document.getElementById('admin-category-name').value);
      if (!checked.ok) {
        notify(t(checked.errorKey), 'error');
        return;
      }
      const name = checked.value;
      if (categories.includes(name)) {
        notify(t('admin.category_exists'), 'error');
        return;
      }
      const { error } = await supabase.from('categories').insert({ name });
      if (error) notify(error.message || t('toast.error_generic'), 'error');
      else {
        notify(t('admin.category_added'), 'success');
        form.reset();
        await loadCategories();
      }
    });
  }
}

async function initReviews() {
  const tbody = document.getElementById('admin-reviews-list');
  if (!tbody) return;

  // Both the storefront and this table read the same reviews. Query the table
  // first (it carries the ids used for deleting) and fall back to the public
  // RPC when the table query is blocked, so the two pages can never disagree
  // about whether the shop has reviews.
  let reviews = [];
  try {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) reviews = data;
  } catch (err) {
    console.warn('[ZenMarket] review query failed', err);
  }

  if (!reviews.length) {
    try {
      const { data } = await supabase.rpc('get_home_reviews');
      if (Array.isArray(data)) reviews = data;
    } catch (err) {
      console.warn('[ZenMarket] review rpc failed', err);
    }
  }

  tbody.innerHTML = '';

  if (!reviews.length) {
    tbody.innerHTML = `<tr><td colspan="6"><p class="empty-state" data-i18n="admin.no_reviews">${t('admin.no_reviews')}</p></td></tr>`;
    return;
  }

  reviews.forEach((r) => {
    const rating = Math.max(0, Math.min(5, Number(r.rating) || 0));
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td data-label="${t('admin.reviewer')}">${escapeHTML(r.reviewer_name || t('common.customer'))}</td>` +
      `<td data-label="${t('admin.product')}">${escapeHTML(r.product_name || '-')}</td>` +
      `<td data-label="${t('admin.rating')}" class="review-rating">${ratingStars(rating, 12)}</td>` +
      `<td data-label="${t('admin.comment')}">${escapeHTML(r.comment || '-')}</td>` +
      `<td data-label="${t('common.date')}">${formatDate(r.created_at) || '-'}</td>` +
      `<td class="cell-actions">${
        r.id
          ? `<button class="btn btn-danger btn-sm" data-del="${escapeHTML(r.id)}">${t('common.delete')}</button>`
          : ''
      }</td>`;
    tbody.appendChild(tr);
  });

  bindOnce(tbody, 'click', async (e) => {
    const btn = e.target.closest('[data-del]');
    if (btn) {
      const confirmed = await confirmAction(t('admin.delete_confirm'), {
        danger: true,
        confirmText: t('common.delete'),
      });
      if (!confirmed) return;
      const { error } = await supabase.from('product_reviews').delete().eq('id', btn.getAttribute('data-del'));
      if (error) notify(error.message || t('toast.error_generic'), 'error');
      else await initReviews();
    }
  });
}

async function initSettings() {
  const form = document.getElementById('admin-settings-form');
  const logoInput = document.getElementById('setting-store-logo');
  const logoFileInput = document.getElementById('setting-logo-file');
  const logoUploadBtn = document.getElementById('setting-logo-upload-btn');
  const logoRemoveBtn = document.getElementById('setting-logo-remove-btn');
  const logoPreview = document.getElementById('setting-logo-preview');

  let currentLogoUrl = '';

  const paintLogoPreview = (url) => {
    if (!logoPreview) return;
    if (url && !url.includes('placeholder')) {
      logoPreview.innerHTML = `<img src="${url}" alt="logo" style="width:100%;height:100%;object-fit:contain">`;
    } else {
      logoPreview.innerHTML = `<span class="text-muted text-xs">${t('admin.logo_preview')}</span>`;
    }
  };

  try {
    const { data: s } = await supabase.from('store_settings').select('*').eq('singleton', true).single();
    if (s) {
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v || '';
      };
      set('setting-store-name', s.shop_name);
      set('setting-store-logo', s.logo_url);
      set('setting-store-description', s.tagline);
      set('setting-contact-email', s.contact_email);
      set('setting-contact-phone', s.contact_phone);
      set('setting-contact-address', s.contact_address);
      set('setting-contact-line', s.line_url);
      set('setting-contact-facebook', s.facebook_url);
      set('setting-contact-instagram', s.instagram_url);
      set('setting-contact-tiktok', s.tiktok_url);
      set('setting-shipping-fee', s.shipping_fee);
      set('setting-delivery-days-min', s.delivery_days_min ?? 2);
      set('setting-delivery-days-max', s.delivery_days_max ?? 5);
      set('setting-free-shipping-threshold', s.free_shipping_threshold);
      set('setting-low-stock', s.low_stock_threshold);
      set('setting-about', s.about_text);
      set('setting-shipping-note', s.shipping_note);
      const showContact = document.getElementById('setting-show-contact');
      if (showContact) showContact.checked = s.show_contact !== false;
      currentLogoUrl = s.logo_url || '';
    }
  } catch (err) {
    console.error(err);
  }

  paintLogoPreview(currentLogoUrl);

  if (logoUploadBtn && logoFileInput) {
    bindOnce(logoUploadBtn, 'click', () => logoFileInput.click());
    bindOnce(logoFileInput, 'change', async () => {
      const file = logoFileInput.files?.[0];
      if (!file) return;
      try {
        const { url } = await uploadStoreLogo(supabase, file);
        if (logoInput) logoInput.value = url;
        currentLogoUrl = url;
        paintLogoPreview(url);

        const { error } = await supabase.from('store_settings').update({ logo_url: url }).eq('singleton', true);
        if (error) throw error;
        notify(t('admin.logo_updated'), 'success');
      } catch (err) {
        console.error(err);
        const code = err?.message || 'upload-failed';
        notify(
          code === 'invalid-type'
            ? t('admin.logo_invalid_type')
            : code === 'too-large'
              ? t('admin.logo_too_large')
              : t('toast.error_generic'),
          'error',
        );
      } finally {
        logoFileInput.value = '';
      }
    });
  }

  if (logoRemoveBtn) {
    bindOnce(logoRemoveBtn, 'click', async () => {
      if (!currentLogoUrl) return;
      try {
        const { error } = await supabase.from('store_settings').update({ logo_url: '' }).eq('singleton', true);
        if (error) throw error;
        await removeStoreLogo(supabase, currentLogoUrl);
        currentLogoUrl = '';
        if (logoInput) logoInput.value = '';
        paintLogoPreview('');
        notify(t('toast.deleted'), 'success');
      } catch (err) {
        notify(err.message || t('toast.error_generic'), 'error');
      }
    });
  }

  if (form) {
    bindOnce(form, 'submit', async (e) => {
      e.preventDefault();
      const get = (id) => document.getElementById(id)?.value || '';
      const payload = {
        shop_name: get('setting-store-name'),
        logo_url: get('setting-store-logo'),
        tagline: get('setting-store-description'),
        contact_email: get('setting-contact-email'),
        contact_phone: get('setting-contact-phone'),
        contact_address: get('setting-contact-address').trim(),
        line_url: validateSocialUrl(get('setting-contact-line'), 'line'),
        facebook_url: validateSocialUrl(get('setting-contact-facebook'), 'facebook'),
        instagram_url: validateSocialUrl(get('setting-contact-instagram'), 'instagram'),
        tiktok_url: validateSocialUrl(get('setting-contact-tiktok'), 'tiktok'),
        show_contact: document.getElementById('setting-show-contact')?.checked !== false,

        shipping_fee: get('setting-shipping-fee').trim(),
        free_shipping_threshold: get('setting-free-shipping-threshold').trim(),
        low_stock_threshold: get('setting-low-stock').trim(),
        delivery_days_min: get('setting-delivery-days-min').trim(),
        delivery_days_max: get('setting-delivery-days-max').trim(),
        about_text: get('setting-about'),
        shipping_note: get('setting-shipping-note'),
      };

      const checked = validateStoreSettings(payload);
      if (!checked.ok) {
        notify(t(checked.errorKey), 'error');
        return;
      }

      const { error } = await supabase.from('store_settings').update(checked.value).eq('singleton', true);
      if (error) notify(error.message || t('toast.error_generic'), 'error');
      else notify(t('admin.settings_saved'), 'success');
    });
  }

  initPageEditor();
}

/**
 * ตัวแก้ข้อความหน้า About / Help / Privacy
 * เก็บในตาราง site_pages แยกภาษาไทย/อังกฤษ เว้นว่าง = ใช้ข้อความเริ่มต้นในโค้ด
 */
function initPageEditor() {
  const slugSelect = document.getElementById('pages-slug');
  const langSelect = document.getElementById('pages-lang');
  const titleInput = document.getElementById('pages-title');
  const bodyInput = document.getElementById('pages-body');
  const saveBtn = document.getElementById('pages-save');
  if (!slugSelect || !langSelect || !titleInput || !bodyInput || !saveBtn) return;

  let rows = [];

  const keyOf = (slug, lang) => (lang === 'en' ? `title_en` : `title_th`);
  const bodyOf = (slug, lang) => (lang === 'en' ? `body_en` : `body_th`);

  const paint = () => {
    const slug = slugSelect.value;
    const lang = langSelect.value;
    const row = rows.find((r) => r.slug === slug) || {};
    titleInput.value = row[keyOf(slug, lang)] || '';
    bodyInput.value = row[bodyOf(slug, lang)] || '';
  };

  const load = async () => {
    const { data, error } = await supabase.from('site_pages').select('*');
    if (error) {
      console.warn('[ZenMarket] site pages unavailable', error);
      return;
    }
    rows = data || [];
    paint();
  };

  slugSelect.addEventListener('change', paint);
  langSelect.addEventListener('change', paint);

  saveBtn.addEventListener('click', async () => {
    const slug = slugSelect.value;
    const lang = langSelect.value;
    const payload = {
      slug,
      [keyOf(slug, lang)]: titleInput.value.trim() || null,
      [bodyOf(slug, lang)]: bodyInput.value.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('site_pages').upsert(payload, { onConflict: 'slug' });
    if (error) {
      notify(error.message || t('toast.error_generic'), 'error');
      return;
    }
    notify(t('admin.pages_saved'), 'success');
    await load();
  });

  load();
}

/* ------------------------------------------------------------------ *
 * คูปองส่วนลด
 * ------------------------------------------------------------------ */
async function initCoupons() {
  const tbody = document.getElementById('admin-coupons-list');
  const form = document.getElementById('admin-coupon-form');
  const addBtn = document.getElementById('admin-coupon-add');
  const cancelBtn = document.getElementById('admin-coupon-cancel');
  if (!tbody || !form) return;

  const sheet = formSheet({
    dialog: document.getElementById('coupon-sheet'),
    form,
    titleEl: document.getElementById('admin-coupon-form-title'),
    subEl: document.getElementById('admin-coupon-form-sub'),
    closeBtn: document.getElementById('admin-coupon-close'),
  });

  let editingId = null;

  const paint = async () => {
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) {
      notify(t('admin.system_error'), 'error');
      return;
    }
    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem" class="text-muted">${escapeHTML(
        t('admin.coupon_empty'),
      )}</td></tr>`;
      return;
    }

    tbody.innerHTML = data
      .map((c) => {
        const amount = Number(c.value) || 0;
        const value = c.kind === 'percent' ? `${amount}%` : formatTHB(amount);
        const uses = c.max_uses
          ? `${Number(c.used_count) || 0}/${c.max_uses}`
          : `${Number(c.used_count) || 0} · ${t('admin.coupon_unlimited')}`;
        const ends = formatDate(c.ends_at) || '-';
        return `<tr data-row-id="${escapeHTML(c.id)}">
          <td data-label="${t('admin.coupon_code')}" class="font-semibold">${escapeHTML(c.code)}</td>
          <td data-label="${t('admin.coupon_value')}" class="num">${escapeHTML(value)}</td>
          <td data-label="${t('admin.coupon_min')}" class="num">${c.min_subtotal ? formatTHB(c.min_subtotal) : '-'}</td>
          <td data-label="${t('admin.coupon_uses')}" class="num">${escapeHTML(uses)}</td>
          <td data-label="${t('admin.coupon_ends')}">${escapeHTML(ends)}</td>
          <td data-label="${t('common.status')}"><span class="badge badge-${c.active ? 'success' : 'error'}">${
            c.active ? t('admin.active') : t('admin.hidden')
          }</span></td>
          <td class="cell-actions">
            <button class="btn btn-outline btn-sm" data-edit-coupon="${c.id}">${t('common.edit')}</button>
            <button class="btn btn-danger btn-sm" data-del-coupon="${c.id}">${t('admin.coupon_delete')}</button>
          </td>
        </tr>`;
      })
      .join('');
  };

  await paint();

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      editingId = null;
      form.reset();
      document.getElementById('coupon-active').checked = true;
      clearCouponError();
      sheet?.open({ titleKey: 'admin.coupon_new' });
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      const closed = await sheet?.requestClose();
      if (closed) editingId = null;
    });
  }

  // ข้อความผิดพลาดของแผงคูปอง (แผงบัง toast อยู่)
  const couponError = document.getElementById('coupon-form-error');
  const showCouponError = (message) => {
    if (!couponError) return;
    couponError.textContent = message;
    couponError.hidden = false;
  };
  const clearCouponError = () => {
    if (!couponError) return;
    couponError.textContent = '';
    couponError.hidden = true;
    form.querySelectorAll('.is-invalid').forEach((el) => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });
  };

  // พอผู้ใช้เริ่มแก้ช่องนั้น ขอบแดง/ข้อความเดิมก็ไม่จำเป็นแล้ว
  form.addEventListener('input', (e) => {
    if (!e.target.classList?.contains('is-invalid')) return;
    e.target.classList.remove('is-invalid');
    e.target.removeAttribute('aria-invalid');
    if (!form.querySelector('.is-invalid')) clearCouponError();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearCouponError();
    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    const kind = document.getElementById('coupon-kind').value;
    const value = Number(document.getElementById('coupon-value').value);
    const minSubtotal = Number(document.getElementById('coupon-min').value || 0);
    const maxUsesRaw = document.getElementById('coupon-max-uses').value;
    const endsRaw = document.getElementById('coupon-ends').value;

    // บอกให้ตรงจุดว่าลืมอะไร — เดิมทุกกรณีขึ้น "โค้ดไม่ถูกต้องหรือหมดอายุ" ซึ่งคนละเรื่อง
    const fail = (key, fieldId) => {
      const message = t(key);
      showCouponError(message);
      const field = document.getElementById(fieldId);
      if (field) {
        field.classList.add('is-invalid');
        field.setAttribute('aria-invalid', 'true');
        field.focus({ preventScroll: false });
      }
      // แผงเปิดอยู่และกล่องแดงในแผงเห็นได้อยู่แล้ว → ไม่ต้องเด้ง toast ซ้ำข้อความเดียวกัน
      if (!couponError) notify(message, 'error');
    };

    const rawCode = document.getElementById('coupon-code').value.trim();
    const rawValue = document.getElementById('coupon-value').value.trim();
    const rawMin = document.getElementById('coupon-min').value.trim();

    if (!rawCode) return fail('admin.coupon_err_code_required', 'coupon-code');
    if (rawCode.length < 2) return fail('admin.coupon_err_code_short', 'coupon-code');
    if (!/^[A-Za-z0-9_-]+$/.test(rawCode)) return fail('admin.coupon_err_code_chars', 'coupon-code');
    if (!rawValue) return fail('admin.coupon_err_value_required', 'coupon-value');
    if (!Number.isFinite(value) || value <= 0) return fail('admin.coupon_err_value_invalid', 'coupon-value');
    if (kind === 'percent' && value > 100) return fail('admin.coupon_err_percent', 'coupon-value');
    if (rawMin && (!Number.isFinite(minSubtotal) || minSubtotal < 0)) return fail('admin.coupon_err_min', 'coupon-min');
    if (maxUsesRaw && (!Number.isInteger(Number(maxUsesRaw)) || Number(maxUsesRaw) < 1))
      return fail('admin.coupon_err_max_uses', 'coupon-max-uses');

    const payload = {
      code,
      kind,
      value,
      min_subtotal: Number.isFinite(minSubtotal) ? minSubtotal : 0,
      max_uses: maxUsesRaw ? Number(maxUsesRaw) : null,
      ends_at: endsRaw ? new Date(`${endsRaw}T23:59:59`).toISOString() : null,
      active: document.getElementById('coupon-active').checked,
    };

    const { error } = editingId
      ? await supabase.from('coupons').update(payload).eq('id', editingId)
      : await supabase.from('coupons').insert(payload);

    if (error) {
      // แปลง error ของฐานข้อมูลเป็นข้อความที่ร้านเข้าใจ (เช่น ราคาส่วนลดต้องมากกว่า 0)
      const code2 = String(error.code || '');
      const message =
        code2 === '23514' || /check constraint/i.test(error.message || '')
          ? t('admin.coupon_err_db_check')
          : code2 === '42501' || /row-level security|permission denied/i.test(error.message || '')
            ? t('admin.coupon_err_permission')
            : error.message || t('toast.error_generic');
      showCouponError(message);
      // ไม่เด้ง toast ซ้ำเมื่อกล่องแดงในแผงโชว์ข้อความเดียวกันอยู่แล้ว
      if (!couponError) notify(message, 'error');
      return;
    }
    const savedId = editingId;
    clearCouponError();
    notify(t('admin.coupon_saved'), 'success');
    editingId = null;
    sheet?.closeNow();
    form.reset();
    await paint();
    if (savedId) {
      const row = tbody.querySelector(`tr[data-row-id="${savedId}"]`);
      if (row) {
        row.classList.add('is-saved');
        row.scrollIntoView({ block: 'nearest' });
        setTimeout(() => row.classList.remove('is-saved'), 1800);
      }
    }
  });

  tbody.addEventListener('click', async (e) => {
    const edit = e.target.closest('[data-edit-coupon]');
    const del = e.target.closest('[data-del-coupon]');

    if (edit) {
      const { data: c } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', edit.getAttribute('data-edit-coupon'))
        .single();
      if (!c) return;
      editingId = c.id;
      document.getElementById('coupon-code').value = c.code || '';
      document.getElementById('coupon-kind').value = c.kind || 'percent';
      document.getElementById('coupon-value').value = c.value ?? '';
      document.getElementById('coupon-min').value = c.min_subtotal ?? 0;
      document.getElementById('coupon-max-uses').value = c.max_uses ?? '';
      document.getElementById('coupon-ends').value = c.ends_at ? new Date(c.ends_at).toISOString().slice(0, 10) : '';
      document.getElementById('coupon-active').checked = !!c.active;
      clearCouponError();
      sheet?.open({ titleKey: 'admin.coupon_edit', sub: c.code || '' });
    }

    if (del) {
      const confirmed = await confirmAction(t('admin.coupon_confirm_delete'), {
        danger: true,
        confirmText: t('common.delete'),
      });
      if (!confirmed) return;
      const { error } = await supabase.from('coupons').delete().eq('id', del.getAttribute('data-del-coupon'));
      if (error) {
        notify(error.message || t('toast.error_generic'), 'error');
        return;
      }
      notify(t('admin.coupon_deleted'), 'success');
      await paint();
    }
  });
}

/* ------------------------------------------------------------------ *
 * รายงานยอดขาย + ดาวน์โหลด CSV
 * ------------------------------------------------------------------ */
async function initReports() {
  const form = document.getElementById('admin-report-form');
  const kpis = document.getElementById('report-kpis');
  const tbody = document.getElementById('report-top-list');
  if (!form || !kpis) return;

  const toISO = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 29 * 86400000);

  const fromInput = document.getElementById('report-from');
  const toInput = document.getElementById('report-to');
  fromInput.value = toISO(monthAgo);
  toInput.value = toISO(today);

  let lastReport = null;

  const paint = (report) => {
    lastReport = report;
    const cards = [
      ['admin.reports_revenue', formatTHB(report.revenue || 0)],
      ['admin.reports_orders', String(report.orders || 0)],
      ['admin.reports_units', String(report.units || 0)],
      ['admin.reports_discount', formatTHB(report.discount || 0)],
    ];
    kpis.innerHTML = cards
      .map(
        ([key, value], index) => `
        <div class="kpi${index === 0 ? ' is-accent' : ''}">
          <div class="k-label" data-i18n="${key}">${t(key)}</div>
          <div class="k-value${index === 0 ? ' accent' : ''}">${escapeHTML(value)}</div>
        </div>`,
      )
      .join('');

    if (!tbody) return;
    const top = Array.isArray(report.top_products) ? report.top_products : [];
    tbody.innerHTML = top.length
      ? top
          .map(
            (row) => `<tr>
              <td data-label="${t('admin.product')}" class="font-semibold">${escapeHTML(row.name || '-')}</td>
              <td data-label="${t('admin.reports_units')}" class="num">${row.units || 0}</td>
              <td data-label="${t('admin.reports_revenue')}" class="num">${formatTHB(row.revenue || 0)}</td>
            </tr>`,
          )
          .join('')
      : `<tr><td colspan="3" style="text-align:center;padding:2rem" class="text-muted">${escapeHTML(
          t('admin.reports_empty'),
        )}</td></tr>`;
  };

  const load = async () => {
    const from = fromInput.value;
    const to = toInput.value;
    if (!from || !to) return;
    const { data, error } = await supabase.rpc('get_sales_report', { p_from: from, p_to: to });
    if (error) {
      notify(error.message || t('admin.system_error'), 'error');
      return;
    }
    paint(data || {});
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    load();
  });

  const exportBtn = document.getElementById('report-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const from = fromInput.value;
      const to = toInput.value;
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, created_at, paid_at, status, recipient, phone, address, subtotal, discount, shipping, total, coupon_code, tracking',
        )
        .in('status', ['paid', 'shipped', 'delivered'])
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .order('created_at', { ascending: true });

      if (error) {
        notify(error.message || t('admin.system_error'), 'error');
        return;
      }

      const rows = data || [];
      const header = [
        'order_id',
        'created_at',
        'paid_at',
        'status',
        'recipient',
        'phone',
        'address',
        'subtotal',
        'discount',
        'coupon_code',
        'shipping',
        'total',
        'tracking',
      ];
      const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const body = rows.map((r) =>
        [
          r.id,
          r.created_at,
          r.paid_at,
          r.status,
          r.recipient,
          r.phone,
          r.address,
          r.subtotal,
          r.discount,
          r.coupon_code,
          r.shipping,
          r.total,
          r.tracking,
        ]
          .map(csvCell)
          .join(','),
      );
      const csv = `\uFEFF${header.join(',')}\n${body.join('\n')}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zenmarket-sales-${from}-to-${to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify(t('admin.reports_exported'), 'success');
    });
  }

  await load();

  // แปลภาษาใหม่เมื่อสลับภาษา โดยใช้ข้อมูลที่โหลดไว้แล้ว
  onLanguageChange(() => {
    if (lastReport) paint(lastReport);
  });
}

async function initPayments() {
  const form = document.getElementById('admin-payments-form');
  const generateBtn = document.getElementById('test-generate-qr-btn');
  let savedPromptPayId = '';
  let savedRecipient = '';

  try {
    const { data: s } = await supabase
      .from('store_settings')
      .select('promptpay_id, recipient_name')
      .eq('singleton', true)
      .single();
    if (s) {
      savedPromptPayId = s.promptpay_id || '';
      savedRecipient = s.recipient_name || '';
      document.getElementById('payment-promptpay-id').value = savedPromptPayId;
      document.getElementById('payment-promptpay-name').value = savedRecipient;
    }
  } catch (err) {
    console.error(err);
  }

  if (form) {
    bindOnce(form, 'submit', async (e) => {
      e.preventDefault();
      const promptpayId = document.getElementById('payment-promptpay-id').value.trim();
      const checked = validatePromptPay(promptpayId);
      if (!checked.ok) {
        notify(t(checked.errorKey), 'error');
        return;
      }
      const { error } = await supabase
        .from('store_settings')
        .update({
          promptpay_id: checked.value,
          recipient_name: document.getElementById('payment-promptpay-name').value.trim(),
        })
        .eq('singleton', true);
      if (error) notify(error.message || t('toast.error_generic'), 'error');
      else {
        savedPromptPayId = checked.value;
        savedRecipient = document.getElementById('payment-promptpay-name').value.trim();
        notify(t('admin.payments_saved'), 'success');
      }
    });
  }

  if (generateBtn) {
    bindOnce(generateBtn, 'click', async () => {
      const amount = parseFloat(document.getElementById('test-qr-amount').value) || 0;
      const reference = document.getElementById('test-qr-reference').value || 'TEST';
      // Use whatever is in the form right now so a new account can be tried
      // before it is saved.
      const typedId = document.getElementById('payment-promptpay-id').value.trim();
      const typedName = document.getElementById('payment-promptpay-name').value.trim();
      const promptpayId = typedId || savedPromptPayId;

      if (!promptpayId) {
        notify(t('admin.payments_missing_id'), 'error');
        return;
      }

      const checked = validatePromptPay(promptpayId);
      if (!checked.ok) {
        notify(t(checked.errorKey), 'error');
        return;
      }

      try {
        const payload = createPromptPayPayload(checked.value, amount, reference);
        const qrDataURL = await createPromptPayQRDataURL(payload, 640);
        document.getElementById('test-qr-image').innerHTML = promptPayCardHTML({
          qrDataURL,
          amount,
          recipient: typedName || savedRecipient,
          target: checked.value,
        });

        const download = document.getElementById('test-qr-download');
        if (download) {
          download.setAttribute('href', qrDataURL);
          download.setAttribute('download', 'promptpay-qr.png');
          const name = typedName || savedRecipient;
          promptPayCardDataURL({
            qrDataURL,
            amount,
            recipient: name,
            target: checked.value,
          })
            .then((cardUrl) => download.setAttribute('href', cardUrl))
            .catch(() => {});
        }

        const account = document.getElementById('test-qr-account');
        if (account) {
          const name = typedName || savedRecipient;
          account.textContent = name ? `${checked.value} · ${name}` : checked.value;
        }

        const source = document.getElementById('test-qr-source');
        if (source) source.textContent = typedId ? '' : t('admin.payments_qr_saved');

        const amountText = document.getElementById('test-qr-amount-text');
        if (amountText) amountText.textContent = formatTHB(amount);

        document.getElementById('test-qr-result').classList.remove('hidden');
      } catch (err) {
        notify(err.message || t('toast.error_generic'), 'error');
      }
    });
  }
}

const LOCKED_ORDER_STATUSES = ['delivered', 'cancelled'];

async function loadShopForPrint() {
  try {
    const { data } = await supabase.from('store_settings').select('*').eq('singleton', true).maybeSingle();
    return data || {};
  } catch {
    return {};
  }
}

function printSheetHtml(order, shop, mode) {
  const isSlip = mode === 'slip';
  const date = formatDate(order.created_at) || '-';
  const items = order.items || [];
  const pieces = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const rows = items
    .map(
      (item) => `<tr>
        <td>${escapeHTML(item.name || '')}</td>
        <td class="num">${Number(item.quantity || 1)}</td>
        <td class="num">${formatTHB(item.price)}</td>
        <td class="num">${formatTHB(Number(item.price || 0) * Number(item.quantity || 1))}</td>
      </tr>`,
    )
    .join('');

  const shopBlock = `
    <div class="sheet-shop">
      <strong>${escapeHTML(shop.shop_name || 'ZenMarket')}</strong>
      <span>${escapeHTML(shop.contact_phone || '')}</span>
      <span>${escapeHTML(shop.contact_address || '')}</span>
    </div>`;

  const head = `
    <div class="sheet-head">
      <h1>${escapeHTML(t(isSlip ? 'admin.print_slip_title' : 'admin.print_receipt_title'))}</h1>
      <div class="sheet-meta">
        <span>${escapeHTML(t('admin.print_order_no'))} <strong>#${escapeHTML(order.id.slice(0, 8))}</strong></span>
        <span>${escapeHTML(t('common.date'))} ${escapeHTML(date)}</span>
      </div>
    </div>`;

  if (isSlip) {
    return `${head}
      <div class="sheet-pair">
        <section class="sheet-box">
          <h2>${escapeHTML(t('admin.print_sender'))}</h2>
          ${shopBlock}
        </section>
        <section class="sheet-box sheet-box--to">
          <h2>${escapeHTML(t('admin.print_receiver'))}</h2>
          <div class="sheet-to-name">${escapeHTML(order.recipient || '-')}</div>
          <div class="sheet-to-phone">${escapeHTML(order.phone || '')}</div>
          <div class="sheet-to-address">${escapeHTML(order.address || '-')}</div>
        </section>
      </div>
      <div class="sheet-row">
        <span>${escapeHTML(t('admin.print_tracking'))}</span>
        <span class="sheet-fill">${escapeHTML(order.tracking || ' ')}</span>
        <span>${escapeHTML(t('admin.print_pieces', { n: pieces }))}</span>
      </div>
      <table class="sheet-table">
        <thead><tr><th>${escapeHTML(t('order.items'))}</th><th class="num">${escapeHTML(t('common.quantity'))}</th></tr></thead>
        <tbody>${items
          .map(
            (item) =>
              `<tr><td>${escapeHTML(item.name || '')}${item.sku ? ` <span class="sheet-sku">${escapeHTML(item.sku)}</span>` : ''}</td><td class="num">${Number(item.quantity || 1)}</td></tr>`,
          )
          .join('')}</tbody>
      </table>
      <p class="sheet-note">${escapeHTML(t('admin.print_slip_note'))}</p>`;
  }

  return `${head}
    <div class="sheet-pair">
      <section class="sheet-box">
        <h2>${escapeHTML(t('admin.print_sender'))}</h2>
        ${shopBlock}
      </section>
      <section class="sheet-box">
        <h2>${escapeHTML(t('admin.print_receiver'))}</h2>
        <div class="sheet-to-name">${escapeHTML(order.recipient || '-')}</div>
        <div class="sheet-to-phone">${escapeHTML(order.phone || '')}</div>
        <div class="sheet-to-address">${escapeHTML(order.address || '-')}</div>
      </section>
    </div>
    <table class="sheet-table">
      <thead>
        <tr>
          <th>${escapeHTML(t('order.items'))}</th>
          <th class="num">${escapeHTML(t('common.quantity'))}</th>
          <th class="num">${escapeHTML(t('admin.print_unit_price'))}</th>
          <th class="num">${escapeHTML(t('common.total'))}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sheet-totals">
      <div><span>${escapeHTML(t('cart.subtotal'))}</span><span>${formatTHB(order.subtotal)}</span></div>
      <div><span>${escapeHTML(t('cart.shipping'))}</span><span>${formatTHB(order.shipping)}</span></div>
      ${Number(order.discount) > 0 ? `<div><span>${escapeHTML(t('cart.discount'))}</span><span>-${formatTHB(order.discount)}</span></div>` : ''}
      <div class="sheet-total"><span>${escapeHTML(t('cart.total'))}</span><span>${formatTHB(order.total)}</span></div>
    </div>
    <p class="sheet-payment">
      ${escapeHTML(t('checkout.promptpay'))} —
      <strong>${escapeHTML(t(order.status === 'pending' ? 'admin.print_unpaid' : 'admin.print_paid'))}</strong>
    </p>
    <p class="sheet-note">${escapeHTML(t('admin.print_receipt_note'))}</p>`;
}

async function bindPrintSheets(order) {
  const sheet = document.getElementById('print-sheet');
  const slipBtn = document.getElementById('admin-print-slip');
  const receiptBtn = document.getElementById('admin-print-receipt');
  if (!sheet || (!slipBtn && !receiptBtn)) return;
  const shop = await loadShopForPrint();

  const run = (mode) => {
    sheet.innerHTML = printSheetHtml(order, shop, mode);
    document.body.classList.add('print-mode');
    window.print();
  };

  const cleanup = () => {
    document.body.classList.remove('print-mode');
    sheet.innerHTML = '';
  };
  window.addEventListener('afterprint', cleanup, { once: false });

  bindOnce(slipBtn, 'click', () => run('slip'));
  bindOnce(receiptBtn, 'click', () => run('receipt'));
}

async function initAdminOrderDetail() {
  const orderId = new URLSearchParams(window.location.search).get('id');
  if (!orderId) return;

  try {
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (error || !order) {
      notify(t('order.not_found'), 'error');
      return;
    }

    document.getElementById('admin-order-detail').classList.remove('hidden');
    document.getElementById('admin-order-number').textContent = '#' + order.id.slice(0, 8);
    document.getElementById('admin-order-customer').textContent =
      order.recipient || order.customer_name || order.email || '-';
    document.getElementById('admin-order-date').textContent = order.created_at ? formatDate(order.created_at) : '-';
    document.getElementById('admin-order-status').value = order.status || 'pending';
    document.getElementById('admin-order-payment').textContent = t('checkout.promptpay');
    document.getElementById('admin-order-address').textContent =
      order.address || order.shipping_address || order.delivery_address || '-';
    document.getElementById('admin-order-subtotal').textContent = formatTHB(order.subtotal);
    document.getElementById('admin-order-shipping').textContent = formatTHB(order.shipping);
    document.getElementById('admin-order-total').textContent = formatTHB(order.total);
    document.getElementById('admin-tracking-number').value = order.tracking || '';

    const carrierSelect = document.getElementById('admin-order-carrier');
    const trackingInput = document.getElementById('admin-tracking-number');
    const carrierHint = document.getElementById('admin-carrier-hint');
    let carrierTouched = Boolean(order.carrier);

    fillCarrierSelect(carrierSelect, order.carrier || '');
    if (carrierHint) carrierHint.classList.add('hidden');

    if (trackingInput && carrierSelect) {
      bindOnce(trackingInput, 'input', () => {
        const number = trackingInput.value.trim();
        if (!carrierTouched) {
          const guess = detectCarrier(number);
          if (guess && guess !== carrierSelect.value) {
            carrierSelect.value = guess;
            carrierHint?.classList.remove('hidden');
          } else if (!guess) {
            carrierSelect.value = '';
            carrierHint?.classList.add('hidden');
          }
        }
      });
      bindOnce(carrierSelect, 'change', () => {
        carrierTouched = Boolean(carrierSelect.value);
        if (carrierTouched) carrierHint?.classList.add('hidden');
      });
    }

    bindPrintSheets(order);

    const locked = LOCKED_ORDER_STATUSES.includes(order.status || 'pending');
    document.getElementById('admin-order-locked')?.classList.toggle('hidden', !locked);
    ['admin-order-status', 'admin-tracking-number', 'admin-order-carrier'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = locked;
    });
    ['admin-update-order-btn', 'admin-shipping-update-form', 'admin-shipping-divider'].forEach((id) => {
      document.getElementById(id)?.classList.toggle('hidden', locked);
    });
    const shippingTitle = document.getElementById('admin-shipping-title');
    if (shippingTitle) {
      const titleKey = locked ? 'admin.shipping_history' : 'admin.shipping_updates';
      shippingTitle.setAttribute('data-i18n', titleKey);
      shippingTitle.textContent = t(titleKey);
    }

    const items = order.items || [];
    document.getElementById('admin-order-items').innerHTML = items
      .map(
        (item) => `
      <div class="cart-row cart-row--info">
        <img class="ci-thumb" src="${item.image_url || '/images/placeholder.svg'}" alt="">
        <div class="ci-main"><div class="nm">${escapeHTML(item.name || '')}</div><div class="pr">${formatTHB(item.price)} × ${item.quantity || 1}</div></div>
        <div class="ci-qty"></div>
        <div class="ci-total font-semibold">${formatTHB(Number(item.price || 0) * Number(item.quantity || 1))}</div>
      </div>
    `,
      )
      .join('');

    if (order.slip_path) {
      const slipUrl = await getPrivateImageUrl(supabase, 'payment-slips', order.slip_path);
      document.getElementById('admin-order-receipt').innerHTML = slipUrl
        ? `<img src="${slipUrl}" alt="${escapeHTML(t('admin.order_receipt'))}" style="max-width:100%;border-radius:8px">`
        : `<p class="text-muted text-sm">${t('order.slip_unavailable')}</p>`;
    }

    renderSlipReview(order);

    const shippingForm = document.getElementById('admin-shipping-update-form');
    const pickBtn = document.getElementById('admin-shipping-pick');
    const filesInput = document.getElementById('admin-shipping-images');
    const filesStatus = document.getElementById('admin-shipping-file-status');
    if (pickBtn && filesInput) {
      bindOnce(pickBtn, 'click', () => filesInput.click());
      bindOnce(filesInput, 'change', () => {
        const picked = Array.from(filesInput.files || []);
        if (!filesStatus) return;
        filesStatus.textContent = picked.length
          ? t('admin.shipping_files_selected', { n: picked.length })
          : t('admin.shipping_no_file');
      });
    }

    if (shippingForm) {
      bindOnce(shippingForm, 'submit', async (e) => {
        e.preventDefault();
        const messageInput = document.getElementById('admin-shipping-message');
        const filesInput = document.getElementById('admin-shipping-images');
        const message = (messageInput?.value || '').trim();
        const files = Array.from(filesInput?.files || []);

        if (!message && files.length === 0) {
          notify(t('admin.shipping_empty'), 'warning');
          return;
        }
        if (files.length > 4) {
          notify(t('admin.shipping_too_many'), 'warning');
          return;
        }

        try {
          const paths = [];
          for (const file of files) {
            const { path } = await uploadShippingImage(supabase, order.id, file);
            paths.push(path);
          }
          const { error } = await supabase.rpc('add_shipping_update', {
            p_order_id: order.id,
            p_message: message || null,
            p_images: paths,
          });
          if (error) throw error;
          notify(t('admin.shipping_sent'), 'success');
          shippingForm.reset();
          if (filesStatus) filesStatus.textContent = t('admin.shipping_no_file');
          await loadShippingHistory(order.id);
        } catch (err) {
          console.error(err);
          reportClientError('admin', err?.message || 'DATABASE');
          notify(err.message || t('toast.error_generic'), 'error');
        }
      });
    }

    await loadShippingHistory(order.id);

    bindOnce(document.getElementById('admin-update-order-btn'), 'click', async () => {
      const newStatus = document.getElementById('admin-order-status').value;
      const trackingNumber = document.getElementById('admin-tracking-number').value.trim();
      const carrier = document.getElementById('admin-order-carrier')?.value || null;
      try {
        const { error } = await supabase.rpc('transition_order', {
          order_id: order.id,
          next_status: newStatus,
          tracking_number: trackingNumber || null,
          p_carrier: carrier,
        });
        if (error) throw error;
        notify(t('admin.order_updated'), 'success');
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        notify(err.message || t('toast.error_generic'), 'error');
      }
    });
  } catch (err) {
    console.error(err);
  }
}

/** แผงตรวจสลิป: เจ้าของร้านกดอนุมัติ/ตีกลับทีละใบ */
function renderSlipReview(order) {
  const box = document.getElementById('admin-slip-review');
  const status = document.getElementById('admin-slip-status');
  if (!box) return;

  const widgets = () => {
    const approve = document.getElementById('admin-slip-approve');
    const reject = document.getElementById('admin-slip-reject');
    const run = async (isApprove) => {
      let note = null;
      if (!isApprove) {
        const typed = await askText({
          title: t('admin.slip_reject_title'),
          hint: t('admin.slip_reject_prompt'),
          placeholder: t('admin.slip_reject_placeholder'),
          confirmText: t('admin.slip_reject'),
          danger: true,
        });
        if (typed === null) return;
        note = typed.trim();
      }
      const { error } = await supabase.rpc('review_slip', {
        p_order_id: order.id,
        p_approve: isApprove,
        p_note: note,
      });
      if (error) {
        notify(error.message || t('toast.error_generic'), 'error');
        return;
      }
      notify(t(isApprove ? 'admin.slip_approved' : 'admin.slip_rejected'), 'success');
      setTimeout(() => location.reload(), 700);
    };
    if (approve) approve.addEventListener('click', () => run(true));
    if (reject) reject.addEventListener('click', () => run(false));
  };

  const waiting = order.status === 'review';
  const hasSlip = !!order.slip_path;
  box.classList.toggle('hidden', !waiting);
  const approveBtn = document.getElementById('admin-slip-approve');
  const rejectBtn = document.getElementById('admin-slip-reject');
  if (approveBtn) approveBtn.classList.toggle('hidden', !hasSlip);
  if (rejectBtn) rejectBtn.classList.toggle('hidden', !hasSlip);

  if (status) {
    if (order.slip_status === 'approved') {
      status.textContent = t('admin.slip_approved_badge');
      status.className = 'slip-status is-ok';
    } else if (order.slip_status === 'rejected') {
      status.textContent = order.slip_note || t('admin.slip_rejected_badge');
      status.className = 'slip-status is-error';
    } else {
      status.className = 'slip-status hidden';
      status.textContent = '';
    }
  }

  if (waiting && hasSlip) widgets();
}

async function loadShippingHistory(orderId) {
  const box = document.getElementById('admin-shipping-history');
  if (!box) return;
  try {
    const { data, error } = await supabase
      .from('order_shipping_updates')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) {
      box.innerHTML = `<p class="text-muted text-sm">${t('order.no_updates')}</p>`;
      return;
    }
    box.innerHTML = data
      .map(
        (u) => `
      <div style="padding:0.75rem 0;border-bottom:1px solid var(--color-border-soft)">
        <div class="text-sm">${escapeHTML(u.message || '')}</div>
        <div class="text-muted text-xs">${u.created_at ? formatDateTime(u.created_at) : ''}</div>
      </div>
    `,
      )
      .join('');
  } catch (err) {
    console.warn('[ZenMarket] load shipping history failed', err);
  }
}

async function initAdminOrders() {
  const tbody = document.getElementById('admin-orders-list');
  if (!tbody) return;

  const filterButtons = document.querySelectorAll('[data-status]');
  let currentFilter = 'all';

  async function loadOrders() {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      notify(t('admin.system_error'), 'error');
      return;
    }

    const filtered = currentFilter === 'all' ? orders || [] : (orders || []).filter((o) => o.status === currentFilter);

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem" class="text-muted">${t('admin.no_orders_in_status')}</td></tr>`;
      return;
    }

    filtered.forEach((order) => {
      const badge = getOrderStatusBadge(order.status);
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td data-label="${t('order.no')}" class="font-semibold" style="color:var(--color-text)">#${order.id.slice(0, 8)}</td>` +
        `<td data-label="${t('admin.order_customer')}">${escapeHTML(order.recipient || '-')}</td>` +
        `<td data-label="${t('common.date')}">${formatDate(order.created_at) || '-'}</td>` +
        `<td data-label="${t('common.total')}" class="num">${formatTHB(order.total)}</td>` +
        `<td data-label="${t('common.status')}"><span class="badge badge-${badge.variant}">${badge.label}</span></td>` +
        `<td class="cell-actions"><a href="/admin/order?id=${order.id}" class="btn btn-outline btn-sm" aria-label="${t('common.view')} #${order.id.slice(0, 8)}" title="${t('common.view')} #${order.id.slice(0, 8)}">${t('common.view')}</a></td>`;
      tbody.appendChild(tr);
    });
  }

  loadOrders();

  filterButtons.forEach((btn) => {
    bindOnce(btn, 'click', () => {
      filterButtons.forEach((b) => b.classList.remove('btn-primary'));
      filterButtons.forEach((b) => b.classList.add('btn-outline'));
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      currentFilter = btn.getAttribute('data-status');
      loadOrders();
    });
  });
}
