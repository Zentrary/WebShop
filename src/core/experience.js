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
  pending: { label: 'รอยืนยัน', variant: 'pending' },
  paid: { label: 'ชำระเงินแล้ว', variant: 'paid' },
  preparing: { label: 'กำลังเตรียมสินค้า', variant: 'preparing' },
  shipping: { label: 'จัดส่งแล้ว', variant: 'shipping' },
  delivered: { label: 'ส่งถึงมือแล้ว', variant: 'delivered' },
  cancelled: { label: 'ยกเลิกแล้ว', variant: 'cancelled' },
  returned: { label: 'คืนสินค้าแล้ว', variant: 'returned' },
};

export function getOrderStatusBadge(status) {
  return ORDER_STATUS_BADGES[status] || { label: status, variant: 'pending' };
}

export const ORDER_TIMELINE_STEPS = [
  { key: 'pending', label: 'รอการยืนยัน', icon: 'Clock' },
  { key: 'paid', label: 'ยืนยันการชำระเงิน', icon: 'CheckCircle' },
  { key: 'preparing', label: 'กำลังเตรียมสินค้า', icon: 'Package' },
  { key: 'shipping', label: 'จัดส่งพัสดุ', icon: 'Truck' },
  { key: 'delivered', label: 'ส่งถึงมือลูกค้า', icon: 'CheckCircle2' },
  { key: 'reviewed', label: 'ลูกค้ารีวิวแล้ว', icon: 'Star' },
  { key: 'completed', label: 'คำสั่งซื้อสำเร็จ', icon: 'Award' },
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