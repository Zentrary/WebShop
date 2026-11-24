/**
 * ZenMarket Client error reporting
 * ส่งรายงานข้อผิดพลาดฝั่งผู้ใช้ไปยัง RPC report_client_error (จำกัด 1 ครั้ง/นาที และ 10 ครั้ง/วัน)
 */

import { state } from '/src/app.js';

const sent = new Set();

/**
 * @param {string} area พื้นที่ที่เกิดข้อผิดพลาด เช่น 'store', 'checkout', 'admin'
 * @param {string} code รหัสข้อผิดพลาด
 */
export async function reportClientError(area, code) {
  if (!state.supabase) return;
  const key = `${area}:${code}`;
  if (sent.has(key)) return;
  sent.add(key);
  try {
    await state.supabase.rpc('report_client_error', { p_area: area, p_code: String(code || '').slice(0, 120) });
  } catch (err) {
    console.warn('[ZenMarket] report_client_error failed', err);
  }
}

/**
 * ติดตั้งตัวดัก error ระดับ window (ไม่รบกวนผู้ใช้)
 */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    reportClientError('window', event.message || 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const code = reason?.message || String(reason || 'unhandledrejection');
    reportClientError('promise', code);
  });
}
