export function validateLogoUrl(url) {
  if (!url) return '/images/placeholder.svg';
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol === 'https:' || u.origin === window.location.origin) {
      return url;
    }
  } catch {
    if (url.startsWith('/') || url.startsWith('data:')) {
      return url;
    }
  }
  return '/images/placeholder.svg';
}

import { t } from '/src/core/i18n.js';

export function getStockStatus(stockQuantity) {
  if (!stockQuantity || stockQuantity <= 0) return 'out_of_stock';
  if (stockQuantity <= 3) return 'low_stock';
  return 'in_stock';
}

export function getStockStatusText(stockQuantity) {
  const status = getStockStatus(stockQuantity);
  const map = {
    out_of_stock: 'product.out_of_stock_tag',
    low_stock: 'product.low_stock',
    in_stock: 'product.in_stock',
  };
  return t(map[status] || map.in_stock);
}

export function getStockStatusClass(stockQuantity) {
  const status = getStockStatus(stockQuantity);
  const classes = {
    out_of_stock: 'stock-out',
    low_stock: 'stock-low',
    in_stock: 'stock-ok',
  };
  return classes[status] || classes.in_stock;
}

export function getDefaultRecipient(user) {
  if (!user) return {};

  return {
    name: user.full_name || user.user_name || '',
    phone: user.phone || '',
    email: user.email || '',
    address: user.address || '',
    subdistrict: user.subdistrict || '',
    district: user.district || '',
    province: user.province || '',
    postal_code: user.postal_code || '',
  };
}
