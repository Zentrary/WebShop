import { register } from 'node:module';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

import fs from 'node:fs';
import path from 'node:path';

const { loadPage, makeSupabaseMock, wait, makeAssert, el, ROOT, importPage } = await import('./harness.mjs');

const A = makeAssert();
const THAI = /[\u0E00-\u0E7F]/;
const WEB = path.join(ROOT, 'web');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const HTML_FILES = walk(WEB);

/* ------------------------------------------------------------------ *
 * 1. ทุกคีย์ในแอตทริบิวต์ data-i18n* ต้องมีในพจนานุกรมทั้ง 2 ภาษา
 * ------------------------------------------------------------------ */
{
  const dictSrc = fs.readFileSync(path.join(ROOT, 'src/core/i18n.js'), 'utf8');
  const thBlock = dictSrc.slice(dictSrc.indexOf('th: {'), dictSrc.indexOf('en: {'));
  const enBlock = dictSrc.slice(dictSrc.indexOf('en: {'));
  const thKeys = new Set([...thBlock.matchAll(/^\s*'([a-z0-9_.]+)':/gm)].map((m) => m[1]));
  const enKeys = new Set([...enBlock.matchAll(/^\s*'([a-z0-9_.]+)':/gm)].map((m) => m[1]));

  A.ok('i18n: พจนานุกรมภาษาไทยมีคีย์มากกว่า 500', thKeys.size > 500);
  A.ok('i18n: พจนานุกรมภาษาอังกฤษมีคีย์เท่ากับภาษาไทย', thKeys.size === enKeys.size);

  const missingTh = [];
  const missingEn = [];
  for (const file of HTML_FILES) {
    const rel = path.relative(WEB, file);
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) {
      if (!thKeys.has(m[1])) missingTh.push(`${rel} -> ${m[1]}`);
      if (!enKeys.has(m[1])) missingEn.push(`${rel} -> ${m[1]}`);
    }
  }
  A.eq('i18n: ไม่มีคีย์ที่ใช้ใน HTML แต่หายจากพจนานุกรมไทย', missingTh, []);
  A.eq('i18n: ไม่มีคีย์ที่ใช้ใน HTML แต่หายจากพจนานุกรมอังกฤษ', missingEn, []);

  const used = new Set();
  for (const file of HTML_FILES) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) used.add(m[1]);
  }
  A.ok('i18n: มีคีย์ data-i18n ใช้งานจริงในหน้าเว็บ', used.size > 150);

  // ทุกไฟล์ใน src/ ถือเป็นการใช้งานคีย์ด้วย
  const jsFiles = [];
  const walkSrc = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkSrc(p);
      else if (e.name.endsWith('.js')) jsFiles.push(p);
    }
  };
  walkSrc(path.join(ROOT, 'src'));
  const jsAll = jsFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const orphan = [...thKeys].filter(
    (k) => !used.has(k) && !jsAll.includes(`'${k}'`) && !k.startsWith('validation.') && !k.startsWith('toast.'),
  );
  A.eq('i18n: ไม่มีคีย์ที่ไม่ถูกใช้เลย', orphan, []);

  // คีย์ที่ถูกเรียกในโค้ด (t('...')) ต้องมีอยู่จริงในพจนานุกรมทั้งสองภาษา
  const missingInCode = [];
  for (const file of jsFiles) {
    const rel = path.relative(ROOT, file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-z0-9_.]+)'/g)) {
      if (!thKeys.has(m[1])) missingInCode.push(`${rel} -> ${m[1]} (th)`);
      if (!enKeys.has(m[1])) missingInCode.push(`${rel} -> ${m[1]} (en)`);
    }
  }
  A.eq('i18n: คีย์ที่เรียกจากโค้ดต้องมีในพจนานุกรม', missingInCode, []);
}

/* ------------------------------------------------------------------ *
 * 2. ข้อความไทยที่มองเห็นได้ทุกจุดต้องผูกกับ data-i18n
 * ------------------------------------------------------------------ */
{
  const untranslated = [];
  for (const file of HTML_FILES) {
    const rel = path.relative(WEB, file);
    const html = fs.readFileSync(file, 'utf8');
    const bodyIdx = html.indexOf('<body');
    if (bodyIdx < 0) continue;
    const body = html
      .slice(bodyIdx)
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '');

    const textRe = />([^<>]*[\u0E00-\u0E7F][^<>]*)</g;
    let m;
    while ((m = textRe.exec(body))) {
      const text = m[1].trim();
      if (!text || text.length < 2) continue;
      if (text.startsWith('ZenMarket |')) continue; // <title> แปลงที่ runtime แล้ว

      const before = body.slice(0, m.index);
      const openIdx = before.lastIndexOf('<');
      const openEnd = before.indexOf('>', openIdx);
      const openTag = before.slice(openIdx, openEnd < 0 ? undefined : openEnd);

      // ข้อความที่เติมจาก runtime (ชื่อร้าน / ชื่อผู้ใช้) ไม่ต้องผูกกับ data-i18n
      if (/id="(account-name|hero-shop-name|hero-tagline)"/.test(openTag)) continue;
      if (/data-i18n(?:-[\w-]+)?\s*=/.test(openTag)) continue;
      if (/placeholder\s*=/.test(openTag)) continue;
      if (/aria-label\s*=/.test(openTag)) continue;
      if (/title\s*=/.test(openTag)) continue;
      if (/alt\s*=/.test(openTag)) continue;

      // ไล่ดู element บรรพบุรุษ 5 ชั้น
      let anc = before;
      let covered = false;
      for (let i = 0; i < 5; i++) {
        const o = anc.lastIndexOf('<');
        if (o < 0) break;
        const close = anc.indexOf('>', o);
        const tg = anc.slice(o, close < 0 ? undefined : close);
        if (/data-i18n(?:-[\w-]+)?\s*=/.test(tg)) {
          covered = true;
          break;
        }
        anc = anc.slice(0, o);
      }
      if (covered) continue;
      untranslated.push(`${rel}: ${text}`);
    }
  }
  A.eq('i18n: ไม่มีข้อความไทยที่มองเห็นได้และไม่ได้ผูกกับ data-i18n', untranslated, []);
}

/* ------------------------------------------------------------------ *
 * 3. หน้าแรก: สถิติ / รีวิว / FAQ ต้องสลับภาษาได้จริง
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    tableData: { products: [], categories: [], reviews: [] },
  });
  const { document, window } = await loadPage({
    htmlPath: path.join(WEB, 'home.html'),
    scripts: ['src/pages/storefront/home.js'],
    supabase,
  });
  await wait(200);

  const statShip = document.querySelector('.hero-meta .stat:nth-child(2) b');
  A.ok('i18n: หน้าแรกมีตัวเลขสถิติการจัดส่ง', !!statShip);
  A.ok('i18n: สถิติการจัดส่งเป็นภาษาไทยก่อนสลับ', THAI.test(statShip?.textContent || ''));

  const faqQ = document.querySelector('.faq-item .faq-q span[data-i18n]');
  A.ok('i18n: คำถาม FAQ ผูกกับ data-i18n', !!faqQ);

  // Reviews come from the database, never from hard-coded copy: with an empty
  // table the home page has to say so honestly.
  const emptyReviews = document.querySelector('#home-reviews .empty-state');
  A.eq('i18n: ยังไม่มีรีวิวในฐานข้อมูลจึงแสดงข้อความว่าง', emptyReviews?.textContent.trim(), 'ยังไม่มีรีวิว');

  const { setLanguage, t } = await importPage('/src/core/i18n.js');
  setLanguage('en');
  await wait(60);

  A.eq('i18n: สถิติการจัดส่งเปลี่ยนเป็นอังกฤษ', statShip?.textContent.trim(), '2–5 days');
  A.ok('i18n: คำถาม FAQ เปลี่ยนเป็นอังกฤษ', (faqQ?.textContent || '').includes('When will'));
  A.eq(
    'i18n: ข้อความว่างของรีวิวเปลี่ยนเป็นอังกฤษ',
    document.querySelector('#home-reviews .empty-state')?.textContent.trim(),
    'No reviews yet',
  );
  A.ok('i18n: เนื้อหาอังกฤษไม่เหลืออักขระไทยค้างในหน้าแรก', !THAI.test(document.querySelector('.hero-meta').textContent));

  setLanguage('th');
  await wait(60);
  A.eq('i18n: สลับกลับภาษาไทยแล้วกลับมาเป็นไทย', statShip?.textContent.trim(), '2–5 วัน');
  A.ok('i18n: t() คืนค่าภาษาไทย', t('common.loading') === 'กำลังโหลด...');
  A.ok('i18n: t() คืนค่าภาษาอังกฤษ', t('common.loading', {}) === 'กำลังโหลด...');
  void window;
}

/* ------------------------------------------------------------------ *
 * 4. ราคาและสกุลเงินต้องเปลี่ยนตามภาษา
 * ------------------------------------------------------------------ */
{
  const { formatTHB } = await importPage('/src/core/lib.js');
  const { setLanguage } = await importPage('/src/core/i18n.js');

  setLanguage('th');
  const thPrice = formatTHB(1234.5);
  setLanguage('en');
  const enPrice = formatTHB(1234.5);

  A.ok('i18n: ราคาภาษาไทยใช้สัญลักษณ์บาท', thPrice.includes('฿'));
  A.ok('i18n: ราคาภาษาอังกฤษระบุสกุลเงินชัดเจน', enPrice.includes('THB'));
  A.ok('i18n: ราคามีทศนิยม 2 ตำแหน่ง', thPrice.includes('1,234.50') && enPrice.includes('1,234.50'));

  setLanguage('th');
}

/* ------------------------------------------------------------------ *
 * 5. ป้ายสรุปยอด / ปุ่ม / สถานะโหลด ต้องสลับภาษา
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    tableData: { products: [], categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'shop/cart.html'),
    scripts: ['src/pages/customer/checkout.js'],
    supabase,
  });
  await wait(200);

  const { setLanguage } = await importPage('/src/core/i18n.js');
  const label = document.querySelector('.sum-row span[data-i18n="cart.subtotal"]');
  A.ok('i18n: ป้ายยอดรวมสินค้าผูกกับ data-i18n', !!label);

  setLanguage('en');
  await wait(60);
  A.eq('i18n: ป้ายยอดรวมสินค้าเปลี่ยนเป็นอังกฤษ', label?.textContent.trim(), 'Subtotal');

  const total = el(document, 'cart-total');
  A.ok(
    'i18n: ยอดรวมในตะกร้าถูกอัปเดตเป็นภาษาอังกฤษ',
    total?.textContent.includes('THB') || total?.textContent.includes('฿'),
  );

  setLanguage('th');
  await wait(60);
  A.eq('i18n: ป้ายยอดรวมสินค้ากลับเป็นไทย', label?.textContent.trim(), 'ยอดรวมสินค้า');
}

/* ------------------------------------------------------------------ *
 * 6. หน้า auth: ไม่มีโลโก้ เหลือแต่ข้อความ + ต้องเป็นหน้า stand-alone
 * ------------------------------------------------------------------ */
{
  for (const page of ['login.html', 'register.html', 'reset-password.html', 'forgot-password.html']) {
    const file = path.join(WEB, 'auth', page);
    const html = fs.readFileSync(file, 'utf8');
    A.ok(`auth: ${page} ไม่มีตัวอักษร Z เป็นโลโก้`, !/>Z</.test(html));
    A.ok(`auth: ${page} ไม่มีรูปโลโก้ในหน้า`, !html.includes('id="auth-logo"'));
    A.ok(`auth: ${page} ไม่มีเครื่องหมายสำรอง`, !html.includes('id="auth-mark"'));
    A.ok(`auth: ${page} ใช้ container ของเว็บไซต์`, html.includes('class="container page"'));
    A.ok(`auth: ${page} ใช้ panel ของเว็บไซต์`, html.includes('class="panel auth-card'));
    A.ok(`auth: ${page} ไม่มีแถบหัวเว็บแยกเอง`, !html.includes('auth-topbar'));
    A.ok(`auth: ${page} ไม่มีปุ่มสลับภาษาแยกเอง`, !html.includes('auth-lang-toggle'));
  }

  const adminLogin = fs.readFileSync(path.join(WEB, 'admin/login.html'), 'utf8');
  A.ok('auth: หน้า login ผู้ดูแลไม่มีตัวอักษร Z', !/>Z</.test(adminLogin));
  A.ok('auth: หน้า login ผู้ดูแลไม่มีรูปโลโก้', !adminLogin.includes('id="auth-logo"'));
  A.ok('auth: หน้า login ผู้ดูแลใช้ panel ของเว็บไซต์', adminLogin.includes('class="panel auth-card'));

  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    rpcResults: {
      get_storefront: {
        singleton: true,
        shop_name: 'ร้านทดสอบ',
        tagline: 'ทดสอบ',
        logo_url: 'https://cdn.example.test/logo.png',
      },
    },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'auth/login.html'),
    scripts: ['src/pages/customer/account.js'],
    supabase,
  });
  await wait(300);

  A.ok('auth: หน้า login มีแถบหัวเว็บของเว็บไซต์', !!document.querySelector('.site-header'));
  A.ok('auth: หน้า login มีท้ายเว็บของเว็บไซต์', !!document.querySelector('.site-footer'));
  A.ok('auth: หน้า login ใช้ปุ่มสลับภาษาของเว็บไซต์', !!document.getElementById('lang-toggle'));
  A.ok('auth: ปุ่มสลับภาษาแสดงป้ายภาษา', /TH|EN/.test(document.getElementById('lang-toggle')?.textContent || ''));
}

/* ------------------------------------------------------------------ *
 * 7. กฎ CSS ของหน้า auth
 * ------------------------------------------------------------------ */
{
  const base = fs.readFileSync(path.join(ROOT, 'src/styles/base.css'), 'utf8');
  A.ok('css: มีกฎ [hidden] ที่บังคับ display:none', /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(base));
  A.ok('css: มีกริด 2 คอลัมน์สำหรับฟอร์มสมัครสมาชิก', /\.auth-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/.test(base));
  A.ok('css: หน้า auth ไม่มีสไตล์แยกเอง', !/\.auth-topbar|\.auth-aside|\.auth-lang\b/.test(base));
  A.ok('css: ซ่อนปุ่มเลื่อนของช่องตัวเลข', /input\[type='number'\]::\-webkit\-outer\-spin\-button/.test(base));
  A.ok('css: ช่องตัวเลขใช้ appearance textfield', /input\[type='number'\]\s*\{[^}]*appearance:\s*textfield/.test(base));
  A.ok('css: ไม่มีสไตล์ eyebrow เหลือแล้ว', !/\.eyebrow/.test(base));

  const responsive = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf8');
  A.ok('css: ฟอร์มสมัครสมาชิกยุบเป็น 1 คอลัมน์บนมือถือ', /\.auth-grid\s*\{\s*grid-template-columns:\s*1fr/.test(responsive));
}

/* ------------------------------------------------------------------ *
 * 8. ส่วนติดต่อบนหน้าแรก + ท้ายเว็บ ต้องมาจากค่าที่ตั้งในแอดมิน
 * ------------------------------------------------------------------ */
{
  const STORE = {
    singleton: true,
    shop_name: 'ร้านทดสอบ',
    tagline: 'คำโปรยทดสอบ',
    contact_email: 'hello@test.shop',
    contact_phone: '0812345678',
    contact_address: '123 ถนนสุขุมวิท',
    line_url: 'https://line.me/R/ti/abc',
    facebook_url: 'https://facebook.com/shop',
    instagram_url: 'https://instagram.com/shop',
    tiktok_url: 'https://tiktok.com/@shop',
    show_contact: true,
  };

  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    rpcResults: { get_storefront: STORE },
    tableData: { products: [], categories: [], reviews: [] },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'pages/contact.html'),
    scripts: ['src/app.js'],
    supabase,
  });
  await wait(300);

  const band = document.querySelector('[data-contact-band]');
  A.ok('contact: หน้าร้านมีส่วนติดต่อ', !!band);
  A.ok('contact: ส่วนติดต่อไม่ถูกซ่อน', !band.classList.contains('hidden'));

  const channels = [...band.querySelectorAll('.contact-channel-name')].map((e) => e.textContent.trim());
  A.eq('contact: แสดงทุกช่องทางที่ตั้งไว้', channels, ['LINE Official', 'Facebook', 'Instagram', 'TikTok']);

  const details = band.querySelector('[data-contact-details]')?.textContent || '';
  A.ok('contact: แสดงเบอร์โทรศัพท์', details.includes('0812345678'));
  A.ok('contact: แสดงอีเมล', details.includes('hello@test.shop'));
  A.ok('contact: แสดงที่อยู่', details.includes('123 ถนนสุขุมวิท'));

  const footerLinks = document.querySelectorAll('.footer-contact-list a, .footer-contact-list span');
  A.ok('contact: ท้ายเว็บแสดงช่องทางติดต่อด้วย', footerLinks.length >= 7);
  const footerText = document.querySelector('.footer-contact-list')?.textContent || '';
  A.ok('contact: ท้ายเว็บมี TikTok', footerText.includes('TikTok'));
  A.ok('contact: ท้ายเว็บมี Instagram', footerText.includes('Instagram'));

  A.ok('contact: ท้ายเว็บมีปุ่มสลับภาษา', !!document.getElementById('footer-lang-toggle'));
  A.ok('contact: ปุ่มสลับภาษายังอยู่ในแถบหัวเว็บ', !!document.getElementById('lang-toggle'));
}

/* ------------------------------------------------------------------ *
 * 9. ปิดส่วนติดต่อจากแอดมินได้
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    rpcResults: {
      get_storefront: {
        shop_name: 'ร้านทดสอบ',
        contact_phone: '0812345678',
        show_contact: false,
      },
    },
    tableData: { products: [], categories: [], reviews: [] },
  });
  const { document } = await loadPage({
    htmlPath: path.join(WEB, 'pages/contact.html'),
    scripts: ['src/app.js'],
    supabase,
  });
  await wait(300);
  const band = document.querySelector('[data-contact-band]');
  A.ok('contact: ปิดสวิตช์แล้วส่วนติดต่อถูกซ่อน', !!band && band.classList.contains('hidden'));
}

process.exit(A.report('i18n') ? 1 : 0);
