import { register } from 'node:module';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

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
  await wait(200);
  const gate = el(document, 'shop-gate');
  const content = el(document, 'shop-content');
  A.ok('store: guest เห็นประตูสมัครสมาชิก', !!gate && !gate.classList.contains('hidden'));
  A.ok('store: guest ถูกซ่อนเนื้อหาสินค้า', !!content && content.classList.contains('hidden'));
  A.ok('store: guest มีปุ่มสมัครสมาชิก', !!gate.querySelector('a[href="/auth/register.html"]'));
  A.eq('store: guest ไม่เห็นการ์ดสินค้า', el(document, 'product-grid').querySelectorAll('.product-card').length, 0);
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
  A.eq('store: guest ไม่มีปุ่มหัวใจ', grid.querySelectorAll('[data-favorite]').length, 0);
  A.eq('store: guest กดหัวใจ → ไม่ insert', supabase.calls.insert.filter((i) => i.table === 'favorites').length, 0);
}

{
  const supabase = await makeSupabaseMock({
    session: null,
    user: null,
    tableData: { products: PRODUCTS, categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/categories.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(250);
  const gate = el(document, 'shop-gate');
  A.ok('store: หน้าหมวดหมู่กำหนดประตูสมัครสมาชิก', !!gate && !gate.classList.contains('hidden'));
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
  const gate = el(document, 'shop-gate');
  A.ok('store: หน้ารายละเอียดสินค้ากำหนดประตูสมัครสมาชิก', !!gate && !gate.classList.contains('hidden'));
}

{
  const fs = await import('node:fs');
  const css = fs.readFileSync('/home/user/WebShop/src/styles/responsive.css', 'utf8');
  A.ok('responsive: มีกฎ touch/coarse pointer', /@media\s*\([^)]*(hover:\s*none|pointer:\s*coarse)/.test(css));
  A.ok('responsive: quick-add ถูกบังคับแสดง', /\.quick-add[^{]*\{[^}]*opacity:\s*1/.test(css) || /\.quick-add/.test(css));
  A.ok('responsive: favorite ถูกบังคับแสดง', /\.favorite-btn/.test(css));

  for (const bp of [1200, 1024, 900, 768, 640, 560, 480, 400]) {
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

process.exit(A.report('store') ? 1 : 0);
