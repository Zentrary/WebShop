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

process.exit(A.report('admin') ? 1 : 0);
