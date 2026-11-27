import { getLanguage, t } from './i18n.js';

export const CURRENCY = 'THB';
export const CURRENCY_SYMBOL = '฿';

/**
 * ราคาที่ลูกค้าจ่ายจริง — ถ้าร้านตั้งราคาโปรโมชั่นไว้และถูกกว่าราคาปกติ
 * ให้ใช้ราคาโปรฯ (ตรงกับที่เซิร์ฟเวอร์คิดตอนสร้างออเดอร์)
 */
export function effectivePrice(product) {
  const price = Number(product?.price) || 0;
  const sale = Number(product?.sale_price);
  if (Number.isFinite(sale) && sale > 0 && sale < price) return sale;
  return price;
}

export function hasSalePrice(product) {
  const price = Number(product?.price) || 0;
  const sale = Number(product?.sale_price);
  return Number.isFinite(sale) && sale > 0 && sale < price;
}

export function formatTHB(amount, lang = getLanguage()) {
  const locale = lang === 'en' ? 'en-US' : 'th-TH';
  // ออเดอร์เก่าบางใบไม่มีค่า subtotal/shipping → เดิมโชว์ "฿NaN" ให้ถือเป็น 0
  const value = Number(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/**
 * วันที่แบบ dd/mm/yyyy ตามที่ร้านกำหนด — ภาษาไทยใช้ พ.ศ. ภาษาอังกฤษใช้ ค.ศ.
 * เดิมแต่ละหน้าเรียก toLocaleDateString('th-TH') เอง ทำให้เดือน/วันหลักเดียวไม่เติมศูนย์
 * (26/1/2570) และหน้า EN ก็ยังโชว์ปี พ.ศ. อยู่
 */
export function formatDate(value, lang = getLanguage()) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = lang === 'en' ? d.getFullYear() : d.getFullYear() + 543;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${year}`;
}

/**
 * วันและเวลารูปแบบเดียวกัน (dd/mm/yyyy HH:MM) — ใช้กับไทม์ไลน์/บันทึกกิจกรรม
 * เดิมเรียก toLocaleString('th-TH') ทำให้หน้า EN ได้วันที่แบบ พ.ศ. และรูปวันที่ไม่ตรงกับ formatDate
 */
export function formatDateTime(value, lang = getLanguage()) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${formatDate(d, lang)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function bindOnce(el, event, handler) {
  if (!el || typeof handler !== 'function') return;
  if (!el.__zenHandlers) el.__zenHandlers = {};
  if (el.__zenHandlers[event]) {
    el.removeEventListener(event, el.__zenHandlers[event]);
  }
  el.__zenHandlers[event] = handler;
  el.addEventListener(event, handler);
}

export function escapeHTML(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function safeImage(url) {
  if (!url) return '';
  try {
    const u = new URL(url, window.location.origin);
    return u.protocol === 'https:' ||
      u.protocol === 'data:' ||
      u.protocol === 'blob:' ||
      u.origin === window.location.origin
      ? url
      : '';
  } catch {
    return url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:') ? url : '';
  }
}

const SAFE_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

export function safeLink(url) {
  if (!url) return '';
  try {
    const u = new URL(String(url).trim(), window.location.origin);
    return SAFE_LINK_PROTOCOLS.includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

export function safeReturnPath(path, fallback = '/home') {
  if (!path || typeof path !== 'string') return fallback;
  const value = path.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}

export function isPromptPayMobile(phone) {
  return /^[0-9]{10}$/.test(phone.replace(/\s/g, ''));
}

export function isThaiNationalID(id) {
  const cleaned = id.replace(/\s/g, '');
  if (!/^[0-9]{13}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(cleaned.charAt(12), 10);
}

function crc16CCITT(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

function tlv(tag, value) {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`;
}

export function promptPayTarget(raw) {
  const digits = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (/^0066\d{9}$/.test(digits)) return { type: 'msisdn', value: digits };
  if (/^66\d{9}$/.test(digits)) return { type: 'msisdn', value: `00${digits}` };
  if (/^0\d{9}$/.test(digits)) return { type: 'msisdn', value: `0066${digits.slice(1)}` };
  if (/^\d{13}$/.test(digits)) return { type: 'nid', value: digits };
  if (/^\d{15}$/.test(digits)) return { type: 'ewallet', value: digits };
  return null;
}

export function maskPromptPayTarget(raw) {
  const target = promptPayTarget(raw);
  if (!target) return String(raw || '');
  if (target.type === 'msisdn') {
    const local = `0${target.value.slice(4)}`;
    return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (target.type === 'nid') {
    const v = target.value;
    return `${v[0]}-${v.slice(1, 5)}-${v.slice(5, 10)}-${v.slice(10, 12)}-${v[12]}`;
  }
  const v = target.value;
  return `${v.slice(0, 4)}-${v.slice(4, 8)}-${v.slice(8)}`;
}

export function createPromptPayPayload(mobileOrID, amount = 0, reference = '') {
  const target = promptPayTarget(mobileOrID);
  if (!target) {
    throw new Error('Invalid PromptPay identifier: must be a mobile number or 13-digit Thai National ID');
  }

  const tag = { msisdn: '01', nid: '02', ewallet: '03' }[target.type];
  const merchant = tlv('29', tlv('00', 'A000000677010111') + tlv(tag, target.value));
  const amountField = amount && Number(amount) > 0 ? tlv('54', Number(amount).toFixed(2)) : '';
  const body =
    tlv('00', '01') +
    tlv('01', amount && Number(amount) > 0 ? '11' : '12') +
    merchant +
    tlv('53', '764') +
    amountField +
    tlv('58', 'TH');

  const withCrc = `${body}6304`;
  return withCrc + crc16CCITT(withCrc).toString(16).toUpperCase().padStart(4, '0');
}

export async function createPromptPayQRDataURL(payload, size = 400) {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(payload, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

export async function reconcileCart(supabase, cartItems) {
  if (!cartItems || cartItems.length === 0) return { valid: true, items: [], errors: [] };

  const errors = [];
  const validItems = [];

  const productIds = [...new Set(cartItems.map((item) => item.product_id))];
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, stock, active')
    .in('id', productIds);

  if (error) {
    return { valid: false, items: [], errors: [error.message] };
  }

  const productMap = new Map();
  products.forEach((p) => productMap.set(p.id, p));

  for (const item of cartItems) {
    const product = productMap.get(item.product_id);
    if (!product) {
      errors.push(t('cart.error_missing', { name: item.name }));
      continue;
    }

    if (!product.active) {
      errors.push(t('cart.error_unavailable', { name: product.name }));
      continue;
    }

    if (product.stock < item.quantity) {
      errors.push(t('cart.error_stock', { name: product.name, stock: product.stock }));
      continue;
    }

    if (Math.abs(product.price - item.price) > 0.001) {
      errors.push(t('cart.error_price_changed', { name: product.name }));
      continue;
    }

    validItems.push({
      ...item,
      product_name: product.name,
      stock: product.stock,
      max_quantity: product.stock,
    });
  }

  return {
    valid: errors.length === 0,
    items: validItems,
    errors,
  };
}

export function calculateCartTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function calculateCartItemCount(items) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export async function getPrivateImageUrl(supabase, bucket, objectPath, expiresIn = 3600) {
  if (!objectPath) return '';
  if (objectPath.startsWith('http')) return objectPath;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresIn);
  if (error) return '';
  return data?.signedUrl || '';
}

export function buildSlipObjectPath(userId, orderId, fileName) {
  const safeName = String(fileName).replace(/[^\w.\-]/g, '_');
  return `${userId}/${orderId}/${Date.now()}_${safeName}`;
}

/**
 * A five-star rating drawn as inline SVG.
 *
 * Text glyphs (★ / ☆) depend on the font actually containing them — they
 * vanished on some devices — so the rating is vector art instead. The label
 * stays readable for screen readers.
 */
export function ratingStars(rating, size = 14) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const path = 'm12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4 6.2 20.4l1.1-6.4L2.6 9.4l6.5-.9L12 2.6Z';
  const star = (filled) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
  const stars = Array.from({ length: 5 }, (_, i) => star(i < Math.round(value))).join('');
  return `<span class="stars" role="img" aria-label="${value} / 5">${stars}</span>`;
}
