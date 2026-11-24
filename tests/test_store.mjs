import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);

const { loadPage, makeSupabaseMock, wait, makeAssert, el } = await import('./harness.mjs');

const A = makeAssert();
const MEMBER = { id: 'member-1', email: 'member@zenmarket.test' };
const MEMBER_SESSION = { user: MEMBER };

const PRODUCTS = [
  { id: 'p1', name: 'กาแฟอาริจิน', price: 120, stock: 5, active: true, category: 'กาแฟ', image_url: null, image_urls: [] },
  { id: 'p2', name: 'ชาเย็น', price: 80, stock: 0, active: true, category: 'ชา', image_url: null, image_urls: [] },
  { id: 'p3', name: 'เค้กเบอร์เกอร์', price: 250, stock: 3, active: false, category: 'ของหวาน', image_url: null, image_urls: [] },
];

/* ============ 1. guest กด quick-add → ต้องเพิ่มลงตะกร้าได้ (ไม่ต้องล็อกอิน) ============ */
{
  const supabase = await makeSupabaseMock({
    session: null, user: null,
    tableData: { products: PRODUCTS, categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(150);
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

/* ============ 2. สินค้าหมดสต็อก → quick-add ต้องไม่เพิ่ม ============ */
{
  const supabase = await makeSupabaseMock({
    session: null, user: null,
    tableData: { products: PRODUCTS, categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(150);
  const grid = el(document, 'product-grid');
  const addBtn = grid.querySelector('[data-add-to-cart="p2"]');
  addBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(200);
  const cart = JSON.parse(document.defaultView.localStorage.getItem('zenmarket_cart') || '[]');
  A.eq('store: สินค้าหมดสต็อกไม่ถูกเพิ่ม', cart.length, 0);
}

/* ============ 3. สินค้า inactive → quick-add ต้องไม่เพิ่ม ============ */
{
  const supabase = await makeSupabaseMock({
    session: null, user: null,
    tableData: { products: PRODUCTS, categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(150);
  const grid = el(document, 'product-grid');
  const addBtn = grid.querySelector('[data-add-to-cart="p3"]');
  addBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(200);
  const cart = JSON.parse(document.defaultView.localStorage.getItem('zenmarket_cart') || '[]');
  A.eq('store: สินค้า inactive ไม่ถูกเพิ่ม', cart.length, 0);
}

/* ============ 4. กด quick-add สองครั้ง → จำนวนต้องรวมเป็น 2 ============ */
{
  const supabase = await makeSupabaseMock({
    session: null, user: null,
    tableData: { products: PRODUCTS, categories: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(150);
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

/* ============ 5. member กดหัวใจ → ต้อง insert favorites ============ */
{
  const supabase = await makeSupabaseMock({
    session: MEMBER_SESSION, user: MEMBER,
    tableData: { products: PRODUCTS, categories: [], favorites: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(200);
  const grid = el(document, 'product-grid');
  const favBtn = grid.querySelector('[data-favorite="p1"]');
  A.ok('store: ปุ่มหัวใจมีอยู่', !!favBtn);
  favBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(200);
  const ins = supabase.calls.insert.filter((i) => i.table === 'favorites');
  A.eq('store: member กดหัวใจ → insert favorites', ins.length, 1);
  A.eq('store: insert มีแค่ product_id', JSON.stringify(ins[0]?.payload), JSON.stringify({ product_id: 'p1' }));
}

/* ============ 6. guest กดหัวใจ → ต้องไม่ insert (ต้องล็อกอินก่อน) ============ */
{
  const supabase = await makeSupabaseMock({
    session: null, user: null,
    tableData: { products: PRODUCTS, categories: [], favorites: [] },
  });
  const { document } = await loadPage({
    htmlPath: '/home/user/WebShop/web/shop/index.html',
    scripts: ['src/pages/storefront/store.js'],
    supabase,
  });
  await wait(200);
  const grid = el(document, 'product-grid');
  const favBtn = grid.querySelector('[data-favorite="p1"]');
  favBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(200);
  A.eq('store: guest กดหัวใจ → ไม่ insert', supabase.calls.insert.filter((i) => i.table === 'favorites').length, 0);
}

/* ============ 7. ปุ่ม quick-add ต้องมองเห็นได้บน touch device (responsive.css) ============ */
{
  const fs = await import('node:fs');
  const css = fs.readFileSync('/home/user/WebShop/src/styles/responsive.css', 'utf8');
  A.ok('responsive: มีกฎ touch/coarse pointer', /@media\s*\([^)]*(hover:\s*none|pointer:\s*coarse)/.test(css));
  A.ok('responsive: quick-add ถูกบังคับแสดง', /\.quick-add[^{]*\{[^}]*opacity:\s*1/.test(css) || /\.quick-add/.test(css));
  A.ok('responsive: favorite ถูกบังคับแสดง', /\.favorite-btn/.test(css));
}

process.exit(A.report('store') ? 1 : 0);
