/**
 * ZenMarket App
 * จุดเริ่มต้นแอป, Global State, Header/Footer, Event Delegation, Scroll Reveal
 */

import { createClient } from '@supabase/supabase-js';
import { getAudience, getCurrentUser, isOwner, isMember, logout, setAudience, AUDIENCE_GUEST } from '/src/core/audience.js';
import { initI18n, t, setLanguage, getLanguage } from '/src/core/i18n.js';
import { setFlash, notify, flash } from '/src/core/ui.js';
import { initCaptcha } from '/src/core/captcha.js';
import { mergeStoreSettings } from '/src/core/settings.js';
import { initReveal } from '/src/core/reveal.js';

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
      price: Number(product.price),
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
    badge.style.display = count > 0 ? 'inline-grid' : 'none';
  }
}

const ICONS = {
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  bag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};

// Initialize header (storefront pages)
export function initHeader() {
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="header-container">
      <a href="/home.html" class="header-logo"><span class="header-logo-mark">Z</span>ZenMarket</a>
      <nav class="header-nav">
        <a href="/home.html" data-nav="home" data-i18n="nav.home">หน้าแรก</a>
        <a href="/shop/index.html" data-nav="shop" data-i18n="nav.shop">ร้านค้า</a>
        <a href="/shop/categories.html" data-nav="categories">หมวดหมู่</a>
        <a href="/account/index.html" data-nav="account" data-i18n="nav.account">บัญชีของฉัน</a>
      </nav>
      <div class="header-actions">
        <button id="lang-toggle" class="btn btn-ghost btn-sm">TH/EN</button>
        <a href="/shop/cart.html" class="btn btn-ghost btn-sm header-cart" aria-label="ตะกร้า">
          ${ICONS.bag}<span id="cart-badge" class="cart-badge" style="display:none">0</span>
        </a>
        <button id="user-menu-btn" class="btn btn-outline btn-sm">${ICONS.user}<span data-i18n="nav.login">เข้าสู่ระบบ</span></button>
        <button id="menu-toggle" class="menu-toggle" aria-label="เมนู">${ICONS.menu}</button>
      </div>
    </div>
    <nav id="mobile-nav" class="mobile-nav">
      <a href="/home.html" data-i18n="nav.home">หน้าแรก</a>
      <a href="/shop/index.html" data-i18n="nav.shop">ร้านค้า</a>
      <a href="/shop/categories.html">หมวดหมู่</a>
      <a href="/account/index.html" data-i18n="nav.account">บัญชีของฉัน</a>
      <a href="/shop/cart.html" data-i18n="nav.cart">ตะกร้า</a>
    </nav>
  `;

  // Active nav state
  const path = window.location.pathname;
  const isActive = {
    home: path === '/' || path.includes('/home.html'),
    shop: path === '/shop' || path.includes('/shop/index'),
    categories: path.includes('/shop/categories'),
    account: path.includes('/account'),
  };
  header.querySelectorAll('[data-nav]').forEach(a => {
    const key = a.getAttribute('data-nav');
    if (isActive[key]) a.classList.add('active');
  });

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
    const label = userBtn.querySelector('[data-i18n]');
    if ((isMember() || isOwner()) && label) {
      label.setAttribute('data-i18n', 'nav.logout');
      label.textContent = 'ออกจากระบบ';
      if (isOwner()) {
        const adminLink = document.createElement('a');
        adminLink.href = '/admin/dashboard.html';
        adminLink.className = 'btn btn-ghost btn-sm';
        adminLink.setAttribute('data-i18n', 'nav.admin');
        adminLink.textContent = 'จัดการร้าน';
        userBtn.parentNode.insertBefore(adminLink, userBtn);
      }
    }
    userBtn.addEventListener('click', async () => {
      if (isMember() || isOwner()) {
        try {
          if (state.supabase) await state.supabase.auth.signOut();
        } catch {}
        logout();
        window.location.href = '/home.html';
      } else {
        window.location.href = '/auth/login.html';
      }
    });
  }

  // Mobile menu
  const menuToggle = header.querySelector('#menu-toggle');
  const mobileNav = header.querySelector('#mobile-nav');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('open');
      menuToggle.innerHTML = open ? ICONS.close : ICONS.menu;
    });
  }

  // Header shadow on scroll
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });

  document.body.insertBefore(header, document.body.firstChild);
}

// Initialize footer (storefront pages)
export function initFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  const s = state.storeSettings || {};
  const shopName = s.shop_name || 'ZenMarket';
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        <a href="/home.html" class="header-logo"><span class="header-logo-mark">Z</span>${shopName}</a>
        <p>${s.tagline || 'ร้านค้าออนไลน์ ด้วยความตั้งใจและความใส่ใจในทุกรายละเอียด'}</p>
      </div>
      <div class="footer-col">
        <h4>ร้านค้า</h4>
        <a href="/shop/index.html">สินค้าทั้งหมด</a>
        <a href="/shop/categories.html">หมวดหมู่</a>
        <a href="/shop/cart.html">ตะกร้า</a>
      </div>
      <div class="footer-col">
        <h4>ช่วยเหลือ</h4>
        <a href="/pages/help.html">การจัดส่งและชำระเงิน</a>
        <a href="/pages/about.html">เกี่ยวกับร้าน</a>
        <a href="/pages/contact.html">ติดต่อเรา</a>
        <a href="/pages/privacy.html">นโยบายความเป็นส่วนตัว</a>
      </div>
      <div class="footer-col">
        <h4>ติดต่อ</h4>
        ${s.contact_phone ? `<a href="tel:${s.contact_phone}">${s.contact_phone}</a>` : ''}
        ${s.contact_email ? `<a href="mailto:${s.contact_email}">${s.contact_email}</a>` : ''}
        ${s.line_url ? `<a href="${s.line_url}" target="_blank" rel="noopener">LINE Official</a>` : ''}
        ${s.facebook_url ? `<a href="${s.facebook_url}" target="_blank" rel="noopener">Facebook</a>` : ''}
        ${s.instagram_url ? `<a href="${s.instagram_url}" target="_blank" rel="noopener">Instagram</a>` : ''}
      </div>
    </div>
    <div class="footer-bottom">© ${new Date().getFullYear()} ${shopName} — สงวนลิขสิทธิ์</div>
  `;
  document.body.appendChild(footer);
}

// Load store settings from DB (for footer/brand)
export async function loadStoreSettings() {
  if (!state.supabase) return;
  try {
    const { data } = await state.supabase.rpc('get_storefront');
    if (data) state.storeSettings = mergeStoreSettings(data);
  } catch {}
}

/**
 * ตรวจสอบว่าเชื่อมต่อ Supabase ได้หรือไม่ (ใช้ก่อน query ข้อมูล)
 */
export function requireSupabase() {
  if (state.supabase) return true;
  const banner = document.createElement('div');
  banner.className = 'toast error';
  banner.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);z-index:2000';
  banner.innerHTML = '<span>ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)</span>';
  document.body.appendChild(banner);
  return false;
}

// Main initialization
let initPromise = null;

export function initApp() {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit() {
  initI18n();
  initCaptcha();
  initSupabase();

  loadCart();
  updateCartBadge();

  // กู้คืน session จาก Supabase (กรณีรีเฟรชแล้ว localStorage หาย)
  await restoreSession();

  const aud = getAudience();
  state.audience = aud;
  state.user = getCurrentUser();

  if (document.body && !document.querySelector('.site-header')) {
    initHeader();
  }
  updateCartBadge();

  await loadStoreSettings();
  if (document.body && !document.querySelector('.site-footer')) {
    initFooter();
  }

  initReveal();

  document.body.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      e.preventDefault();
      const productId = addBtn.getAttribute('data-add-to-cart');
      window.dispatchEvent(new CustomEvent('zenmarket:add-to-cart', {
        detail: { productId, button: addBtn }
      }));
    }
  });

  flash();
  state.initialized = true;
  return state;
}

/**
 * ตรวจสอบ session ของ Supabase และเติมข้อมูลผู้ใช้ + สิทธิ์ (member / owner)
 */
async function restoreSession() {
  if (!state.supabase) return;
  try {
    const { data } = await state.supabase.auth.getSession();
    const session = data?.session;
    if (!session?.user) return;

    const userId = session.user.id;
    const { data: profile } = await state.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const { data: adminRow } = await state.supabase
      .from('store_admin')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    const user = {
      id: userId,
      email: session.user.email,
      username: profile?.username || '',
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || '',
    };

    setAudience(adminRow ? 'owner' : 'member', user);
    state.user = user;
    state.audience = adminRow ? 'owner' : 'member';
  } catch (err) {
    console.warn('[ZenMarket] restore session failed', err);
  }
}

// หน้าเนื้อหา static (about/contact/help/privacy) ใช้แค่ app.js ต้องบูตแอปเอง
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body && document.body.classList.contains('app-shell')) {
      initApp();
    }
  });
}

// Export for use in page modules
export { state as appState };
