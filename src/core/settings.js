export const DEFAULT_STORE_SETTINGS = {
  store_name: 'ZenMarket',
  store_logo: '/public/images/placeholder.svg',
  store_description: 'ร้านค้าออนไลน์สำหรับเจ้าของคนเดียว ด้วยความตั้งใจและความใส่ใจ',
  contact_email: '',
  contact_phone: '',
  contact_line: '',
  contact_facebook: '',
  contact_instagram: '',
  contact_tiktok: '',
  shipping_fee: 50,
  free_shipping_threshold: 500,
  enable_cod: true,
  enable_promptpay: true,
  store_address: '',
  store_tax_id: '',
  terms_and_conditions: '',
  privacy_policy: '',
  maintenance_mode: false,
  maintenance_message: 'ร้านกำลังปรับปรุงระบบ ขออภัยในความไม่สะดวก',
};

export function shippingFor(subtotal, settings = DEFAULT_STORE_SETTINGS) {
  const freeThreshold = settings.free_shipping_threshold || 0;
  const shippingFee = settings.shipping_fee || 0;

  if (freeThreshold > 0 && subtotal >= freeThreshold) {
    return 0;
  }
  return shippingFee;
}

export function loadStoreSettings() {
  try {
    const stored = localStorage.getItem('zenmarket_store_settings');
    if (stored) {
      return { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {}
  return { ...DEFAULT_STORE_SETTINGS };
}

export function saveStoreSettings(settings) {
  try {
    localStorage.setItem('zenmarket_store_settings', JSON.stringify(settings));
  } catch {}
}