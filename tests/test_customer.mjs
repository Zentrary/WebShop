import { register } from 'node:module';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

const { loadPage, makeSupabaseMock, setVal, submit, fire, wait, makeAssert, el, importPage } =
  await import('./harness.mjs');

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
  A.ok('checkout: guest gate มีปุ่มเข้าสู่ระบบ', gate.innerHTML.includes('/auth/login'));
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
  A.ok('login: ใช้ panel ของเว็บไซต์', !!document.querySelector('.panel.auth-card'));
  A.ok('login: มีแถบหัวเว็บของเว็บไซต์เหมือนทุกหน้า', !!document.querySelector('.site-header'));
  A.ok('login: มีท้ายเว็บของเว็บไซต์เหมือนทุกหน้า', !!document.querySelector('.site-footer'));
  A.ok('login: ใช้ปุ่มสลับภาษาของเว็บไซต์', !!document.getElementById('lang-toggle'));
  A.ok('login: ไม่มีปุ่มสลับภาษาแยกเอง', !document.getElementById('auth-lang-toggle'));
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
  A.ok('header: guest ไม่เห็นลิงก์สินค้า', !nav.querySelector('a[href="/shop"]'));
  A.ok('header: guest ไม่เห็นลิงก์หมวดหมู่', !nav.querySelector('a[href="/shop/categories"]'));
  const actions = document.querySelector('#header-actions');
  A.ok('header: guest ไม่เห็นปุ่มตะกร้า', !actions.querySelector('a[href="/shop/cart"]'));
  A.ok('header: guest เห็นปุ่มเข้าสู่ระบบ', !!actions.querySelector('a[href="/auth/login"]'));
  A.ok('header: guest เห็นปุ่มสมัครสมาชิก', !!actions.querySelector('a[href="/auth/register"]'));
  A.ok('header: ชื่อร้านไม่มีชื่อหน้าแนบ', !navText.includes('|'));
  const logoText = document.querySelector('.header-logo-text');
  A.ok('header: .header-logo-text มีแค่ชื่อร้าน', !!logoText && !logoText.textContent.includes('|'));
  const heroCta = document.querySelector('.hero-cta a[href="/shop"]');
  A.ok('hero: guest ซ่อนปุ่มเลือกซื้อสินค้า', !!heroCta && heroCta.classList.contains('hidden'));
  const heroRegister = document.querySelector('.hero-cta a[href="/auth/register"]');
  A.ok('hero: ไม่มีปุ่มสมัครสมาชิกใน hero', !heroRegister);
  const heroLogin = document.querySelector('.hero-cta a[href="/auth/login"]');
  A.ok('hero: ไม่มีปุ่มเข้าสู่ระบบใน hero', !heroLogin);
  const langToggle = document.getElementById('lang-toggle');
  A.ok('header: ปุ่มสลับภาษาอยู่ท้ายแถบหัวเว็บ', !!langToggle && !!langToggle.closest('.site-header'));
  const footerLang = document.getElementById('footer-lang-toggle');
  A.ok('header: ท้ายเว็บมีปุ่มสลับภาษา', !!footerLang);
  const headerLogout = document.querySelector('#user-menu-btn');
  A.ok('header: ปุ่มออกจากระบบเป็นสีแดง', !headerLogout);
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
  A.ok('header: member เห็นลิงก์สินค้า', !!nav.querySelector('a[href="/shop"]'));
  A.ok('header: member ไม่เห็นลิงก์หมวดหมู่แยก (รวมไว้ในหน้ารายการสินค้า)', !nav.querySelector('a[href="/shop/categories"]'));
  const actions = document.querySelector('#header-actions');
  A.ok('header: member เห็นปุ่มตะกร้า', !!actions.querySelector('a[href="/shop/cart"]'));
  const heroCta = document.querySelector('.hero-cta a[href="/shop"]');
  A.ok('hero: member เห็นปุ่มเลือกซื้อสินค้า', !!heroCta && !heroCta.classList.contains('hidden'));
  const heroRegister = document.querySelector('.hero-cta a[href="/auth/register"]');
  A.ok('hero: member ไม่มีปุ่มสมัครสมาชิก', !heroRegister);
  const headerLogout = document.querySelector('#user-menu-btn');
  A.ok('header: ปุ่มออกจากระบบใช้สไตล์สีแดง', !!headerLogout && headerLogout.classList.contains('btn-danger'));

  // บัญชีของฉันต้องมีที่เดียว — เป็นปุ่มไอคอนทางขวา ไม่ซ้ำในเมนูหลัก
  A.eq('header: เมนูหลักไม่มี "บัญชีของฉัน" ซ้ำ', nav.querySelectorAll('a[href="/account"]').length, 0);
  A.ok('header: ยังมีปุ่มบัญชีของฉันทางขวา', !!actions.querySelector('a[href="/account"]'));
  A.ok('header: เมนูมือถือยังเข้าบัญชีของฉันได้', !!document.querySelector('#mobile-nav a[href="/account"]'));
}

/* ------------------------------------------------------------------ *
 * เข้าสู่ระบบแล้วต้องไปหน้าแรก ไม่ใช่หน้าบัญชีของฉัน
 * ------------------------------------------------------------------ */
{
  const { safeReturnPath } = await importPage('/src/core/lib.js');
  A.eq('login: ค่าเริ่มต้นหลังเข้าสู่ระบบคือหน้าแรก', safeReturnPath(null), '/home');
  A.eq('login: ยังพากลับไปหน้าที่ตั้งใจไว้ได้', safeReturnPath('/shop/cart'), '/shop/cart');

  const source = fs.readFileSync('/home/user/WebShop/src/pages/customer/account.js', 'utf8');
  A.ok('login: ฟอร์มเข้าสู่ระบบใช้หน้าแรกเป็นปลายทางเริ่มต้น', /zenmarket_return_path'\)\s*,\s*'\/home'/.test(source));
}

/* ------------------------------------------------------------------ *
 * บัญชีของฉัน: สลับแท็บโปรไฟล์ / คำสั่งซื้อ / ที่อยู่ ต้องไม่ซ้อนกัน
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
    tableData: {
      profiles: { id: 'member-1', username: 'tester', first_name: 'สมชาย', last_name: 'ใจดี' },
      store_admin: [],
      orders: [],
      customer_addresses: [],
    },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/account/index.html',
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  await wait(300);

  const profile = document.getElementById('account-profile');
  const orders = document.getElementById('account-orders');
  const addresses = document.getElementById('account-addresses');
  A.ok('account: มีคลาส account-section ครบ', !!profile && !!orders && !!addresses);
  A.ok('account: เริ่มต้นแสดงแท็บโปรไฟล์', !profile.classList.contains('hidden'));
  A.ok('account: เริ่มต้นซ่อนแท็บคำสั่งซื้อ', orders.classList.contains('hidden'));

  const click = (tab) => {
    const link = document.querySelector(`.side-nav a[data-tab="${tab}"]`);
    link.dispatchEvent(new document.defaultView.Event('click', { bubbles: true, cancelable: true }));
  };

  click('orders');
  await wait(120);
  A.ok('account: กดคำสั่งซื้อแล้วซ่อนโปรไฟล์', profile.classList.contains('hidden'));
  A.ok('account: กดคำสั่งซื้อแล้วแสดงคำสั่งซื้อ', !orders.classList.contains('hidden'));
  A.ok('account: กดคำสั่งซื้อแล้วที่อยู่ยังซ่อนอยู่', addresses.classList.contains('hidden'));

  click('addresses');
  await wait(120);
  A.ok('account: กดที่อยู่แล้วซ่อนคำสั่งซื้อ', orders.classList.contains('hidden'));
  A.ok('account: กดที่อยู่แล้วแสดงที่อยู่', !addresses.classList.contains('hidden'));

  click('profile');
  await wait(120);
  A.ok('account: กดโปรไฟล์แล้วแสดงโปรไฟล์', !profile.classList.contains('hidden'));
  A.ok('account: กดโปรไฟล์แล้วซ่อนที่อยู่', addresses.classList.contains('hidden'));
}

process.exit(A.report('customer') ? 1 : 0);
