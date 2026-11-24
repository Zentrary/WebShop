export const ROUTE_MAP = {
  '/': '/home.html',
  '/home.html': '/home.html',
  '/shop': '/shop/index.html',
  '/shop/index.html': '/shop/index.html',
  '/shop/categories': '/shop/index.html',
  '/shop/categories.html': '/shop/index.html',
  '/shop/product': '/shop/product.html',
  '/shop/product.html': '/shop/product.html',
  '/shop/cart': '/shop/cart.html',
  '/shop/cart.html': '/shop/cart.html',
  '/shop/checkout': '/shop/checkout.html',
  '/shop/checkout.html': '/shop/checkout.html',
  '/account': '/account/index.html',
  '/account/index.html': '/account/index.html',
  '/account/orders': '/account/orders.html',
  '/account/orders.html': '/account/orders.html',
  '/account/order': '/account/order.html',
  '/account/order.html': '/account/order.html',
  '/account/favorites': '/account/favorites.html',
  '/account/favorites.html': '/account/favorites.html',
  '/auth/login': '/auth/login.html',
  '/auth/login.html': '/auth/login.html',
  '/auth/register': '/auth/register.html',
  '/auth/register.html': '/auth/register.html',
  '/auth/reset-password': '/auth/reset-password.html',
  '/auth/reset-password.html': '/auth/reset-password.html',
  '/auth/forgot-password': '/auth/forgot-password.html',
  '/auth/forgot-password.html': '/auth/forgot-password.html',
  '/auth/forgot-password': '/auth/forgot-password.html',
  '/auth/forgot-password.html': '/auth/forgot-password.html',
  '/pages/about': '/pages/about.html',
  '/pages/about.html': '/pages/about.html',
  '/pages/contact': '/pages/contact.html',
  '/pages/contact.html': '/pages/contact.html',
  '/pages/help': '/pages/help.html',
  '/pages/help.html': '/pages/help.html',
  '/pages/privacy': '/pages/privacy.html',
  '/pages/privacy.html': '/pages/privacy.html',
  '/admin': '/admin/dashboard.html',
  '/admin/login': '/admin/login.html',
  '/admin/login.html': '/admin/login.html',
  '/admin/dashboard': '/admin/dashboard.html',
  '/admin/dashboard.html': '/admin/dashboard.html',
  '/admin/orders': '/admin/orders.html',
  '/admin/orders.html': '/admin/orders.html',
  '/admin/order': '/admin/order.html',
  '/admin/order.html': '/admin/order.html',
  '/admin/products': '/admin/products.html',
  '/admin/products.html': '/admin/products.html',
  '/admin/categories': '/admin/categories.html',
  '/admin/categories.html': '/admin/categories.html',
  '/admin/reviews': '/admin/reviews.html',
  '/admin/reviews.html': '/admin/reviews.html',
  '/admin/settings': '/admin/settings.html',
  '/admin/settings.html': '/admin/settings.html',
  '/admin/payments': '/admin/payments.html',
  '/admin/payments.html': '/admin/payments.html',
  '/admin/operations': '/admin/operations.html',
  '/admin/operations.html': '/admin/operations.html',
};

export const PAGE_TITLE_KEYS = [
  ['/admin/dashboard', 'admin.page_dashboard'],
  ['/admin/orders', 'admin.page_orders'],
  ['/admin/order', 'admin.page_orders'],
  ['/admin/products', 'admin.page_products'],
  ['/admin/categories', 'admin.page_categories'],
  ['/admin/reviews', 'admin.page_reviews'],
  ['/admin/settings', 'admin.page_settings'],
  ['/admin/payments', 'admin.page_payments'],
  ['/admin/operations', 'admin.page_operations'],
  ['/admin/login', 'admin.page_login'],
  ['/shop/product', 'shop.eyebrow'],
  ['/shop/cart', 'nav.cart'],
  ['/shop/checkout', 'checkout.title'],
  ['/account/orders', 'nav.orders'],
  ['/account/order', 'nav.orders'],
  ['/account/favorites', 'nav.favorites'],
  ['/account/index', 'nav.account'],
  ['/auth/login', 'nav.login'],
  ['/auth/register', 'nav.register'],
  ['/auth/reset-password', 'auth.reset_title'],
  ['/auth/forgot-password', 'auth.forgot_title'],
  ['/auth/login', 'nav.login'],
  ['/auth/register', 'nav.register'],
  ['/pages/about', 'page.about_title'],
  ['/pages/contact', 'page.contact_title'],
  ['/pages/help', 'page.help_title'],
  ['/pages/privacy', 'page.privacy_title'],
  ['/shop/index', 'nav.shop'],
  ['/home', 'nav.home'],
];

export const MEMBERSHIP_ROUTES = [
  '/account/index.html',
  '/account/orders.html',
  '/account/order.html',
  '/account/favorites.html',
];

export const EXACT_TITLE_KEYS = {
  '/': 'nav.home',
  '/home': 'nav.home',
  '/shop': 'nav.shop',
  '/shop/index': 'nav.shop',
  '/shop/product': 'shop.eyebrow',
  '/shop/cart': 'nav.cart',
  '/shop/checkout': 'checkout.title',
  '/account': 'nav.account',
  '/account/index': 'nav.account',
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
  '/admin/operations': 'admin.page_operations',
  '/admin/login': 'admin.page_login',
};

export const ADMIN_ROUTES = [
  '/admin/dashboard.html',
  '/admin/orders.html',
  '/admin/order.html',
  '/admin/products.html',
  '/admin/categories.html',
  '/admin/reviews.html',
  '/admin/settings.html',
  '/admin/payments.html',
  '/admin/operations.html',
];

export function migrateLegacyLink(hash) {
  if (!hash) return '/home.html';
  const path = hash.replace(/^#\/?/, '/');
  return ROUTE_MAP[path] || '/home.html';
}

export function safeReturnPath(currentPath) {
  if (MEMBERSHIP_ROUTES.includes(currentPath) || ADMIN_ROUTES.includes(currentPath)) {
    return currentPath;
  }
  return '/home.html';
}

export function needsMembership(path) {
  return MEMBERSHIP_ROUTES.includes(path);
}

export function needsAdmin(path) {
  return ADMIN_ROUTES.includes(path);
}

export function getPageTitleKey(pathname = window.location.pathname) {
  const raw = pathname || '/';
  const path = raw.replace(/\.html$/, '').replace(/\/$/, '') || '/';

  if (EXACT_TITLE_KEYS[path]) return EXACT_TITLE_KEYS[path];

  for (const [prefix, key] of PAGE_TITLE_KEYS) {
    if (path === prefix || path.startsWith(prefix + '/')) return key;
  }

  return 'nav.home';
}

export function isMemberOnlyPage(pathname = window.location.pathname) {
  return needsMembership(pathname.replace(/\/$/, '') || '/');
}
