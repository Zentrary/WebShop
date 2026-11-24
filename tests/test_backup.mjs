import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

const { loadPage, makeSupabaseMock, setVal, fire, wait, makeAssert, el } = await import('./harness.mjs');

const A = makeAssert();
const ADMIN_SESSION = { user: { id: 'admin-1', email: 'admin@zenmarket.test' } };

/* helper: สร้างไฟล์สำรองจริง (เข้ารหัสแบบเดียวกับ production) */
async function makeBackupFile(password, payload) {
  const enc = new TextEncoder();
  const salt = new Uint8Array(16).fill(7);
  const iv = new Uint8Array(12).fill(3);
  const passwordKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
  return JSON.stringify({ salt: Array.from(salt), iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ct)) });
}

const VALID_BACKUP = {
  format: 'zenmarket-data-v1',
  created_at: '2026-01-01T00:00:00.000Z',
  tables: { products: [{ id: 'p1' }, { id: 'p2' }], orders: [{ id: 'o1' }] },
};

/* ============ 1. ไฟล์ถูกต้อง → ต้องแสดง preview และยังไม่กู้คืน ============ */
{
  const supabase = await makeSupabaseMock({
    session: ADMIN_SESSION, user: ADMIN_SESSION.user,
    tableData: { store_admin: { user_id: 'admin-1' } },
    rpcResults: { restore_admin_backup: { products: 2, orders: 1 } },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/operations.html',
    scripts: ['src/pages/admin/operations.js'],
    supabase,
  });

  const text = await makeBackupFile('secret123', VALID_BACKUP);
  const file = new File([text], 'backup.zenbackup', { type: 'application/json' });
  const input = el(document, 'backup-file-input');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  setVal(document, 'backup-password', 'secret123');
  input.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
  await wait(200);

  A.ok('backup: ยังไม่กู้คืนจริง', supabase.calls.rpc.filter((r) => r.name === 'restore_admin_backup').length === 0);
  A.ok('backup: มีปุ่มยืนยัน', !!document.getElementById('backup-restore-confirm-btn'));
  A.ok('backup: มีปุ่มยกเลิก', !!document.getElementById('backup-restore-cancel-btn'));
  const preview = el(document, 'operations-error-log').innerHTML;
  A.ok('backup: แสดงจำนวนแถว products', preview.includes('products: 2'));
  A.ok('backup: แสดงจำนวนแถว orders', preview.includes('orders: 1'));

  /* ============ 2. กดยืนยัน → ต้องกู้คืนจริง ============ */
  fire(document, 'backup-restore-confirm-btn', 'click');
  await wait(200);
  const rpc = supabase.calls.rpc.find((r) => r.name === 'restore_admin_backup');
  A.ok('backup: กดยืนยันแล้วเรียก restore_admin_backup', !!rpc);
  A.eq('backup: ส่ง p_backup ที่ถอดรหัสแล้ว', rpc?.params?.p_backup?.format, 'zenmarket-data-v1');
  A.eq('backup: ส่งตารางครบ', rpc?.params?.p_backup?.tables?.products?.length, 2);
}

/* ============ 3. กดยกเลิก → ต้องไม่กู้คืน ============ */
{
  const supabase = await makeSupabaseMock({
    session: ADMIN_SESSION, user: ADMIN_SESSION.user,
    tableData: { store_admin: { user_id: 'admin-1' } },
    rpcResults: { restore_admin_backup: { products: 2 } },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/operations.html',
    scripts: ['src/pages/admin/operations.js'],
    supabase,
  });
  const text = await makeBackupFile('secret123', VALID_BACKUP);
  const file = new File([text], 'backup.zenbackup', { type: 'application/json' });
  const input = el(document, 'backup-file-input');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  setVal(document, 'backup-password', 'secret123');
  input.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
  await wait(200);

  fire(document, 'backup-restore-cancel-btn', 'click');
  await wait(150);
  A.eq('backup: ยกเลิกแล้วไม่กู้คืน', supabase.calls.rpc.filter((r) => r.name === 'restore_admin_backup').length, 0);
  A.eq('backup: ยกเลิกแล้วล้างพรีวิว', el(document, 'operations-error-log').innerHTML, '');
}

/* ============ 4. ไฟล์ผิดรูปแบบ → ต้องไม่เสนอให้กู้คืน ============ */
{
  const supabase = await makeSupabaseMock({
    session: ADMIN_SESSION, user: ADMIN_SESSION.user,
    tableData: { store_admin: { user_id: 'admin-1' } },
    rpcResults: { restore_admin_backup: { products: 2 } },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/operations.html',
    scripts: ['src/pages/admin/operations.js'],
    supabase,
  });
  const text = await makeBackupFile('secret123', { format: 'something-else', tables: {} });
  const file = new File([text], 'bad.zenbackup', { type: 'application/json' });
  const input = el(document, 'backup-file-input');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  setVal(document, 'backup-password', 'secret123');
  input.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
  await wait(200);

  A.eq('backup: ไฟล์ผิด format ไม่กู้คืน', supabase.calls.rpc.filter((r) => r.name === 'restore_admin_backup').length, 0);
  A.eq('backup: ไฟล์ผิด format ไม่มีปุ่มยืนยัน', document.getElementById('backup-restore-confirm-btn'), null);
  A.ok('backup: แสดงข้อความผิดรูปแบบ', el(document, 'operations-error-log').innerHTML.length > 0);
}

/* ============ 5. ไม่ใส่รหัสผ่าน → ต้องไม่อ่านไฟล์ ============ */
{
  const supabase = await makeSupabaseMock({
    session: ADMIN_SESSION, user: ADMIN_SESSION.user,
    tableData: { store_admin: { user_id: 'admin-1' } },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/operations.html',
    scripts: ['src/pages/admin/operations.js'],
    supabase,
  });
  const text = await makeBackupFile('secret123', VALID_BACKUP);
  const file = new File([text], 'backup.zenbackup', { type: 'application/json' });
  const input = el(document, 'backup-file-input');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  setVal(document, 'backup-password', '');
  input.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
  await wait(150);
  A.eq('backup: ไม่ใส่รหัสผ่าน → ไม่มี preview', document.getElementById('backup-restore-confirm-btn'), null);
  A.eq('backup: ไม่ใส่รหัสผ่าน → ไม่กู้คืน', supabase.calls.rpc.filter((r) => r.name === 'restore_admin_backup').length, 0);
}

/* ============ 6. RPC กู้คืนล้มเหลว → ต้องแสดง error และไม่หายเงียบ ============ */
{
  const supabase = await makeSupabaseMock({
    session: ADMIN_SESSION, user: ADMIN_SESSION.user,
    tableData: { store_admin: { user_id: 'admin-1' } },
    rpcError: { rpc: 'restore_admin_backup', message: 'permission denied for function restore_admin_backup', code: '42501' },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/operations.html',
    scripts: ['src/pages/admin/operations.js'],
    supabase,
  });
  const text = await makeBackupFile('secret123', VALID_BACKUP);
  const file = new File([text], 'backup.zenbackup', { type: 'application/json' });
  const input = el(document, 'backup-file-input');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  setVal(document, 'backup-password', 'secret123');
  input.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
  await wait(200);
  fire(document, 'backup-restore-confirm-btn', 'click');
  await wait(200);
  const log = el(document, 'operations-error-log').innerHTML;
  A.ok('backup: error แสดงผู้ใช้', log.includes('permission denied'));
}

process.exit(A.report('backup') ? 1 : 0);
