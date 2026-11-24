export const PHONE_PATTERN = /^0[0-9]{9}$/;

export const LIMITS = {
  recipient: { min: 2, max: 150 },
  address: { min: 20, max: 1200 },
  label: { min: 1, max: 40 },
  phone: { min: 10, max: 10 },
};

export function normalizeThaiPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  if (digits.length === 9) return `0${digits}`;
  return null;
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export const AGE_RANGE = { min: 13, max: 120 };

export const PASSWORD_RULES = { minLength: 8 };

export function passwordStrength(password) {
  const value = String(password || '');
  if (value.length < PASSWORD_RULES.minLength) {
    return { ok: false, errorKey: 'auth.password_too_short' };
  }
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return { ok: false, errorKey: 'auth.password_weak' };
  }
  return { ok: true };
}

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

  // ราคาโปรโมชั่น (ไม่บังคับ) — ต้องถูกกว่าราคาปกติและมากกว่าศูนย์
  const rawSale = product.sale_price;
  let salePrice = null;
  if (rawSale !== undefined && rawSale !== null && String(rawSale).trim() !== '') {
    salePrice = Number(rawSale);
    if (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= price) {
      return { ok: false, errorKey: 'validation.product_sale_price_invalid' };
    }
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
      sale_price: salePrice,
    },
  };
}

/**
 * Category names that collide with the storefront's "all categories" filter.
 * The list is language-independent on purpose: a shop should not be able to
 * create a category named "All" in English mode and "ทั้งหมด" in Thai mode.
 */
const RESERVED_CATEGORY_NAMES = new Set(['ทั้งหมด', 'ทุกหมวดหมู่', 'all', 'all categories']);

export function validateCategory(name) {
  const clean = String(name || '').trim();
  if (clean.length < 1 || clean.length > 80) {
    return { ok: false, errorKey: 'validation.category_name_length' };
  }
  if (RESERVED_CATEGORY_NAMES.has(clean.toLowerCase())) {
    return { ok: false, errorKey: 'validation.category_reserved' };
  }
  return { ok: true, value: clean };
}

export function validatePromptPay(value) {
  const id = String(value || '').trim();
  if (!/^(0[0-9]{9}|[0-9]{13})$/.test(id)) {
    return { ok: false, errorKey: 'validation.promptpay_invalid' };
  }
  return { ok: true, value: id };
}

export function validateStoreSettings(settings = {}) {
  const toNumber = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

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

  const contactAddress = String(settings.contact_address || '');
  if (contactAddress.length > 300) return { ok: false, errorKey: 'validation.contact_address_invalid' };

  const logoUrl = String(settings.logo_url || '');
  if (logoUrl && (!logoUrl.startsWith('https://') || logoUrl.length > 1000)) {
    return { ok: false, errorKey: 'validation.logo_url_invalid' };
  }

  const shippingFee = toNumber(settings.shipping_fee);
  if (shippingFee === null || shippingFee < 0 || shippingFee > 10000) {
    return { ok: false, errorKey: 'validation.shipping_fee_invalid' };
  }

  const threshold = toNumber(settings.free_shipping_threshold);
  if (threshold === null || threshold < 1 || threshold > 1000000) {
    return { ok: false, errorKey: 'validation.free_shipping_invalid' };
  }

  // เกณฑ์แจ้งเตือนสต็อกใกล้หมด (อนุญาต 0 = แจ้งเฉพาะของหมด)
  const rawLowStock = toNumber(settings.low_stock_threshold);
  const lowStockThreshold = rawLowStock === null ? 5 : rawLowStock;
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 1000) {
    return { ok: false, errorKey: 'validation.low_stock_invalid' };
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
      contact_address: contactAddress,
      logo_url: logoUrl,
      shipping_fee: shippingFee,
      free_shipping_threshold: threshold,
      show_contact: settings.show_contact !== false,
      low_stock_threshold: lowStockThreshold,
    },
  };
}

export function validateProfile({ first_name, last_name, nickname, phone, age, username }, options = {}) {
  const requireNames = options.requireNames === true;
  const cleanUsername = String(username || '')
    .trim()
    .toLowerCase();
  if (!USERNAME_PATTERN.test(cleanUsername)) {
    return { ok: false, errorKey: 'validation.username_invalid' };
  }

  const cleanFirst = String(first_name || '').trim();
  const cleanLast = String(last_name || '').trim();
  const cleanNick = String(nickname || '').trim();

  if (requireNames && (!cleanFirst || !cleanLast)) {
    return { ok: false, errorKey: 'validation.name_required' };
  }

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
