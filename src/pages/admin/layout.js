import { isOwner, logout } from '/src/core/audience.js';
import { t, onLanguageChange, toggleLanguage, getLanguage } from '/src/core/i18n.js';
import { safeImage } from '/src/core/lib.js';

const NAV_GROUPS = [
  {
    labelKey: 'admin.nav_group_store',
    items: [
      {
        href: '/admin/dashboard',
        key: 'admin.dashboard',
        icon: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
      },
      {
        href: '/admin/orders',
        key: 'admin.orders',
        icon: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
      },
      {
        href: '/admin/products',
        key: 'admin.products',
        icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
      },
      {
        href: '/admin/categories',
        key: 'admin.categories',
        icon: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
      },
      {
        href: '/admin/coupons',
        key: 'admin.nav_coupons',
        icon: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01',
      },
      {
        href: '/admin/reviews',
        key: 'admin.reviews',
        icon: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z',
      },
    ],
  },
  {
    labelKey: 'admin.nav_group_system',
    items: [
      {
        href: '/admin/reports',
        key: 'admin.nav_reports',
        icon: 'M3 3v18h18M7 15l4-4 3 3 5-6',
      },
      {
        href: '/admin/settings',
        key: 'admin.settings',
        icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H7a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
      },
      {
        href: '/admin/payments',
        key: 'admin.payments',
        icon: 'M2 7h20v10H2V7Zm0 5h20M6 15h4',
      },
      {
        href: '/admin/operations',
        key: 'admin.operations',
        icon: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
      },
    ],
  },
];

function svg(path) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}

export function initAdminLayout(activeHref, storeSettings = {}) {
  const layout = document.querySelector('.admin-layout');
  if (!layout) return;

  const shopName = storeSettings?.shop_name || 'ZenMarket';
  const rawLogo = storeSettings?.logo_url || '';
  // No letter mark: the shop either has a real logo image or it shows its
  // name in type only.
  const logo = rawLogo && !rawLogo.includes('placeholder') ? safeImage(rawLogo) : '';
  const brandLogo = logo ? `<img class="admin-brand-logo" src="${logo}" alt="${shopName}">` : '';

  const navHtml = (extraClass = '') =>
    NAV_GROUPS.map(
      (group) => `
      <div class="admin-nav-group">
        <span class="admin-nav-label${extraClass}" data-i18n="${group.labelKey}">${t(group.labelKey)}</span>
        ${group.items
          .map(
            (item) => `
          <a href="${item.href}" class="${item.href === activeHref ? 'active' : ''}">
            ${svg(item.icon)}
            <span data-i18n="${item.key}">${t(item.key)}</span>
          </a>`,
          )
          .join('')}
      </div>`,
    ).join('');

  const render = () => {
    const sidebar = document.createElement('aside');
    sidebar.className = 'admin-sidebar';
    sidebar.innerHTML = `
      <a href="/admin/dashboard" class="admin-brand">
        ${brandLogo}
        <span class="admin-brand-text">
          <span class="admin-brand-name">${shopName}</span>
          <span class="admin-brand-role" data-i18n="admin.system">${t('admin.system')}</span>
        </span>
      </a>
      <nav class="admin-nav">${navHtml()}</nav>
      <div class="admin-sidebar-foot">
        <button type="button" id="admin-lang-toggle" class="lang-link admin-lang-toggle" aria-label="${t('common.change_lang')}" data-i18n-aria-label="common.change_lang">${getLanguage() === 'th' ? 'TH / EN' : 'EN / TH'}</button>
        <a href="/home" class="btn btn-outline btn-sm btn-full" data-i18n="admin.back_store">← ${t('admin.back_store')}</a>
        <button id="admin-logout" class="btn btn-danger-solid btn-sm btn-full" data-i18n="admin.logout">${t('admin.logout')}</button>
      </div>
    `;

    // ใช้ปุ่ม + div แทน <details> เพราะ <details> ที่พับอยู่ยังกินความสูงของ
    // เนื้อหาข้างในในบางเบราว์เซอร์ ทำให้มีช่องว่างใหญ่ใต้แถบเมนู
    const mobileNav = document.createElement('div');
    mobileNav.className = 'admin-mobile-nav';
    mobileNav.innerHTML = `
      <button type="button" class="admin-mobile-nav-summary" aria-expanded="false" aria-controls="admin-mobile-nav-body">
        <span class="admin-mobile-nav-title" data-i18n="admin.menu">${t('admin.menu')}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="admin-mobile-nav-body" id="admin-mobile-nav-body">
        <nav class="admin-nav admin-nav-mobile">${navHtml()}</nav>
        <div class="admin-mobile-nav-foot">
          <button type="button" id="admin-mobile-lang-toggle" class="lang-link admin-lang-toggle" aria-label="${t('common.change_lang')}" data-i18n-aria-label="common.change_lang">${getLanguage() === 'th' ? 'TH / EN' : 'EN / TH'}</button>
          <a href="/home" class="btn btn-outline btn-sm btn-full" data-i18n="admin.back_store">← ${t('admin.back_store')}</a>
          <button id="admin-mobile-logout" class="btn btn-danger-solid btn-sm btn-full" data-i18n="admin.logout">${t('admin.logout')}</button>
        </div>
      </div>
    `;

    layout.querySelector('.admin-sidebar')?.remove();
    layout.querySelector('.admin-mobile-nav')?.remove();
    layout.insertBefore(sidebar, layout.firstChild);
    layout.insertBefore(mobileNav, layout.firstChild);

    const mobileToggle = mobileNav.querySelector('.admin-mobile-nav-summary');
    if (mobileToggle) {
      mobileToggle.addEventListener('click', () => {
        const open = mobileNav.classList.toggle('is-open');
        mobileToggle.setAttribute('aria-expanded', String(open));
      });
    }

    const langBtn = document.getElementById('admin-lang-toggle');
    if (langBtn) {
      langBtn.addEventListener('click', () => toggleLanguage());
    }

    const mobileLangBtn = document.getElementById('admin-mobile-lang-toggle');
    if (mobileLangBtn) {
      mobileLangBtn.addEventListener('click', () => toggleLanguage());
    }

    const signOut = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
        await supabase.auth.signOut();
      } catch {}
      logout();
      window.location.href = '/admin/login';
    };

    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', signOut);
    }

    const mobileLogoutBtn = document.getElementById('admin-mobile-logout');
    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener('click', signOut);
    }
  };

  render();
  onLanguageChange(render);
}

export function guardAdmin() {
  if (!isOwner()) {
    window.location.href = '/admin/login';
    return false;
  }
  return true;
}
