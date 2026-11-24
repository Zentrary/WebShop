/**
 * ZenMarket Favorites
 * ใช้ตาราง `favorites` (id, user_id, product_id, created_at) ที่มี RLS แบบ owner-only
 */

import { state } from '/src/app.js';
import { isSignedIn } from '/src/core/audience.js';
import { notify } from '/src/core/ui.js';
import { t } from '/src/core/i18n.js';

const cache = {
  loaded: false,
  ids: new Set(),
};

export function canUseFavorites() {
  return isSignedIn();
}

/**
 * โหลดรายการโปรดของผู้ใช้ปัจจุบัน (พร้อม cache)
 */
export async function loadFavorites({ force = false } = {}) {
  if (!state.supabase) return new Set();
  if (!canUseFavorites()) {
    cache.loaded = true;
    cache.ids = new Set();
    return cache.ids;
  }
  if (cache.loaded && !force) return cache.ids;

  try {
    const { data, error } = await state.supabase
      .from('favorites')
      .select('product_id');
    if (error) throw error;
    cache.ids = new Set((data || []).map(row => row.product_id));
    cache.loaded = true;
  } catch (err) {
    console.warn('[ZenMarket] load favorites failed', err);
    cache.ids = new Set();
  }
  return cache.ids;
}

export function isFavorite(productId) {
  return cache.ids.has(productId);
}

export function favoriteIds() {
  return cache.ids;
}

/**
 * เพิ่ม/ลบสินค้าจากรายการโปรด
 * @returns {Promise<boolean|null>} สถานะใหม่ (true = อยู่ในรายการ) หรือ null เมื่อยังไม่ได้เข้าสู่ระบบ
 */
export async function toggleFavorite(productId) {
  if (!canUseFavorites()) {
    notify(t('toast.login_required'), 'warning');
    return null;
  }
  if (!state.supabase) return null;

  const id = productId;
  try {
    if (cache.ids.has(id)) {
      const { error } = await state.supabase.from('favorites').delete().eq('product_id', id);
      if (error) throw error;
      cache.ids.delete(id);
      notify(t('product.favorite_remove'), 'info');
      return false;
    }

    const { error } = await state.supabase.from('favorites').insert({ product_id: id });
    if (error) {
      // ซ้ำ (unique user_id, product_id) → ถือว่าอยู่ในรายการแล้ว
      if (String(error.message || '').includes('duplicate')) {
        cache.ids.add(id);
        return true;
      }
      throw error;
    }
    cache.ids.add(id);
    notify(t('product.favorite_add'), 'success');
    return true;
  } catch (err) {
    console.error(err);
    notify(t('toast.error_generic'), 'error');
    return null;
  }
}

/**
 * โหลดสินค้าจากรายการโปรด (พร้อมข้อมูลสินค้าปัจจุบัน)
 */
export async function loadFavoriteProducts() {
  const ids = await loadFavorites({ force: true });
  const list = [...ids];
  if (list.length === 0) return [];

  const { data, error } = await state.supabase
    .from('products')
    .select('*')
    .in('id', list);
  if (error) throw error;

  // เรียงตามลำดับที่ผู้ใช้กดบันทึก
  const map = new Map((data || []).map(p => [p.id, p]));
  return list.map(id => map.get(id)).filter(Boolean);
}

export function resetFavoritesCache() {
  cache.loaded = false;
  cache.ids = new Set();
}
