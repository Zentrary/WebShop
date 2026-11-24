/**
 * ZenMarket Admin — แดชบอร์ด / สินค้า / หมวดหมู่ / รีวิว / ตั้งค่า / ชำระเงิน / คำสั่งซื้อ
 * ใช้ RPC get_admin_dashboard + schema จริง
 */

import { isOwner, setAudience } from '/src/core/audience.js';
import { notify } from '/src/core/ui.js';
import { formatTHB, escapeHTML, createPromptPayPayload, createPromptPayQRDataURL, getPrivateImageUrl, bindOnce } from '/src/core/lib.js';
import { validateSocialUrl, getOrderStatusBadge } from '/src/core/experience.js';
import { initReveal } from '/src/core/reveal.js';
import { initAdminLayout } from '/src/pages/admin/layout.js';
import { initI18n, t, translatePage, onLanguageChange } from '/src/core/i18n.js';
import { uploadStoreLogo, removeStoreLogo, uploadShippingImage, uploadProductImage, publicAssetUrl, BUCKETS, LOGO_ACCEPT } from '/src/core/storage.js';
import { reportClientError } from '/src/core/errors.js';
import { mergeStoreSettings } from '/src/core/settings.js';
import { validateStoreSettings, validateProduct, validateCategory, validatePromptPay } from '/src/core/validation.js';

let supabase;

document.addEventListener('DOMContentLoaded', async () => {
  initI18n();
  translatePage();

  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  // ตรวจสิทธิ์จากฐานข้อมูลจริง (ไม่พึ่ง localStorage อย่างเดียว)
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
    window.location.href = '/admin/login.html';
    return;
  }

  const path = window.location.pathname;
  const layoutMap = [
    ['/admin/dashboard.html', '/admin/dashboard.html'],
    ['/admin/products.html', '/admin/products.html'],
    ['/admin/categories.html', '/admin/categories.html'],
    ['/admin/reviews.html', '/admin/reviews.html'],
    ['/admin/settings.html', '/admin/settings.html'],
    ['/admin/payments.html', '/admin/payments.html'],
    ['/admin/order.html', '/admin/orders.html'],
    ['/admin/orders.html', '/admin/orders.html'],
  ];
  const active = layoutMap.find(([key]) => path.includes(key))?.[1];

  // โหลดข้อมูลร้าน (ชื่อร้าน/โลโก้) เพื่อแสดงในแถบด้านข้าง
  let storeSettings = {};
  try {
    const { data: s } = await supabase.from('store_settings').select('*').eq('singleton', true).maybeSingle();
    storeSettings = mergeStoreSettings(s);
  } catch {}

  initAdminLayout(active, storeSettings);
  initReveal();

  let renderer = null;
  if (path.includes('/admin/dashboard.html')) renderer = initDashboard;
  else if (path.includes('/admin/products.html')) renderer = initProducts;
  else if (path.includes('/admin/categories.html')) renderer = initCategories;
  else if (path.includes('/admin/reviews.html')) renderer = initReviews;
  else if (path.includes('/admin/settings.html')) renderer = initSettings;
  else if (path.includes('/admin/payments.html')) renderer = initPayments;
  else if (path.includes('/admin/order.html')) renderer = initAdminOrderDetail;
  else if (path.includes('/admin/orders.html')) renderer = initAdminOrders;

  if (renderer) await renderer();

  // เปลี่ยนภาษาแล้ววาดหน้าใหม่
  onLanguageChange(() => {
    translatePage();
    if (renderer) renderer();
  });
});

/* ================= แดชบอร์ด ================= */
async function initDashboard() {
  try {
    const { data: d, error } = await supabase.rpc('get_admin_dashboard');
    if (error) throw error;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-sales', formatTHB(d.revenue || 0));
    set('kpi-pending', d.awaiting_review || 0);
    set('kpi-products', d.product_count || 0);
    set('kpi-rating', (d.average_rating || 0).toFixed(1));

    // กราฟยอดขาย 7 วัน (แท่งแบบ CSS)
    const chart = document.getElementById('sales-chart');
    if (chart && d.daily_revenue) {
      const max = Math.max(...d.daily_revenue.map(x => Number(x.total)), 1);
      chart.innerHTML = d.daily_revenue.map(x => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
          <div style="width:100%;max-width:36px;height:${Math.max(4, (Number(x.total) / max) * 100)}%;background:var(--color-accent);border-radius:4px 4px 0 0;min-height:4px" title="${formatTHB(x.total)}"></div>
          <span style="font-size:11px;color:var(--color-text-muted)">${new Date(x.day).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
        </div>
      `).join('');
      chart.style.display = 'flex';
      chart.style.alignItems = 'stretch';
      chart.style.gap = '8px';
      chart.style.padding = '16px';
    }

    // สินค้าใกล้หมด
    const { data: products } = await supabase.from('products').select('*').order('stock', { ascending: true }).limit(5);
    const lowStockList = document.getElementById('low-stock-list');
    if (lowStockList && products) {
      lowStockList.innerHTML = products.map(p => `
        <div class="flex justify-between items-center text-sm" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border-soft)">
          <span>${escapeHTML(p.name)}</span>
          <span class="${p.stock <= 3 ? 'text-warning' : 'text-muted'} font-bold">${p.stock} ${t('common.pieces')}</span>
        </div>
      `).join('');
    }

    // รีวิวล่าสุด
    const { data: reviews } = await supabase.from('product_reviews').select('*').order('created_at', { ascending: false }).limit(5);
    const recentReviews = document.getElementById('recent-reviews');
    if (recentReviews && reviews) {
      recentReviews.innerHTML = reviews.map(r => `
        <div style="padding:0.5rem 0;border-bottom:1px solid var(--color-border-soft)">
          <div class="stars" style="font-size:12px">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
          <div class="text-sm">${escapeHTML(r.comment || '')} <span class="text-muted">— ${escapeHTML(r.reviewer_name || '')}</span></div>
        </div>
      `).join('') || `<p class="text-muted text-sm">${t('admin.no_reviews')}</p>`;
    }
  } catch (err) {
    console.error(err);
    notify(t('admin.system_error'), 'error');
  }
}

/* ================= สินค้า ================= */
async function initProducts() {
  const tbody = document.getElementById('admin-products-list');
  const searchInput = document.getElementById('admin-product-search');
  const addBtn = document.getElementById('admin-add-product-btn');
  const form = document.getElementById('admin-product-form');
  const formTitle = document.getElementById('admin-product-form-title');
  let editingId = null;

  async function loadProducts() {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { notify(t('admin.system_error'), 'error'); return; }

    tbody.innerHTML = '';
    products?.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><img src="${p.image_url || '/images/placeholder.svg'}" style="width:40px;height:40px;object-fit:cover;border-radius:6px" alt=""></td>` +
        `<td class="font-semibold" style="color:var(--color-text)">${escapeHTML(p.name)}</td>` +
        `<td>${escapeHTML(p.category || '-')}</td>` +
        `<td class="num">${formatTHB(p.price)}</td>` +
        `<td style="text-align:center">${p.stock}</td>` +
        `<td><span class="badge badge-${p.active ? 'success' : 'error'}">${p.active ? t('admin.active') : t('admin.hidden')}</span></td>` +
        `<td><button class="btn btn-outline btn-sm" data-edit="${p.id}">${t('common.edit')}</button> ` +
        `<button class="btn btn-outline btn-sm" data-toggle="${p.id}">${p.active ? t('admin.hide') : t('admin.show')}</button> ` +
        `<button class="btn btn-danger btn-sm" data-del="${p.id}">${t('common.delete')}</button></td>`;
      tbody.appendChild(tr);
    });
  }

  loadProducts();

  bindOnce(tbody, 'click', async (e) => {
    const edit = e.target.closest('[data-edit]');
    const toggle = e.target.closest('[data-toggle]');
    const del = e.target.closest('[data-del]');

    if (edit) {
      const { data: p } = await supabase.from('products').select('*').eq('id', edit.getAttribute('data-edit')).single();
      if (!p) return;
      editingId = p.id;
      formTitle.textContent = t('admin.edit_product');
      form.classList.remove('hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.getElementById('product-name').value = p.name || '';
      document.getElementById('product-sku').value = p.sku || '';
      document.getElementById('product-category').value = p.category || '';
      document.getElementById('product-price').value = p.price || 0;
      document.getElementById('product-stock').value = p.stock || 0;
      document.getElementById('product-image').value = p.image_url || '';
      document.getElementById('product-description').value = p.description || '';
      document.getElementById('product-active').checked = !!p.active;
      return;
    }

    if (toggle) {
      const id = toggle.getAttribute('data-toggle');
      const { data: p } = await supabase.from('products').select('active').eq('id', id).single();
      await supabase.from('products').update({ active: !p.active }).eq('id', id);
      loadProducts();
    }

    if (del) {
      if (confirm(t('admin.delete_confirm'))) {
        await supabase.from('products').delete().eq('id', del.getAttribute('data-del'));
        notify(t('toast.deleted'), 'success');
        loadProducts();
      }
    }
  });

  if (addBtn) {
    bindOnce(addBtn, 'click', () => {
      editingId = null;
      formTitle.textContent = t('admin.new_product');
      form.classList.remove('hidden');
      form.reset();
      document.getElementById('product-active').checked = true;
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // อัปโหลดรูปสินค้าเข้า bucket product-images
  const imageUploadBtn = document.getElementById('product-image-upload-btn');
  const imageFileInput = document.getElementById('product-image-file');
  const imageStatus = document.getElementById('product-image-status');
  const imageUrlInput = document.getElementById('product-image');

  if (imageUploadBtn && imageFileInput) {
    bindOnce(imageUploadBtn, 'click', () => imageFileInput.click());
    bindOnce(imageFileInput, 'change', async () => {
      const file = imageFileInput.files?.[0];
      if (!file) return;
      imageUploadBtn.disabled = true;
      if (imageStatus) imageStatus.textContent = t('common.loading');
      try {
        const { url } = await uploadProductImage(supabase, file);
        if (imageUrlInput) imageUrlInput.value = url;
        if (imageStatus) imageStatus.textContent = t('admin.product_upload_done');
      } catch (err) {
        console.error(err);
        if (imageStatus) imageStatus.textContent = t('toast.error_generic');
        notify(err.message || t('toast.error_generic'), 'error');
      } finally {
        imageUploadBtn.disabled = false;
        imageFileInput.value = '';
      }
    });
  }

  if (form) {
    bindOnce(form, 'submit', async (e) => {
      e.preventDefault();
      const checked = validateProduct({
        name: document.getElementById('product-name').value,
        sku: document.getElementById('product-sku').value,
        category: document.getElementById('product-category').value,
        price: document.getElementById('product-price').value,
        stock: document.getElementById('product-stock').value,
        image_url: document.getElementById('product-image').value,
        description: document.getElementById('product-description').value,
        active: document.getElementById('product-active').checked,
      });
      if (!checked.ok) { notify(t(checked.errorKey), 'error'); return; }

      const payload = {
        ...checked.value,
        category: checked.value.category?.trim() || null,
      };
      if (!payload.name) { notify(t('admin.product_name_required'), 'error'); return; }

      let error;
      if (editingId) {
        ({ error } = await supabase.from('products').update(payload).eq('id', editingId));
      } else {
        payload.image_urls = payload.image_url ? [payload.image_url] : [];
        ({ error } = await supabase.from('products').insert(payload));
      }
      if (error) { notify(error.message || t('toast.error_generic'), 'error'); return; }

      notify(editingId ? t('admin.product_saved') : t('admin.product_added'), 'success');
      editingId = null;
      form.classList.add('hidden');
      form.reset();
      loadProducts();
    });

    const cancelBtn = document.getElementById('admin-product-cancel');
    if (cancelBtn) {
      bindOnce(cancelBtn, 'click', () => {
        editingId = null;
        form.classList.add('hidden');
      });
    }
  }

  if (searchInput) {
    bindOnce(searchInput, 'input', () => {
      const term = searchInput.value.toLowerCase();
      tbody.querySelectorAll('tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  }
}

/* ================= หมวดหมู่ ================= */
async function initCategories() {
  const list = document.getElementById('admin-categories-list');
  const form = document.getElementById('admin-category-form');

  async function loadCategories() {
    const { data: categories } = await supabase.from('categories').select('*').order('name');
    list.innerHTML = '';
    categories?.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'flex justify-between items-center';
      item.style.cssText = 'padding:0.75rem 0;border-bottom:1px solid var(--color-border-soft)';
      item.innerHTML =
        `<span class="font-semibold" style="color:var(--color-text)">${escapeHTML(cat.name)}</span>` +
        `<button class="btn btn-danger btn-sm" data-del="${escapeHTML(cat.name)}">${t('common.delete')}</button>`;
      list.appendChild(item);
    });
  }

  loadCategories();

  bindOnce(list, 'click', async (e) => {
    const btn = e.target.closest('[data-del]');
    if (btn && confirm(t('admin.delete_confirm'))) {
      await supabase.from('categories').delete().eq('name', btn.getAttribute('data-del'));
      loadCategories();
    }
  });

  if (form) {
    bindOnce(form, 'submit', async (e) => {
      e.preventDefault();
      const checked = validateCategory(document.getElementById('admin-category-name').value);
      if (!checked.ok) { notify(t(checked.errorKey), 'error'); return; }
      const name = checked.value;
      const { error } = await supabase.from('categories').insert({ name });
      if (error) notify(error.message || t('toast.error_generic'), 'error');
      else { notify(t('admin.category_added'), 'success'); form.reset(); loadCategories(); }
    });
  }
}

/* ================= รีวิว ================= */
async function initReviews() {
  const tbody = document.getElementById('admin-reviews-list');
  if (!tbody) return;
  const { data: reviews, error } = await supabase
    .from('product_reviews')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { notify(t('admin.system_error'), 'error'); return; }

  tbody.innerHTML = '';
  reviews?.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${escapeHTML(r.reviewer_name || t('common.customer'))}</td>` +
      `<td>${escapeHTML(r.product_name || t('admin.product'))}</td>` +
      `<td style="text-align:center"><span class="stars" style="font-size:12px">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></td>` +
      `<td>${escapeHTML(r.comment || '-')}</td>` +
      `<td>${r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH') : '-'}</td>` +
      `<td><button class="btn btn-danger btn-sm" data-del="${r.id}">${t('common.delete')}</button></td>`;
    tbody.appendChild(tr);
  });

  bindOnce(tbody, 'click', async (e) => {
    const btn = e.target.closest('[data-del]');
    if (btn && confirm(t('admin.delete_confirm'))) {
      await supabase.from('product_reviews').delete().eq('id', btn.getAttribute('data-del'));
      initReviews();
    }
  });
}

/* ================= ตั้งค่า ================= */
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
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      set('setting-store-name', s.shop_name);
      set('setting-store-logo', s.logo_url);
      set('setting-store-description', s.tagline);
      set('setting-contact-email', s.contact_email);
      set('setting-contact-phone', s.contact_phone);
      set('setting-contact-line', s.line_url);
      set('setting-contact-facebook', s.facebook_url);
      set('setting-contact-instagram', s.instagram_url);
      set('setting-shipping-fee', s.shipping_fee);
      set('setting-free-shipping-threshold', s.free_shipping_threshold);
      set('setting-about', s.about_text);
      set('setting-shipping-note', s.shipping_note);
      currentLogoUrl = s.logo_url || '';
    }
  } catch (err) { console.error(err); }

  paintLogoPreview(currentLogoUrl);

  // อัปโหลดโลโก้
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
        // บันทึกทันทีให้ผู้ใช้เห็นผล
        const { error } = await supabase.from('store_settings').update({ logo_url: url }).eq('singleton', true);
        if (error) throw error;
        notify(t('admin.logo_updated'), 'success');
      } catch (err) {
        console.error(err);
        const code = err?.message || 'upload-failed';
        notify(code === 'invalid-type' ? t('admin.logo_invalid_type')
          : code === 'too-large' ? t('admin.logo_too_large')
          : t('toast.error_generic'), 'error');
      } finally {
        logoFileInput.value = '';
      }
    });
  }

  // ลบโลโก้
  if (logoRemoveBtn) {
    bindOnce(logoRemoveBtn, 'click', async () => {
      if (!currentLogoUrl) return;
      try {
        // อัปเดตฐานข้อมูลก่อน → ถ้าล้มเหลวไฟล์โลโก้เดิมยังไม่ถูกลบ
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
        line_url: validateSocialUrl(get('setting-contact-line'), 'line'),
        facebook_url: validateSocialUrl(get('setting-contact-facebook'), 'facebook'),
        instagram_url: validateSocialUrl(get('setting-contact-instagram'), 'instagram'),
        // ส่งค่าดิบให้ validator ตรวจ (ค่า 0 ที่ถูกต้องต้องไม่ถูกแทนด้วยค่าเริ่มต้น)
        shipping_fee: get('setting-shipping-fee').trim(),
        free_shipping_threshold: get('setting-free-shipping-threshold').trim(),
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
}

/* ================= ชำระเงิน ================= */
async function initPayments() {
  const form = document.getElementById('admin-payments-form');
  const generateBtn = document.getElementById('test-generate-qr-btn');

  try {
    const { data: s } = await supabase.from('store_settings').select('promptpay_id, recipient_name').eq('singleton', true).single();
    if (s) {
      document.getElementById('payment-promptpay-id').value = s.promptpay_id || '';
      document.getElementById('payment-promptpay-name').value = s.recipient_name || '';
    }
  } catch (err) { console.error(err); }

  if (form) {
    bindOnce(form, 'submit', async (e) => {
      e.preventDefault();
      const promptpayId = document.getElementById('payment-promptpay-id').value.trim();
      const checked = validatePromptPay(promptpayId);
      if (!checked.ok) {
        notify(t(checked.errorKey), 'error');
        return;
      }
      const { error } = await supabase.from('store_settings').update({
        promptpay_id: checked.value,
        recipient_name: document.getElementById('payment-promptpay-name').value.trim(),
      }).eq('singleton', true);
      if (error) notify(error.message || t('toast.error_generic'), 'error');
      else notify(t('admin.payments_saved'), 'success');
    });
  }

  if (generateBtn) {
    bindOnce(generateBtn, 'click', async () => {
      const amount = parseFloat(document.getElementById('test-qr-amount').value) || 0;
      const reference = document.getElementById('test-qr-reference').value || 'TEST';
      try {
        const { data: s } = await supabase.from('store_settings').select('promptpay_id').eq('singleton', true).single();
        if (!s?.promptpay_id) { notify(t('admin.payments_missing_id'), 'error'); return; }
        const payload = createPromptPayPayload(s.promptpay_id, amount, reference);
        const qrDataURL = await createPromptPayQRDataURL(payload);
        document.getElementById('test-qr-image').innerHTML = `<img src="${qrDataURL}" alt="QR PromptPay" style="width:220px;height:220px">`;
        document.getElementById('test-qr-payload').textContent = payload;
        document.getElementById('test-qr-result').classList.remove('hidden');
      } catch (err) {
        notify(err.message || t('toast.error_generic'), 'error');
      }
    });
  }
}

/* ================= จัดการคำสั่งซื้อ (รายละเอียด) ================= */
async function initAdminOrderDetail() {
  const orderId = new URLSearchParams(window.location.search).get('id');
  if (!orderId) return;

  try {
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (error || !order) { notify(t('order.not_found'), 'error'); return; }

    document.getElementById('admin-order-detail').classList.remove('hidden');
    document.getElementById('admin-order-number').textContent = '#' + order.id.slice(0, 8);
    document.getElementById('admin-order-customer').textContent = order.recipient || '-';
    document.getElementById('admin-order-date').textContent = order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-';
    document.getElementById('admin-order-status').value = order.status || 'pending';
    document.getElementById('admin-order-payment').textContent = t('checkout.promptpay');
    document.getElementById('admin-order-address').textContent = order.address || '-';
    document.getElementById('admin-order-subtotal').textContent = formatTHB(order.subtotal);
    document.getElementById('admin-order-shipping').textContent = formatTHB(order.shipping);
    document.getElementById('admin-order-total').textContent = formatTHB(order.total);
    document.getElementById('admin-tracking-number').value = order.tracking || '';

    const items = order.items || [];
    document.getElementById('admin-order-items').innerHTML = items.map(item => `
      <div class="cart-row">
        <img src="${item.image_url || '/images/placeholder.svg'}" alt="">
        <div><div class="nm">${escapeHTML(item.name || '')}</div><div class="pr">${formatTHB(item.price)} × ${item.quantity}</div></div>
        <div></div>
        <div class="font-semibold">${formatTHB(item.price * item.quantity)}</div>
      </div>
    `).join('');

    if (order.slip_path) {
      const slipUrl = await getPrivateImageUrl(supabase, 'payment-slips', order.slip_path);
      document.getElementById('admin-order-receipt').innerHTML = slipUrl
        ? `<img src="${slipUrl}" alt="สลิป" style="max-width:100%;border-radius:8px">`
        : `<p class="text-muted text-sm">${t('order.slip_unavailable')}</p>`;
    }

    // ---- อัปเดตการจัดส่ง (ส่งข้อความ + รูปให้ลูกค้า) ----
    const shippingForm = document.getElementById('admin-shipping-update-form');
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
      try {
        const { error } = await supabase.rpc('transition_order', {
          order_id: order.id,
          next_status: newStatus,
          tracking_number: trackingNumber || null,
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

/* ================= ประวัติการจัดส่ง (แอดมิน) ================= */
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
    box.innerHTML = data.map(u => `
      <div style="padding:0.75rem 0;border-bottom:1px solid var(--color-border-soft)">
        <div class="text-sm">${escapeHTML(u.message || '')}</div>
        <div class="text-muted text-xs">${u.created_at ? new Date(u.created_at).toLocaleString('th-TH') : ''}</div>
      </div>
    `).join('');
  } catch (err) {
    console.warn('[ZenMarket] load shipping history failed', err);
  }
}

/* ================= คำสั่งซื้อ (แอดมิน) ================= */
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
    if (error) { notify(t('admin.system_error'), 'error'); return; }

    const filtered = currentFilter === 'all'
      ? (orders || [])
      : (orders || []).filter(o => o.status === currentFilter);

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem" class="text-muted">${t('admin.no_orders_in_status')}</td></tr>`;
      return;
    }

    filtered.forEach(order => {
      const badge = getOrderStatusBadge(order.status);
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="font-semibold" style="color:var(--color-text)">#${order.id.slice(0, 8)}</td>` +
        `<td>${escapeHTML(order.recipient || '-')}</td>` +
        `<td>${order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-'}</td>` +
        `<td class="num">${formatTHB(order.total)}</td>` +
        `<td><span class="badge badge-${badge.variant}">${badge.label}</span></td>` +
        `<td><a href="/admin/order.html?id=${order.id}" class="btn btn-outline btn-sm">${t('common.view')}</a></td>`;
      tbody.appendChild(tr);
    });
  }

  loadOrders();

  filterButtons.forEach(btn => {
    bindOnce(btn, 'click', () => {
      filterButtons.forEach(b => b.classList.remove('btn-primary'));
      filterButtons.forEach(b => b.classList.add('btn-outline'));
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      currentFilter = btn.getAttribute('data-status');
      loadOrders();
    });
  });
}
