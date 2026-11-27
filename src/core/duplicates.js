/**
 * ตรวจสินค้าซ้ำก่อนบันทึก
 *
 * ตรวจสามทางตามที่ร้านต้องการ:
 *  1) รหัสสินค้า (SKU) ซ้ำ — อันนี้บล็อกเลย เพราะฐานข้อมูลมี UNIQUE อยู่แล้ว
 *  2) ชื่อซ้ำ (เทียบแบบไม่สนตัวพิมพ์/ช่องว่างเกิน) หรือชื่อคล้ายกันมาก
 *  3) รูปซ้ำ — เทียบลายนิ้วมือรูป (dHash) ว่าต่างกันไม่เกินเกณฑ์
 *
 * การเทียบทำในหน่วยความจำจากรายการสินค้าที่โหลดมาครั้งเดียว
 * (ร้านขนาดเล็ก-กลางหลักสิบถึงหลักพันรายการยังเร็วและไม่ยิง query ถี่)
 */
import { hashDistance, hashSimilarity, SAME_IMAGE_DISTANCE } from '/src/core/image.js';

/** ชื่อที่ใช้เทียบ: ตัดช่องว่างหัวท้าย ยุบช่องว่างซ้ำ และไม่สนตัวพิมพ์ */
export function normalizeName(value) {
  return String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSku(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/** Dice coefficient ของชุด bigram — ใช้วัดว่าชื่อ "คล้ายกันมาก" หรือไม่ */
export function nameSimilarity(a, b) {
  const x = normalizeName(a).replace(/\s/g, '');
  const y = normalizeName(b).replace(/\s/g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 4 || y.length < 4) return 0;
  const bigrams = (s) => {
    const map = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      map.set(g, (map.get(g) || 0) + 1);
    }
    return map;
  };
  const A = bigrams(x);
  const B = bigrams(y);
  let hit = 0;
  A.forEach((count, gram) => {
    const other = B.get(gram);
    if (other) hit += Math.min(count, other);
  });
  return (2 * hit) / (x.length - 1 + (y.length - 1));
}

/**
 * ชื่อที่ถือว่า "คล้ายกัน" — ใช้เป็นคำใบ้เท่านั้น ไม่นับเป็นสินค้าซ้ำ
 * (สินค้าตระกูลเดียวกัน เช่น "รุ่น A1" กับ "รุ่น A2" ต้องเพิ่มได้ตามปกติ)
 */
export const SIMILAR_NAME_SCORE = 0.88;

/** แปลงแถวจากฐานข้อมูลให้อยู่ในรูปที่เทียบง่าย */
export function normalizeIndex(rows = []) {
  return rows
    .filter((row) => row && row.id)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name || ''),
      nameKey: normalizeName(row.name),
      sku: String(row.sku || ''),
      skuKey: normalizeSku(row.sku),
      imageUrl: String(row.image_url || ''),
      imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [],
      hashes: Array.isArray(row.image_hashes) ? row.image_hashes.filter(Boolean) : [],
      active: row.active !== false,
    }));
}

/** โหลดรายการสินค้าที่จำเป็นสำหรับการตรวจซ้ำ */
export async function loadProductIndex(supabase) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, image_url, image_urls, image_hashes, active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return normalizeIndex(data || []);
}

/** หา best match ของ hash หนึ่งกับรายการสินค้า (คืน null ถ้าไม่มีใครใกล้พอ) */
export function bestImageMatch(index, hash, excludeId = '') {
  if (!hash) return null;
  let best = null;
  index.forEach((product) => {
    if (excludeId && product.id === excludeId) return;
    product.hashes.forEach((candidate) => {
      const distance = hashDistance(hash, candidate);
      if (!Number.isFinite(distance) || distance > SAME_IMAGE_DISTANCE) return;
      if (!best || distance < best.distance) {
        best = { product, distance, score: hashSimilarity(distance), hash: candidate };
      }
    });
  });
  return best;
}

/**
 * ตรวจทั้งสามทาง
 * @returns {{
 *   sku: object|null,
 *   names: Array<{product:object, score:number, exact:boolean}>,
 *   images: Array<{product:object, score:number, distance:number}>,
 *   hasIssue: boolean,
 *   blocking: boolean
 * }}
 */
export function detectDuplicates(index, { name = '', sku = '', hashes = [], excludeId = '' } = {}) {
  const nameKey = normalizeName(name);
  const skuKey = normalizeSku(sku);
  const list = index.filter((product) => !excludeId || product.id !== excludeId);

  const skuMatch = skuKey ? list.find((product) => product.skuKey && product.skuKey === skuKey) || null : null;

  // ชื่อซ้ำแบบตรงตัว (ไม่สนตัวพิมพ์/ช่องว่าง) = สินค้าซ้ำจริง
  const names = [];
  // ชื่อคล้ายกันมาก = แค่คำใบ้ ไม่บล็อก ไม่นับเป็นสินค้าซ้ำ
  const similar = [];
  if (nameKey) {
    list.forEach((product) => {
      if (!product.nameKey) return;
      if (product.nameKey === nameKey) {
        names.push({ product, score: 1, exact: true });
        return;
      }
      const score = nameSimilarity(product.name, name);
      if (score >= SIMILAR_NAME_SCORE) similar.push({ product, score, exact: false });
    });
    similar.sort((a, b) => b.score - a.score);
  }

  // รวม hash ของทุกรูปที่กำลังจะบันทึก แล้วหาคู่ที่ใกล้ที่สุดต่อสินค้าหนึ่งรายการ
  const byProduct = new Map();
  (hashes || []).filter(Boolean).forEach((hash) => {
    const match = bestImageMatch(list, hash, '');
    if (!match) return;
    const current = byProduct.get(match.product.id);
    if (!current || match.distance < current.distance) byProduct.set(match.product.id, match);
  });
  const images = [...byProduct.values()]
    .map((match) => ({ product: match.product, score: match.score, distance: match.distance }))
    .sort((a, b) => a.distance - b.distance);

  return {
    sku: skuMatch,
    names: names.slice(0, 5),
    similar: similar.slice(0, 3),
    images: images.slice(0, 5),
    hasIssue: Boolean(skuMatch) || names.length > 0 || images.length > 0,
    blocking: Boolean(skuMatch),
  };
}
