/**
 * ZenMarket Client error reporting
 * ส่งรายงานข้อผิดพลาดฝั่งผู้ใช้ไปยัง RPC report_client_error
 * (จำกัด 1 ครั้ง/นาที และ 10 ครั้ง/วัน)
 *
 * ข้อจำกัดจริงของตาราง public.client_errors (CHECK constraint):
 *   area ∈ { 'checkout', 'account', 'catalogue', 'admin', 'auth', 'other' }
 *   code ∈ { 'NETWORK', 'AUTH', 'PERMISSION', 'DATABASE', 'STORAGE', 'UI', 'UNKNOWN' }
 * → ต้องแปลงค่าก่อนเสมอ ไม่งั้น insert จะถูกปฏิเสธด้วย check violation
 */

import { state } from '/src/app.js';

const AREA_ALLOWLIST = ['checkout', 'account', 'catalogue', 'admin', 'auth', 'other'];
const CODE_ALLOWLIST = ['NETWORK', 'AUTH', 'PERMISSION', 'DATABASE', 'STORAGE', 'UI', 'UNKNOWN'];

const sent = new Set();

/**
 * แปลงพื้นที่ให้อยู่ใน allowlist
 * @param {string} area
 * @returns {string}
 */
export function normalizeArea(area) {
  const value = String(area || '').trim().toLowerCase();
  if (AREA_ALLOWLIST.includes(value)) return value;

  // สถานที่ที่พบบ่อย → เดาพื้นที่ที่ถูกต้องจาก prefix/path
  if (value.startsWith('checkout') || value.startsWith('cart') || value.startsWith('order')) return 'checkout';
  if (value.startsWith('account') || value.startsWith('profile') || value.startsWith('address') || value.startsWith('fav')) return 'account';
  if (value.startsWith('admin')) return 'admin';
  if (value.startsWith('auth') || value.startsWith('login') || value.startsWith('register') || value.startsWith('password')) return 'auth';
  if (value.startsWith('store') || value.startsWith('product') || value.startsWith('catalog') || value.startsWith('shop')) return 'catalogue';

  return 'other';
}

/**
 * แปลงรหัสข้อผิดพลาดให้อยู่ใน allowlist
 * @param {string} code
 * @returns {string}
 */
export function normalizeCode(code) {
  const value = String(code || '').trim().toUpperCase();
  if (CODE_ALLOWLIST.includes(value)) return value;

  const lower = value.toLowerCase();
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) return 'NETWORK';
  if (lower.includes('auth') || lower.includes('jwt') || lower.includes('session') || lower.includes('token')) return 'AUTH';
  if (lower.includes('permission') || lower.includes('denied') || lower.includes('unauthorized') || lower.includes('forbidden')) return 'PERMISSION';
  if (lower.includes('database') || lower.includes('supabase') || lower.includes('sql') || lower.includes('rpc') || lower.includes('postgres')) return 'DATABASE';
  if (lower.includes('storage') || lower.includes('upload') || lower.includes('bucket')) return 'STORAGE';
  if (lower.includes('typeerror') || lower.includes('referenceerror') || lower.includes('syntaxerror') || lower.includes('render') || lower.includes('undefined is not')) return 'UI';

  return 'UNKNOWN';
}

/**
 * @param {string} area พื้นที่ที่เกิดข้อผิดพลาด เช่น 'checkout', 'admin'
 * @param {string} code รหัสข้อผิดพลาด เช่น 'NETWORK', 'AUTH' หรือข้อความ error ใด ๆ
 */
export async function reportClientError(area, code) {
  if (!state.supabase) return;

  const safeArea = normalizeArea(area);
  const safeCode = normalizeCode(code);

  const key = `${safeArea}:${safeCode}`;
  if (sent.has(key)) return;
  sent.add(key);

  try {
    await state.supabase.rpc('report_client_error', { p_area: safeArea, p_code: safeCode });
  } catch (err) {
    console.warn('[ZenMarket] report_client_error failed', err);
  }
}

/**
 * ติดตั้งตัวดัก error ระดับ window (ไม่รบกวนผู้ใช้)
 */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    reportClientError('other', event.message || 'UNKNOWN');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const code = reason?.message || String(reason || 'UNKNOWN');
    reportClientError('other', code);
  });
}
