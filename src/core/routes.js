export const ROUTE_MAP = {
  '/': '/home.html',
  '/home.html': '/home.html',
  '/shop': '/shop/index.html',
  '/shop/index.html': '/shop/index.html',
  '/shop/categories': '/shop/categories.html',
  '/shop/categories.html': '/shop/categories.html',
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

export const MEMBERSHIP_ROUTES = [
  '/account/index.html',
  '/account/orders.html',
  '/account/order.html',
  '/account/favorites.html',
  '/shop/cart.html',
  '/shop/checkout.html',
];

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