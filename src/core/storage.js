export const BUCKETS = {
  productImages: 'product-images',
  storeAssets: 'store-assets',
  paymentSlips: 'payment-slips',
  shippingUpdates: 'shipping-updates',
  avatars: 'avatars',
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

const AVATAR_SIZE = 320;
const AVATAR_QUALITY = 0.82;
const AVATAR_SOURCE_MAX_BYTES = 8 * 1024 * 1024;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('invalid-image'));
    };
    img.src = url;
  });
}

export async function compressAvatar(file) {
  if (!file) throw new Error('no-file');
  if (!AVATAR_TYPES.includes(file.type)) throw new Error('invalid-type');
  if (file.size > AVATAR_SOURCE_MAX_BYTES) throw new Error('too-large');

  let source;
  try {
    source = await loadBitmap(file);
  } catch {
    throw new Error('invalid-image');
  }
  const width = source.width || 0;
  const height = source.height || 0;
  if (!width || !height) throw new Error('invalid-image');

  const side = Math.min(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('compress-failed');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  source.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', AVATAR_QUALITY));
  if (!blob) throw new Error('compress-failed');
  return blob;
}

export async function uploadAvatar(supabase, userId, file) {
  if (!userId) throw new Error('no-user');
  const blob = await compressAvatar(file);
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKETS.avatars)
    .upload(path, blob, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' });
  if (error) throw error;
  return { url: publicAssetUrl(BUCKETS.avatars, path), path, bytes: blob.size };
}

export function avatarPublicUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return publicAssetUrl(BUCKETS.avatars, pathOrUrl);
}

export async function removeAvatar(supabase, pathOrUrl) {
  if (!pathOrUrl) return;
  const marker = `/storage/v1/object/public/${BUCKETS.avatars}/`;
  const path = pathOrUrl.includes(marker) ? pathOrUrl.split(marker)[1] : pathOrUrl;
  if (!path) return;
  try {
    await supabase.storage.from(BUCKETS.avatars).remove([path]);
  } catch (err) {
    console.warn('[ZenMarket] remove avatar failed', err);
  }
}
