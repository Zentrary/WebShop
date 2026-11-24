export const CURRENCY = 'THB';
export const CURRENCY_SYMBOL = '฿';

export function formatTHB(amount) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
    return u.protocol === 'https:' || u.protocol === 'data:' || u.protocol === 'blob:' || u.origin === window.location.origin
      ? url
      : '';
  } catch {
    return url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:') ? url : '';
  }
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
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc;
}

export function createPromptPayPayload(mobileOrID, amount = 0, reference = '') {
  const isPhone = isPromptPayMobile(mobileOrID);
  const isID = isThaiNationalID(mobileOrID);

  if (!isPhone && !isID) {
    throw new Error('Invalid PromptPay identifier: must be 10-digit mobile or 13-digit Thai National ID');
  }

  const merchantAccountData = isPhone
    ? `010212${mobileOrID}`
    : `010313${mobileOrID}`;

  let refField = '';
  if (reference) {
    refField = `020${String(reference.length).padStart(2, '0')}${reference}`;
  }

  const merchantInfoLength = merchantAccountData.length + refField.length + 4;
  const merchantInfo = `26${String(merchantInfoLength).padStart(2, '0')}${merchantAccountData}${refField}`;

  const merchantCategory = '52040000';
  const currencyCode = '5303764';

  let amountField = '';
  if (amount && amount > 0) {
    const amtStr = amount.toFixed(2);
    amountField = `54${String(amtStr.length).padStart(2, '0')}${amtStr}`;
  }

  const countryCode = '5802TH';
  const crcPlaceholder = '6304';

  const payloadWithoutCRC =
    '000201' +
    merchantInfo +
    merchantCategory +
    currencyCode +
    amountField +
    countryCode +
    crcPlaceholder;

  const crc = crc16CCITT(payloadWithoutCRC);
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');

  return payloadWithoutCRC + crcHex;
}

export async function createPromptPayQRDataURL(payload, size = 400) {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(payload, {
    width: size,
    margin: 2,
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

  const productIds = [...new Set(cartItems.map(item => item.product_id))];
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, stock_quantity, is_active')
    .in('id', productIds);

  if (error) {
    return { valid: false, items: [], errors: [error.message] };
  }

  const productMap = new Map();
  products.forEach(p => productMap.set(p.id, p));

  for (const item of cartItems) {
    const product = productMap.get(item.product_id);
    if (!product) {
      errors.push(`สินค้า "${item.name}" ไม่พบในระบบ`);
      continue;
    }

    if (!product.is_active) {
      errors.push(`สินค้า "${product.name}" ไม่สามารถซื้อได้ในขณะนี้`);
      continue;
    }

    if (product.stock_quantity < item.quantity) {
      errors.push(`สินค้า "${product.name}" เหลือเพียง ${product.stock_quantity} ชิ้น`);
      continue;
    }

    if (Math.abs(product.price - item.price) > 0.001) {
      errors.push(`ราคาสินค้า "${product.name}" เปลี่ยนแปลงแล้ว`);
      continue;
    }

    validItems.push({
      ...item,
      product_name: product.name,
      stock_quantity: product.stock_quantity,
      max_quantity: product.stock_quantity,
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