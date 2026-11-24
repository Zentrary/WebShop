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

export function validateSocialUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

export const ORDER_STATUS_BADGES = {
  pending: { label: 'รอการยืนยัน', variant: 'warning' },
  review: { label: 'รอตรวจสอบสลิป', variant: 'warning' },
  paid: { label: 'ชำระเงินแล้ว', variant: 'info' },
  shipped: { label: 'จัดส่งแล้ว', variant: 'info' },
  delivered: { label: 'ส่งถึงมือแล้ว', variant: 'success' },
  cancelled: { label: 'ยกเลิกแล้ว', variant: 'error' },
};

export function getOrderStatusBadge(status) {
  return ORDER_STATUS_BADGES[status] || { label: status || '-', variant: 'info' };
}

export const ORDER_TIMELINE_STEPS = [
  { key: 'pending', label: 'สั่งซื้อสำเร็จ' },
  { key: 'review', label: 'ตรวจสอบสลิป' },
  { key: 'paid', label: 'ชำระเงินแล้ว' },
  { key: 'shipped', label: 'จัดส่งพัสดุ' },
  { key: 'delivered', label: 'ส่งถึงมือลูกค้า' },
];

export function getTimelineProgress(currentStatus) {
  const stepKeys = ORDER_TIMELINE_STEPS.map(s => s.key);
  const currentIndex = stepKeys.indexOf(currentStatus);
  return ORDER_TIMELINE_STEPS.map((step, index) => ({
    ...step,
    completed: index <= Math.max(0, currentIndex),
    current: index === Math.max(0, currentIndex),
  }));
}

export function validateProductImageCount(images) {
  const count = normalizeProductImages(images).length;
  return count <= 8;
}
