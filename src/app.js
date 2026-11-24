/**
 * ZenMarket App
 * จุดเริ่มต้นแอป, Global State, Header/Footer, Event Delegation, Scroll Reveal
 */

import { createClient } from '@supabase/supabase-js';
import { getAudience, getCurrentUser, isOwner, isMember, isSignedIn, logout, setAudience, clearStaleRole, AUDIENCE_GUEST } from '/src/core/audience.js';
import { initI18n, t, setLanguage, getLanguage, toggleLanguage, onLanguageChange, translatePage, setBrandName, applyDocumentTitle } from '/src/core/i18n.js';
import { setFlash, notify, flash } from '/src/core/ui.js';
import { initCaptcha } from '/src/core/captcha.js';
import { mergeStoreSettings } from '/src/core/settings.js';
import { initReveal } from '/src/core/reveal.js';
import { getPageTitleKey } from '/src/core/routes.js';
import { installGlobalErrorHandlers } from '/src/core/errors.js';
import { applyBrandAssets } from '/src/core/brand.js';

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

// ---------- Cart ----------
export function loadCart() {
  try {
    const stored = localStorage.getItem('zenmarket_cart');
    if (stored) state.cart = JSON.parse(stored) || [];
  } catch { state.cart = []; }
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
      image_url: product.image_url || null,
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

export function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) {
    const count = getCartItemCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-grid' : 'none';
  }
}

// ---------- Member gating (ซ่อนส่วนที่ต้องสมัครสมาชิกสำหรับ guest) ----------
/**
 * ซ่อน/แสดงองค์ประกอบตามสถานะการเข้าสู่ระบบ
 * - data-member-only : แสดงเฉพาะสมาชิก/แอดมิน
 * - data-guest-only  : แสดงเฉพาะ guest
 */
export function applyMemberGating(root = document) {
  const member = isMember() || isOwner();
  root.querySelectorAll('[data-member-only]').forEach(el => {
    el.classList.toggle('hidden', !member);
  });
  root.querySelectorAll('[data-guest-only]').forEach(el => {
    el.classList.toggle('hidden', member);
  });
}

/**
 * แสดงป้าย “เข้าสู่ระบบ/สมัครสมาชิก” แทนส่วนที่ต้องสมัครสมาชิก
 */
export function renderGuestGate(targetId) {
  const box = document.getElementById(targetId);
  if (!box) return;
  box.innerHTML = `
    <div class="empty-state" style="border:1px solid var(--color-border)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <h2 style="font-size:var(--font-size-xl);margin-bottom:var(--space-sm)" data-i18n="checkout.login_required">${t('checkout.login_required')}</h2>
      <p class="mb-lg" data-i18n="checkout.login_required_desc">${t('checkout.login_required_desc')}</p>
      <div class="flex gap-sm" style="flex-wrap:wrap;justify-content:center">
        <a href="/auth/login.html" class="btn btn-outline" data-i18n="nav.login">${t('nav.login')}</a>
        <a href="/auth/register.html" class="btn btn-primary" data-i18n="nav.register">${t('nav.register')}</a>
      </div>
    </div>
  `;
  box.classList.remove('hidden');
}

// ---------- Member guard ----------
/**
 * บังคับให้เข้าสู่ระบบก่อนใช้งานส่วนที่ต้องสมัครสมาชิก
 * @returns {boolean} true = ผ่าน, false = ถูกพาไปหน้า login/register
 */
export function requireMember(nextPath = window.location.pathname + window.location.search) {
  if (isSignedIn()) return true;
  sessionStorage.setItem('zenmarket_return_path', nextPath);
  notify(t('toast.login_required'), 'warning');
  setTimeout(() => { window.location.href = '/auth/login.html'; }, 900);
  return false;
}

// ---------- Icons ----------
const ICONS = {
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  bag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};

// ---------- Brand / logo ----------
function shopName() {
  return state.storeSettings?.shop_name || 'ZenMarket';
}

function logoUrl() {
  const url = state.storeSettings?.logo_url;
  if (!url || url.includes('placeholder')) return '';
  return url;
}

/**
 * โลโก้ร้าน: ใช้รูปที่อัปโหลดในแอดมิน ถ้าไม่มีใช้เครื่องหมายตัวอักษร
 */
function brandMarkup({ showPageTitle = true } = {}) {
  const logo = logoUrl();
  const name = shopName();
  const pageKey = getPageTitleKey();
  const pageLabel = showPageTitle ? t(pageKey) : '';

  const mark = logo
    ? `<img class="header-logo-img" src="${logo}" alt="${name}">`
    : `<span class="header-logo-mark">${(name[0] || 'Z').toUpperCase()}</span>`;

  return `
    ${mark}
    <span class="header-logo-text">
      <span class="header-logo-name">${name}</span>
      ${pageLabel ? `<span class="header-logo-sep">${t('nav.brand_sep')}</span><span class="header-logo-page" data-i18n="${pageKey}">${pageLabel}</span>` : ''}
    </span>
  `;
}

// ---------- Header ----------
export function initHeader() {
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="header-container">
      <a href="/home.html" class="header-logo" id="brand-link"></a>
      <nav class="header-nav" id="header-nav"></nav>
      <div class="header-actions" id="header-actions"></div>
    </div>
    <nav id="mobile-nav" class="mobile-nav"></nav>
  `;

  document.body.insertBefore(header, document.body.firstChild);

  renderHeader(header);

  // Header shadow on scroll
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });

  onLanguageChange(() => {
    renderHeader(header);
    applyMemberGating();
  });
}

function renderHeader(header) {
  const brandLink = header.querySelector('#brand-link');
  if (brandLink) brandLink.innerHTML = brandMarkup();

  const member = isMember() || isOwner();
  const path = window.location.pathname;
  const isActive = {
    home: path === '/' || path.includes('/home.html'),
    shop: path === '/shop' || path.includes('/shop/index'),
    categories: path.includes('/shop/categories'),
    account: path.includes('/account'),
  };

  const navItems = [
    { key: 'home', href: '/home.html', label: t('nav.home'), show: true },
    { key: 'shop', href: '/shop/index.html', label: t('nav.shop'), show: true },
    { key: 'categories', href: '/shop/categories.html', label: t('nav.categories'), show: true },
    { key: 'account', href: '/account/index.html', label: t('nav.account'), show: member || path.includes('/account') },
  ];

  const nav = header.querySelector('#header-nav');
  if (nav) {
    nav.innerHTML = navItems
      .filter(i => i.show)
      .map(i => `<a href="${i.href}" data-nav="${i.key}" data-i18n="${i.key === 'home' ? 'nav.home' : i.key === 'shop' ? 'nav.shop' : i.key === 'categories' ? 'nav.categories' : 'nav.account'}" class="${isActive[i.key] ? 'active' : ''}">${i.label}</a>`)
      .join('');
  }

  const mobileNav = header.querySelector('#mobile-nav');
  if (mobileNav) {
    mobileNav.innerHTML = `
      ${navItems.filter(i => i.show).map(i => `<a href="${i.href}" data-i18n="${i.key === 'home' ? 'nav.home' : i.key === 'shop' ? 'nav.shop' : i.key === 'categories' ? 'nav.categories' : 'nav.account'}">${i.label}</a>`).join('')}
      <a href="/shop/cart.html" data-i18n="nav.cart">${t('nav.cart')}</a>
      ${member
        ? `<a href="/account/favorites.html" data-i18n="nav.favorites">${t('nav.favorites')}</a>
           <a href="/account/orders.html" data-i18n="nav.orders">${t('nav.orders')}</a>`
        : `<a href="/auth/login.html" data-i18n="nav.login">${t('nav.login')}</a>
           <a href="/auth/register.html" data-i18n="nav.register">${t('nav.register')}</a>`}
      ${isOwner() ? `<a href="/admin/dashboard.html" data-i18n="nav.admin">${t('nav.admin')}</a>` : ''}
    `;
  }

  const actions = header.querySelector('#header-actions');
  if (actions) {
    actions.innerHTML = `
      <button id="lang-toggle" class="btn btn-ghost btn-sm" aria-label="เปลี่ยนภาษา">${getLanguage() === 'th' ? 'TH/EN' : 'EN/TH'}</button>
      <a href="/shop/cart.html" class="btn btn-ghost btn-sm header-cart" aria-label="${t('nav.cart')}" data-i18n-aria-label="nav.cart">
        ${ICONS.bag}<span id="cart-badge" class="cart-badge" style="display:none">0</span>
      </a>
      ${member
        ? `<a href="/account/index.html" class="btn btn-ghost btn-sm">${ICONS.user}<span>${t('nav.account')}</span></a>
           ${isOwner() ? `<a href="/admin/dashboard.html" class="btn btn-outline btn-sm" data-i18n="nav.admin">${t('nav.admin')}</a>` : ''}
           <button id="user-menu-btn" class="btn btn-outline btn-sm">${t('nav.logout')}</button>`
        : `<a href="/auth/login.html" class="btn btn-outline btn-sm" data-i18n="nav.login">${t('nav.login')}</a>
           <a href="/auth/register.html" class="btn btn-primary btn-sm" data-i18n="nav.register">${t('nav.register')}</a>`}
      <button id="menu-toggle" class="menu-toggle" aria-label="${t('nav.menu')}" data-i18n-aria-label="nav.menu">${ICONS.menu}</button>
    `;

    const langToggle = actions.querySelector('#lang-toggle');
    if (langToggle) {
      langToggle.addEventListener('click', () => toggleLanguage());
    }

    const logoutBtn = actions.querySelector('#user-menu-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { if (state.supabase) await state.supabase.auth.signOut(); } catch {}
        logout();
        notify(t('toast.logout_success'), 'success');
        setTimeout(() => { window.location.href = '/home.html'; }, 500);
      });
    }

    const menuToggle = actions.querySelector('#menu-toggle');
    const mobileNav = header.querySelector('#mobile-nav');
    if (menuToggle && mobileNav) {
      menuToggle.addEventListener('click', () => {
        const open = mobileNav.classList.toggle('open');
        menuToggle.innerHTML = open ? ICONS.close : ICONS.menu;
      });
    }
  }

  updateCartBadge();
}

// ---------- Footer ----------
export function initFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  document.body.appendChild(footer);
  renderFooter(footer);
  onLanguageChange(() => renderFooter(footer));
}

function renderFooter(footer) {
  const s = state.storeSettings || {};
  const logo = logoUrl();
  const mark = logo
    ? `<img class="footer-logo-img" src="${logo}" alt="${shopName()}">`
    : `<span class="header-logo-mark">${(shopName()[0] || 'Z').toUpperCase()}</span>`;

  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        <a href="/home.html" class="header-logo">${mark}<span class="header-logo-name">${shopName()}</span></a>
        <p>${s.tagline || t('footer.tagline')}</p>
      </div>
      <div class="footer-col">
        <h4>${t('footer.shop')}</h4>
        <a href="/shop/index.html" data-i18n="footer.all_products">${t('footer.all_products')}</a>
        <a href="/shop/categories.html" data-i18n="footer.categories">${t('footer.categories')}</a>
        <a href="/shop/cart.html" data-i18n="footer.cart">${t('footer.cart')}</a>
      </div>
      <div class="footer-col">
        <h4>${t('footer.help')}</h4>
        <a href="/pages/help.html" data-i18n="footer.help_shipping">${t('footer.help_shipping')}</a>
        <a href="/pages/about.html" data-i18n="footer.about">${t('footer.about')}</a>
        <a href="/pages/contact.html" data-i18n="footer.contact_us">${t('footer.contact_us')}</a>
        <a href="/pages/privacy.html" data-i18n="footer.privacy">${t('footer.privacy')}</a>
      </div>
      <div class="footer-col">
        <h4>${t('footer.contact')}</h4>
        ${s.contact_phone ? `<a href="tel:${s.contact_phone}">${s.contact_phone}</a>` : ''}
        ${s.contact_email ? `<a href="mailto:${s.contact_email}">${s.contact_email}</a>` : ''}
        ${s.contact_address ? `<span class="footer-text">${s.contact_address}</span>` : ''}
        ${s.line_url ? `<a href="${s.line_url}" target="_blank" rel="noopener">LINE Official</a>` : ''}
        ${s.facebook_url ? `<a href="${s.facebook_url}" target="_blank" rel="noopener">Facebook</a>` : ''}
        ${s.instagram_url ? `<a href="${s.instagram_url}" target="_blank" rel="noopener">Instagram</a>` : ''}
      </div>
    </div>
    <div class="footer-bottom">© ${new Date().getFullYear()} ${shopName()} — ${t('footer.rights')}</div>
  `;
}

// ---------- Store settings ----------
export async function loadStoreSettings() {
  if (!state.supabase) return;
  try {
    const { data } = await state.supabase.rpc('get_storefront');
    if (data) state.storeSettings = mergeStoreSettings(data);
  } catch {}
  setBrandName(state.storeSettings?.shop_name || 'ZenMarket');
  applyBrandAssets(state.storeSettings || {});
}

/**
 * ตรวจสอบว่าเชื่อมต่อ Supabase ได้หรือไม่
 */
export function requireSupabase() {
  if (state.supabase) return true;
  if (typeof document !== 'undefined' && document.body) {
    const banner = document.createElement('div');
    banner.className = 'toast error';
    banner.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);z-index:2000';
    banner.innerHTML = `<span>${t('toast.db_missing')}</span>`;
    document.body.appendChild(banner);
  }
  return false;
}

/**
 * เพิ่มสินค้าลงตะกร้าจากปุ่มในการ์ดสินค้า (ทุกหน้าที่มี data-add-to-cart)
 */
window.addEventListener('zenmarket:add-to-cart', async (event) => {
  const productId = event.detail?.productId;
  if (!productId || !state.supabase) return;

  try {
    const { data } = await state.supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();
    if (!data) {
      notify(t('product.not_found'), 'error');
      return;
    }
    if (!data.active || data.stock <= 0) {
      notify(t('product.out_of_stock'), 'warning');
      return;
    }
    addToCart(data, 1);
    updateCartBadge();
    notify(t('product.added_to_cart', { name: data.name }), 'success');
  } catch (err) {
    console.error(err);
    notify(t('toast.error_generic'), 'error');
  }
});

// ---------- Session ----------
async function restoreSession() {
  if (!state.supabase) return;
  try {
    const { data } = await state.supabase.auth.getSession();
    const session = data?.session;
    if (!session?.user) {
      // ไม่มี session จริง → ล้างบทบาทที่ค้างอยู่ใน localStorage
      clearStaleRole();
      return;
    }

    const userId = session.user.id;
    const { data: profile } = await state.supabase
      .from('profiles').select('*').eq('id', userId).maybeSingle();

    const { data: adminRow } = await state.supabase
      .from('store_admin').select('user_id').eq('user_id', userId).maybeSingle();

    const user = {
      id: userId,
      email: session.user.email,
      username: profile?.username || '',
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      nickname: profile?.nickname || '',
      phone: profile?.phone || '',
      age: profile?.age ?? null,
    };

    setAudience(adminRow ? 'owner' : 'member', user);
    state.user = user;
    state.audience = adminRow ? 'owner' : 'member';
  } catch (err) {
    console.warn('[ZenMarket] restore session failed', err);
  }
}

// ---------- Bootstrap ----------
let initPromise = null;

export function initApp() {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit() {
  initI18n();
  initCaptcha();
  installGlobalErrorHandlers();
  initSupabase();

  loadCart();
  updateCartBadge();

  await restoreSession();

  state.audience = getAudience();
  state.user = getCurrentUser();

  // ซ่อนส่วนที่ต้องสมัครสมาชิกสำหรับ guest
  applyMemberGating();

  if (document.body && !document.querySelector('.site-header')) initHeader();

  await loadStoreSettings();

  // โหลดข้อมูลร้านแล้ววาด header/footer ใหม่ (โลโก้ + ชื่อร้านจริง)
  if (document.querySelector('#brand-link')) {
    const header = document.querySelector('.site-header');
    if (header) renderHeader(header);
  }
  if (document.body && !document.querySelector('.site-footer')) initFooter();

  // ใช้หลังสร้าง header/footer แล้ว เพื่อซ่อนส่วนสมาชิกให้ครบทุกจุด
  applyMemberGating();

  initReveal();

  document.body.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('zenmarket:add-to-cart', {
        detail: { productId: addBtn.getAttribute('data-add-to-cart'), button: addBtn }
      }));
    }
  });

  flash();
  state.initialized = true;
  return state;
}

// หน้าเนื้อหา static (about/contact/help/privacy) ใช้แค่ app.js
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body && document.body.classList.contains('app-shell')) {
      initApp();
    }
  });
}
