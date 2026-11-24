import { register } from 'node:module';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

import fs from 'node:fs';
import path from 'node:path';

const { loadPage, makeSupabaseMock, wait, makeAssert, el, ROOT, importPage } = await import('./harness.mjs');

const A = makeAssert();
const WEB = path.join(ROOT, 'web');
const THAI = /[\u0E00-\u0E7F]/;

/* ------------------------------------------------------------------ *
 * 1. โลโก้สำรอง: ไม่มีโลโก้ที่ตั้งค่าไว้ -> ใช้รูปกระเป๋าซื้อของแทน
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    rpcResults: { get_storefront: { singleton: true, shop_name: 'ZenMarket' } },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'auth/login.html'),
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  await wait(300);

  const img = el(document, 'auth-logo');
  const mark = el(document, 'auth-mark');
  A.ok('logo: มีคอนเทนเนอร์โลโก้จริง', !!img);
  A.ok('logo: มีคอนเทนเนอร์รูปสำรอง', !!mark);
  A.eq('logo: โลโก้จริงถูกซ่อนเมื่อไม่ได้ตั้งค่า', img?.hidden, true);
  A.eq('logo: รูปสำรองถูกแสดงเมื่อไม่ได้ตั้งค่า', mark?.hidden, false);
  A.ok('logo: รูปสำรองเป็น SVG ไม่ใช่ตัวอักษร Z', !!mark?.querySelector('svg'));
  A.ok('logo: รูปสำรองไม่มีตัวอักษร Z', !/>Z</.test(mark?.innerHTML || ''));
}

/* ------------------------------------------------------------------ *
 * 2. หน้าสมัครสมาชิก: 2 คอลัมน์บนจอใหญ่ และ 1 คอลัมน์บนมือถือ
 * ------------------------------------------------------------------ */
{
  const html = fs.readFileSync(path.join(WEB, 'auth/register.html'), 'utf8');
  A.ok('register: ฟอร์มใช้คลาส auth-grid', /id="register-form"[^>]*class="[^"]*auth-grid/.test(html));
  A.ok('register: การ์ดใช้คลาส auth-card-wide', /auth-card-wide/.test(html));
  A.ok('register: ปุ่มสมัครสมาชิกกินเต็มแถว', /auth-grid-full[^>]*data-i18n="auth.submit_register"/.test(html));

  const base = fs.readFileSync(path.join(ROOT, 'src/styles/base.css'), 'utf8');
  A.ok(
    'register: CSS กำหนด 2 คอลัมน์',
    /\.auth-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(base),
  );
  A.ok('register: มี auth-grid-full ครอบทั้งแถว', /\.auth-grid-full\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/.test(base));

  const responsive = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf8');
  const mobileBlock = responsive.slice(responsive.indexOf('max-width: 768px'));
  A.ok('register: บนมือถือยุบเหลือ 1 คอลัมน์', /\.auth-grid\s*\{[^}]*grid-template-columns:\s*1fr/.test(responsive));
  void mobileBlock;
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

process.exit(A.report('regression') ? 1 : 0);
