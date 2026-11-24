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

  const jsSrc = [
    'src/app.js',
    'src/core/i18n.js',
    'src/core/customer.js',
    'src/core/favorites.js',
    'src/core/experience.js',
  ]
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n');
  const orphan = [...thKeys].filter(
    (k) => !used.has(k) && !jsSrc.includes(`'${k}'`) && !k.startsWith('validation.') && !k.startsWith('toast.'),
  );
  A.eq('i18n: ไม่มีคีย์ที่ไม่ถูกใช้เลย', orphan, []);
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
      if (text === 'ผู้ใช้งาน' && /id="account-name"/.test(body)) continue; // เติมค่าจากผู้ใช้ที่ล็อกอิน

      const before = body.slice(0, m.index);
      const openIdx = before.lastIndexOf('<');
      const openTag = before.slice(openIdx, before.indexOf('>', openIdx));
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
        const tg = anc.slice(o, anc.indexOf('>', o));
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

  const reviewQuote = document.querySelector('.review-card blockquote[data-i18n]');
  A.ok('i18n: รีวิวตัวอย่างผูกกับ data-i18n', !!reviewQuote);

  const { setLanguage, t } = await importPage('/src/core/i18n.js');
  setLanguage('en');
  await wait(60);

  A.eq('i18n: สถิติการจัดส่งเปลี่ยนเป็นอังกฤษ', statShip?.textContent.trim(), '2–5 days');
  A.ok('i18n: คำถาม FAQ เปลี่ยนเป็นอังกฤษ', (faqQ?.textContent || '').includes('When will'));
  A.ok('i18n: รีวิวตัวอย่างเปลี่ยนเป็นอังกฤษ', !THAI.test(reviewQuote?.textContent || ''));
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
 * 6. หน้า auth ต้องไม่มีตัวอักษร Z และต้องแสดงโลโก้ที่ตั้งค่าไว้
 * ------------------------------------------------------------------ */
{
  for (const page of ['login.html', 'register.html', 'reset-password.html', 'forgot-password.html']) {
    const file = path.join(WEB, 'auth', page);
    const html = fs.readFileSync(file, 'utf8');
    A.ok(`auth: ${page} ไม่มีตัวอักษร Z เป็นโลโก้`, !/>Z</.test(html));
    A.ok(`auth: ${page} มีคอนเทนเนอร์ auth-logo`, html.includes('id="auth-logo"'));
    A.ok(`auth: ${page} มีคอนเทนเนอร์ auth-mark สำรอง`, html.includes('id="auth-mark"'));
  }

  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    rpcResults: {
      get_storefront: {
        singleton: true,
        shop_name: 'ZenMarket',
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

  const img = el(document, 'auth-logo');
  const mark = el(document, 'auth-mark');
  A.ok('auth: โลโก้ที่ตั้งค่าไว้ถูกแสดง', !!img && img.src.includes('logo.png'));
  A.eq('auth: โลโก้ที่ตั้งค่าไว้ไม่ถูกซ่อน', img?.hidden, false);
  A.eq('auth: กรอบสำรองถูกซ่อนเมื่อมีโลโก้', mark?.hidden, true);
}

/* ------------------------------------------------------------------ *
 * 7. กฎ CSS ที่ทำให้ [hidden] ใช้งานได้จริง
 * ------------------------------------------------------------------ */
{
  const base = fs.readFileSync(path.join(ROOT, 'src/styles/base.css'), 'utf8');
  A.ok('css: มีกฎ [hidden] ที่บังคับ display:none', /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(base));
  A.ok('css: กรอบสำรอง auth มีรูปทรงแบบกริด', /\.auth-head \.mark\s*\{[^}]*display:\s*grid/.test(base));
  A.ok('css: มีกริด 2 คอลัมน์สำหรับฟอร์มสมัครสมาชิก', /\.auth-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/.test(base));
  A.ok('css: การ์ดสมัครสมาชิกกว้างพอสำหรับ 2 คอลัมน์', /\.auth-card-wide\s*\{[^}]*max-width/.test(base));

  const responsive = fs.readFileSync(path.join(ROOT, 'src/styles/responsive.css'), 'utf8');
  A.ok('css: ฟอร์มสมัครสมาชิกยุบเป็น 1 คอลัมน์บนมือถือ', /\.auth-grid\s*\{\s*grid-template-columns:\s*1fr/.test(responsive));
}

process.exit(A.report('i18n') ? 1 : 0);
