/**
 * ZenMarket Experience — สถานะคำสั่งซื้อตาม DB จริง
 * สถานะใน DB: pending → review → paid → shipped → delivered (+ cancelled)
 */

const ALLOWED_ICONS = [
  'Home', 'Category', 'Tag', 'Shop', 'Cart', 'CreditCard', 'User', 'Shield',
  'CheckCircle', 'AlertCircle', 'Mail', 'Phone', 'Link', 'ExternalLink',
  'Instagram', 'Facebook', 'Tiktok', 'Twitter', 'Youtube', 'Line',
];

export const CATEGORY_ICONS = ALLOWED_ICONS;

export function isValidCategoryIcon(iconName) {
  return ALLOWED_ICONS.includes(iconName);
}

export function normalizeProductImages(images, max = 8) {
  if (!images) return [];
  const arr = Array.isArray(images) ? images : [images];
  return arr.filter(Boolean).slice(0, max);
}

/**
 * ตรวจ URL โซเชียลให้ตรงกับ CHECK constraint ของ store_settings
 *   facebook_url  ~ ^https://(www\.)?(facebook\.com|fb\.com)/...
 *   instagram_url ~ ^https://(www\.)?instagram\.com/...
 *   line_url     ~ ^https://(line\.me|lin\.ee)/...
 * @param {string} url
 * @param {'facebook'|'instagram'|'line'} [platform]
 * @returns {string} URL ที่ถูกต้อง หรือ '' ถ้าไม่ผ่าน
 */
export function validateSocialUrl(url, platform) {
  if (!url) return '';
  let u;
  try {
    u = new URL(url);
  } catch {
    return '';
  }
  if (u.protocol !== 'https:') return '';
  if (!platform) return url;

  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, '');
  if (path === '') return '';

  const rules = {
    facebook: (h, p) => (h === 'facebook.com' || h === 'www.facebook.com' || h === 'fb.com' || h === 'www.fb.com') && p.length > 1,
    instagram: (h, p) => (h === 'instagram.com' || h === 'www.instagram.com') && p.length > 1,
    line: (h, p) => (h === 'line.me' || h === 'lin.ee') && p.length > 1,
  };

  const rule = rules[platform];
  return rule && rule(host, path) ? url : '';
}

import { t } from '/src/core/i18n.js';

export const ORDER_STATUS_BADGES = {
  pending: { key: 'status.pending', variant: 'warning' },
  review: { key: 'status.review', variant: 'warning' },
  paid: { key: 'status.paid', variant: 'info' },
  shipped: { key: 'status.shipped', variant: 'info' },
  delivered: { key: 'status.delivered', variant: 'success' },
  cancelled: { key: 'status.cancelled', variant: 'error' },
};

export function getOrderStatusBadge(status) {
  const badge = ORDER_STATUS_BADGES[status];
  if (!badge) return { label: status || '-', variant: 'info' };
  return { label: t(badge.key), variant: badge.variant };
}

export const ORDER_TIMELINE_STEPS = [
  { key: 'pending', labelKey: 'timeline.ordered' },
  { key: 'review', labelKey: 'timeline.verify' },
  { key: 'paid', labelKey: 'timeline.paid' },
  { key: 'shipped', labelKey: 'timeline.shipped' },
  { key: 'delivered', labelKey: 'timeline.delivered' },
];

export function getTimelineProgress(currentStatus) {
  const stepKeys = ORDER_TIMELINE_STEPS.map(s => s.key);
  const currentIndex = stepKeys.indexOf(currentStatus);
  return ORDER_TIMELINE_STEPS.map((step, index) => ({
    ...step,
    label: t(step.labelKey),
    completed: index <= Math.max(0, currentIndex),
    current: index === Math.max(0, currentIndex),
  }));
}

export function validateProductImageCount(images) {
  const count = normalizeProductImages(images).length;
  return count <= 8;
}
