export const BUCKETS = {
  productImages: 'product-images',
  storeAssets: 'store-assets',
  paymentSlips: 'payment-slips',
  shippingUpdates: 'shipping-updates',
};

const MAX_LOGO_BYTES = 1024 * 1024;

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function publicAssetUrl(bucket, path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.VITE_SUPABASE_URL || '';
  if (!base) return path;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path}`;
}

function sanitizeFileName(name) {
  return String(name || 'file')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(-80);
}

export async function uploadStoreLogo(supabase, file) {
  if (!file) throw new Error('no-file');
  if (!LOGO_TYPES.includes(file.type)) {
    throw new Error('invalid-type');
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error('too-large');
  }

  const path = `logo/${Date.now()}_${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKETS.storeAssets)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) throw error;

  return { url: publicAssetUrl(BUCKETS.storeAssets, path), path };
}

export async function removeStoreLogo(supabase, url) {
  if (!url) return;
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const marker = `/storage/v1/object/public/${BUCKETS.storeAssets}/`;
  if (!url.includes(marker)) return;
  const path = url.split(marker)[1];
  if (!path) return;
  try {
    await supabase.storage.from(BUCKETS.storeAssets).remove([path]);
  } catch (err) {
    console.warn('[ZenMarket] remove logo failed', err);
  }
}

export async function uploadProductImage(supabase, file) {
  if (!file) throw new Error('no-file');
  if (!file.type.startsWith('image/')) throw new Error('invalid-type');
  if (file.size > 5 * 1024 * 1024) throw new Error('too-large');

  const path = `${Date.now()}_${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKETS.productImages)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) throw error;

  return { url: publicAssetUrl(BUCKETS.productImages, path), path };
}

export async function uploadShippingImage(supabase, orderId, file) {
  if (!file) throw new Error('no-file');
  if (!file.type.startsWith('image/')) throw new Error('invalid-type');
  if (file.size > 5 * 1024 * 1024) throw new Error('too-large');

  const extMap = { 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
  const ext = extMap[file.type];
  if (!ext) throw new Error('invalid-type');

  const uuid =
    (crypto.randomUUID && crypto.randomUUID()) ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

  const path = `${orderId}/${uuid}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKETS.shippingUpdates)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) throw error;

  return { path, bucket: BUCKETS.shippingUpdates };
}

export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';
export { MAX_LOGO_BYTES, LOGO_TYPES };
