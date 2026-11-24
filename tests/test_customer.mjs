import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

const { loadPage, makeSupabaseMock, setVal, submit, fire, wait, makeAssert, el } = await import('./harness.mjs');

const A = makeAssert();
const MEMBER = { id: 'member-1', email: 'member@zenmarket.test' };
const MEMBER_SESSION = { user: MEMBER };

const CART = [{ product_id: 'p1', name: 'กาแฟ', price: 120, quantity: 2 }];

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

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
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
    console.log('DEBUG gate html:', document.getElementById('checkout-gate').innerHTML.slice(0, 200));
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

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
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

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
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

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
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

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
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

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
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

{
  const supabase = await makeSupabaseMock({ session: null, user: null });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/auth/register.html',
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  const firstName = el(document, 'register-first-name');
  const lastName = el(document, 'register-last-name');
  const age = el(document, 'register-age');
  const password = el(document, 'register-password');
  A.ok('register: มีช่องชื่อจริง', !!firstName);
  A.ok('register: มีช่องนามสกุล', !!lastName);
  A.ok('register: มีช่องอายุ', !!age);
  A.eq('register: ชื่อจริงบังคับ required', firstName.hasAttribute('required'), true);
  A.eq('register: นามสกุลบังคับ required', lastName.hasAttribute('required'), true);
  A.eq('register: อายุบังคับ required', age.hasAttribute('required'), true);
  A.eq('register: อายุต่ำสุด 13', age.getAttribute('min'), '13');
  A.eq('register: อายุสูงสุด 120', age.getAttribute('max'), '120');
  A.eq('register: รหัสผ่านอย่างน้อย 8 ตัว', password.getAttribute('minlength'), '8');
  A.ok('register: มีเลย์เอาต์ฟอร์มสองคอลัมน์', !!document.querySelector('.auth-grid'));
  A.ok('register: ไม่มีโลโก้ในหน้า auth', !document.getElementById('auth-logo'));
  A.ok('register: ไม่มีเครื่องหมายสำรอง', !document.getElementById('auth-mark'));
}

{
  const supabase = await makeSupabaseMock({ session: null, user: null });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/auth/register.html',
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  const password = el(document, 'register-password');
  const hint = el(document, 'register-password-hint');
  A.ok('register: มีข้อความแนะนำความแข็งรหัสผ่าน', !!hint);
  password.value = 'abc';
  password.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
  A.eq('register: รหัสผ่านสั้น → ข้อความเตือน', hint.classList.contains('auth-hint-bad'), true);
  password.value = 'abcd1234';
  password.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
  A.eq('register: รหัสผ่านดี → ข้อความยืนยัน', hint.classList.contains('auth-hint-ok'), true);
  password.value = 'abcdefgh';
  password.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
  A.eq('register: รหัสผ่านไม่มีตัวเลข → ข้อความเตือน', hint.classList.contains('auth-hint-bad'), true);
}

{
  const supabase = await makeSupabaseMock({ session: null, user: null });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/auth/login.html',
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  A.ok('login: ไม่มีโลโก้ในหน้า auth', !document.getElementById('auth-logo'));
  A.ok('login: ไม่มีเครื่องหมายสำรอง', !document.getElementById('auth-mark'));
  A.ok('login: มีแถบบนสุดพร้อมชื่อร้าน', !!document.getElementById('auth-brand-name'));
  A.ok('login: มีปุ่มสลับภาษา', !!document.getElementById('auth-lang-toggle'));
  A.ok('login: มีแผงแนะนำด้านข้าง', !!document.querySelector('.auth-aside'));
  A.ok('login: ไม่มีแถบหัวเว็บของเว็บไซต์', !document.querySelector('.site-header'));
  A.ok('login: ไม่มีท้ายเว็บของเว็บไซต์', !document.querySelector('.site-footer'));
}

{
  const supabase = await makeSupabaseMock({ session: null, user: null });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/home.html',
    scripts: ['src/pages/storefront/home.js'],
    supabase,
  });
  await wait(250);
  const header = document.querySelector('.site-header');
  A.ok('header: guest มีแถบหัวเว็บ', !!header);
  const nav = document.querySelector('#header-nav');
  const navText = nav ? nav.textContent : '';
  A.ok('header: guest ไม่เห็นลิงก์สินค้า', !nav.querySelector('a[href="/shop/index.html"]'));
  A.ok('header: guest ไม่เห็นลิงก์หมวดหมู่', !nav.querySelector('a[href="/shop/categories.html"]'));
  const actions = document.querySelector('#header-actions');
  A.ok('header: guest ไม่เห็นปุ่มตะกร้า', !actions.querySelector('a[href="/shop/cart.html"]'));
  A.ok('header: guest เห็นปุ่มเข้าสู่ระบบ', !!actions.querySelector('a[href="/auth/login.html"]'));
  A.ok('header: guest เห็นปุ่มสมัครสมาชิก', !!actions.querySelector('a[href="/auth/register.html"]'));
  A.ok('header: ชื่อร้านไม่มีชื่อหน้าแนบ', !navText.includes('|'));
  const logoText = document.querySelector('.header-logo-text');
  A.ok('header: .header-logo-text มีแค่ชื่อร้าน', !!logoText && !logoText.textContent.includes('|'));
  const heroCta = document.querySelector('.hero-cta a[href="/shop/index.html"]');
  A.ok('hero: guest ซ่อนปุ่มเลือกซื้อสินค้า', !!heroCta && heroCta.classList.contains('hidden'));
  const heroRegister = document.querySelector('.hero-cta a[href="/auth/register.html"]');
  A.ok('hero: guest เห็นปุ่มสมัครสมาชิก', !!heroRegister && !heroRegister.classList.contains('hidden'));
}

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
    tableData: { profiles: { id: 'member-1', username: 'tester' }, store_admin: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/home.html',
    scripts: ['src/pages/storefront/home.js'],
    supabase,
  });
  await wait(300);
  const nav = document.querySelector('#header-nav');
  A.ok('header: member เห็นลิงก์สินค้า', !!nav.querySelector('a[href="/shop/index.html"]'));
  A.ok('header: member เห็นลิงก์หมวดหมู่', !!nav.querySelector('a[href="/shop/categories.html"]'));
  const actions = document.querySelector('#header-actions');
  A.ok('header: member เห็นปุ่มตะกร้า', !!actions.querySelector('a[href="/shop/cart.html"]'));
  const heroCta = document.querySelector('.hero-cta a[href="/shop/index.html"]');
  A.ok('hero: member เห็นปุ่มเลือกซื้อสินค้า', !!heroCta && !heroCta.classList.contains('hidden'));
  const heroRegister = document.querySelector('.hero-cta a[href="/auth/register.html"]');
  A.ok('hero: member ซ่อนปุ่มสมัครสมาชิก', !!heroRegister && heroRegister.classList.contains('hidden'));
}

process.exit(A.report('customer') ? 1 : 0);
