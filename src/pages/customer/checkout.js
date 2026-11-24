import { initApp, state, updateCartBadge, requireSupabase, renderGuestGate, applyMemberGating } from '/src/app.js';
import { isSignedIn } from '/src/core/audience.js';
import { translatePage, t, onLanguageChange } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import {
  formatTHB,
  escapeHTML,
  createPromptPayPayload,
  createPromptPayQRDataURL,
  getPrivateImageUrl,
  buildSlipObjectPath,
  bindOnce,
} from '/src/core/lib.js';
import { validateDelivery } from '/src/core/validation.js';
import { getOrderStatusBadge, getTimelineProgress } from '/src/core/experience.js';
import { calculateShipping, amountToFreeShipping } from '/src/core/settings.js';

let currentRenderer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  translatePage();

  if (!requireSupabase()) return;

  const path = window.location.pathname;

  if (path.includes('/shop/cart')) {
    currentRenderer = initCartPage;
  } else if (path.includes('/shop/checkout')) {
    currentRenderer = initCheckoutPage;
  } else if (path.includes('/account/orders')) {
    currentRenderer = initCustomerOrdersPage;
  } else if (path.includes('/account/order')) {
    currentRenderer = initCustomerOrderDetailPage;
  }

  if (currentRenderer) await currentRenderer();

  applyMemberGating();

  onLanguageChange(() => {
    translatePage();
    if (currentRenderer) currentRenderer();
    applyMemberGating();
  });
});

function initCartPage() {
  renderCart();

  bindOnce(document.getElementById('cart-items'), 'click', (e) => {
    const removeBtn = e.target.closest('[data-remove-item]');
    if (removeBtn) {
      state.cart = state.cart.filter((i) => i.product_id !== removeBtn.getAttribute('data-remove-item'));
      localStorage.setItem('zenmarket_cart', JSON.stringify(state.cart));
      updateCartBadge();
      renderCart();
      return;
    }
    const changeBtn = e.target.closest('[data-change-qty]');
    if (changeBtn) {
      const pid = changeBtn.getAttribute('data-change-qty');
      const dir = parseInt(changeBtn.getAttribute('data-dir'));
      const item = state.cart.find((i) => i.product_id === pid);
      if (item) {
        item.quantity = Math.max(1, item.quantity + dir);
        localStorage.setItem('zenmarket_cart', JSON.stringify(state.cart));
        updateCartBadge();
        renderCart();
      }
    }
  });
}

// คูปองที่ใช้อยู่ (ตรวจกับเซิร์ฟเวอร์แล้วเท่านั้น — ฝั่งเซิร์ฟเวอร์คิดส่วนลดซ้ำอีกครั้งตอนสร้างออเดอร์)
let appliedCoupon = null;

function cartTotals() {
  const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = Math.min(appliedCoupon?.discount || 0, subtotal);
  const shipping = calculateShipping(subtotal, state.storeSettings || {});
  return { subtotal, shipping, discount, total: Math.max(subtotal - discount, 0) + shipping };
}

function renderCheckoutTotals() {
  const totals = cartTotals();
  const subtotalEl = document.getElementById('checkout-subtotal');
  if (!subtotalEl) return totals;
  subtotalEl.textContent = formatTHB(totals.subtotal);

  const discountRow = document.getElementById('checkout-discount-row');
  if (discountRow) {
    discountRow.classList.toggle('hidden', !totals.discount);
    document.getElementById('checkout-discount').textContent = `−${formatTHB(totals.discount)}`;
  }
  document.getElementById('checkout-shipping').textContent =
    totals.shipping === 0 ? t('cart.free') : formatTHB(totals.shipping);
  document.getElementById('checkout-total').textContent = formatTHB(totals.total);
  showQR(totals.total);
  return totals;
}

function renderCart() {
  const cartContent = document.getElementById('cart-content');
  const cartEmpty = document.getElementById('cart-empty');
  const cartItemsEl = document.getElementById('cart-items');

  if (!state.cart || state.cart.length === 0) {
    cartEmpty.classList.remove('hidden');
    cartContent.classList.add('hidden');
    return;
  }

  cartEmpty.classList.add('hidden');
  cartContent.classList.remove('hidden');
  cartItemsEl.innerHTML = '';

  state.cart.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'cart-row';
    el.innerHTML = `
      <img src="/images/placeholder.svg" alt="${escapeHTML(item.name)}">
      <div>
        <div class="nm">${escapeHTML(item.name)}</div>
        <div class="pr">${formatTHB(item.price)} ${t('cart.per_item')}</div>
      </div>
      <div class="qty-ctl">
        <button data-change-qty="${item.product_id}" data-dir="-1" aria-label="${t('common.decrease')}">−</button>
        <input type="text" value="${item.quantity}" readonly aria-label="${t('common.quantity')}">
        <button data-change-qty="${item.product_id}" data-dir="1" aria-label="${t('common.increase')}">+</button>
      </div>
      <div style="text-align:right">
        <div class="font-semibold">${formatTHB(item.price * item.quantity)}</div>
        <button class="text-error text-sm mt-sm" data-remove-item="${item.product_id}">${t('cart.remove')}</button>
      </div>
    `;
    cartItemsEl.appendChild(el);
  });

  const { subtotal, shipping, total } = cartTotals();
  document.getElementById('cart-subtotal').textContent = formatTHB(subtotal);
  document.getElementById('cart-shipping').textContent = shipping === 0 ? t('cart.free') : formatTHB(shipping);
  document.getElementById('cart-total').textContent = formatTHB(total);

  const hint = document.getElementById('cart-shipping-hint');
  if (hint) {
    const remain = amountToFreeShipping(subtotal, state.storeSettings || {});
    hint.textContent = remain > 0 ? t('cart.free_hint', { amount: formatTHB(remain) }) : t('cart.free_done');
    hint.style.color = remain > 0 ? 'var(--color-accent)' : 'var(--color-success)';
  }
}

async function initCheckoutPage() {
  const form = document.getElementById('checkout-form');
  const placeOrderBtn = document.getElementById('place-order-btn');

  if (!state.cart || state.cart.length === 0) {
    window.location.href = '/shop/cart';
    return;
  }

  if (!isSignedIn() || !state.user) {
    sessionStorage.setItem('zenmarket_return_path', '/shop/checkout');
    const gate = document.getElementById('checkout-gate');
    const content = document.getElementById('checkout-content');
    if (content) content.classList.add('hidden');
    if (gate) {
      renderGuestGate('checkout-gate');
      applyMemberGating(gate);
    }
    return;
  }

  document.getElementById('checkout-items').innerHTML = state.cart
    .map(
      (item) => `
    <div class="sum-row"><span>${escapeHTML(item.name)} × ${item.quantity}</span><span>${formatTHB(item.price * item.quantity)}</span></div>
  `,
    )
    .join('');
  renderCheckoutTotals();
  loadSavedAddresses();
  bindCouponBox();

  const payOpts = document.querySelectorAll('.pay-opt');
  payOpts.forEach((opt) => {
    bindOnce(opt, 'click', () => {
      payOpts.forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
    });
  });

  bindOnce(placeOrderBtn, 'click', async () => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = t('checkout.placing');

    try {
      const cart = state.cart.map((i) => ({ id: i.product_id, quantity: i.quantity }));

      const checked = validateDelivery({
        recipient: document.getElementById('checkout-name').value,
        phone: document.getElementById('checkout-phone').value,
        address: document.getElementById('checkout-address').value,
      });
      if (!checked.ok) {
        notify(t(checked.errorKey), 'error');
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = t('checkout.place_order');
        return;
      }
      const delivery = checked.value;
      const requestKey = crypto.randomUUID();

      const { data: order, error } = await state.supabase.rpc('create_order', {
        cart,
        delivery,
        request_key: requestKey,
        p_coupon: appliedCoupon?.code || null,
      });

      if (error) throw error;

      state.cart = [];
      localStorage.setItem('zenmarket_cart', '[]');
      updateCartBadge();

      notify(t('toast.order_placed'), 'success');
      setTimeout(() => {
        window.location.href = `/account/order?id=${order.id}`;
      }, 1200);
    } catch (err) {
      console.error(err);
      notify(err.message || t('toast.error_generic'), 'error');
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = t('checkout.place_order');
    }
  });
}

/**
 * ที่อยู่ที่ลูกค้าเคยบันทึกไว้ — แตะครั้งเดียวก็เติมชื่อ/เบอร์/ที่อยู่ให้
 * (ไม่ต้องพิมพ์ใหม่ทุกครั้งที่สั่งซื้อ)
 */
async function loadSavedAddresses() {
  const host = document.getElementById('checkout-saved');
  if (!host || !state.user?.id) return;
  try {
    const { data, error } = await state.supabase
      .from('customer_addresses')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) {
      host.classList.add('hidden');
      return;
    }

    host.innerHTML = `
      <p class="text-muted text-sm">${escapeHTML(t('checkout.saved_addresses'))} · ${escapeHTML(t('checkout.saved_addresses_hint'))}</p>
      <div class="checkout-saved-list">
        ${data
          .map(
            (addr, index) => `
          <button type="button" class="saved-address" data-address-index="${index}">
            <span class="lbl">${escapeHTML(addr.label || addr.recipient || '')}</span>
            <span class="addr">${escapeHTML(addr.address || '')}</span>
            ${addr.is_default ? `<span class="pill">${escapeHTML(t('checkout.default_address'))}</span>` : ''}
          </button>`,
          )
          .join('')}
      </div>`;

    host.classList.remove('hidden');
    host.querySelectorAll('[data-address-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const addr = data[Number(btn.getAttribute('data-address-index'))];
        if (!addr) return;
        document.getElementById('checkout-name').value = addr.recipient || '';
        document.getElementById('checkout-phone').value = addr.phone || '';
        document.getElementById('checkout-address').value = addr.address || '';
        host.querySelectorAll('.saved-address').forEach((el) => el.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });
  } catch (err) {
    console.warn('[ZenMarket] saved addresses unavailable', err);
    host.classList.add('hidden');
  }
}

function setCouponStatus(message, variant) {
  const el = document.getElementById('coupon-status');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('is-ok', variant === 'ok');
  el.classList.toggle('is-error', variant === 'error');
}

/**
 * ใช้โค้ดส่วนลด: ตรวจกับเซิร์ฟเวอร์ก่อน แล้วค่อยเอายอดลดมาแสดง
 * ฝั่งเซิร์ฟเวอร์จะคิดส่วนลดซ้ำตอนสร้างออเดอร์จริง
 */
async function applyCouponCode(rawCode) {
  const code = (rawCode || '').trim();
  if (!code) {
    setCouponStatus('', null);
    return;
  }
  const { subtotal } = cartTotals();

  try {
    const { data, error } = await state.supabase.rpc('check_coupon', { p_code: code, p_subtotal: subtotal });
    if (error) throw error;

    if (!data || data.ok !== true) {
      const reason = data?.reason;
      const message =
        reason === 'min_subtotal'
          ? t('coupon.min_subtotal', { amount: formatTHB(data.min_subtotal) })
          : reason === 'used_up'
            ? t('coupon.used_up')
            : reason === 'expired'
              ? t('coupon.expired')
              : reason === 'not_started'
                ? t('coupon.not_started')
                : t('coupon.invalid');
      appliedCoupon = null;
      renderCheckoutTotals();
      setCouponStatus(message, 'error');
      return;
    }

    appliedCoupon = { code: data.code, discount: Number(data.discount) || 0 };
    const totals = renderCheckoutTotals();
    setCouponStatus(t('coupon.applied', { code: data.code, amount: formatTHB(totals.discount) }), 'ok');
  } catch (err) {
    console.error(err);
    appliedCoupon = null;
    renderCheckoutTotals();
    setCouponStatus(t('coupon.invalid'), 'error');
  }
}

function bindCouponBox() {
  const input = document.getElementById('coupon-input');
  const applyBtn = document.getElementById('coupon-apply');
  if (!input || !applyBtn) return;

  applyBtn.addEventListener('click', () => {
    if (appliedCoupon) {
      appliedCoupon = null;
      input.value = '';
      setCouponStatus('', null);
      renderCheckoutTotals();
      applyBtn.textContent = t('coupon.apply');
      return;
    }
    applyCouponCode(input.value).then(() => {
      applyBtn.textContent = appliedCoupon ? t('coupon.remove') : t('coupon.apply');
    });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    applyCouponCode(input.value).then(() => {
      applyBtn.textContent = appliedCoupon ? t('coupon.remove') : t('coupon.apply');
    });
  });
}

async function showQR(amount) {
  try {
    const s = state.storeSettings || {};
    const promptpayId = s.promptpay_id;
    if (!promptpayId) return;
    const payload = createPromptPayPayload(promptpayId, amount);
    const qrDataURL = await createPromptPayQRDataURL(payload);
    document.getElementById('qr-container').innerHTML = `<img src="${qrDataURL}" alt="QR PromptPay">`;
    document.getElementById('qr-amount').textContent = formatTHB(amount);
    document.getElementById('promptpay-qr').classList.remove('hidden');
  } catch (err) {
    console.error(err);
  }
}

async function initCustomerOrdersPage() {
  if (!isSignedIn() || !state.user?.id) {
    sessionStorage.setItem('zenmarket_return_path', window.location.pathname + window.location.search);
    window.location.href = '/auth/login';
    return;
  }

  try {
    const { data: orders, error } = await state.supabase
      .from('orders')
      .select('*')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById('orders-list');
    tbody.innerHTML = '';

    if (!orders || orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem">${t('account.no_orders')}</td></tr>`;
      return;
    }

    orders.forEach((order) => {
      const badge = getOrderStatusBadge(order.status);
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td data-label="${t('order.no')}" class="font-semibold">#${order.id.slice(0, 8)}</td>` +
        `<td data-label="${t('common.date')}">${order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-'}</td>` +
        `<td data-label="${t('common.status')}"><span class="badge badge-${badge.variant}">${badge.label}</span></td>` +
        `<td data-label="${t('common.total')}" class="num">${formatTHB(order.total)}</td>` +
        `<td class="cell-actions"><a href="/account/order?id=${order.id}" class="btn btn-outline btn-sm">${t('common.view')}</a></td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    notify(t('toast.error_generic'), 'error');
  }
}

async function loadCustomerShippingUpdates(orderId) {
  const box = document.getElementById('order-shipping-updates');
  if (!box) return;
  try {
    const { data, error } = await state.supabase
      .from('order_shipping_updates')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      box.innerHTML = `<p class="text-muted text-sm">${t('order.no_updates')}</p>`;
      return;
    }

    box.innerHTML = '';
    for (const update of data) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:0.75rem 0;border-bottom:1px solid var(--color-border-soft)';
      wrap.innerHTML = `
        <div class="text-sm">${escapeHTML(update.message || '')}</div>
        <div class="text-muted text-xs">${update.created_at ? new Date(update.created_at).toLocaleString('th-TH') : ''}</div>
      `;

      const paths = Array.isArray(update.image_paths) ? update.image_paths : [];
      if (paths.length) {
        const gallery = document.createElement('div');
        gallery.className = 'flex gap-sm mt-sm';
        gallery.style.flexWrap = 'wrap';
        for (const path of paths) {
          const signedUrl = await getPrivateImageUrl(state.supabase, 'shipping-updates', path);
          if (!signedUrl) continue;
          const img = document.createElement('img');
          img.src = signedUrl;
          img.alt = 'shipping';
          img.style.cssText =
            'width:96px;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--color-border)';
          gallery.appendChild(img);
        }
        if (gallery.children.length) wrap.appendChild(gallery);
      }

      box.appendChild(wrap);
    }
  } catch (err) {
    console.warn('[ZenMarket] load shipping updates failed', err);
    box.innerHTML = `<p class="text-muted text-sm">${t('order.no_updates')}</p>`;
  }
}

async function initCustomerOrderDetailPage() {
  if (!isSignedIn() || !state.user?.id) {
    sessionStorage.setItem('zenmarket_return_path', window.location.pathname + window.location.search);
    window.location.href = '/auth/login';
    return;
  }

  const orderId = new URLSearchParams(window.location.search).get('id');
  if (!orderId) {
    window.location.href = '/account/orders';
    return;
  }

  try {
    const { data: order, error } = await state.supabase.from('orders').select('*').eq('id', orderId).single();

    if (error || !order) {
      document.getElementById('order-not-found').classList.remove('hidden');
      return;
    }

    document.getElementById('order-detail').classList.remove('hidden');
    document.getElementById('order-number').textContent = '#' + order.id.slice(0, 8);
    document.getElementById('order-date').textContent = order.created_at
      ? new Date(order.created_at).toLocaleDateString('th-TH')
      : '-';
    const badge = getOrderStatusBadge(order.status);
    const statusEl = document.getElementById('order-status');
    statusEl.textContent = badge.label;
    statusEl.className = 'badge badge-' + badge.variant;
    document.getElementById('order-payment').textContent = t('checkout.promptpay');
    document.getElementById('order-shipping-address').textContent = order.address || '-';
    document.getElementById('order-subtotal').textContent = formatTHB(order.subtotal);
    document.getElementById('order-shipping').textContent = formatTHB(order.shipping);
    document.getElementById('order-total').textContent = formatTHB(order.total);
    if (order.tracking) {
      document.getElementById('order-tracking').textContent = order.tracking;
      document.getElementById('order-tracking-row').classList.remove('hidden');
    }

    const steps = getTimelineProgress(order.status);
    document.getElementById('order-timeline').innerHTML = steps
      .map(
        (step) => `
      <div class="tl-step ${step.completed ? 'done' : ''}">
        <div class="tl-dot">${step.completed ? '✓' : ''}</div>
        <div class="lbl">${step.label}</div>
      </div>
    `,
      )
      .join('');

    const items = order.items || [];
    document.getElementById('order-items-list').innerHTML = items
      .map(
        (item) => `
      <div class="cart-row">
        <img src="${item.image_url || '/images/placeholder.svg'}" alt="${escapeHTML(item.name || '')}">
        <div>
          <div class="nm">${escapeHTML(item.name || '')}</div>
          <div class="pr">${formatTHB(item.price)} × ${item.quantity}</div>
        </div>
        <div></div>
        <div class="font-semibold">${formatTHB(item.price * item.quantity)}</div>
      </div>
    `,
      )
      .join('');

    const slipStatus = document.getElementById('order-slip-status');
    if (slipStatus) {
      if (order.status === 'review') {
        slipStatus.textContent = t('order.slip_waiting');
        slipStatus.className = 'slip-status';
      } else if (order.slip_status === 'rejected') {
        slipStatus.textContent = t('order.slip_rejected', { note: order.slip_note || '' });
        slipStatus.className = 'slip-status is-error';
      } else if (order.slip_status === 'approved') {
        slipStatus.textContent = t('order.slip_approved');
        slipStatus.className = 'slip-status is-ok';
      } else {
        slipStatus.className = 'slip-status hidden';
        slipStatus.textContent = '';
      }
    }

    if (order.slip_path) {
      const slipUrl = await getPrivateImageUrl(state.supabase, 'payment-slips', order.slip_path);
      document.getElementById('receipt-upload').classList.add('hidden');
      document.getElementById('receipt-image').classList.remove('hidden');
      const preview = document.getElementById('receipt-preview');
      if (slipUrl) {
        preview.src = slipUrl;
      } else {
        preview.replaceWith(
          Object.assign(document.createElement('p'), {
            className: 'text-muted text-sm',
            textContent: t('order.slip_unavailable'),
          }),
        );
      }
    } else {
      bindOnce(document.getElementById('upload-receipt-btn'), 'click', () => {
        document.getElementById('slip-input').click();
      });
      bindOnce(document.getElementById('slip-input'), 'change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const objectPath = buildSlipObjectPath(state.user.id, order.id, file.name);
          const { error: upErr } = await state.supabase.storage
            .from('payment-slips')
            .upload(objectPath, file, { upsert: false });
          if (upErr) throw upErr;

          const { error: rpcErr } = await state.supabase.rpc('attach_slip', {
            order_id: order.id,
            object_path: objectPath,
          });
          if (rpcErr) throw rpcErr;

          notify(t('order.slip_sent'), 'success');
          setTimeout(() => location.reload(), 900);
        } catch (err) {
          notify(err.message || t('toast.error_generic'), 'error');
        }
      });
    }

    await loadCustomerShippingUpdates(order.id);

    const actionsBox = document.getElementById('order-actions');
    if (actionsBox) {
      const buttons = [];
      if (order.status === 'pending') {
        buttons.push(
          `<button id="order-cancel-btn" class="btn btn-outline btn-sm" data-i18n="order.cancel">${t('order.cancel')}</button>`,
        );
      }
      if (order.status === 'shipped') {
        buttons.push(
          `<button id="order-received-btn" class="btn btn-primary btn-sm" data-i18n="order.confirm_received">${t('order.confirm_received')}</button>`,
        );
      }
      actionsBox.innerHTML = buttons.join('');

      const cancelBtn = document.getElementById('order-cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
          if (!window.confirm(t('order.cancel_confirm'))) return;
          try {
            const { error } = await state.supabase.rpc('transition_order', {
              order_id: order.id,
              next_status: 'cancelled',
              tracking_number: null,
            });
            if (error) throw error;
            notify(t('order.cancelled'), 'success');
            setTimeout(() => location.reload(), 800);
          } catch (err) {
            notify(err.message || t('toast.error_generic'), 'error');
          }
        });
      }

      const receivedBtn = document.getElementById('order-received-btn');
      if (receivedBtn) {
        receivedBtn.addEventListener('click', async () => {
          try {
            const { error } = await state.supabase.rpc('transition_order', {
              order_id: order.id,
              next_status: 'delivered',
              tracking_number: null,
            });
            if (error) throw error;
            notify(t('order.received'), 'success');
            setTimeout(() => location.reload(), 800);
          } catch (err) {
            notify(err.message || t('toast.error_generic'), 'error');
          }
        });
      }
    }

    const reviewForm = document.getElementById('review-form');
    const reviewPanel = reviewForm.closest('.panel');
    if (order.status !== 'delivered') {
      reviewPanel.classList.add('hidden');
    } else if (items.length) {
      reviewForm.innerHTML = items
        .map(
          (item) => `
        <div class="form-group">
          <label class="form-label">${escapeHTML(item.name || '')}</label>
          <div class="flex gap-sm items-center">
            <select class="form-select" id="rating-${item.id}" style="width:auto">
              <option value="5">5 ★</option><option value="4">4 ★</option>
              <option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option>
            </select>
            <input type="text" class="form-input" id="comment-${item.id}" placeholder="${t('order.review_hint')}">
            <button class="btn btn-outline btn-sm" data-review="${item.id}">${t('order.review_send')}</button>
          </div>
        </div>
      `,
        )
        .join('');
      bindOnce(reviewForm, 'click', async (e) => {
        const btn = e.target.closest('[data-review]');
        if (!btn) return;
        const pid = btn.getAttribute('data-review');
        const rating = parseInt(document.getElementById(`rating-${pid}`).value);
        const comment = document.getElementById(`comment-${pid}`).value.trim();
        const { error } = await state.supabase.rpc('save_review', {
          p_order_id: order.id,
          p_product_id: pid,
          p_rating: rating,
          p_comment: comment,
        });
        if (error) notify(error.message || t('toast.error_generic'), 'error');
        else notify(t('order.review_sent'), 'success');
      });
    }
  } catch (err) {
    console.error(err);
    notify(t('toast.error_generic'), 'error');
  }
}
