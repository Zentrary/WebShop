import { state } from '/src/core/state.js';
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

export async function loadFavorites({ force = false } = {}) {
  if (!state.supabase) return new Set();
  if (!canUseFavorites()) {
    cache.loaded = true;
    cache.ids = new Set();
    return cache.ids;
  }
  if (cache.loaded && !force) return cache.ids;

  try {
    const { data, error } = await state.supabase.from('favorites').select('product_id');
    if (error) throw error;
    cache.ids = new Set((data || []).map((row) => row.product_id));
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

export async function loadFavoriteProducts() {
  const ids = await loadFavorites({ force: true });
  const list = [...ids];
  if (list.length === 0) return [];

  const { data, error } = await state.supabase.from('products').select('*').in('id', list);
  if (error) throw error;

  const map = new Map((data || []).map((p) => [p.id, p]));
  return list.map((id) => map.get(id)).filter(Boolean);
}

export function resetFavoritesCache() {
  cache.loaded = false;
  cache.ids = new Set();
}
