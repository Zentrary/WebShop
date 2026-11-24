/**
 * ZenMarket App
 * จุดเริ่มต้นแอป, Global State, Header, Event Delegation, Polling
 */

import { createClient } from '@supabase/supabase-js';
import { getAudience, getCurrentUser, isOwner, isMember, logout, AUDIENCE_GUEST } from '/src/core/audience.js';
import { initI18n, t, setLanguage, getLanguage } from '/src/core/i18n.js';
import { setFlash, notify, flash } from '/src/core/ui.js';
import { initCaptcha } from '/src/core/captcha.js';

// Global state
export const state = {
  audience: AUDIENCE_GUEST,
  user: null,
  cart: [],
  storeSettings: {},
  supabase: null,
  initialized: false,
};

// Initialize Supabase client
export function initSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    state.supabase = createClient(url, key);
  } else {
    console.warn('[ZenMarket] Supabase env vars missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  }
  return state.supabase;
}

// Load cart from localStorage
export function loadCart() {
  try {
    const stored = localStorage.getItem('zenmarket_cart');
    if (stored) {
      state.cart = JSON.parse(stored);
    }
  } catch {}
}

export function saveCart() {
  try {
    localStorage.setItem('zenmarket_cart', JSON.stringify(state.cart));
  } catch {}
}

export function addToCart(product, quantity = 1) {
  const existing = state.cart.find(item => item.product_id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      quantity,
    });
  }
  saveCart();
  updateCartBadge();
}

export function removeFromCart(productId) {
  state.cart = state.cart.filter(item => item.product_id !== productId);
  saveCart();
  updateCartBadge();
}

export function updateCartItemQuantity(productId, quantity) {
  const item = state.cart.find(item => item.product_id === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    saveCart();
    updateCartBadge();
  }
}

export function clearCart() {
  state.cart = [];
  saveCart();
  updateCartBadge();
}

export function getCartItemCount() {
  return state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

// Update cart badge in header
export function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) {
    const count = getCartItemCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// Initialize header
export function initHeader() {
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="header-container">
      <a href="/home.html" class="header-logo" data-i18n="nav.home">ZenMarket</a>
      <nav class="header-nav">
        <a href="/shop/index.html" data-i18n="nav.shop">ร้านค้า</a>
        <a href="/account/index.html" data-i18n="nav.account">บัญชีของฉัน</a>
        <a href="/shop/cart.html" class="header-cart" data-i18n="nav.cart">
          ตะกร้า <span id="cart-badge" class="cart-badge">0</span>
        </a>
      </nav>
      <div class="header-actions">
        <button id="lang-toggle" class="btn btn-outline btn-sm">TH/EN</button>
        <button id="user-menu-btn" class="btn btn-outline btn-sm" data-i18n="nav.login">เข้าสู่ระบบ</button>
      </div>
    </div>
  `;

  // Language toggle
  const langToggle = header.querySelector('#lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', () => {
      const current = getLanguage();
      setLanguage(current === 'th' ? 'en' : 'th');
    });
  }

  // User menu
  const userBtn = header.querySelector('#user-menu-btn');
  if (userBtn) {
    userBtn.addEventListener('click', () => {
      if (isMember() || isOwner()) {
        logout();
        window.location.href = '/home.html';
      } else {
        window.location.href = '/auth/login.html';
      }
    });
  }

  // Insert header at top of body
  document.body.insertBefore(header, document.body.firstChild);
}

// Main initialization
export async function initApp() {
  if (state.initialized) return;
  state.initialized = true;

  // Initialize i18n
  initI18n();

  // Initialize captcha
  initCaptcha();

  // Initialize Supabase client (must run before any page queries state.supabase)
  initSupabase();

  // Load cart
  loadCart();
  updateCartBadge();

  // Load audience state
  const aud = getAudience();
  state.audience = aud;
  state.user = getCurrentUser();

  // Init header if on a page that needs it
  if (document.body && !document.querySelector('.site-header')) {
    initHeader();
  }

  // Setup global event delegation for cart buttons
  document.body.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      e.preventDefault();
      const productId = addBtn.getAttribute('data-add-to-cart');
      // Will be handled by page-specific code
      window.dispatchEvent(new CustomEvent('zenmarket:add-to-cart', {
        detail: { productId, button: addBtn }
      }));
    }
  });

  // Flash messages
  flash();
}

// Export for use in page modules
export { state as appState };