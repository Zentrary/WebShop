/**
 * ZenMarket Admin Layout
 * สร้าง sidebar + แถบบนสำหรับทุกหน้าหลังบ้าน (รองรับ TH/EN และโลโก้ร้าน)
 */

import { isOwner, logout } from '/src/core/audience.js';
import { t, onLanguageChange } from '/src/core/i18n.js';

const NAV_ITEMS = [
  { href: '/admin/dashboard.html', key: 'admin.dashboard', icon: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z' },
  { href: '/admin/orders.html', key: 'admin.orders', icon: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0' },
  { href: '/admin/products.html', key: 'admin.products', icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z' },
  { href: '/admin/categories.html', key: 'admin.categories', icon: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z' },
  { href: '/admin/reviews.html', key: 'admin.reviews', icon: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z' },
  { href: '/admin/settings.html', key: 'admin.settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H7a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' },
  { href: '/admin/payments.html', key: 'admin.payments', icon: 'M2 7h20v10H2V7Zm0 5h20M6 15h4' },
  { href: '/admin/operations.html', key: 'admin.operations', icon: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
];

function svg(path) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

export function initAdminLayout(activeHref, storeSettings = {}) {
  const layout = document.querySelector('.admin-layout');
  if (!layout) return;

  const shopName = storeSettings?.shop_name || 'ZenMarket';
  const logo = storeSettings?.logo_url && !storeSettings.logo_url.includes('placeholder')
    ? storeSettings.logo_url
    : '';
  const brandMark = logo
    ? `<img class="header-logo-img" src="${logo}" alt="${shopName}">`
    : `<span class="header-logo-mark">${(shopName[0] || 'Z').toUpperCase()}</span>`;

  const render = () => {
    const navHtml = NAV_ITEMS.map(item => `
      <a href="${item.href}" class="${item.href === activeHref ? 'active' : ''}" data-i18n="${item.key}">
        ${svg(item.icon)}
        <span>${t(item.key)}</span>
      </a>
    `).join('');

    const sidebar = document.createElement('aside');
    sidebar.className = 'admin-sidebar';
    sidebar.innerHTML = `
      <div class="brand">
        <a href="/admin/dashboard.html" class="header-logo">${brandMark}<span class="header-logo-name">${shopName}</span></a>
        <div class="text-muted" style="font-size:var(--font-size-xs);margin-top:var(--space-xs)" data-i18n="admin.system">ระบบจัดการร้าน</div>
      </div>
      <nav class="admin-nav">${navHtml}</nav>
      <div style="margin-top:var(--space-2xl)">
        <a href="/home.html" class="btn btn-outline btn-sm btn-full" data-i18n="admin.back_store">← กลับหน้าร้าน</a>
        <button id="admin-logout" class="btn btn-ghost btn-sm btn-full mt-sm" data-i18n="admin.logout">ออกจากระบบ</button>
      </div>
    `;

    const mobileNav = document.createElement('details');
    mobileNav.className = 'admin-mobile-nav';
    mobileNav.innerHTML = `
      <summary style="padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-lg);font-weight:600">☰ ${t('admin.menu')}</summary>
      <nav class="admin-nav" style="margin-top:var(--space-sm)">${navHtml}</nav>
    `;

    layout.querySelector('.admin-sidebar')?.remove();
    layout.querySelector('.admin-mobile-nav')?.remove();
    layout.insertBefore(sidebar, layout.firstChild);
    layout.insertBefore(mobileNav, layout.firstChild);

    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY
          );
          await supabase.auth.signOut();
        } catch {}
        logout();
        window.location.href = '/admin/login.html';
      });
    }
  };

  render();
  onLanguageChange(render);
}

export function guardAdmin() {
  if (!isOwner()) {
    window.location.href = '/admin/login.html';
    return false;
  }
  return true;
}
