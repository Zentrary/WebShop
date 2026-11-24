/**
 * โครงสร้าง URL ของเว็บใช้แบบ "clean URL" ไม่มี `.html` ต่อท้าย
 * เช่น /home, /shop, /shop/product, /admin/dashboard
 * (Vercel เปิด `cleanUrls` ให้ และ dev server แปลงให้ใน vite.config.js)
 */

/** ที่อยู่เก่า/ชื่อย่อ → ที่อยู่จริงของหน้า */
export const ROUTE_MAP = {
  '/': '/home',
  '/home': '/home',
  '/home.html': '/home',
  '/index.html': '/home',

  '/shop': '/shop',
  '/shop.html': '/shop',
  '/shop/index': '/shop',
  '/shop/index.html': '/shop',
  '/shop/categories': '/shop',
  '/shop/categories.html': '/shop',
  '/shop/product': '/shop/product',
  '/shop/product.html': '/shop/product',
  '/shop/cart': '/shop/cart',
  '/shop/cart.html': '/shop/cart',
  '/shop/checkout': '/shop/checkout',
  '/shop/checkout.html': '/shop/checkout',

  '/account': '/account',
  '/account.html': '/account',
  '/account/index': '/account',
  '/account/index.html': '/account',
  '/account/orders': '/account/orders',
  '/account/orders.html': '/account/orders',
  '/account/order': '/account/order',
  '/account/order.html': '/account/order',
  '/account/favorites': '/account/favorites',
  '/account/favorites.html': '/account/favorites',

  '/auth/login': '/auth/login',
  '/login': '/auth/login',
  '/login.html': '/auth/login',
  '/auth/login.html': '/auth/login',
  '/auth/register': '/auth/register',
  '/register': '/auth/register',
  '/register.html': '/auth/register',
  '/auth/register.html': '/auth/register',
  '/auth/reset-password': '/auth/reset-password',
  '/auth/reset-password.html': '/auth/reset-password',
  '/auth/forgot-password': '/auth/forgot-password',
  '/auth/forgot-password.html': '/auth/forgot-password',

  '/pages/about': '/pages/about',
  '/pages/about.html': '/pages/about',
  '/about': '/pages/about',
  '/about.html': '/pages/about',
  '/pages/contact': '/pages/contact',
  '/pages/contact.html': '/pages/contact',
  '/contact': '/pages/contact',
  '/contact.html': '/pages/contact',
  '/pages/help': '/pages/help',
  '/pages/help.html': '/pages/help',
  '/help': '/pages/help',
  '/help.html': '/pages/help',
  '/pages/privacy': '/pages/privacy',
  '/pages/privacy.html': '/pages/privacy',
  '/privacy': '/pages/privacy',
  '/privacy.html': '/pages/privacy',

  '/admin': '/admin/dashboard',
  '/admin.html': '/admin/dashboard',
  '/admin/login': '/admin/login',
  '/admin/login.html': '/admin/login',
  '/admin/dashboard': '/admin/dashboard',
  '/admin/dashboard.html': '/admin/dashboard',
  '/admin/orders': '/admin/orders',
  '/admin/orders.html': '/admin/orders',
  '/admin/order': '/admin/order',
  '/admin/order.html': '/admin/order',
  '/admin/products': '/admin/products',
  '/admin/products.html': '/admin/products',
  '/admin/categories': '/admin/categories',
  '/admin/categories.html': '/admin/categories',
  '/admin/reviews': '/admin/reviews',
  '/admin/reviews.html': '/admin/reviews',
  '/admin/settings': '/admin/settings',
  '/admin/settings.html': '/admin/settings',
  '/admin/payments': '/admin/payments',
  '/admin/payments.html': '/admin/payments',
  '/admin/coupons': '/admin/coupons',
  '/admin/coupons.html': '/admin/coupons',
  '/admin/reports': '/admin/reports',
  '/admin/reports.html': '/admin/reports',
  '/admin/operations': '/admin/operations',
  '/admin/operations.html': '/admin/operations',
};

/** ทำให้ path ใด ๆ กลายเป็นที่อยู่จริง (ตัด .html, index, trailing slash) */
export function normalizePath(pathname = '/') {
  const raw = String(pathname || '/')
    .split('?')[0]
    .split('#')[0];
  const trimmed = raw.replace(/\/+$/, '') || '/';
  // เผื่อมีใครเปิดลิงก์เก่าที่ลงท้าย .html อยู่ ก็ยังได้ path เดียวกัน
  const withoutHtml = trimmed.replace(/\.html$/, '');
  const withoutIndex = withoutHtml.replace(/\/index$/, '') || '/';
  return withoutIndex || '/';
}

export const PAGE_TITLE_KEYS = [
  ['/admin/dashboard', 'admin.page_dashboard'],
  ['/admin/orders', 'admin.page_orders'],
  ['/admin/order', 'admin.page_orders'],
  ['/admin/products', 'admin.page_products'],
  ['/admin/categories', 'admin.page_categories'],
  ['/admin/reviews', 'admin.page_reviews'],
  ['/admin/settings', 'admin.page_settings'],
  ['/admin/payments', 'admin.page_payments'],
  ['/admin/coupons', 'admin.page_coupons'],
  ['/admin/reports', 'admin.page_reports'],
  ['/admin/operations', 'admin.page_operations'],
  ['/admin/login', 'admin.page_login'],
  ['/shop/product', 'shop.product_title'],
  ['/shop/cart', 'nav.cart'],
  ['/shop/checkout', 'checkout.title'],
  ['/account/orders', 'nav.orders'],
  ['/account/order', 'nav.orders'],
  ['/account/favorites', 'nav.favorites'],
  ['/account', 'nav.account'],
  ['/auth/login', 'nav.login'],
  ['/auth/register', 'nav.register'],
  ['/auth/reset-password', 'auth.reset_title'],
  ['/auth/forgot-password', 'auth.forgot_title'],
  ['/pages/about', 'page.about_title'],
  ['/pages/contact', 'page.contact_title'],
  ['/pages/help', 'page.help_title'],
  ['/pages/privacy', 'page.privacy_title'],
  ['/shop', 'nav.shop'],
  ['/home', 'nav.home'],
];

export const MEMBERSHIP_ROUTES = ['/account', '/account/orders', '/account/order', '/account/favorites'];

export const EXACT_TITLE_KEYS = {
  '/': 'nav.home',
  '/home': 'nav.home',
  '/shop': 'nav.shop',
  '/shop/product': 'shop.product_title',
  '/shop/cart': 'nav.cart',
  '/shop/checkout': 'checkout.title',
  '/account': 'nav.account',
  '/account/orders': 'nav.orders',
  '/account/order': 'nav.orders',
  '/account/favorites': 'nav.favorites',
  '/auth/login': 'nav.login',
  '/auth/register': 'nav.register',
  '/auth/reset-password': 'auth.reset_title',
  '/auth/forgot-password': 'auth.forgot_title',
  '/pages/about': 'page.about_title',
  '/pages/contact': 'page.contact_title',
  '/pages/help': 'page.help_title',
  '/pages/privacy': 'page.privacy_title',
  '/admin': 'admin.page_dashboard',
  '/admin/dashboard': 'admin.page_dashboard',
  '/admin/orders': 'admin.page_orders',
  '/admin/order': 'admin.page_orders',
  '/admin/products': 'admin.page_products',
  '/admin/categories': 'admin.page_categories',
  '/admin/reviews': 'admin.page_reviews',
  '/admin/settings': 'admin.page_settings',
  '/admin/payments': 'admin.page_payments',
  '/admin/coupons': 'admin.page_coupons',
  '/admin/reports': 'admin.page_reports',
  '/admin/operations': 'admin.page_operations',
  '/admin/login': 'admin.page_login',
};

export const ADMIN_ROUTES = [
  '/admin/dashboard',
  '/admin/orders',
  '/admin/order',
  '/admin/products',
  '/admin/categories',
  '/admin/reviews',
  '/admin/settings',
  '/admin/payments',
  '/admin/coupons',
  '/admin/reports',
  '/admin/operations',
];

export function migrateLegacyLink(hash) {
  if (!hash) return '/home';
  const path = normalizePath(hash.replace(/^#\/?/, '/'));
  return ROUTE_MAP[path] || '/home';
}

export function safeReturnPath(currentPath) {
  const path = normalizePath(currentPath);
  if (MEMBERSHIP_ROUTES.includes(path) || ADMIN_ROUTES.includes(path)) {
    return path;
  }
  return '/home';
}

export function needsMembership(path) {
  return MEMBERSHIP_ROUTES.includes(normalizePath(path));
}

export function needsAdmin(path) {
  return ADMIN_ROUTES.includes(normalizePath(path));
}

export function getPageTitleKey(pathname = window.location.pathname) {
  const path = normalizePath(pathname);

  if (EXACT_TITLE_KEYS[path]) return EXACT_TITLE_KEYS[path];

  for (const [prefix, key] of PAGE_TITLE_KEYS) {
    if (path === prefix || path.startsWith(prefix + '/')) return key;
  }

  return 'nav.home';
}

export function isMemberOnlyPage(pathname = window.location.pathname) {
  return needsMembership(pathname);
}
