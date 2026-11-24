/**
 * ZenMarket Admin Index - Part 1: Dashboard, Products
 */

import { isOwner } from '/src/core/audience.js';
import { notify } from '/src/core/ui.js';
import { formatTHB } from '/src/core/lib.js';
import { validateSocialUrl } from '/src/core/experience.js';

let supabase;

document.addEventListener('DOMContentLoaded', async () => {
  if (!isOwner()) {
    window.location.href = '/admin/login.html';
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  const path = window.location.pathname;

  if (path.includes('/admin/dashboard.html')) {
    initDashboard();
  } else if (path.includes('/admin/products.html')) {
    initProducts();
  } else if (path.includes('/admin/categories.html')) {
    initCategories();
  } else if (path.includes('/admin/reviews.html')) {
    initReviews();
  } else if (path.includes('/admin/settings.html')) {
    initSettings();
  } else if (path.includes('/admin/payments.html')) {
    initPayments();
  } else if (path.includes('/admin/orders.html')) {
    initAdminOrders();
  }
});

async function initDashboard() {
  try {
    const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const { data: products } = await supabase.from('products').select('*');
    const { data: reviews } = await supabase.from('reviews').select('*');

    const totalSales = orders?.reduce((s, o) => s + o.total_amount, 0) || 0;
    const pendingOrders = orders?.filter(o => o.order_status === 'pending').length || 0;
    const avgRating = reviews?.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

    const elSales = document.getElementById('kpi-sales');
    const elPending = document.getElementById('kpi-pending');
    const elProducts = document.getElementById('kpi-products');
    const elRating = document.getElementById('kpi-rating');

    if (elSales) elSales.textContent = formatTHB(totalSales);
    if (elPending) elPending.textContent = pendingOrders;
    if (elProducts) elProducts.textContent = products?.length || 0;
    if (elRating) elRating.textContent = avgRating;

    const lowStock = products?.filter(p => p.stock_quantity <= 3 && p.stock_quantity > 0) || [];
    const lowStockList = document.getElementById('low-stock-list');
    if (lowStockList) {
      lowStockList.innerHTML = lowStock.map(p =>
        '<div class="flex justify-between items-center text-sm">' +
        '<span>' + p.name + '</span>' +
        '<span class="text-warning font-bold">' + p.stock_quantity + ' ชิ้น</span>' +
        '</div>'
      ).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

async function initCategories() {
  const list = document.getElementById('admin-categories-list');
  const form = document.getElementById('admin-category-form');

  async function loadCategories() {
    try {
      const { data: categories, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;

      list.innerHTML = '';
      categories?.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center border-b pb-sm mb-sm';
        item.innerHTML =
          '<div class="flex items-center gap-sm">' +
          '<span class="text-primary">' + (cat.icon || '📦') + '</span>' +
          '<span class="font-semibold">' + cat.name + '</span>' +
          '</div>' +
          '<div class="flex gap-xs">' +
          '<button class="btn btn-outline btn-sm text-xs" onclick="editCategory(\'' + cat.id + '\', \'' + (cat.name || '').replace(/'/g, "\\'") + '\', \'' + (cat.icon || '') + '\', \'' + (cat.description || '').replace(/'/g, "\\'") + '\')">แก้ไข</button>' +
          '<button class="btn btn-outline btn-sm text-xs text-error" onclick="deleteCategory(\'' + cat.id + '\')">ลบ</button>' +
          '</div>';
        list.appendChild(item);
      });
    } catch (err) {
      console.error(err);
      notify('เกิดข้อผิดพลาดในการโหลดหมวดหมู่', 'error');
    }
  }

  loadCategories();

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('admin-category-name').value;
      const icon = document.getElementById('admin-category-icon').value;
      const description = document.getElementById('admin-category-description').value;

      try {
        const { error } = await supabase.from('categories').insert({ name, icon, description });
        if (error) throw error;

        notify('เพิ่มหมวดหมู่สำเร็จ', 'success');
        form.reset();
        loadCategories();
      } catch (err) {
        notify(err.message || 'เกิดข้อผิดพลาด', 'error');
      }
    });
async function initSettings() {
  const form = document.getElementById('admin-settings-form');

  try {
    const { data: settings } = await supabase.from('store_settings').select('*').single();
    if (settings) {
      document.getElementById('setting-store-name').value = settings.store_name || '';
      document.getElementById('setting-store-logo').value = settings.store_logo || '';
      document.getElementById('setting-store-description').value = settings.store_description || '';
      document.getElementById('setting-contact-email').value = settings.contact_email || '';
      document.getElementById('setting-contact-phone').value = settings.contact_phone || '';
      document.getElementById('setting-contact-line').value = settings.contact_line || '';
      document.getElementById('setting-contact-facebook').value = settings.contact_facebook || '';
      document.getElementById('setting-contact-instagram').value = settings.contact_instagram || '';
      document.getElementById('setting-contact-tiktok').value = settings.contact_tiktok || '';
      document.getElementById('setting-shipping-fee').value = settings.shipping_fee || 50;
      document.getElementById('setting-free-shipping-threshold').value = settings.free_shipping_threshold || 500;
      document.getElementById('setting-terms').value = settings.terms_and_conditions || '';
      document.getElementById('setting-privacy').value = settings.privacy_policy || '';
    }
  } catch (err) { console.error(err); }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const settingsData = {
        store_name: document.getElementById('setting-store-name').value,
        store_logo: document.getElementById('setting-store-logo').value,
        store_description: document.getElementById('setting-store-description').value,
        contact_email: document.getElementById('setting-contact-email').value,
        contact_phone: document.getElementById('setting-contact-phone').value,
        contact_line: document.getElementById('setting-contact-line').value,
        contact_facebook: validateSocialUrl(document.getElementById('setting-contact-facebook').value),
        contact_instagram: validateSocialUrl(document.getElementById('setting-contact-instagram').value),
        contact_tiktok: validateSocialUrl(document.getElementById('setting-contact-tiktok').value),
        shipping_fee: parseInt(document.getElementById('setting-shipping-fee').value) || 50,
        free_shipping_threshold: parseInt(document.getElementById('setting-free-shipping-threshold').value) || 500,
        terms_and_conditions: document.getElementById('setting-terms').value,
        privacy_policy: document.getElementById('setting-privacy').value,
      };

      try {
        const { error } = await supabase.from('store_settings').upsert(settingsData);
        if (error) throw error;
        notify('บันทึกการตั้งค่าสำเร็จ', 'success');
      } catch (err) {
        notify(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
      }
    });
  }
}
  }
}

async function initReviews() {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*, profiles(full_name), products(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

async function initPayments() {
  const form = document.getElementById('admin-payments-form');
  const generateBtn = document.getElementById('test-generate-qr-btn');

  try {
    const { data: settings } = await supabase.from('store_settings').select('promptpay_id, promptpay_name').single();
    if (settings) {
      document.getElementById('payment-promptpay-id').value = settings.promptpay_id || '';
      document.getElementById('payment-promptpay-name').value = settings.promptpay_name || '';
    }
  } catch (err) { console.error(err); }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const paymentData = {
        promptpay_id: document.getElementById('payment-promptpay-id').value,
        promptpay_name: document.getElementById('payment-promptpay-name').value,
      };

      try {
        const { error } = await supabase.from('store_settings').upsert(paymentData);
        if (error) throw error;
        notify('บันทึกการตั้งค่าการชำระเงินสำเร็จ', 'success');
      } catch (err) {
        notify(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
      }
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const amount = parseFloat(document.getElementById('test-qr-amount').value) || 0;
      const reference = document.getElementById('test-qr-reference').value || 'TEST';

      try {
        const { data: settings } = await supabase.from('store_settings').select('promptpay_id').single();
        if (!settings?.promptpay_id) {
          notify('กรุณาตั้งค่า PromptPay ID ก่อน', 'error');
          return;
        }

        const { createPromptPayPayload, createPromptPayQRDataURL } = await import('/src/core/lib.js');
        const payload = createPromptPayPayload(settings.promptpay_id, amount, reference);
        const qrDataURL = await createPromptPayQRDataURL(payload);

        document.getElementById('test-qr-image').innerHTML = '<img src="' + qrDataURL + '" alt="QR PromptPay" class="w-64 h-64">';
        document.getElementById('test-qr-payload').textContent = payload;
        document.getElementById('test-qr-result').classList.remove('hidden');
      } catch (err) {
        notify(err.message || 'เกิดข้อผิดพลาดในการสร้าง QR Code', 'error');
      }
    });
  }
}

async function initAdminOrders() {
  try {
    const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);

    if (error) throw error;

    const tbody = document.getElementById('admin-orders-list');
    tbody.innerHTML = '';

    orders?.forEach(order => {
      const tr = document.createElement('tr');
      tr.className = 'border-b';
      tr.innerHTML =
        '<td class="pb-sm font-semibold">#' + order.id.slice(0, 8) + '</td>' +
        '<td class="pb-sm">' + order.customer_name + '</td>' +
        '<td class="pb-sm">' + (order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-') + '</td>' +
        '<td class="pb-sm font-bold text-right">' + formatTHB(order.total_amount) + '</td>' +
        '<td class="pb-sm">' + order.order_status + '</td>' +
        '<td class="pb-sm"><a href="/admin/order.html?id=' + order.id + '" class="btn btn-outline btn-sm">จัดการ</a></td>';
// Global functions for inline HTML handlers
window.editProduct = (id) => { notify('ฟังก์ชันแก้ไขสินค้าจะเปิดใช้งานในเวอร์ชันถัดไป', 'info'); };
window.deleteProduct = async (id) => {
  if (confirm('ยืนยันการลบสินค้า?')) {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      notify('ลบสินค้าสำเร็จ', 'success');
      location.reload();
    } catch (err) { notify(err.message || 'เกิดข้อผิดพลาด', 'error'); }
  }
};
window.editCategory = (id, name, icon, description) => {
  document.getElementById('admin-category-name').value = name;
  document.getElementById('admin-category-icon').value = icon;
  document.getElementById('admin-category-description').value = description;
  notify('กรุณาแก้ไขแล้วกดบันทึก', 'info');
};
window.deleteCategory = async (id) => {
  if (confirm('ยืนยันการลบหมวดหมู่?')) {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      notify('ลบหมวดหมู่สำเร็จ', 'success');
      location.reload();
    } catch (err) { notify(err.message || 'เกิดข้อผิดพลาด', 'error'); }
  }
};
      tbody.appendChild(tr);
    });
  } catch (err) {
    notify('เกิดข้อผิดพลาดในการโหลดคำสั่งซื้อ', 'error');
  }
}
    const tbody = document.querySelector('#admin-reviews-list');
    if (!tbody) return;

    tbody.innerHTML = '';
    reviews?.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'border-b';
      tr.innerHTML =
        '<td class="pb-sm">' + (r.profiles?.full_name || 'ลูกค้า') + '</td>' +
        '<td class="pb-sm">' + (r.products?.name || 'สินค้า') + '</td>' +
        '<td class="pb-sm text-center">' + '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) + '</td>' +
        '<td class="pb-sm">' + (r.review_text || '-') + '</td>' +
        '<td class="pb-sm">' + (r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH') : '-') + '</td>' +
        '<td class="pb-sm"><button class="btn btn-outline btn-sm text-xs text-error">ลบ</button></td>';
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}
async function initProducts() {
  const tbody = document.getElementById('admin-products-list');
  const searchInput = document.getElementById('admin-product-search');

  async function loadProducts() {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      tbody.innerHTML = '';
      products?.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'border-b';
        tr.innerHTML =
          '<td class="pb-sm"><img src="' + (p.images?.[0] || '/public/images/placeholder.svg') + '" class="w-10 h-10 object-contain rounded-md"></td>' +
          '<td class="pb-sm font-semibold">' + p.name + '</td>' +
          '<td class="pb-sm">' + (p.categories?.name || '-') + '</td>' +
          '<td class="pb-sm text-right">' + formatTHB(p.price) + '</td>' +
          '<td class="pb-sm text-center">' + p.stock_quantity + '</td>' +
          '<td class="pb-sm"><span class="badge badge-' + (p.is_active ? 'success' : 'error') + '">' + (p.is_active ? 'ใช้งาน' : 'ซ่อน') + '</span></td>' +
          '<td class="pb-sm">' +
          '<button class="btn btn-outline btn-sm mr-xs" onclick="editProduct(\'' + p.id + '\')">แก้ไข</button>' +
          '<button class="btn btn-outline btn-sm text-error" onclick="deleteProduct(\'' + p.id + '\')">ลบ</button>' +
          '</td>';
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      notify('เกิดข้อผิดพลาดในการโหลดสินค้า', 'error');
    }
  }

  loadProducts();

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const rows = tbody.querySelectorAll('tr');
      const term = searchInput.value.toLowerCase();
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }
}