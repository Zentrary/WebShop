/**
 * ZenMarket Customer — ตะกร้า / ชำระเงิน / คำสั่งซื้อ
 * ใช้ RPC create_order + schema จริง (orders.status/total/shipping/address/recipient/phone)
 */

import { initApp, state, updateCartBadge, requireSupabase } from '/src/app.js';
import { isMember } from '/src/core/audience.js';
import { translatePage } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import { formatTHB, escapeHTML, createPromptPayPayload, createPromptPayQRDataURL, getPrivateImageUrl, buildSlipObjectPath } from '/src/core/lib.js';
import { getOrderStatusBadge, getTimelineProgress } from '/src/core/experience.js';
import { calculateShipping, amountToFreeShipping } from '/src/core/settings.js';

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  translatePage();

  if (!requireSupabase()) return;

  const path = window.location.pathname;

  if (path.includes('/shop/cart.html')) {
    initCartPage();
  } else if (path.includes('/shop/checkout.html')) {
    initCheckoutPage();
  } else if (path.includes('/account/orders.html')) {
    initCustomerOrdersPage();
  } else if (path.includes('/account/order.html')) {
    initCustomerOrderDetailPage();
  }
});

/* ================= ตะกร้า ================= */
function initCartPage() {
  renderCart();

  document.getElementById('cart-items').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-item]');
    if (removeBtn) {
      state.cart = state.cart.filter(i => i.product_id !== removeBtn.getAttribute('data-remove-item'));
      localStorage.setItem('zenmarket_cart', JSON.stringify(state.cart));
      updateCartBadge();
      renderCart();
      return;
    }
    const changeBtn = e.target.closest('[data-change-qty]');
    if (changeBtn) {
      const pid = changeBtn.getAttribute('data-change-qty');
      const dir = parseInt(changeBtn.getAttribute('data-dir'));
      const item = state.cart.find(i => i.product_id === pid);
      if (item) {
        item.quantity = Math.max(1, item.quantity + dir);
        localStorage.setItem('zenmarket_cart', JSON.stringify(state.cart));
        updateCartBadge();
        renderCart();
      }
    }
  });
}

function cartTotals() {
  const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = calculateShipping(subtotal, state.storeSettings || {});
  return { subtotal, shipping, total: subtotal + shipping };
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

  state.cart.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cart-row';
    el.innerHTML = `
      <img src="/images/placeholder.svg" alt="${escapeHTML(item.name)}">
      <div>
        <div class="nm">${escapeHTML(item.name)}</div>
        <div class="pr">${formatTHB(item.price)} / ชิ้น</div>
      </div>
      <div class="qty-ctl">
        <button data-change-qty="${item.product_id}" data-dir="-1" aria-label="ลด">−</button>
        <input type="text" value="${item.quantity}" readonly>
        <button data-change-qty="${item.product_id}" data-dir="1" aria-label="เพิ่ม">+</button>
      </div>
      <div style="text-align:right">
        <div class="font-semibold">${formatTHB(item.price * item.quantity)}</div>
        <button class="text-error text-sm mt-sm" data-remove-item="${item.product_id}">ลบออก</button>
      </div>
    `;
    cartItemsEl.appendChild(el);
  });

  const { subtotal, shipping, total } = cartTotals();
  document.getElementById('cart-subtotal').textContent = formatTHB(subtotal);
  document.getElementById('cart-shipping').textContent = shipping === 0 ? 'ฟรี' : formatTHB(shipping);
  document.getElementById('cart-total').textContent = formatTHB(total);

  const hint = document.getElementById('cart-shipping-hint');
  if (hint) {
    const remain = amountToFreeShipping(subtotal, state.storeSettings || {});
    hint.textContent = remain > 0
      ? `สั่งซื้อเพิ่มอีก ${formatTHB(remain)} จะได้ส่งฟรี`
      : 'คุณได้สิทธิ์ส่งฟรีแล้ว';
    hint.style.color = remain > 0 ? 'var(--color-accent)' : 'var(--color-success)';
  }
}

/* ================= ชำระเงิน ================= */
async function initCheckoutPage() {
  const form = document.getElementById('checkout-form');
  const placeOrderBtn = document.getElementById('place-order-btn');

  if (!state.cart || state.cart.length === 0) {
    window.location.href = '/shop/cart.html';
    return;
  }

  // ต้องเข้าสู่ระบบก่อนจึงจะสั่งซื้อได้ (backend บังคับ auth)
  if (!isMember()) {
    sessionStorage.setItem('zenmarket_return_path', '/shop/checkout.html');
    window.location.href = '/auth/login.html';
    return;
  }

  const { subtotal, shipping, total } = cartTotals();
  document.getElementById('checkout-items').innerHTML = state.cart.map(item => `
    <div class="sum-row"><span>${escapeHTML(item.name)} × ${item.quantity}</span><span>${formatTHB(item.price * item.quantity)}</span></div>
  `).join('');
  document.getElementById('checkout-subtotal').textContent = formatTHB(subtotal);
  document.getElementById('checkout-shipping').textContent = shipping === 0 ? 'ฟรี' : formatTHB(shipping);
  document.getElementById('checkout-total').textContent = formatTHB(total);

  // ตัวเลือกวิธีชำระเงิน (PromptPay เท่านั้นตาม backend — COD ตัดออก)
  const payOpts = document.querySelectorAll('.pay-opt');
  payOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      payOpts.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
    });
  });

  // แสดง QR ทันที
  showQR(total);

  placeOrderBtn.addEventListener('click', async () => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = 'กำลังดำเนินการ...';

    try {
      const cart = state.cart.map(i => ({ id: i.product_id, quantity: i.quantity }));
      const delivery = {
        recipient: document.getElementById('checkout-name').value.trim(),
        phone: document.getElementById('checkout-phone').value.trim(),
        address: document.getElementById('checkout-address').value.trim(),
      };
      const requestKey = crypto.randomUUID();

      const { data: order, error } = await state.supabase.rpc('create_order', {
        cart,
        delivery,
        request_key: requestKey,
      });

      if (error) throw error;

      state.cart = [];
      localStorage.setItem('zenmarket_cart', '[]');
      updateCartBadge();

      notify('สั่งซื้อสำเร็จ! กรุณาชำระเงินด้วย QR PromptPay', 'success');
      setTimeout(() => {
        window.location.href = `/account/order.html?id=${order.id}`;
      }, 1200);
    } catch (err) {
      console.error(err);
      notify(err.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ', 'error');
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = 'ยืนยันคำสั่งซื้อ';
    }
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

/* ================= รายการคำสั่งซื้อ ================= */
async function initCustomerOrdersPage() {
  if (!isMember()) {
    window.location.href = '/auth/login.html';
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
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem">ยังไม่มีคำสั่งซื้อ</td></tr>';
      return;
    }

    orders.forEach(order => {
      const badge = getOrderStatusBadge(order.status);
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="font-semibold">#${order.id.slice(0, 8)}</td>` +
        `<td>${order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-'}</td>` +
        `<td><span class="badge badge-${badge.variant}">${badge.label}</span></td>` +
        `<td class="num">${formatTHB(order.total)}</td>` +
        `<td><a href="/account/order.html?id=${order.id}" class="btn btn-outline btn-sm">ดูรายละเอียด</a></td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    notify('เกิดข้อผิดพลาดในการโหลดคำสั่งซื้อ', 'error');
  }
}

/* ================= รายละเอียดคำสั่งซื้อ ================= */
async function initCustomerOrderDetailPage() {
  if (!isMember()) {
    window.location.href = '/auth/login.html';
    return;
  }

  const orderId = new URLSearchParams(window.location.search).get('id');
  if (!orderId) {
    window.location.href = '/account/orders.html';
    return;
  }

  try {
    const { data: order, error } = await state.supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      document.getElementById('order-not-found').classList.remove('hidden');
      return;
    }

    document.getElementById('order-detail').classList.remove('hidden');
    document.getElementById('order-number').textContent = '#' + order.id.slice(0, 8);
    document.getElementById('order-date').textContent = order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-';
    const badge = getOrderStatusBadge(order.status);
    const statusEl = document.getElementById('order-status');
    statusEl.textContent = badge.label;
    statusEl.className = 'badge badge-' + badge.variant;
    document.getElementById('order-payment').textContent = 'พร้อมเพย์ (PromptPay)';
    document.getElementById('order-shipping-address').textContent = order.address || '-';
    document.getElementById('order-subtotal').textContent = formatTHB(order.subtotal);
    document.getElementById('order-shipping').textContent = formatTHB(order.shipping);
    document.getElementById('order-total').textContent = formatTHB(order.total);
    if (order.tracking) {
      document.getElementById('order-tracking').textContent = order.tracking;
      document.getElementById('order-tracking-row').classList.remove('hidden');
    }

    // Timeline
    const steps = getTimelineProgress(order.status);
    document.getElementById('order-timeline').innerHTML = steps.map(step => `
      <div class="tl-step ${step.completed ? 'done' : ''}">
        <div class="tl-dot">${step.completed ? '✓' : ''}</div>
        <div class="lbl">${step.label}</div>
      </div>
    `).join('');

    // Items
    const items = order.items || [];
    document.getElementById('order-items-list').innerHTML = items.map(item => `
      <div class="cart-row">
        <img src="${item.image_url || '/images/placeholder.svg'}" alt="${escapeHTML(item.name || '')}">
        <div>
          <div class="nm">${escapeHTML(item.name || '')}</div>
          <div class="pr">${formatTHB(item.price)} × ${item.quantity}</div>
        </div>
        <div></div>
        <div class="font-semibold">${formatTHB(item.price * item.quantity)}</div>
      </div>
    `).join('');

    // สลิป
    if (order.slip_path) {
      const slipUrl = await getPrivateImageUrl(state.supabase, 'payment-slips', order.slip_path);
      document.getElementById('receipt-upload').classList.add('hidden');
      document.getElementById('receipt-image').classList.remove('hidden');
      const preview = document.getElementById('receipt-preview');
      if (slipUrl) {
        preview.src = slipUrl;
      } else {
        preview.replaceWith(Object.assign(document.createElement('p'), {
          className: 'text-muted text-sm',
          textContent: 'ไม่สามารถเปิดสลิปได้',
        }));
      }
    } else {
      document.getElementById('upload-receipt-btn').addEventListener('click', () => {
        document.getElementById('slip-input').click();
      });
      document.getElementById('slip-input').addEventListener('change', async (e) => {
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

          notify('อัปโหลดสลิปสำเร็จ รอร้านตรวจสอบ', 'success');
          setTimeout(() => location.reload(), 900);
        } catch (err) {
          notify(err.message || 'อัปโหลดสลิปไม่สำเร็จ', 'error');
        }
      });
    }

    // ฟอร์มรีวิว (เปิดเมื่อสินค้าส่งถึงมือแล้วเท่านั้น)
    const reviewForm = document.getElementById('review-form');
    const reviewPanel = reviewForm.closest('.panel');
    if (order.status !== 'delivered') {
      reviewPanel.classList.add('hidden');
    } else if (items.length) {
      reviewForm.innerHTML = items.map(item => `
        <div class="form-group">
          <label class="form-label">${escapeHTML(item.name || '')}</label>
          <div class="flex gap-sm items-center">
            <select class="form-select" id="rating-${item.id}" style="width:auto">
              <option value="5">5 ดาว</option><option value="4">4 ดาว</option>
              <option value="3">3 ดาว</option><option value="2">2 ดาว</option><option value="1">1 ดาว</option>
            </select>
            <input type="text" class="form-input" id="comment-${item.id}" placeholder="เขียนรีวิว...">
            <button class="btn btn-outline btn-sm" data-review="${item.id}">ส่งรีวิว</button>
          </div>
        </div>
      `).join('');
      reviewForm.addEventListener('click', async (e) => {
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
        if (error) notify(error.message || 'ส่งรีวิวไม่สำเร็จ', 'error');
        else notify('ส่งรีวิวสำเร็จ ขอบคุณครับ!', 'success');
      });
    }
  } catch (err) {
    console.error(err);
    notify('เกิดข้อผิดพลาดในการโหลดคำสั่งซื้อ', 'error');
  }
}
