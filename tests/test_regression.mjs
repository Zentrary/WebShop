import { register } from 'node:module';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

import fs from 'node:fs';
import path from 'node:path';

const { loadPage, makeSupabaseMock, wait, makeAssert, el, ROOT, importPage } = await import('./harness.mjs');

const A = makeAssert();
const WEB = path.join(ROOT, 'web');
const THAI = /[\u0E00-\u0E7F]/;

/* ------------------------------------------------------------------ *
 * 1. หน้า auth: ไม่มีโลโก้ เหลือแต่ข้อความ และใช้โครงเดียวกับเว็บไซต์
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    rpcResults: { get_storefront: { singleton: true, shop_name: 'ร้านพรีเมียม' } },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'auth/login.html'),
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  await wait(300);

  A.ok('auth: ไม่มีคอนเทนเนอร์โลโก้', !document.getElementById('auth-logo'));
  A.ok('auth: ไม่มีคอนเทนเนอร์เครื่องหมายสำรอง', !document.getElementById('auth-mark'));
  A.ok('auth: ไม่มีรูปภาพโลโก้ในหน้า', document.querySelectorAll('.auth-card img').length === 0);
  A.ok('auth: ใช้ panel ของเว็บไซต์', !!document.querySelector('.panel.auth-card'));
  A.ok('auth: มีหัวข้อฟอร์ม', !!document.querySelector('.auth-title'));
  A.ok('auth: มีแถบหัวเว็บของเว็บไซต์', !!document.querySelector('.site-header'));
  A.ok('auth: มีท้ายเว็บของเว็บไซต์', !!document.querySelector('.site-footer'));

  const toggle = document.getElementById('lang-toggle');
  A.ok('auth: ใช้ปุ่มสลับภาษาของเว็บไซต์', !!toggle);
  A.ok('auth: ปุ่มสลับภาษามี aria-label', !!toggle?.getAttribute('aria-label'));
  toggle.dispatchEvent(new document.defaultView.Event('click', { bubbles: true }));
  await wait(120);
  A.ok('auth: กดสลับภาษาแล้วข้อความเปลี่ยน', !/[฀-๿]/.test(document.querySelector('.auth-title')?.textContent || ''));
  A.ok('auth: สลับภาษาแล้วหัวข้อยังอยู่', !!document.querySelector('.auth-title'));
}

/* ------------------------------------------------------------------ *
 * 1b. หน้า login ผู้ดูแล ใช้โครงเดียวกับเว็บไซต์และไม่มีโลโก้
 * ------------------------------------------------------------------ */
{
  const html = fs.readFileSync(path.join(WEB, 'admin/login.html'), 'utf8');
  A.ok('admin-login: ไม่มีตัวอักษร Z', !/>Z</.test(html));
  A.ok('admin-login: ไม่มีรูปโลโก้', !html.includes('id="auth-logo"'));
  A.ok('admin-login: ใช้ panel ของเว็บไซต์', /class="[^"]*panel[^"]*auth-card/.test(html));
  A.ok('admin-login: ไม่มีปุ่มสลับภาษาแยกเอง', !html.includes('id="auth-lang-toggle"'));
  A.ok('admin-login: ไม่มีแถบหัวเว็บแยกเอง', !html.includes('auth-topbar'));

  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    rpcResults: { get_storefront: { singleton: true, shop_name: 'ร้านผู้ดูแล' } },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'admin/login.html'),
    scripts: ['src/pages/admin/login.js'],
    supabase,
  });
  await wait(250);

  A.ok('admin-login: พบฟอร์มเข้าสู่ระบบ', !!document.getElementById('admin-login-form'));
  A.ok('admin-login: มีแถบหัวเว็บของเว็บไซต์', !!document.querySelector('.site-header'));
  A.ok('admin-login: มีท้ายเว็บของเว็บไซต์', !!document.querySelector('.site-footer'));
  A.ok('admin-login: ใช้ปุ่มสลับภาษาของเว็บไซต์', !!document.getElementById('lang-toggle'));
}

/* ------------------------------------------------------------------ *
 * 2. หน้าสมัครสมาชิก: 2 คอลัมน์บนจอใหญ่ และ 1 คอลัมน์บนมือถือ
 * ------------------------------------------------------------------ */
{
  const html = fs.readFileSync(path.join(WEB, 'auth/register.html'), 'utf8');
  A.ok('register: ฟอร์มใช้คลาส auth-grid', /id="register-form"[^>]*class="[^"]*auth-grid/.test(html));
  A.ok('register: หน้าใช้แผงกว้างสองคอลัมน์', /auth-card-wide/.test(html));
  A.ok('register: ปุ่มสมัครสมาชิกกินเต็มแถว', /auth-grid-full[^>]*data-i18n="auth.submit_register"/.test(html));

  const base = fs.readFileSync(path.join(ROOT, 'src/styles/base.css'), 'utf8');
  A.ok(
    'register: CSS กำหนด 2 คอลัมน์',
    /\.auth-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(base),
  );
  A.ok('register: มี auth-grid-full ครอบทั้งแถว', /\.auth-grid-full\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/.test(base));
  A.ok('register: ฟอร์มกว้างพอสำหรับ 2 คอลัมน์', /\.auth-card-wide\s*\{[^}]*max-width/.test(base));

  const responsive = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf8');
  A.ok('register: บนมือถือยุบเหลือ 1 คอลัมน์', /\.auth-grid\s*\{[^}]*grid-template-columns:\s*1fr/.test(responsive));
}

/* ------------------------------------------------------------------ *
 * 3. สลับภาษา: ปุ่มสลับภาษาและเนื้อหาหลักต้องเปลี่ยนจริง
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    tableData: { products: [], categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'shop/index.html'),
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);

  const { getLanguage, setLanguage } = await importPage('/src/core/i18n.js');
  const toggle = document.querySelector('[data-lang-toggle], #lang-toggle, .lang-toggle');
  A.ok('lang: หน้าร้านมีปุ่มสลับภาษา', !!toggle);

  const heading = document.querySelector('[data-i18n="shop.title"]');
  A.ok('lang: หัวข้อหน้าร้านผูกกับ data-i18n', !!heading);
  A.ok('lang: หัวข้อเป็นภาษาไทยก่อนสลับ', THAI.test(heading?.textContent || ''));

  setLanguage('en');
  await wait(80);
  A.eq('lang: ภาษาปัจจุบันเปลี่ยนเป็นอังกฤษ', getLanguage(), 'en');
  A.ok('lang: หัวข้อกลายเป็นภาษาอังกฤษ', !THAI.test(heading?.textContent || ''));
  A.eq('lang: หัวข้อภาษาอังกฤษถูกต้อง', heading?.textContent.trim(), 'Products');
  A.ok('lang: ปุ่มสลับภาษามี aria-label ที่แปลแล้ว', !!toggle?.getAttribute('aria-label'));

  setLanguage('th');
  await wait(80);
  A.eq('lang: สลับกลับภาษาไทยได้', getLanguage(), 'th');
  A.ok('lang: หัวข้อกลับเป็นภาษาไทย', THAI.test(heading?.textContent || ''));
}

/* ------------------------------------------------------------------ *
 * 4. สกุลเงินตามภาษา
 * ------------------------------------------------------------------ */
{
  const { formatTHB } = await importPage('/src/core/lib.js');
  const { setLanguage } = await importPage('/src/core/i18n.js');

  setLanguage('th');
  const th = formatTHB(0);
  const th2 = formatTHB(1234.5);
  setLanguage('en');
  const en = formatTHB(0);
  const en2 = formatTHB(1234.5);

  A.ok('currency: ภาษาไทยใช้สัญลักษณ์บาท', th.includes('฿'));
  A.ok('currency: ภาษาไทยคั่นหลักพันด้วยจุลภาค', th2.includes('1,234.50'));
  A.ok('currency: ภาษาอังกฤษใช้รหัสสกุลเงิน THB', en.includes('THB'));
  A.ok('currency: ภาษาอังกฤษคั่นหลักพันด้วยจุลภาค', en2.includes('1,234.50'));
  A.ok('currency: รูปแบบสองภาษาต่างกัน', th !== en);

  setLanguage('th');
}

/* ------------------------------------------------------------------ *
 * 5. ตัวตนผู้ใช้ต้องไม่ถูกแปลทับเมื่อสลับภาษา
 * ------------------------------------------------------------------ */
{
  const USER = {
    id: 'customer-1',
    email: 'somchai@zenmarket.test',
    username: 'somchai',
    first_name: 'สมชาย',
    last_name: 'ใจดี',
  };
  const supabase = await makeSupabaseMock({
    session: { user: USER },
    user: USER,
    tableData: { profiles: [USER], orders: [], addresses: [], favorites: [] },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'account/index.html'),
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  await wait(300);

  const nameEl = el(document, 'account-name');
  const emailEl = el(document, 'account-email');
  A.ok('identity: พบช่องชื่อผู้ใช้', !!nameEl);
  A.eq('identity: ชื่อผู้ใช้มาจากโปรไฟล์', nameEl?.textContent.trim(), 'สมชาย ใจดี');
  A.eq('identity: อีเมลผู้ใช้มาจากโปรไฟล์', emailEl?.textContent.trim(), 'somchai@zenmarket.test');
  A.ok('identity: ไม่มี data-i18n ทับชื่อผู้ใช้', !nameEl?.hasAttribute('data-i18n'));

  const { setLanguage } = await importPage('/src/core/i18n.js');
  setLanguage('en');
  await wait(120);
  A.eq('identity: ชื่อผู้ใช้ยังคงเดิมหลังสลับภาษา', nameEl?.textContent.trim(), 'สมชาย ใจดี');
  A.eq('identity: อีเมลยังคงเดิมหลังสลับภาษา', emailEl?.textContent.trim(), 'somchai@zenmarket.test');

  setLanguage('th');
  await wait(120);
  A.eq('identity: ชื่อผู้ใช้ยังคงเดิมหลังสลับกลับ', nameEl?.textContent.trim(), 'สมชาย ใจดี');
}

/* ------------------------------------------------------------------ *
 * 6. คำโปรยร้านต้องตามภาษาที่เลือก
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    rpcResults: { get_storefront: { singleton: true, shop_name: 'ZenMarket' } },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'home.html'),
    scripts: ['src/pages/storefront/home.js'],
    supabase,
  });
  await wait(300);

  const footer = document.querySelector('.site-footer');
  A.ok('tagline: มีส่วนท้ายเว็บ', !!footer);
  const tagline = footer?.querySelector('.footer-brand p');
  A.ok('tagline: พบคำโปรยร้าน', !!tagline);
  A.ok('tagline: คำโปรยร้านเป็นภาษาไทย', THAI.test(tagline?.textContent || ''));

  const { setLanguage } = await importPage('/src/core/i18n.js');
  setLanguage('en');
  await wait(150);
  // ส่วนท้ายเว็บถูก render ใหม่ทั้งก้อน จึงต้อง query อีกครั้ง
  const taglineEn = document.querySelector('.site-footer .footer-brand p');
  A.ok('tagline: คำโปรยร้านเปลี่ยนเป็นภาษาอังกฤษ', !THAI.test(taglineEn?.textContent || ''));
  A.ok('tagline: คำโปรยภาษาอังกฤษไม่ว่างเปล่า', (taglineEn?.textContent || '').trim().length > 5);

  setLanguage('th');
  await wait(150);
  const taglineTh = document.querySelector('.site-footer .footer-brand p');
  A.ok('tagline: คำโปรยกลับเป็นภาษาไทย', THAI.test(taglineTh?.textContent || ''));
}

/* ------------------------------------------------------------------ *
 * 7. ชื่อหมวดหมู่ที่สงวนไว้ ต้องถูกปฏิเสธทั้งสองภาษา
 * ------------------------------------------------------------------ */
{
  const { validateCategory } = await importPage('/src/core/validation.js');
  A.eq('category: "ทั้งหมด" เป็นชื่อที่สงวนไว้', validateCategory('ทั้งหมด').ok, false);
  A.eq('category: "ทุกหมวดหมู่" เป็นชื่อที่สงวนไว้', validateCategory('ทุกหมวดหมู่').ok, false);
  A.eq('category: "all" เป็นชื่อที่สงวนไว้', validateCategory('all').ok, false);
  A.eq('category: "All Categories" เป็นชื่อที่สงวนไว้', validateCategory('All Categories').ok, false);
  A.eq('category: ชื่อทั่วไปใช้ได้', validateCategory('กาแฟ').ok, true);
  A.eq('category: ชื่อทั่วไปภาษาอังกฤษใช้ได้', validateCategory('Coffee').ok, true);
}

/* ------------------------------------------------------------------ *
 * 8. หน้าแรก: เลย์เอาต์แบบนิตยสาร (masthead) ไม่ใช่การ์ดกล่องซ้ำ ๆ
 * ------------------------------------------------------------------ */
{
  const html = fs.readFileSync(path.join(WEB, 'home.html'), 'utf8');

  A.ok('home: มีแถบชื่อร้านแบบ masthead', /class="[^"]*hero-masthead/.test(html));
  A.ok('home: ชื่อร้านใน masthead มี id ที่ถูกต้อง', html.includes('id="hero-shop-name"'));
  A.ok('home: หัวเรื่อง hero แยกเป็นบรรทัด', html.includes('class="hero-title-line"'));
  A.ok('home: มีบล็อกข้อมูลร้านแบบแยกส่วน', /class="[^"]*hero-facts/.test(html));
  A.ok(
    'home: ข้อมูลร้านแยก label/value ชัดเจน',
    html.includes('class="stat-label"') && html.includes('class="stat-value"'),
  );
  A.ok('home: ไม่มีตัวเลขใหญ่แบบเดิม', !/hero-meta \.stat b/.test(html));
  A.ok('home: หัวข้อกับคำโปรยของแต่ละส่วนไม่ซ้ำกัน', !html.includes('data-i18n="home.steps_eyebrow">วิธีการสั่งซื้อ'));

  const base = fs.readFileSync(path.join(ROOT, 'src/styles/base.css'), 'utf8');
  A.ok('home: CSS มี masthead', /\.hero-masthead\s*\{/.test(base));
  A.ok('home: CSS มีเส้นคั่น masthead', /\.hero-masthead-rule\s*\{/.test(base));
  A.ok(
    'home: ข้อมูลร้านกลับไปอยู่คอลัมน์ขวาของ hero',
    /\.hero-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.25fr\)/.test(base),
  );
  A.ok('home: ข้อมูลร้านเรียงเป็นคอลัมน์เดียวชิดขวา', /\.hero-meta\s*\{[^}]*flex-direction:\s*column/.test(base));
  A.ok('home: มีเส้นคั่นด้านซ้ายของข้อมูลร้าน', /\.hero-facts\s*\{[^}]*border-left/.test(base));
  A.ok(
    'home: ชื่อร้านใน hero ไม่ใช้ eyebrow จึงไม่มีขีดนำหน้า',
    !/class="[^"]*eyebrow[^"]*"[^>]*id="hero-shop-name"/.test(html) &&
      !/id="hero-shop-name"[^>]*class="[^"]*eyebrow/.test(html),
  );
  A.ok('home: ไม่มีสไตล์ eyebrow เหลือทั้งเว็บ', !/\.eyebrow/.test(base));
  A.ok('home: ไม่มีป้าย eyebrow ในหน้าแรกแล้ว', !html.includes('class="eyebrow"'));
  A.ok('home: ไม่มีปุ่ม "ดูหมวดหมู่" แล้ว', !html.includes('home.cta_categories'));
  A.ok('home: ไม่มีส่วนติดต่อท้ายหน้าแล้ว (ใช้คอลัมน์ติดต่อในท้ายเว็บ)', !html.includes('data-contact-band'));
  A.ok('home: ไม่มีรีวิวตัวอย่างที่เขียนตายตัว', !html.includes('home.review_1_quote'));

  // หน้า admin/reviews เคยว่างเปล่าทั้งที่มีรีวิว เพราะตารางไม่มี GRANT ให้ role ของ PostgREST
  const grantMigration = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/010_grant_product_reviews_privileges.sql'),
    'utf8',
  );
  A.ok(
    'reviews: product_reviews ให้สิทธิ์ SELECT กับ anon/authenticated',
    /grant select on table public\.product_reviews to anon, authenticated/i.test(grantMigration),
  );
  A.ok(
    'reviews: admin ลบรีวิวได้ (มีสิทธิ์ DELETE สำหรับ authenticated)',
    /grant insert, update, delete on table public\.product_reviews to authenticated/i.test(grantMigration),
  );

  const responsive = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf8');
  A.ok('home: บนมือถือข้อมูลร้านซ้อนเป็นบรรทัดเดียว', /\.hero-meta \.stat\s*\{[^}]*flex-direction:\s*row/.test(responsive));
  A.ok(
    'layout: .container บนมือถือไม่ทับ padding-top ของ .section',
    !/\.container\s*\{\s*padding:\s*0 var\(--space-md\)/.test(responsive),
  );
}

/* ------------------------------------------------------------------ *
 * 9. หน้า auth ใช้ปุ่มสลับภาษาของเว็บไซต์จริง และสลับได้จริง
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({ session: null, user: null });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'auth/register.html'),
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  await wait(250);

  const toggle = document.getElementById('lang-toggle');
  A.ok('auth: ปุ่มสลับภาษาของเว็บไซต์อยู่ในแถบหัวเว็บ', !!toggle && !!toggle.closest('.site-header'));
  toggle.dispatchEvent(new document.defaultView.Event('click', { bubbles: true }));
  await wait(120);

  const title = document.querySelector('.auth-title');
  A.ok('auth: กดสลับภาษาแล้วหัวข้อเปลี่ยนเป็นอังกฤษ', !/[\u0E00-\u0E7F]/.test(title?.textContent || ''));
  A.eq('auth: หัวข้อภาษาอังกฤษถูกต้อง', title?.textContent.trim(), 'Create an account');
}

/* ------------------------------------------------------------------ *
 * 10. โครงสร้าง URL แบบ clean URL (ไม่มี .html) และตารางบนมือถือ
 * ------------------------------------------------------------------ */
{
  const fs = await import('node:fs');
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });

  const sourceFiles = [
    ...walk(path.join(ROOT, 'web')).filter((f) => f.endsWith('.html')),
    ...walk(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js')),
  ].filter((f) => !f.endsWith(path.join('core', 'routes.js')));

  const htmlLink = /(["'`])(\/(?!\/)[\w/-]*)\.html(?=["'`?#])/g;
  const offenders = [];
  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(htmlLink)) {
      offenders.push(`${path.relative(ROOT, file)} → ${match[2]}.html`);
    }
  }
  A.eq('url: ไม่มีลิงก์ภายในที่ลงท้ายด้วย .html แล้ว', offenders.slice(0, 5), []);

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  A.ok('url: vercel.json เปิด cleanUrls', vercel.cleanUrls === true);
  A.ok(
    'url: vercel.json ส่ง /home.html ไป /home',
    (vercel.redirects || []).some((r) => r.source === '/index.html' && r.destination === '/home'),
  );

  // cleanUrls ตัด .html ให้ก่อนถึง redirects จึงต้องมีกฎสำหรับ path ที่ตัดแล้วด้วย
  const redirectMap = new Map((vercel.redirects || []).map((r) => [r.source, r.destination]));
  const legacyPairs = [
    ['/about', '/pages/about'],
    ['/contact', '/pages/contact'],
    ['/help', '/pages/help'],
    ['/privacy', '/pages/privacy'],
    ['/login', '/auth/login'],
    ['/register', '/auth/register'],
    ['/cart', '/shop/cart'],
    ['/checkout', '/shop/checkout'],
    ['/product', '/shop/product'],
    ['/orders', '/account/orders'],
    ['/favorites', '/account/favorites'],
  ];
  const missing = legacyPairs.filter(([src, dst]) => redirectMap.get(src) !== dst);
  A.eq('url: ลิงก์เก่าที่ไม่มี .html ก็ถูกส่งไปหน้าที่ถูกต้อง', missing, []);

  const viteConfig = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
  A.ok('url: dev server แปลง clean URL ให้', /zenmarket-clean-urls/.test(viteConfig));

  const requests = fs.readFileSync(path.join(ROOT, 'src/core/routes.js'), 'utf8');
  A.ok('url: routes.js แปลงชื่อย่อเป็นที่อยู่จริง', /'\/home\.html': '\/home'/.test(requests));

  const responsiveCss = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf8');
  A.ok(
    'responsive: ตารางบนมือถือกลายเป็นการ์ด',
    /table\.data td::before\s*\{[^}]*content:\s*attr\(data-label\)/.test(responsiveCss),
  );
  A.ok(
    'responsive: การ์ดตารางใช้ถึงแท็บเล็ตแนวตั้ง (≤900px)',
    /@media \(max-width: 900px\) \{[\s\S]*table\.data thead\s*\{[^}]*display:\s*none/.test(responsiveCss),
  );

  const adminJs = fs.readFileSync(path.join(ROOT, 'src/pages/admin/index.js'), 'utf8');
  A.ok('admin: แถวออเดอร์มี data-label ครบ', (adminJs.match(/<td data-label=/g) || []).length >= 8);
  A.ok('admin: แถวสินค้ามี data-label ครบ', /data-label="\$\{t\('admin\.product_name'\)\}"/.test(adminJs));
}

/* ------------------------------------------------------------------ *
 * 11. หัวเว็บบนมือถือ: ไม่มีปุ่มล้น และย้ายเมนูที่เกินเข้าไปในเมนูพับ
 * ------------------------------------------------------------------ */
{
  const fs = await import('node:fs');
  const responsiveCss = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf8');
  const mobileBlock = responsiveCss.slice(responsiveCss.indexOf('@media (max-width: 768px)', 2000));
  A.ok(
    'header: ซ่อนปุ่มแอดมิน/ออกจากระบบ/สลับภาษาบนมือถือ',
    /#lang-toggle,\s*\.header-admin,\s*\.header-logout\s*\{[^}]*display:\s*none/.test(mobileBlock),
  );
  A.ok('header: เมนูพับมีปุ่มออกจากระบบ', /\.mobile-nav-logout\s*\{/.test(mobileBlock));

  const appJs = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  A.ok('header: เมนูพับมีปุ่มออกจากระบบจริง', /id="mobile-logout"/.test(appJs));
  A.ok('header: ใช้ฟังก์ชันออกจากระบบเดียวกันทั้งสองที่', /signOutNow/.test(appJs));
}

/* ------------------------------------------------------------------ *
 * 12. ระบบที่เพิ่มรอบล่าสุด: คูปอง, รายงาน, ตรวจสลิป, สต็อก, หน้าเว็บ, 404
 * ------------------------------------------------------------------ */
{
  const fs = await import('node:fs');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  // 404 + ความยินยอมคุกกี้
  A.ok('404: มีหน้า 404 ของร้านเอง', fs.existsSync(path.join(ROOT, 'web/404.html')));
  A.ok('404: หน้า 404 มีข้อความแปลภาษา', read('web/404.html').includes('data-i18n="notfound.title"'));
  A.ok('cookie: มีแถบความยินยอมคุกกี้', /renderCookieNotice/.test(read('src/app.js')));
  A.ok('cookie: จำคำตอบของผู้ใช้', /zenmarket_cookie_consent/.test(read('src/app.js')));

  // ข้อความหน้าเว็บที่แก้ได้จากหลังบ้าน
  for (const page of ['about', 'help', 'privacy']) {
    A.ok(`pages: ${page} โหลดตัวแก้ข้อความ`, read(`web/pages/${page}.html`).includes('site-page.js'));
  }
  A.ok('pages: อ่านเนื้อหาจากตาราง site_pages', /from\('site_pages'\)/.test(read('src/pages/content/site-page.js')));
  A.ok('pages: หลังบ้านมีตัวแก้ข้อความ', read('web/admin/settings.html').includes('id="pages-slug"'));

  // คูปอง + ราคาโปรโมชั่น
  A.ok('coupon: หน้าชำระเงินมีช่องกรอกโค้ด', read('web/shop/checkout.html').includes('id="coupon-input"'));
  A.ok('coupon: เรียก check_coupon ก่อนใช้โค้ด', /rpc\('check_coupon'/.test(read('src/pages/customer/checkout.js')));
  A.ok('coupon: ส่งโค้ดไปกับ create_order', /p_coupon/.test(read('src/pages/customer/checkout.js')));
  A.ok('coupon: มีหน้าจัดการคูปองหลังบ้าน', fs.existsSync(path.join(ROOT, 'web/admin/coupons.html')));
  A.ok('sale: คำนวณราคาที่จ่ายจริงจาก sale_price', /export function effectivePrice/.test(read('src/core/lib.js')));
  A.ok('sale: การ์ดสินค้าแสดงป้ายลดราคา', /sale-badge/.test(read('src/pages/storefront/store.js')));
  A.ok('sale: ฟอร์มสินค้ามีช่องราคาโปร', read('web/admin/products.html').includes('id="product-sale-price"'));

  // ที่อยู่ที่บันทึกไว้ใน checkout
  A.ok('address: checkout มีที่อยู่ที่บันทึกไว้', read('web/shop/checkout.html').includes('id="checkout-saved"'));
  A.ok('address: เติมข้อมูลจากที่อยู่ที่เลือก', /customer_addresses/.test(read('src/pages/customer/checkout.js')));

  // ตรวจสลิปโดยเจ้าของร้าน
  A.ok('slip: มีแผงตรวจสลิปในหน้าออเดอร์', read('web/admin/order.html').includes('id="admin-slip-review"'));
  A.ok('slip: เรียกฟังก์ชัน review_slip', /review_slip/.test(read('src/pages/admin/index.js')));
  A.ok('slip: ลูกค้าเห็นเหตุผลที่สลิปไม่ผ่าน', read('web/account/order.html').includes('id="order-slip-status"'));

  // สต็อกใกล้หมด + รายงานยอดขาย
  A.ok('stock: ตั้งเกณฑ์แจ้งเตือนได้', read('web/admin/settings.html').includes('id="setting-low-stock"'));
  A.ok('stock: แดชบอร์ดกรองตามเกณฑ์', /low_stock_threshold/.test(read('src/pages/admin/index.js')));
  A.ok('reports: มีหน้ารายงานยอดขาย', fs.existsSync(path.join(ROOT, 'web/admin/reports.html')));
  A.ok('reports: ดาวน์โหลด CSV ได้', /text\/csv/.test(read('src/pages/admin/index.js')));
  A.ok('reports: เรียก get_sales_report', /get_sales_report/.test(read('src/pages/admin/index.js')));

  // เส้นทางของหน้าใหม่
  const routes = read('src/core/routes.js');
  A.ok('routes: มีเส้นทางคูปอง', routes.includes("'/admin/coupons'"));
  A.ok('routes: มีเส้นทางรายงาน', routes.includes("'/admin/reports'"));
}

/* ------------------------------------------------------------------ *
 * ปรับหน้าเว็บตามผลตรวจ (responsive/UX): ตรวจว่าแก้แล้วจริงและไม่ถอยหลัง
 * ------------------------------------------------------------------ */
{
  const readFile = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const base = readFile('src/styles/base.css');
  const responsive = readFile('src/styles/responsive.css');
  const app = readFile('src/app.js');
  const lib = readFile('src/core/lib.js');

  // 1. ตะกร้า: กริด 4 คอลัมน์ + พื้นที่ยอดรวมของแต่ละแถว
  A.ok('cart: กริด 4 คอลัมน์บนเดสก์ท็อป', /\.cart-row\s*\{[^}]*grid-template-columns:\s*88px/.test(base));
  A.ok(
    'cart: มีคลาส ci-main/ci-total',
    /\.cart-row \.ci-main\s*\{/.test(base) && /\.cart-row \.ci-total\s*\{/.test(base),
  );
  A.ok('cart: มือถือจัดกริดด้วย grid-template-areas', /\.cart-row\s*\{[^}]*grid-template-areas/.test(responsive));
  A.ok(
    'cart: จอ 360–400 แยกแถวจำนวน/ยอดรวม',
    /max-width:\s*400px\)\s*\{[^@]*\.cart-row\s*\{[^}]*grid-template-areas/.test(responsive),
  );

  // 2. หัวเว็บกะทัดรัดถึง 960px และยังโชว์ชื่อร้านที่ 360px
  A.ok(
    'header: ซ่อนเมนูเต็มรูปแบบถึง 960px',
    /@media \(max-width:\s*960px\)\s*\{[^}]*\.header-nav\s*\{[^}]*display:\s*none/.test(responsive),
  );
  A.ok(
    'header: ไม่ซ่อนชื่อร้านที่ 360px',
    !/@media \(max-width:\s*360px\)\s*\{[^@]*\.header-logo-name\s*\{[^}]*display:\s*none/.test(responsive),
  );
  A.ok(
    'header: ยุบปุ่มสมัครสมาชิกบนจอแคบมาก',
    /max-width:\s*400px\)\s*\{[^@]*\.header-register\s*\{[^}]*display:\s*none/.test(responsive),
  );

  // 3. รายการโปรด: route ต้องมาก่อน /account
  const account = readFile('src/pages/customer/account.js');
  A.ok(
    'favorites: ตรวจเส้นทาง /account/favorites ก่อน /account',
    account.indexOf("includes('/account/favorites')") < account.indexOf("includes('/account')"),
  );

  // 4. การ์ดสินค้า: หัวใจอ่านออก + ปุ่มหยิบใส่ตะกร้าไม่ทับรูป
  A.ok('card: ปุ่มหัวใจมีพื้นสว่าง/ไอคอนเข้ม', /\.favorite-btn\s*\{[^}]*color:\s*#1c1c1c/.test(base));
  A.ok('card: ปุ่มหยิบใส่ตะกร้าเป็นแคปซูลบนจอสัมผัส', /@media \(hover:\s*none\)[^@]*\.quick-add/.test(responsive));

  // 5. หน้าแรก: ปุ่มเลือกซื้อสินค้าไม่ผูกกับสมาชิก
  const home = readFile('web/home.html');
  A.ok('home: ปุ่ม CTA ไม่ติด data-member-only', !/data-i18n="home\.cta_shop"[^>]*data-member-only/.test(home));

  // 6/18. แถบคุกกี้: วัดความสูงจริงมากันพื้นที่ และย่อบนมือถือ
  A.ok(
    'cookie: กันพื้นที่ตามความสูงจริงของแถบ',
    /syncCookiePadding/.test(app) && /getBoundingClientRect\(\)\.height/.test(app),
  );
  A.ok('cookie: มีสไตล์กะทัดรัดบนมือถือ', /@media \(max-width:\s*600px\)\s*\{[^@]*\.cookie-notice\s*\{/.test(base));

  // 7. หน้าสินค้าบนแท็บเล็ต: จำกัดขนาดรูป
  A.ok('product: จำกัดความกว้างแกลเลอรี', /\.pd-gallery\s*\{[^}]*max-width/.test(responsive));

  // 9. ชาร์ต: ป้ายวันที่ไม่ทับกัน
  A.ok('chart: ป้ายวันที่เลือกแสดงเฉพาะจุด', /\.sales-day\.is-labeled \.sales-day-label/.test(responsive));

  // 10. ช่องอัปโหลดไฟล์เข้าธีมมืด
  A.ok('file: สไตล์ input[type=file] ในธีมมืด', /input\[type=['"]?file['"]?\]/.test(base));

  // 11. พื้นที่แตะขั้นต่ำบนจอสัมผัส
  A.ok(
    'tap: ชิปหมวดหมู่อย่างน้อย 44px บนจอสัมผัส',
    /@media \(hover:\s*none\)[^@]*\.category-chip\s*\{[^}]*min-height:\s*44px/.test(responsive),
  );
  A.ok('tap: ช่องทำเครื่องหมายใหญ่ขึ้น', /\.form-checkbox input\s*\{[^}]*width:\s*18px/.test(base));

  // 12/17. ตัวเลขเงินต้องไม่เป็น ฿NaN
  A.ok('money: formatTHB กันค่าที่ไม่ใช่ตัวเลข', /Number\.isFinite/.test(lib));

  // 13. ที่อยู่ที่บันทึกไว้ไม่ตัด ellipsis ตั้งแต่ 768px
  A.ok('address: ที่อยู่แสดงได้ 2 บรรทัด', /\.saved-address \.addr\s*\{[^}]*-webkit-line-clamp:\s*2/.test(base));

  // 14. แถบผู้เยี่ยมชมอยู่ใต้หัวข้อหน้า
  A.ok('guest note: แทรกใต้หัวข้อ/ breadcrumb', /\.page-head'\)\s*\|\|/.test(readFile('src/pages/storefront/store.js')));

  // 15. Checkout 2 คอลัมน์ได้ถึง ~901px
  A.ok(
    'checkout: ยุบเป็นคอลัมน์เดียวที่ 900px',
    /@media \(max-width:\s*900px\)\s*\{[^}]*\.cart-grid\s*\{[^}]*grid-template-columns:\s*1fr/.test(responsive),
  );
}

process.exit(A.report('regression') ? 1 : 0);
