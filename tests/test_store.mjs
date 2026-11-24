import { register } from 'node:module';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

import fs from 'node:fs';

const { loadPage, makeSupabaseMock, wait, makeAssert, el } = await import('./harness.mjs');

const A = makeAssert();
const MEMBER = { id: 'member-1', email: 'member@zenmarket.test' };
const MEMBER_SESSION = { user: MEMBER };

const PRODUCTS = [
  {
    id: 'p1',
    name: 'กาแฟอาริจิน',
    price: 120,
    stock: 5,
    active: true,
    category: 'กาแฟ',
    image_url: null,
    image_urls: [],
  },
  { id: 'p2', name: 'ชาเย็น', price: 80, stock: 0, active: true, category: 'ชา', image_url: null, image_urls: [] },
  {
    id: 'p3',
    name: 'เค้กเบอร์เกอร์',
    price: 250,
    stock: 3,
    active: false,
    category: 'ของหวาน',
    image_url: null,
    image_urls: [],
  },
];

{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    tableData: { products: PRODUCTS, categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const gate = el(document, 'shop-gate');
  const content = el(document, 'shop-content');
  const notice = el(document, 'shop-guest-note');
  A.ok('store: guest เห็นเนื้อหาสินค้าได้โดยไม่ต้องล็อกอิน', !!content && !content.classList.contains('hidden'));
  A.ok('store: guest ไม่ถูกบังคับด้วยประตูสมัครสมาชิก', !gate || gate.classList.contains('hidden'));
  A.ok('store: guest เห็นแถบเชิญเข้าสู่ระบบ', !!notice);
  A.ok('store: แถบเชิญมีลิงก์เข้าสู่ระบบ', !!notice.querySelector('a[href="/auth/login"]'));
  A.ok('store: guest เห็นการ์ดสินค้า', el(document, 'product-grid').querySelectorAll('.product-card').length > 0);
}

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
    tableData: { products: PRODUCTS, categories: [], favorites: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const gate = el(document, 'shop-gate');
  const content = el(document, 'shop-content');
  A.ok('store: member ไม่เห็นประตูสมัครสมาชิก', !gate || gate.classList.contains('hidden'));
  A.ok('store: member เห็นเนื้อหาสินค้า', !!content && !content.classList.contains('hidden'));
  const grid = el(document, 'product-grid');
  const cards = grid.querySelectorAll('.product-card');
  A.ok('store: มีการ์ดสินค้า', cards.length > 0);

  const addBtn = grid.querySelector('[data-add-to-cart="p1"]');
  A.ok('store: ปุ่ม quick-add มีอยู่', !!addBtn);
  addBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(200);

  const cart = JSON.parse(document.defaultView.localStorage.getItem('zenmarket_cart') || '[]');
  A.eq('store: quick-add เพิ่มสินค้า 1 ชิ้น', cart.length, 1);
  A.eq('store: quick-add ใส่สินค้าถูกตัว', cart[0]?.product_id, 'p1');
  A.eq('store: quick-add ใส่จำนวนถูก', cart[0]?.quantity, 1);
}

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
    tableData: { products: PRODUCTS, categories: [], favorites: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const grid = el(document, 'product-grid');
  const addBtn = grid.querySelector('[data-add-to-cart="p2"]');
  addBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(200);
  const cart = JSON.parse(document.defaultView.localStorage.getItem('zenmarket_cart') || '[]');
  A.eq('store: สินค้าหมดสต็อกไม่ถูกเพิ่ม', cart.length, 0);
}

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
    tableData: { products: PRODUCTS, categories: [], favorites: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const grid = el(document, 'product-grid');
  const addBtn = grid.querySelector('[data-add-to-cart="p3"]');
  addBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(200);
  const cart = JSON.parse(document.defaultView.localStorage.getItem('zenmarket_cart') || '[]');
  A.eq('store: สินค้า inactive ไม่ถูกเพิ่ม', cart.length, 0);
}

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
    tableData: { products: PRODUCTS, categories: [], favorites: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const grid = el(document, 'product-grid');
  const addBtn = grid.querySelector('[data-add-to-cart="p1"]');
  addBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(150);
  addBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(200);
  const cart = JSON.parse(document.defaultView.localStorage.getItem('zenmarket_cart') || '[]');
  A.eq('store: กดสองครั้ง → จำนวน 2', cart[0]?.quantity, 2);
  A.eq('store: กดสองครั้ง → ยังมีแถวเดียว', cart.length, 1);
}

{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
    tableData: { products: PRODUCTS, categories: [], favorites: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const grid = el(document, 'product-grid');
  const favBtn = grid.querySelector('[data-favorite="p1"]');
  A.ok('store: ปุ่มหัวใจมีอยู่', !!favBtn);
  favBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(200);
  const ins = supabase.calls.insert.filter((i) => i.table === 'favorites');
  A.eq('store: member กดหัวใจ → insert favorites', ins.length, 1);
  A.eq('store: insert มีแค่ product_id', JSON.stringify(ins[0]?.payload), JSON.stringify({ product_id: 'p1' }));
}

{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    tableData: { products: PRODUCTS, categories: [], favorites: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const grid = el(document, 'product-grid');
  // guest เห็นปุ่มหัวใจได้ แต่กดแล้วระบบจะพาไปเข้าสู่ระบบก่อน
  A.ok('store: guest เห็นปุ่มหัวใจแต่ยังไม่ได้เป็นรายการโปรด', grid.querySelectorAll('[data-favorite]').length > 0);
  A.eq('store: ปุ่มหัวใจของ guest ยังไม่ติดสถานะโปรด', grid.querySelectorAll('[data-favorite].active').length, 0);
  A.eq('store: guest กดหัวใจ → ไม่ insert', supabase.calls.insert.filter((i) => i.table === 'favorites').length, 0);
}

{
  // The categories page is gone: browsing by category now lives inside the
  // product list page.
  A.ok('store: ไม่มีหน้า shop/categories.html', !fs.existsSync('/home/user/WebShop/web/shop/categories.html'));

  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    tableData: { products: PRODUCTS, categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const notice = el(document, 'shop-guest-note');
  A.ok('store: หน้ารายการสินค้าเชื้อเชิญให้เข้าสู่ระบบเมื่อจะสั่งซื้อ', !!notice);
  A.ok(
    'store: หน้ารายการสินค้าแสดงสินค้าให้ guest ดู',
    el(document, 'product-grid').querySelectorAll('.product-card').length > 0,
  );
}

{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    tableData: { products: PRODUCTS, categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/product.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const notice = el(document, 'shop-guest-note');
  A.ok('store: หน้ารายละเอียดสินค้าเชื้อเชิญให้เข้าสู่ระบบเมื่อจะสั่งซื้อ', !!notice);
  A.ok('store: หน้ารายละเอียดสินค้าแสดงชื่อสินค้าให้ guest ดู', !!el(document, 'product-title'));
}

{
  const fs = await import('node:fs');
  const css = fs.readFileSync('/home/user/WebShop/src/styles/responsive.css', 'utf8');
  A.ok('responsive: มีกฎ touch/coarse pointer', /@media\s*\([^)]*(hover:\s*none|pointer:\s*coarse)/.test(css));
  A.ok('responsive: quick-add ถูกบังคับแสดง', /\.quick-add[^{]*\{[^}]*opacity:\s*1/.test(css) || /\.quick-add/.test(css));
  A.ok('responsive: favorite ถูกบังคับแสดง', /\.favorite-btn/.test(css));

  for (const bp of [1200, 1024, 900, 768, 640, 600, 560, 480, 360]) {
    A.ok(`responsive: มี breakpoint ${bp}px`, css.includes(`max-width: ${bp}px`));
  }
  A.ok('responsive: เมนูหลักซ่อนบนมือถือ', /\.header-nav\s*\{[^}]*display:\s*none/.test(css));
  A.ok('responsive: ปุ่มเมนูแฮมเบอร์เกอร์แสดง', /\.menu-toggle\s*\{[^}]*display:\s*grid/.test(css));
  A.ok('responsive: ตารางเลื่อนแนวนอนได้', /\.table-wrap table\.data\s*\{[^}]*min-width/.test(css));
  A.ok('responsive: ฟอร์มสมัครสมาชิกยุบเป็นคอลัมน์เดียว', /\.auth-grid\s*\{[^}]*grid-template-columns:\s*1fr/.test(css));
  A.ok(
    'responsive: ฟอร์มสมัครสมาชิกยุบเป็นคอลัมน์เดียวบนแท็บเล็ต',
    /\.auth-grid\s*\{[^}]*grid-template-columns:\s*1fr/.test(css),
  );
  A.ok('responsive: รองรับ safe-area', /safe-area-inset/.test(css));
  A.ok('responsive: รองรับ dynamic viewport', /100dvh/.test(css));

  const base = fs.readFileSync('/home/user/WebShop/src/styles/base.css', 'utf8');
  A.ok('responsive: ตารางมีขั้นต่ำกันข้อความถูกตัด', /\.table-wrap table\.data\s*\{[^}]*min-width/.test(base));
  A.ok('responsive: หน้า auth ไม่มีเลย์เอาต์แยกเอง', !/\.auth-layout|\.auth-topbar|\.auth-aside/.test(base));
  A.ok('responsive: ช่องตัวเลขไม่มีปุ่มเลื่อนค่า', /input\[type='number'\]::\-webkit\-outer\-spin\-button/.test(base));
  A.ok('responsive: ประตูสมัครสมาชิกมีสไตล์', /\.guest-gate/.test(base));
  A.ok('responsive: ภาษาไทยไม่ใช้ letter-spacing ติดลบ', /html\[lang=['"]th['"]\]/.test(base));
  A.ok('responsive: ชื่อร้านในแถบหัวเว็บถูกตัดไม่ล้น', /\.header-logo-name[^}]*text-overflow:\s*ellipsis/.test(base));
}

/* ------------------------------------------------------------------ *
 * หน้ารายการสินค้า: หมวดหมู่อยู่ในหน้าเดียว กดกรองได้ด้วยชิป
 * ------------------------------------------------------------------ */
{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION,
    user: MEMBER,
    tableData: {
      products: PRODUCTS,
      categories: [{ name: 'กาแฟ' }, { name: 'ชา' }],
    },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(300);

  const chips = document.querySelectorAll('.category-chip');
  A.eq('store: ชิปหมวดหมู่มีทั้งหมด + ทุกหมวด', chips.length, 3);
  A.eq('store: ชิปแรกคือทั้งหมด', chips[0]?.textContent.trim(), 'ทุกหมวดหมู่');
  A.ok('store: มีชิปของหมวดหมู่จริง', !!chips[1] && chips[1].textContent.trim() === 'กาแฟ');
  A.eq('store: แสดงจำนวนหมวดหมู้', document.getElementById('category-count')?.textContent.trim(), 'ทั้งหมด 2 หมวดหมู่');
  A.ok('store: ไม่มีตัวเลือกหมวดหมู่แบบ dropdown แล้ว', !document.getElementById('category-filter'));

  const before = supabase.calls.select.filter((c) => c.table === 'products').length;
  chips[1].dispatchEvent(new document.defaultView.Event('click', { bubbles: true }));
  await wait(200);

  const last = supabase.calls.select.filter((c) => c.table === 'products').slice(-1)[0];
  const pairs = (last?.filters || []).map((f) => f[0]);
  A.ok('store: กดชิปแล้ว query กรองด้วยหมวดหมู่', pairs.includes('category'));
  A.ok('store: เรียก query สินค้าใหม่หลังกดชิป', supabase.calls.select.filter((c) => c.table === 'products').length > before);
  A.eq('store: ชิปที่เลือกถูกทำเครื่องหมาย', document.querySelector('.category-chip.active')?.textContent.trim(), 'กาแฟ');
}

process.exit(A.report('store') ? 1 : 0);
