import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

const { loadPage, makeSupabaseMock, setVal, submit, fire, wait, makeAssert, el } = await import('./harness.mjs');

const A = makeAssert();
const MEMBER = { id: 'member-1', email: 'member@zenmarket.test' };
const MEMBER_SESSION = { user: MEMBER };

const CART = [{ product_id: 'p1', name: 'กาแฟ', price: 120, quantity: 2 }];

/* ============ 1. guest เข้า checkout → ต้องเจอ gate ไม่ใช่ฟอร์ม ============ */
{
  const supabase = await makeSupabaseMock({ session: null, user: null });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/checkout.html',
    scripts: ['src/pages/customer/checkout.js'],
    supabase,
    storage: { zenmarket_cart: JSON.stringify(CART) },
  });
  const gate = el(document, 'checkout-gate');
  A.ok('checkout: guest เห็น gate', !gate.classList.contains('hidden'));
  A.ok('checkout: guest ถูกซ่อนฟอร์ม', el(document, 'checkout-content').classList.contains('hidden'));
  A.ok('checkout: guest gate มีปุ่มเข้าสู่ระบบ', gate.innerHTML.includes('/auth/login.html'));
}

/* ============ 2. member กรอกข้อมูลถูกต้อง → create_order ถูกเรียก ============ */
{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION, user: MEMBER,
    rpcResults: { create_order: { id: 'order-1' } },
    tableData: { profiles: { id: 'member-1', username: 'tester', phone: '0812345678' } },
  });
  const { document, logs } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/checkout.html',
    scripts: ['src/pages/customer/checkout.js'],
    supabase,
    storage: { zenmarket_cart: JSON.stringify(CART) },
  });
  if (!el(document, 'checkout-gate').classList.contains('hidden')) {
    console.log('DEBUG logs:', JSON.stringify(logs));
    console.log('DEBUG auth calls:', JSON.stringify(supabase.calls.auth));
    console.log('DEBUG select calls:', JSON.stringify(supabase.calls.select));
    console.log('DEBUG gate class:', document.getElementById('checkout-gate').className);
    console.log('DEBUG gate html:', document.getElementById('checkout-gate').innerHTML.slice(0,200));
    console.log('DEBUG content class:', document.getElementById('checkout-content').className);
    console.log('DEBUG header?', !!document.querySelector('.site-header'));
  }
  A.ok('checkout: member ไม่เห็น gate', el(document, 'checkout-gate').classList.contains('hidden'));

  setVal(document, 'checkout-name', 'สมชาย ใจดี');
  setVal(document, 'checkout-phone', '0812345678');
  setVal(document, 'checkout-address', 'บ้านเลขที่ 123 ซอยสุขใจ ถนนสุขุมวิท แขวงบางนา เขตบางนา กรุงเทพมหานคร 10260');
  fire(document, 'place-order-btn', 'click');
  await wait(150);

  const rpc = supabase.calls.rpc.find((r) => r.name === 'create_order');
  A.ok('checkout: เรียก create_order', !!rpc);
  A.eq('checkout: phone ถูก normalize', rpc?.params?.delivery?.phone, '0812345678');
  A.eq('checkout: address ถูกตัด', rpc?.params?.delivery?.address.length, 74);
  A.ok('checkout: address ไม่มีช่องว่างหัวท้าย', rpc?.params?.delivery?.address === rpc?.params?.delivery?.address.trim());
}

/* ============ 3. member กรอกเบอร์ 9 หลัก → ต้อง normalize เป็น 10 หลัก ============ */
{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION, user: MEMBER,
    rpcResults: { create_order: { id: 'order-1' } },
    tableData: { profiles: { id: 'member-1', username: 'tester', phone: '0812345678' } },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/checkout.html',
    scripts: ['src/pages/customer/checkout.js'],
    supabase,
    storage: { zenmarket_cart: JSON.stringify(CART) },
  });
  setVal(document, 'checkout-name', 'สมชาย ใจดี');
  setVal(document, 'checkout-phone', '812345678');
  setVal(document, 'checkout-address', 'บ้านเลขที่ 123 ซอยสุขใจ ถนนสุขุมวิท แขวงบางนา เขตบางนา กรุงเทพมหานคร 10260');
  fire(document, 'place-order-btn', 'click');
  await wait(150);
  const rpc = supabase.calls.rpc.find((r) => r.name === 'create_order');
  A.eq('checkout: เบอร์ 9 หลัก → 10 หลัก', rpc?.params?.delivery?.phone, '0812345678');
}

/* ============ 4. member กรอกเบอร์ผิด → ต้องไม่เรียก create_order ============ */
{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION, user: MEMBER,
    rpcResults: { create_order: { id: 'order-1' } },
    tableData: { profiles: { id: 'member-1', username: 'tester', phone: '0812345678' } },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/checkout.html',
    scripts: ['src/pages/customer/checkout.js'],
    supabase,
    storage: { zenmarket_cart: JSON.stringify(CART) },
  });
  setVal(document, 'checkout-name', 'สมชาย ใจดี');
  setVal(document, 'checkout-phone', '12345');
  setVal(document, 'checkout-address', 'บ้านเลขที่ 123 ซอยสุขใจ ถนนสุขุมวิท แขวงบางนา เขตบางนา กรุงเทพมหานคร 10260');
  fire(document, 'place-order-btn', 'click');
  await wait(150);
  A.eq('checkout: เบอร์ผิด → ไม่สร้างออเดอร์', supabase.calls.rpc.filter((r) => r.name === 'create_order').length, 0);
}

/* ============ 5. ที่อยู่สั้นเกิน 20 ตัว → ต้องไม่สร้างออเดอร์ ============ */
{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION, user: MEMBER,
    rpcResults: { create_order: { id: 'order-1' } },
    tableData: { profiles: { id: 'member-1', username: 'tester', phone: '0812345678' } },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/checkout.html',
    scripts: ['src/pages/customer/checkout.js'],
    supabase,
    storage: { zenmarket_cart: JSON.stringify(CART) },
  });
  setVal(document, 'checkout-name', 'สมชาย ใจดี');
  setVal(document, 'checkout-phone', '0812345678');
  setVal(document, 'checkout-address', 'สั้นมาก');
  fire(document, 'place-order-btn', 'click');
  await wait(150);
  A.eq('checkout: ที่อยู่สั้น → ไม่สร้างออเดอร์', supabase.calls.rpc.filter((r) => r.name === 'create_order').length, 0);
}

/* ============ 6. browser pattern ต้องบล็อกเบอร์ที่ DB ปฏิเสธ ============ */
{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION, user: MEMBER,
    rpcResults: { create_order: { id: 'order-1' } },
    tableData: { profiles: { id: 'member-1', username: 'tester', phone: '0812345678' } },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/checkout.html',
    scripts: ['src/pages/customer/checkout.js'],
    supabase,
    storage: { zenmarket_cart: JSON.stringify(CART) },
  });
  const phone = el(document, 'checkout-phone');
  A.eq('checkout: pattern เป็น 0?[0-9]{9}', phone.getAttribute('pattern'), '0?[0-9]{9}');

  phone.value = '0812345678';
  A.ok('checkout: เบอร์ 10 หลักผ่าน browser validation', phone.checkValidity());
  phone.value = '812345678';
  A.ok('checkout: เบอร์ 9 หลักผ่าน browser validation', phone.checkValidity());
  phone.value = '1234567890';
  A.ok('checkout: เบอร์นำหน้าไม่ใช่ 0 ไม่ผ่าน', !phone.checkValidity());
  phone.value = '08123456789';
  A.ok('checkout: เบอร์ 11 หลักไม่ผ่าน', !phone.checkValidity());
  phone.value = '081-234-5678';
  A.ok('checkout: เบอร์มีขีดไม่ผ่าน browser validation', !phone.checkValidity());
}

/* ============ 7. register: pattern ต้องตรงกับ DB ============ */
{
  const supabase = await makeSupabaseMock({ session: null, user: null });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/auth/register.html',
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  const phone = el(document, 'register-phone');
  A.eq('register: pattern เป็น 0?[0-9]{9}', phone.getAttribute('pattern'), '0?[0-9]{9}');
  phone.value = '0812345678';
  A.ok('register: เบอร์ 10 หลักผ่าน', phone.checkValidity());
  phone.value = '9999999999';
  A.ok('register: เบอร์นำหน้าไม่ใช่ 0 ไม่ผ่าน', !phone.checkValidity());
}

/* ============ 8. account: profile phone pattern ============ */
{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION, user: MEMBER,
    tableData: { profiles: { id: 'member-1', username: 'tester', phone: '0812345678', first_name: 'สมชาย' } },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/account/index.html',
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  const phone = el(document, 'profile-phone');
  A.eq('account: profile phone pattern', phone.getAttribute('pattern'), '0?[0-9]{9}');
  const addrPhone = el(document, 'address-phone');
  A.eq('account: address phone pattern', addrPhone.getAttribute('pattern'), '0?[0-9]{9}');
}

process.exit(A.report('customer') ? 1 : 0);
