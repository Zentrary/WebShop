/**
 * ZenMarket Store Page
 * Part 1: Imports, initialization, store page
 */

import { initApp, state, addToCart, updateCartBadge } from '/src/app.js';
import { t, translatePage } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import { formatTHB, safeImage } from '/src/core/lib.js';
import { getStockStatusText, getStockStatusClass } from '/src/core/customer.js';

let currentProduct = null;
let currentCategory = null;
let currentPage = 1;
const PRODUCTS_PER_PAGE = 12;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  translatePage();

  const path = window.location.pathname;

  if (path.includes('/shop/index.html') || path === '/shop') {
    initStorePage();
  } else if (path.includes('/shop/categories.html')) {
    initCategoriesPage();
  } else if (path.includes('/shop/product.html')) {
    initProductPage();
  } else if (path.includes('/shop/cart.html')) {
    initCartPage();
  } else if (path.includes('/shop/checkout.html')) {
    initCheckoutPage();
  }
});

async function initStorePage() {
  const grid = document.getElementById('product-grid');
  const countEl = document.getElementById('product-count');
  const searchInput = document.getElementById('product-search');
  const categorySelect = document.getElementById('category-filter');

  if (!grid) return;

async function loadProducts(grid, countEl, search = '', categoryId = null) {
  let query = state.supabase
    .from('products')
    .select('*, categories(name)', { count: 'exact' })
    .eq('is_active', true);

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const from = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const to = from + PRODUCTS_PER_PAGE - 1;
  query = query.range(from, to).order('created_at', { ascending: false });

  const { data: products, error, count } = await query;

  if (error) {
    notify('เกิดข้อผิดพลาดในการโหลดสินค้า', 'error');
    return;
  }

  countEl.textContent = `พบสินค้า ${count || 0} รายการ`;
  grid.innerHTML = '';

  products?.forEach(product => {
    const card = createProductCard(product);
    grid.appendChild(card);
  });
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'card group';

  const firstImage = product.images && product.images.length > 0
    ? safeImage(product.images[0])
    : '/public/images/placeholder.svg';

  const stockStatus = getStockStatusText(product.stock_quantity);
  const stockClass = getStockStatusClass(product.stock_quantity);
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
    categories?.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'card p-lg text-center';
      card.innerHTML = `
        <div class="w-16 h-16 bg-elevated rounded-lg flex items-center justify-center mx-auto mb-md text-primary text-2xl">
          ${getIconHtml(cat.icon)}
        </div>
        <h3 class="font-semibold mb-sm">${escapeHTML(cat.name)}</h3>
        <a href="/shop/index.html?category=${cat.id}" class="btn btn-outline btn-sm">ดูสินค้า</a>
      `;
      grid.appendChild(card);
    });

    const { data: featured } = await state.supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .limit(8);

    featuredGrid.innerHTML = '';
    featured?.forEach(product => {
      featuredGrid.appendChild(createProductCard(product));
    });
  } catch (err) {
    notify('ไม่สามารถโหลดหมวดหมู่ได้', 'error');
  }
}

function getIconHtml(iconName) {
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
      .select('*, categories(name)')
      .eq('id', productId)
      .single();

    if (error || !product) {
      notify('ไม่พบสินค้าที่ระบุ', 'error');
      return;
    }

    currentProduct = product;

    document.getElementById('product-title').textContent = product.name;
    document.getElementById('product-price').textContent = formatTHB(product.price);
    document.getElementById('product-stock').innerHTML = `
      <span class="${getStockStatusClass(product.stock_quantity)} font-medium">
        ${getStockStatusText(product.stock_quantity)}
      </span>
    `;
    document.getElementById('product-description').textContent = product.description || 'ไม่มีรายละเอียดสินค้า';

    const addBtn = document.getElementById('add-to-cart-btn');
    addBtn.setAttribute('data-add-to-cart', product.id);
    addBtn.addEventListener('click', () => {
      const qty = parseInt(document.getElementById('qty-input').value) || 1;
      addToCart(product, qty);
      notify(`เพิ่ม "${product.name}" ลงในตะกร้าแล้ว`, 'success');
    });

    const qtyInput = document.getElementById('qty-input');
    document.getElementById('qty-decrease').addEventListener('click', () => {
      const val = Math.max(1, (parseInt(qtyInput.value) || 1) - 1);
      qtyInput.value = val;
    });
    document.getElementById('qty-increase').addEventListener('click', () => {
      const val = Math.min(product.stock_quantity, (parseInt(qtyInput.value) || 1) + 1);
      qtyInput.value = val;
    });

    const mainImg = document.getElementById('main-product-img');
    const thumbs = document.getElementById('thumbnail-list');
    const images = product.images ? product.images.filter(Boolean) : [];

    if (images.length > 0) {
      mainImg.src = safeImage(images[0]);
      images.forEach((img, idx) => {
        const thumb = document.createElement('img');
        thumb.src = safeImage(img);
        thumb.className = 'w-12 h-12 object-cover rounded-md border cursor-pointer opacity-50 hover:opacity-100';
async function initCartPage() {
  const cartContent = document.getElementById('cart-content');
  const cartEmpty = document.getElementById('cart-empty');
  const cartItems = document.getElementById('cart-items');

  if (!state.cart || state.cart.length === 0) {
    cartEmpty.classList.remove('hidden');
    cartContent.classList.add('hidden');
    return;
  }

  cartEmpty.classList.add('hidden');
  cartContent.classList.remove('hidden');
  await renderCart();
}

async function renderCart() {
  const cartItemsEl = document.getElementById('cart-items');
  const subtotalEl = document.getElementById('cart-subtotal');
  const shippingEl = document.getElementById('cart-shipping');
  const totalEl = document.getElementById('cart-total');

  cartItemsEl.innerHTML = '';
  state.cart.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'flex gap-md items-center border-b pb-md mb-md';
    itemEl.innerHTML = `
      <div class="w-20 h-20 bg-elevated rounded-md flex-shrink-0">
        <img src="/public/images/placeholder.svg" alt="${escapeHTML(item.product_name || item.name)}" class="w-full h-full object-contain">
      </div>
      <div class="flex-1">
        <h4 class="font-semibold mb-xs">${escapeHTML(item.product_name || item.name)}</h4>
        <p class="text-secondary text-sm">${formatTHB(item.price)}</p>
      </div>
      <div class="flex items-center gap-sm">
        <button class="btn-outline w-8 h-8 rounded-md text-secondary" data-change-qty="${item.product_id}" data-dir="-1">−</button>
        <span class="w-8 text-center">${item.quantity}</span>
        <button class="btn-outline w-8 h-8 rounded-md text-secondary" data-change-qty="${item.product_id}" data-dir="1">+</button>
      </div>
      <button class="text-error text-sm hover:underline" data-remove-item="${item.product_id}">
        ลบ
      </button>
    `;
    cartItemsEl.appendChild(itemEl);
  });

  const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shipping;

async function initCheckoutPage() {
  const form = document.getElementById('checkout-form');
  const placeOrderBtn = document.getElementById('place-order-btn');
  const paymentRadios = document.querySelectorAll('input[name="payment"]');
  const qrSection = document.getElementById('promptpay-qr');

  const checkoutItemsEl = document.getElementById('checkout-items');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const shippingEl = document.getElementById('checkout-shipping');
  const totalEl = document.getElementById('checkout-total');

  const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shipping;

  checkoutItemsEl.innerHTML = state.cart.map(item => `
    <div class="flex justify-between text-sm">
      <span>${escapeHTML(item.product_name || item.name)} x${item.quantity}</span>
      <span>${formatTHB(item.price * item.quantity)}</span>
    </div>
  `).join('');

  subtotalEl.textContent = formatTHB(subtotal);
  shippingEl.textContent = formatTHB(shipping);
  totalEl.textContent = formatTHB(total);

  paymentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'promptpay') {
        qrSection.classList.remove('hidden');
        generateCheckoutQR(total);
      } else {
        qrSection.classList.add('hidden');
      }
    });
  });

  placeOrderBtn.addEventListener('click', async () => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = 'กำลังดำเนินการ...';
    try {
      const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
      const shippingInfo = {
        name: document.getElementById('checkout-name').value,
        phone: document.getElementById('checkout-phone').value,
        email: document.getElementById('checkout-email').value,
        address: document.getElementById('checkout-address').value,
        postal_code: document.getElementById('checkout-postal').value,
      };

      const { data: order, error } = await state.supabase
        .from('orders')
        .insert({
          customer_id: state.user?.id,
          customer_name: shippingInfo.name,
          customer_phone: shippingInfo.phone,
          customer_email: shippingInfo.email,
          shipping_address: shippingInfo.address,
          postal_code: shippingInfo.postal_code,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cod' ? 'pending' : 'pending',
          order_status: 'pending',
          subtotal,
          shipping_fee: shipping,
          total_amount: total,
          items: state.cart,
        })
        .select()
        .single();

      if (error) throw error;

      state.cart = [];
      localStorage.setItem('zenmarket_cart', '');
      updateCartBadge();

      if (paymentMethod === 'promptpay') {
        const { data: settings } = await state.supabase
          .from('store_settings')
          .select('promptpay_id')
          .single();
        if (settings?.promptpay_id) {
          const { createPromptPayPayload, createPromptPayQRDataURL } = await import('/src/core/lib.js');
          const payload = createPromptPayPayload(settings.promptpay_id, total, order.id);
          const qrDataURL = await createPromptPayQRDataURL(payload);
          document.getElementById('qr-container').innerHTML = `<img src="${qrDataURL}" alt="QR PromptPay" class="w-64 h-64">`;
          document.getElementById('qr-amount').textContent = formatTHB(total);
        }
      }

      notify('สั่งซื้อสำเร็จ! รอการยืนยันจากร้านค้า', 'success');
      setTimeout(() => {
        window.location.href = `/account/order.html?id=${order.id}`;
      }, 1500);
    } catch (err) {
      console.error(err);
      notify('เกิดข้อผิดพลาดในการสั่งซื้อ', 'error');
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = 'ยืนยันคำสั่งซื้อ';
    }
  });
}

async function generateCheckoutQR(amount) {
  try {
    const { data: settings } = await state.supabase
      .from('store_settings')
      .select('promptpay_id')
      .single();
    if (settings?.promptpay_id) {
      const { createPromptPayPayload, createPromptPayQRDataURL } = await import('/src/core/lib.js');
      const payload = createPromptPayPayload(settings.promptpay_id, amount);
      const qrDataURL = await createPromptPayQRDataURL(payload);
      document.getElementById('qr-container').innerHTML = `<img src="${qrDataURL}" alt="QR PromptPay" class="w-64 h-64">`;
      document.getElementById('qr-amount').textContent = formatTHB(amount);
    }
  } catch (err) {
    console.error(err);
  }
}
  subtotalEl.textContent = formatTHB(subtotal);
  shippingEl.textContent = formatTHB(shipping);
  totalEl.textContent = formatTHB(total);

  cartItemsEl.addEventListener('click', (e) => {
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
        thumb.onclick = () => {
          mainImg.src = safeImage(img);
          thumbs.querySelectorAll('img').forEach(t => t.classList.remove('border-primary', 'opacity-100'));
          thumb.classList.add('border-primary', 'opacity-100');
        };
        if (idx === 0) {
          thumb.classList.add('border-primary', 'opacity-100');
        }
        thumbs.appendChild(thumb);
      });
    }

    const { data: reviews } = await state.supabase
      .from('reviews')
      .select('*, profiles(full_name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    const reviewsList = document.getElementById('reviews-list');
    reviewsList.innerHTML = '';
    reviews?.forEach(review => {
      const reviewEl = document.createElement('div');
      reviewEl.className = 'border-b pb-sm mb-sm';
      reviewEl.innerHTML = `
        <div class="flex justify-between mb-xs">
          <span class="font-semibold">${escapeHTML(review.profiles?.full_name || 'ลูกค้า')}</span>
          <span class="text-warning text-sm">★${review.rating}</span>
        </div>
        <p class="text-secondary text-sm">${escapeHTML(review.review_text || '')}</p>
      `;
      reviewsList.appendChild(reviewEl);
    });

    const { data: related } = await state.supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .neq('id', productId)
      .limit(4);

    const relatedGrid = document.getElementById('related-grid');
    relatedGrid.innerHTML = '';
    related?.forEach(p => {
      relatedGrid.appendChild(createProductCard(p));
    });

  } catch (err) {
    console.error(err);
    notify('เกิดข้อผิดพลาดในการโหลดสินค้า', 'error');
  }
}
  const iconMap = {
    'Home': '🏠', 'Shop': '🏪', 'Cart': '🛒', 'Package': '📦', 'Box': '📦',
    'Star': '⭐', 'Heart': '❤️', 'Clock': '🕐', 'Truck': '🚚', 'Tag': '🏷️',
    'Category': '📂', 'User': '👤', 'Shield': '🛡️', 'CheckCircle': '✅',
    'Mail': '📧', 'Phone': '📱', 'Link': '🔗', 'Instagram': '📷', 'Facebook': '👍',
    'Tiktok': '🎵', 'Twitter': '🐦', 'Youtube': '▶️', 'Line': '💬',
    'CreditCard': '💳', 'Wallet': '👛', 'Percent': '%', 'AlertCircle': '⚠️'
  };
  return iconMap[iconName] || '📦';
}

  card.innerHTML = `
    <div class="aspect-square bg-elevated overflow-hidden mb-md">
      <img src="${firstImage}" alt="${escapeHTML(product.name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
    </div>
    <h3 class="font-semibold mb-xs">${escapeHTML(product.name)}</h3>
    <p class="text-secondary text-sm mb-sm">${escapeHTML(product.categories?.name || '')}</p>
    <div class="flex justify-between items-end">
      <span class="font-bold text-primary">${formatTHB(product.price)}</span>
      <span class="text-xs ${stockClass}">${stockStatus}</span>
    </div>
    <button class="btn btn-primary btn-full mt-sm w-full" data-add-to-cart="${product.id}">
      หยิบใส่ตะกร้า
    </button>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-to-cart]')) return;
    window.location.href = `/shop/product.html?id=${product.id}`;
  });

  return card;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
  try {
    const { data: categories } = await state.supabase
      .from('categories')
      .select('*')
      .order('name');

    categorySelect.innerHTML = '<option value="">ทุกหมวดหมู่</option>';
    categories?.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      categorySelect.appendChild(opt);
    });

    await loadProducts(grid, countEl);
  } catch (err) {
    console.error(err);
    notify('ไม่สามารถโหลดสินค้าได้', 'error');
  }

  searchInput.addEventListener('input', () => {
    currentPage = 1;
    loadProducts(grid, countEl, searchInput.value);
  });

  categorySelect.addEventListener('change', (e) => {
    currentPage = 1;
    currentCategory = e.target.value || null;
    loadProducts(grid, countEl, searchInput.value, currentCategory);
  });
}