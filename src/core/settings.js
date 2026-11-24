/**
 * ZenMarket Settings
 * รูปแบบข้อมูลตรงกับตาราง store_settings จริงใน Supabase
 */

export const DEFAULT_STORE_SETTINGS = {
  singleton: true,
  shop_name: 'ZenMarket',
  tagline: 'ร้านค้าออนไลน์ ด้วยความตั้งใจและความใส่ใจในทุกรายละเอียด',
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
  promptpay_id: '',
  recipient_name: '',
};

/**
 * ค่าจัดส่ง: ฟรีเมื่อยอดถึงเกณฑ์
 */
export function calculateShipping(subtotal, settings = DEFAULT_STORE_SETTINGS) {
  const threshold = Number(settings.free_shipping_threshold ?? DEFAULT_STORE_SETTINGS.free_shipping_threshold);
  const fee = Number(settings.shipping_fee ?? DEFAULT_STORE_SETTINGS.shipping_fee);

  if (threshold > 0 && subtotal >= threshold) return 0;
  return fee;
}

/**
 * ยอดที่ยังขาดถึงเกณฑ์ส่งฟรี (คืน 0 ถ้าถึงแล้ว)
 */
export function amountToFreeShipping(subtotal, settings = DEFAULT_STORE_SETTINGS) {
  const threshold = Number(settings.free_shipping_threshold ?? DEFAULT_STORE_SETTINGS.free_shipping_threshold);
  if (threshold <= 0) return 0;
  return Math.max(0, threshold - subtotal);
}

/**
 * รวมข้อมูลร้านจาก RPC get_storefront เข้ากับค่าเริ่มต้น
 */
export function mergeStoreSettings(data) {
  if (!data) return { ...DEFAULT_STORE_SETTINGS };
  const merged = { ...DEFAULT_STORE_SETTINGS };
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== '') merged[key] = value;
  }
  return merged;
}
