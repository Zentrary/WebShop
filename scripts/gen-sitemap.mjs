import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://webshop-tau-ebon.vercel.app').replace(
  /\/$/,
  '',
);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const STATIC_ROUTES = [
  { path: '/home', priority: '1.0' },
  { path: '/shop', priority: '0.9' },
  { path: '/pages/about', priority: '0.5' },
  { path: '/pages/help', priority: '0.5' },
  { path: '/pages/contact', priority: '0.5' },
  { path: '/pages/privacy', priority: '0.3' },
];

const escapeXml = (value) =>
  String(value).replace(
    /[<>&'"]/g,
    (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch],
  );

async function fetchProducts() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,created_at&active=eq.true`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[sitemap] ข้ามรายการสินค้า: ${err.message}`);
    return [];
  }
}

const products = await fetchProducts();
const today = new Date().toISOString().slice(0, 10);

const entries = [
  ...STATIC_ROUTES.map(
    (route) => `  <url>
    <loc>${SITE}${route.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
  ),
  ...products.map(
    (product) => `  <url>
    <loc>${SITE}/shop/product?id=${escapeXml(product.id)}</loc>
    <lastmod>${(product.created_at || '').slice(0, 10) || today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
  ),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

const target = path.resolve('public/sitemap.xml');
await fs.writeFile(target, xml, 'utf8');
console.log(`[sitemap] ${entries.length} URLs → public/sitemap.xml`);
