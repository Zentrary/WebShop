import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

const { loadPage, makeSupabaseMock, setVal, submit, wait, makeAssert } = await import('./harness.mjs');

const A = makeAssert();

const ADMIN_TABLE = { store_admin: { user_id: 'admin-1' } };
const ADMIN_SESSION = { user: { id: 'admin-1', email: 'admin@zenmarket.test' } };

{
  const supabase = await makeSupabaseMock({
    tableData: {
      ...ADMIN_TABLE,
      store_settings: { shop_name: 'ZenMarket', tagline: 't', shipping_fee: 50, free_shipping_threshold: 1000 },
    },
    session: ADMIN_SESSION,
    user: ADMIN_SESSION.user,
  });
  const { document, logs } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/settings.html',
    scripts: ['src/pages/admin/index.js'],
    supabase,
  });
  if (logs.length) console.log('LOGS:', JSON.stringify(logs, null, 1));
  A.eq('settings: ไม่มี jsdom error', logs.filter((l) => l[0] === 'jsdomError').length, 0);

  setVal(document, 'setting-store-name', 'ZenMarket');
  setVal(document, 'setting-shipping-fee', '0');
  setVal(document, 'setting-free-shipping-threshold', '1000');
  submit(document, 'admin-settings-form');
  await wait();

  const upd = supabase.calls.update.find((u) => u.table === 'store_settings');
  A.ok('settings: update ถูกเรียก', !!upd);
  A.eq('settings: shipping_fee 0 ไม่ถูกแทนเป็น 50', upd?.payload?.shipping_fee, 0);
  A.eq('settings: threshold คงเดิม', upd?.payload?.free_shipping_threshold, 1000);
}

{
  const supabase = await makeSupabaseMock({
    tableData: {
      ...ADMIN_TABLE,
      store_settings: { shop_name: 'ZenMarket', shipping_fee: 50, free_shipping_threshold: 1000 },
    },
    session: ADMIN_SESSION,
    user: ADMIN_SESSION.user,
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/settings.html',
    scripts: ['src/pages/admin/index.js'],
    supabase,
  });
  setVal(document, 'setting-store-name', 'ZenMarket');
  setVal(document, 'setting-shipping-fee', '50');
  setVal(document, 'setting-free-shipping-threshold', '0');
  submit(document, 'admin-settings-form');
  await wait();
  A.eq(
    'settings: threshold 0 ถูกปฏิเสธ (ไม่ save)',
    supabase.calls.update.filter((u) => u.table === 'store_settings').length,
    0,
  );
}

{
  const supabase = await makeSupabaseMock({
    tableData: {
      ...ADMIN_TABLE,
      store_settings: { shop_name: 'ZenMarket', shipping_fee: 50, free_shipping_threshold: 1000 },
    },
    session: ADMIN_SESSION,
    user: ADMIN_SESSION.user,
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/settings.html',
    scripts: ['src/pages/admin/index.js'],
    supabase,
  });
  setVal(document, 'setting-store-name', 'ZenMarket');
  setVal(document, 'setting-shipping-fee', '');
  setVal(document, 'setting-free-shipping-threshold', '1000');
  submit(document, 'admin-settings-form');
  await wait();
  A.eq('settings: ค่าว่างถูกปฏิเสธ', supabase.calls.update.filter((u) => u.table === 'store_settings').length, 0);
}

{
  const supabase = await makeSupabaseMock({
    tableData: {
      ...ADMIN_TABLE,
      store_settings: { shop_name: 'ZenMarket', shipping_fee: 50, free_shipping_threshold: 1000 },
    },
    session: ADMIN_SESSION,
    user: ADMIN_SESSION.user,
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/settings.html',
    scripts: ['src/pages/admin/index.js'],
    supabase,
  });
  setVal(document, 'setting-store-name', 'ZenMarket');
  setVal(document, 'setting-shipping-fee', '50');
  setVal(document, 'setting-free-shipping-threshold', '1');
  submit(document, 'admin-settings-form');
  await wait();
  const upd = supabase.calls.update.find((u) => u.table === 'store_settings');
  A.eq('settings: threshold 1 ผ่าน', upd?.payload?.free_shipping_threshold, 1);
}

{
  const supabase = await makeSupabaseMock({
    tableData: { ...ADMIN_TABLE, store_settings: { promptpay_id: '0812345678', recipient_name: 'ร้าน' } },
    session: ADMIN_SESSION,
    user: ADMIN_SESSION.user,
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/payments.html',
    scripts: ['src/pages/admin/index.js'],
    supabase,
  });
  setVal(document, 'payment-promptpay-id', '1234567890123');
  submit(document, 'admin-payments-form');
  await wait();
  const upd = supabase.calls.update.find((u) => u.table === 'store_settings');
  A.eq('payments: promptpay 13 หลักผ่าน', upd?.payload?.promptpay_id, '1234567890123');
}

{
  const supabase = await makeSupabaseMock({
    tableData: { ...ADMIN_TABLE, store_settings: { promptpay_id: '0812345678', recipient_name: 'ร้าน' } },
    session: ADMIN_SESSION,
    user: ADMIN_SESSION.user,
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/payments.html',
    scripts: ['src/pages/admin/index.js'],
    supabase,
  });
  setVal(document, 'payment-promptpay-id', '08123456789');
  submit(document, 'admin-payments-form');
  await wait();
  A.eq(
    'payments: promptpay 11 หลักถูกปฏิเสธ',
    supabase.calls.update.filter((u) => u.table === 'store_settings').length,
    0,
  );
}

/* ------------------------------------------------------------------ *
 * โครงหลังของหน้าผู้ดูแล: ไม่มีโลโก้ตัวอักษร, เมนูแบ่งกลุ่ม, ปุ่มออกสีแดง
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    tableData: {
      ...ADMIN_TABLE,
      store_settings: { shop_name: 'ร้านทดสอบ', promptpay_id: '0812345678', recipient_name: 'ร้าน' },
    },
    session: ADMIN_SESSION,
    user: ADMIN_SESSION.user,
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/operations.html',
    scripts: ['src/pages/admin/index.js'],
    supabase,
  });
  await wait(300);

  const sidebar = document.querySelector('.admin-sidebar');
  A.ok('admin: มีแถบด้านข้าง', !!sidebar);
  A.ok('admin: ไม่มีโลโก้ตัวอักษร Z', !document.body.innerHTML.includes('>Z<'));
  A.ok('admin: ไม่มีคลาส header-logo-mark', !document.querySelector('.header-logo-mark'));

  const brandName = document.querySelector('.admin-brand-name');
  A.eq('admin: แถบด้านข้างแสดงชื่อร้าน', brandName?.textContent.trim(), 'ร้านทดสอบ');

  const groups = document.querySelectorAll('.admin-sidebar .admin-nav-group');
  A.eq('admin: เมนูแบ่งเป็น 2 กลุ่ม', groups.length, 2);
  const labels = [...document.querySelectorAll('.admin-sidebar .admin-nav-label')].map((e) => e.textContent.trim());
  A.eq('admin: มีป้ายกำกับกลุ่มเมนู', labels, ['จัดการร้าน', 'ตั้งค่าระบบ']);
  A.eq('admin: เมนูมีครบ 8 รายการ', document.querySelectorAll('.admin-sidebar .admin-nav a').length, 8);

  const logout = document.getElementById('admin-logout');
  A.ok('admin: ปุ่มออกจากระบบเป็นสีแดง', !!logout && logout.classList.contains('btn-danger-solid'));

  const langBtn = document.getElementById('admin-lang-toggle');
  A.ok('admin: แถบด้านข้างมีปุ่มสลับภาษา', !!langBtn);
  A.ok('admin: ปุ่มสลับภาษาแสดงป้าย TH / EN', /TH\s*\/\s*EN/.test(langBtn?.textContent || ''));

  const mobileNav = document.querySelector('.admin-mobile-nav');
  A.ok('admin: มีเมนูแบบพับสำหรับมือถือ', !!mobileNav);
  A.ok('admin: เมนูมือถือมีปุ่มสลับภาษา', !!document.getElementById('admin-mobile-lang-toggle'));
  const mobileLogout = document.getElementById('admin-mobile-logout');
  A.ok('admin: เมนูมือถือมีปุ่มออกจากระบบสีแดง', !!mobileLogout && mobileLogout.classList.contains('btn-danger-solid'));
  A.eq('admin: เมนูมือถือมีลิงก์ครบ 8 รายการ', mobileNav?.querySelectorAll('.admin-nav a').length, 8);

  A.eq('admin: หัวหน้าหน้าไม่มี eyebrow ซ้ำ', document.querySelectorAll('.admin-content .eyebrow').length, 0);
  const title = document.querySelector('.admin-page-title');
  A.eq('admin: หัวข้อหน้าใช้ admin-page-title', title?.textContent.trim(), 'การดำเนินงาน');

  // กดปุ่มสลับภาษาในแถบด้านข้างแล้วเมนูทั้งชุดต้องเปลี่ยนเป็นอังกฤษทันที
  langBtn.dispatchEvent(new document.defaultView.Event('click', { bubbles: true }));
  await wait(150);
  const enLabels = [...document.querySelectorAll('.admin-sidebar .admin-nav-label')].map((e) => e.textContent.trim());
  A.eq('admin: กดสลับภาษาแล้วป้ายกลุ่มเมนูเป็นอังกฤษ', enLabels, ['Manage the store', 'System setup']);
  A.eq(
    'admin: ปุ่มสลับภาษาแสดง EN / TH หลังสลับ',
    document.getElementById('admin-lang-toggle')?.textContent.trim(),
    'EN / TH',
  );
  A.eq(
    'admin: ป้ายเมนูมือถือเปลี่ยนตามภาษา',
    document.querySelector('.admin-mobile-nav-title')?.textContent.trim(),
    'Admin menu',
  );
}

/* ------------------------------------------------------------------ *
 * ทดสอบ QR พร้อมเพย์: ใช้ค่าที่พิมพ์ในฟอร์ม และแสดงบัญชีที่ใช้จริง
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    tableData: { ...ADMIN_TABLE, store_settings: { promptpay_id: '0812345678', recipient_name: 'ร้านเดิม' } },
    session: ADMIN_SESSION,
    user: ADMIN_SESSION.user,
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/payments.html',
    scripts: ['src/pages/admin/index.js'],
    supabase,
  });
  await wait(300);

  setVal(document, 'payment-promptpay-id', '0947859322');
  setVal(document, 'payment-promptpay-name', 'ผมเอง');
  setVal(document, 'test-qr-amount', '25');
  document
    .getElementById('test-generate-qr-btn')
    .dispatchEvent(new document.defaultView.Event('click', { bubbles: true }));
  await wait(300);

  const result = document.getElementById('test-qr-result');
  A.ok('payments: แสดงผลลัพธ์ QR', !!result && !result.classList.contains('hidden'));
  const img = document.querySelector('#test-qr-image img');
  A.ok('payments: มีรูป QR', !!img && img.src.startsWith('data:image/png'));
  const account = document.getElementById('test-qr-account')?.textContent || '';
  A.ok('payments: แสดง PromptPay ID ที่พิมพ์', account.includes('0947859322'));
  A.ok('payments: แสดงชื่อผู้รับเงิน', account.includes('ผมเอง'));
  const payload = document.getElementById('test-qr-payload')?.textContent || '';
  A.ok('payments: payload มีเลขพร้อมเพย์', payload.includes('0947859322'));
  A.ok('payments: payload มียอดเงิน', payload.includes('25.00'));
  const download = document.getElementById('test-qr-download');
  A.ok('payments: มีปุ่มดาวน์โหลด QR', !!download && download.getAttribute('href')?.startsWith('data:image/png'));
}

/* ------------------------------------------------------------------ *
 * ตั้งค่าร้าน: TikTok / ที่อยู่ / สวิตช์แสดงส่วนติดต่อ
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    tableData: {
      ...ADMIN_TABLE,
      store_settings: {
        shop_name: 'ZenMarket',
        shipping_fee: 50,
        free_shipping_threshold: 1000,
        tiktok_url: 'https://tiktok.com/@shop',
        contact_address: '123 ถนนสุขุมวิท',
        show_contact: true,
      },
    },
    session: ADMIN_SESSION,
    user: ADMIN_SESSION.user,
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/admin/settings.html',
    scripts: ['src/pages/admin/index.js'],
    supabase,
  });
  await wait(300);

  A.eq(
    'settings: โหลด URL ของ TikTok',
    document.getElementById('setting-contact-tiktok')?.value,
    'https://tiktok.com/@shop',
  );
  A.eq('settings: โหลดที่อยู่ร้าน', document.getElementById('setting-contact-address')?.value, '123 ถนนสุขุมวิท');
  A.eq('settings: สวิตช์แสดงส่วนติดต่อถูกเปิด', document.getElementById('setting-show-contact')?.checked, true);

  setVal(document, 'setting-store-name', 'ZenMarket');
  setVal(document, 'setting-shipping-fee', '50');
  setVal(document, 'setting-free-shipping-threshold', '1000');
  setVal(document, 'setting-contact-tiktok', 'https://tiktok.com/@newshop');
  setVal(document, 'setting-contact-address', '99 ถนนใหม่');
  submit(document, 'admin-settings-form');
  await wait();

  const upd = supabase.calls.update.find((u) => u.table === 'store_settings');
  A.eq('settings: บันทึก URL ของ TikTok', upd?.payload?.tiktok_url, 'https://tiktok.com/@newshop');
  A.eq('settings: บันทึกที่อยู่ร้าน', upd?.payload?.contact_address, '99 ถนนใหม่');
  A.eq('settings: บันทึกสวิตช์แสดงส่วนติดต่อ', upd?.payload?.show_contact, true);
}

process.exit(A.report('admin') ? 1 : 0);
