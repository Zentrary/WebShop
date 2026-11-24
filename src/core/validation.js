/**
 * ZenMarket Validation
 * ตรวจข้อมูลฝั่ง client ให้ตรงกับ CHECK constraint จริงของฐานข้อมูล
 * เพื่อไม่ให้ผู้ใช้เจอข้อความ error ดิบ ๆ จาก PostgreSQL
 *
 * ข้อมูลอ้างอิง (information_schema + pg_constraint):
 *   orders.phone              ~ '^0[0-9]{9}$'   (10 หลัก นำหน้าด้วย 0)
 *   orders.recipient          length 2..150
 *   orders.address            length 20..1200
 *   customer_addresses.phone  ~ '^0[0-9]{9}$'
 *   customer_addresses.label  length(btrim) 1..40
 *   customer_addresses.recipient length(btrim) 2..150
 *   customer_addresses.address length(btrim) 20..1200
 */

export const PHONE_PATTERN = /^0[0-9]{9}$/;

export const LIMITS = {
  recipient: { min: 2, max: 150 },
  address: { min: 20, max: 1200 },
  label: { min: 1, max: 40 },
  phone: { min: 10, max: 10 },
};

/**
 * ปรับเบอร์โทรศัพท์ไทยให้เป็น 10 หลักนำหน้าด้วย 0
 * @returns {string|null} เบอร์ที่ถูกต้อง หรือ null ถ้าแปลงไม่ได้
 */
export function normalizeThaiPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  if (digits.length === 9) return `0${digits}`;
  return null;
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export const AGE_RANGE = { min: 13, max: 120 };

/**
 * ตรวจข้อมูลสินค้า
 *   products.name        length 1..150
 *   products.sku         length 1..50 (ถ้าไม่กรอกจะเป็น NULL ได้) + UNIQUE
 *   products.price       > 0 และ <= 1,000,000
 *   products.stock       0..100,000
 *   products.description length <= 2,000
 *   products.image_url   length <= 1,000
 *   products.image_urls  cardinality <= 8
 */
export function validateProduct(product = {}) {
  const name = String(product.name || '').trim();
  if (name.length < 1 || name.length > 150) {
    return { ok: false, errorKey: 'validation.product_name_length' };
  }

  const sku = String(product.sku || '').trim();
  if (sku && (sku.length < 1 || sku.length > 50)) {
    return { ok: false, errorKey: 'validation.product_sku_length' };
  }

  const price = Number(product.price);
  if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
    return { ok: false, errorKey: 'validation.product_price_invalid' };
  }

  const stock = Number(product.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
    return { ok: false, errorKey: 'validation.product_stock_invalid' };
  }

  const description = String(product.description || '');
  if (description.length > 2000) {
    return { ok: false, errorKey: 'validation.product_description_too_long' };
  }

  const imageUrl = String(product.image_url || '');
  if (imageUrl.length > 1000) {
    return { ok: false, errorKey: 'validation.product_image_too_long' };
  }

  const imageUrls = Array.isArray(product.image_urls) ? product.image_urls : [];
  if (imageUrls.length > 8) {
    return { ok: false, errorKey: 'validation.product_images_too_many' };
  }

  return {
    ok: true,
    value: {
      ...product,
      name,
      sku: sku || null,
      price,
      stock,
      description: description || null,
      image_url: imageUrl || null,
    },
  };
}

/**
 * ตรวจหมวดหมู่
 *   categories.name length 1..80, ห้ามมีช่องว่างนำหน้า/ท้าย และห้ามเป็นคำว่า 'ทั้งหมด'
 */
export function validateCategory(name) {
  const clean = String(name || '').trim();
  if (clean.length < 1 || clean.length > 80) {
    return { ok: false, errorKey: 'validation.category_name_length' };
  }
  if (clean === 'ทั้งหมด' || clean.toLowerCase() === 'all') {
    return { ok: false, errorKey: 'validation.category_reserved' };
  }
  return { ok: true, value: clean };
}

/**
 * ตรวจค่าพร้อมเพย์
 * store_settings.promptpay_id ~ ^(0[0-9]{9}|[0-9]{13})$
 */
export function validatePromptPay(value) {
  const id = String(value || '').trim();
  if (!/^(0[0-9]{9}|[0-9]{13})$/.test(id)) {
    return { ok: false, errorKey: 'validation.promptpay_invalid' };
  }
  return { ok: true, value: id };
}

/**
 * ตรวจข้อมูลร้าน (store_settings)
 *   shop_name             length(btrim) 1..80
 *   tagline              length <= 200
 *   about_text           length <= 3000
 *   shipping_note        length <= 500
 *   contact_email        length <= 254
 *   contact_phone        length <= 30
 *   contact_address      length <= 1000
 *   shipping_fee         0..10000
 *   free_shipping_threshold 1..1000000
 */
export function validateStoreSettings(settings = {}) {
  const shopName = String(settings.shop_name || '').trim();
  if (shopName.length < 1 || shopName.length > 80) {
    return { ok: false, errorKey: 'validation.shop_name_length' };
  }

  const tagline = String(settings.tagline || '');
  if (tagline.length > 200) return { ok: false, errorKey: 'validation.tagline_too_long' };

  const aboutText = String(settings.about_text || '');
  if (aboutText.length > 3000) return { ok: false, errorKey: 'validation.about_too_long' };

  const shippingNote = String(settings.shipping_note || '');
  if (shippingNote.length > 500) return { ok: false, errorKey: 'validation.shipping_note_too_long' };

  const contactEmail = String(settings.contact_email || '');
  if (contactEmail.length > 254) return { ok: false, errorKey: 'validation.contact_email_invalid' };

  const contactPhone = String(settings.contact_phone || '');
  if (contactPhone.length > 30) return { ok: false, errorKey: 'validation.contact_phone_invalid' };

  const logoUrl = String(settings.logo_url || '');
  if (logoUrl && (!logoUrl.startsWith('https://') || logoUrl.length > 1000)) {
    return { ok: false, errorKey: 'validation.logo_url_invalid' };
  }

  const shippingFee = Number(settings.shipping_fee ?? 0);
  if (!Number.isFinite(shippingFee) || shippingFee < 0 || shippingFee > 10000) {
    return { ok: false, errorKey: 'validation.shipping_fee_invalid' };
  }

  const threshold = Number(settings.free_shipping_threshold ?? 0);
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 1000000) {
    return { ok: false, errorKey: 'validation.free_shipping_invalid' };
  }

  return {
    ok: true,
    value: {
      ...settings,
      shop_name: shopName,
      tagline,
      about_text: aboutText,
      shipping_note: shippingNote,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      logo_url: logoUrl,
      shipping_fee: shippingFee,
      free_shipping_threshold: threshold,
    },
  };
}

/**
 * ตรวจข้อมูลโปรไฟล์
 * profiles.first_name/last_name/nickname: length >= 1 (ถ้าไม่กรอกต้องเป็น NULL)
 * profiles.username: ^[a-z0-9_]{3,30}$
 * profiles.phone: ^0[0-9]{9}$
 * profiles.age: 13..120
 * @returns {{ok: true, value: object} | {ok: false, errorKey: string}}
 */
export function validateProfile({ first_name, last_name, nickname, phone, age, username }) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!USERNAME_PATTERN.test(cleanUsername)) {
    return { ok: false, errorKey: 'validation.username_invalid' };
  }

  const cleanFirst = String(first_name || '').trim();
  const cleanLast = String(last_name || '').trim();
  const cleanNick = String(nickname || '').trim();

  if (cleanFirst && cleanFirst.length > 80) return { ok: false, errorKey: 'validation.name_too_long' };
  if (cleanLast && cleanLast.length > 80) return { ok: false, errorKey: 'validation.name_too_long' };
  if (cleanNick && cleanNick.length > 50) return { ok: false, errorKey: 'validation.name_too_long' };

  const rawPhone = String(phone || '').trim();
  let cleanPhone = null;
  if (rawPhone) {
    cleanPhone = normalizeThaiPhone(rawPhone);
    if (!cleanPhone || !PHONE_PATTERN.test(cleanPhone)) {
      return { ok: false, errorKey: 'validation.phone_invalid' };
    }
  }

  let cleanAge = null;
  if (age !== null && age !== undefined && age !== '') {
    cleanAge = Number(age);
    if (!Number.isInteger(cleanAge) || cleanAge < AGE_RANGE.min || cleanAge > AGE_RANGE.max) {
      return { ok: false, errorKey: 'validation.age_invalid' };
    }
  }

  return {
    ok: true,
    value: {
      first_name: cleanFirst || null,
      last_name: cleanLast || null,
      nickname: cleanNick || null,
      phone: cleanPhone,
      age: cleanAge,
      username: cleanUsername,
    },
  };
}

/**
 * ตรวจข้อมูลการจัดส่ง (ชื่อผู้รับ / เบอร์ / ที่อยู่)
 * @returns {{ok: true, value: object} | {ok: false, errorKey: string}}
 */
export function validateDelivery({ recipient, phone, address }) {
  const cleanRecipient = String(recipient || '').trim();
  const cleanAddress = String(address || '').trim();
  const cleanPhone = normalizeThaiPhone(phone);

  if (cleanRecipient.length < LIMITS.recipient.min || cleanRecipient.length > LIMITS.recipient.max) {
    return { ok: false, errorKey: 'validation.recipient_length' };
  }
  if (!cleanPhone || !PHONE_PATTERN.test(cleanPhone)) {
    return { ok: false, errorKey: 'validation.phone_invalid' };
  }
  if (cleanAddress.length < LIMITS.address.min || cleanAddress.length > LIMITS.address.max) {
    return { ok: false, errorKey: 'validation.address_length' };
  }
  return {
    ok: true,
    value: { recipient: cleanRecipient, phone: cleanPhone, address: cleanAddress },
  };
}

/**
 * ตรวจข้อมูลที่อยู่ในสมุดที่อยู่
 * @returns {{ok: true, value: object} | {ok: false, errorKey: string}}
 */
export function validateAddress({ label, recipient, phone, address }) {
  const cleanLabel = String(label || '').trim();
  const cleanRecipient = String(recipient || '').trim();
  const cleanAddress = String(address || '').trim();
  const cleanPhone = normalizeThaiPhone(phone);

  if (cleanLabel.length < LIMITS.label.min || cleanLabel.length > LIMITS.label.max) {
    return { ok: false, errorKey: 'validation.label_length' };
  }
  if (cleanRecipient.length < LIMITS.recipient.min || cleanRecipient.length > LIMITS.recipient.max) {
    return { ok: false, errorKey: 'validation.recipient_length' };
  }
  if (!cleanPhone || !PHONE_PATTERN.test(cleanPhone)) {
    return { ok: false, errorKey: 'validation.phone_invalid' };
  }
  if (cleanAddress.length < LIMITS.address.min || cleanAddress.length > LIMITS.address.max) {
    return { ok: false, errorKey: 'validation.address_length' };
  }
  return {
    ok: true,
    value: {
      label: cleanLabel,
      recipient: cleanRecipient,
      phone: cleanPhone,
      address: cleanAddress,
    },
  };
}
