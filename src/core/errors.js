import { state } from '/src/core/state.js';

const AREA_ALLOWLIST = ['checkout', 'account', 'catalogue', 'admin', 'auth', 'other'];
const CODE_ALLOWLIST = ['NETWORK', 'AUTH', 'PERMISSION', 'DATABASE', 'STORAGE', 'UI', 'UNKNOWN'];

const sent = new Set();

export function normalizeArea(area) {
  const value = String(area || '')
    .trim()
    .toLowerCase();
  if (AREA_ALLOWLIST.includes(value)) return value;

  if (value.startsWith('checkout') || value.startsWith('cart') || value.startsWith('order')) return 'checkout';
  if (
    value.startsWith('account') ||
    value.startsWith('profile') ||
    value.startsWith('address') ||
    value.startsWith('fav')
  )
    return 'account';
  if (value.startsWith('admin')) return 'admin';
  if (
    value.startsWith('auth') ||
    value.startsWith('login') ||
    value.startsWith('register') ||
    value.startsWith('password')
  )
    return 'auth';
  if (
    value.startsWith('store') ||
    value.startsWith('product') ||
    value.startsWith('catalog') ||
    value.startsWith('shop')
  )
    return 'catalogue';

  return 'other';
}

export function normalizeCode(code) {
  const value = String(code || '')
    .trim()
    .toUpperCase();
  if (CODE_ALLOWLIST.includes(value)) return value;

  const lower = value.toLowerCase();
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) return 'NETWORK';
  if (lower.includes('auth') || lower.includes('jwt') || lower.includes('session') || lower.includes('token'))
    return 'AUTH';
  if (
    lower.includes('permission') ||
    lower.includes('denied') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  )
    return 'PERMISSION';
  if (
    lower.includes('database') ||
    lower.includes('supabase') ||
    lower.includes('sql') ||
    lower.includes('rpc') ||
    lower.includes('postgres')
  )
    return 'DATABASE';
  if (lower.includes('storage') || lower.includes('upload') || lower.includes('bucket')) return 'STORAGE';
  if (
    lower.includes('typeerror') ||
    lower.includes('referenceerror') ||
    lower.includes('syntaxerror') ||
    lower.includes('render') ||
    lower.includes('undefined is not')
  )
    return 'UI';

  return 'UNKNOWN';
}

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
