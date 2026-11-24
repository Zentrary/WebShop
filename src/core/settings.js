export const DEFAULT_STORE_SETTINGS = {
  singleton: true,
  shop_name: 'ZenMarket',
  // Left empty on purpose: the UI falls back to the language-aware
  // `footer.tagline` dictionary entry, so the default tagline follows the
  // active language instead of always rendering in Thai.
  tagline: '',
  logo_url: '/images/placeholder.svg',
  contact_email: '',
  contact_phone: '',
  contact_address: '',
  about_text: '',
  shipping_note: '',
  shipping_fee: 50,
  free_shipping_threshold: 300,
  facebook_url: '',
  instagram_url: '',
  line_url: '',
  tiktok_url: '',
  show_contact: true,
  promptpay_id: '',
  recipient_name: '',
};

export function calculateShipping(subtotal, settings = DEFAULT_STORE_SETTINGS) {
  const threshold = Number(settings.free_shipping_threshold ?? DEFAULT_STORE_SETTINGS.free_shipping_threshold);
  const fee = Number(settings.shipping_fee ?? DEFAULT_STORE_SETTINGS.shipping_fee);

  if (threshold > 0 && subtotal >= threshold) return 0;
  return fee;
}

export function amountToFreeShipping(subtotal, settings = DEFAULT_STORE_SETTINGS) {
  const threshold = Number(settings.free_shipping_threshold ?? DEFAULT_STORE_SETTINGS.free_shipping_threshold);
  if (threshold <= 0) return 0;
  return Math.max(0, threshold - subtotal);
}

export function mergeStoreSettings(data) {
  if (!data) return { ...DEFAULT_STORE_SETTINGS };
  const merged = { ...DEFAULT_STORE_SETTINGS };
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== '') merged[key] = value;
  }
  return merged;
}
