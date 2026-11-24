/**
 * ZenMarket Customer Checkout - Part 1
 */

import { initApp, state } from '/src/app.js';
import { isMember } from '/src/core/audience.js';
import { t, translatePage } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import { formatTHB } from '/src/core/lib.js';
import { getOrderStatusBadge, getTimelineProgress } from '/src/core/experience.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  translatePage();

  const path = window.location.pathname;

  if (path.includes('/account/orders.html')) {
    initCustomerOrdersPage();
  } else if (path.includes('/account/order.html')) {
    initCustomerOrderDetailPage();
  } else if (path.includes('/admin/order.html')) {
    initAdminOrderDetailPage();
  }
});

async function initCustomerOrdersPage() {
  if (!isMember()) {
    window.location.href = '/auth/login.html';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const statusFilter = urlParams.get('status') || 'all';

  try {
    let query = state.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('order_status', statusFilter);
async function initCustomerOrderDetailPage() {
  if (!isMember()) {
    window.location.href = '/auth/login.html';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

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
    document.getElementById('order-number').textContent = order.id.slice(0, 8);
    document.getElementById('order-date').textContent = order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-';
    document.getElementById('order-status').textContent = getOrderStatusBadge(order.order_status).label;
    document.getElementById('order-status').className = 'badge badge-' + getOrderStatusBadge(order.order_status).variant;
    document.getElementById('order-payment').textContent = order.payment_method === 'cod' ? 'เก็บเงินปลายทาง' : 'พร้อมเพย์';
    document.getElementById('order-shipping-address').textContent = order.shipping_address || '-';
    document.getElementById('order-subtotal').textContent = formatTHB(order.subtotal);
    document.getElementById('order-shipping').textContent = formatTHB(order.shipping_fee);
    document.getElementById('order-total').textContent = formatTHB(order.total_amount);

    const timeline = document.getElementById('order-timeline');
    const steps = getTimelineProgress(order.order_status);
    timeline.innerHTML = steps.map((step, idx) => {
      return '<div class="flex items-center mb-md ' + (idx === steps.length - 1 ? 'mb-0' : '') + '">' +
        '<div class="w-8 h-8 rounded-full ' + (step.completed ? 'bg-primary text-white' : 'bg-border text-muted') + ' flex items-center justify-center text-sm font-bold mr-md">' +
        (step.completed ? '\u2713' : idx + 1) + '</div>' +
        '<div class="text-sm ' + (step.completed ? 'text-primary font-semibold' : 'text-muted') + '">' + step.label + '</div>' +
        '</div>';
    }).join('');

    const itemsList = document.getElementById('order-items-list');
    const items = order.items || [];
    itemsList.innerHTML = items.map(item => {
      return '<div class="flex gap-md items-center border-b pb-md mb-md">' +
        '<div class="w-16 h-16 bg-elevated rounded-md flex-shrink-0">' +
        '<img src="/public/images/placeholder.svg" alt="' + item.product_name + '" class="w-full h-full object-contain">' +
        '</div>' +
        '<div class="flex-1">' +
        '<h4 class="font-semibold mb-xs">' + item.product_name + '</h4>' +
        '<p class="text-secondary text-sm">' + formatTHB(item.price) + ' x' + item.quantity + '</p>' +
        '</div>' +
        '</div>';
    }).join('');
  } catch (err) {
async function initAdminOrderDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  if (!orderId) return;

  try {
    const { data: order, error } = await state.supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) return;

    document.getElementById('admin-order-detail').classList.remove('hidden');
    document.getElementById('admin-order-number').textContent = order.id.slice(0, 8);
    document.getElementById('admin-order-customer').textContent = order.customer_name;
    document.getElementById('admin-order-date').textContent = order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-';
    document.getElementById('admin-order-status').value = order.order_status;
    document.getElementById('admin-order-payment').textContent = order.payment_method === 'cod' ? 'เก็บเงินปลายทาง' : 'พร้อมเพย์';
    document.getElementById('admin-order-address').textContent = order.shipping_address || '-';
    document.getElementById('admin-order-subtotal').textContent = formatTHB(order.subtotal);
    document.getElementById('admin-order-shipping').textContent = formatTHB(order.shipping_fee);
    document.getElementById('admin-order-total').textContent = formatTHB(order.total_amount);

    const itemsList = document.getElementById('admin-order-items');
    const items = order.items || [];
    itemsList.innerHTML = items.map(item => {
      return '<div class="flex gap-md items-center border-b pb-md mb-md">' +
        '<div class="w-16 h-16 bg-elevated rounded-md flex-shrink-0">' +
        '<img src="/public/images/placeholder.svg" alt="' + item.product_name + '" class="w-full h-full object-contain">' +
        '</div>' +
        '<div class="flex-1">' +
        '<h4 class="font-semibold mb-xs">' + item.product_name + '</h4>' +
        '<p class="text-secondary text-sm">' + formatTHB(item.price) + ' x' + item.quantity + '</p>' +
        '</div>' +
        '</div>';
    }).join('');

    document.getElementById('admin-update-order-btn').addEventListener('click', async () => {
      const newStatus = document.getElementById('admin-order-status').value;
      const trackingNumber = document.getElementById('admin-tracking-number').value;

      try {
        const { error } = await state.supabase
          .from('orders')
          .update({
            order_status: newStatus,
            tracking_number: trackingNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (error) throw error;
        notify('อัปเดตคำสั่งซื้อสำเร็จ', 'success');
      } catch (err) {
        notify(err.message || 'เกิดข้อผิดพลาดในการอัปเดต', 'error');
      }
    });
  } catch (err) {
    console.error(err);
  }
}
    console.error(err);
    notify('เกิดข้อผิดพลาดในการโหลดคำสั่งซื้อ', 'error');
  }
}
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    const tbody = document.getElementById('orders-list');
    tbody.innerHTML = '';

    orders?.forEach(order => {
      const badge = getOrderStatusBadge(order.order_status);
      const tr = document.createElement('tr');
      tr.className = 'border-b';
      tr.innerHTML =
        '<td class="pb-sm font-semibold">#' + order.id.slice(0, 8) + '</td>' +
        '<td class="pb-sm">' + (order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-') + '</td>' +
        '<td class="pb-sm"><span class="badge badge-' + badge.variant + '">' + badge.label + '</span></td>' +
        '<td class="pb-sm font-bold text-right">' + formatTHB(order.total_amount) + '</td>' +
        '<td class="pb-sm"><a href="/account/order.html?id=' + order.id + '" class="btn btn-outline btn-sm">ดูรายละเอียด</a></td>';
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    notify('เกิดข้อผิดพลาดในการโหลดคำสั่งซื้อ', 'error');
  }
}