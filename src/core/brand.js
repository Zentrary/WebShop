import { safeImage } from '/src/core/lib.js';

function upsertMeta(selector, attr, key, content) {
  if (typeof document === 'undefined' || !content) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function applyPageMeta({ title, description, image, type, url } = {}) {
  if (typeof document === 'undefined') return;
  const pageUrl = url || window.location.href;
  const absolute = (value) => {
    try {
      return new URL(value, window.location.origin).href;
    } catch {
      return value;
    }
  };

  if (title) {
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  }
  if (description) {
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  }
  if (image) {
    const img = absolute(image);
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', img);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', img);
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  }
  if (type) upsertMeta('meta[property="og:type"]', 'property', 'og:type', type);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', pageUrl);
  upsertLink('canonical', pageUrl);
}

function upsertLink(rel, href, type) {
  if (typeof document === 'undefined' || !href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  if (type) el.setAttribute('type', type);
}

export function applyBrandAssets(settings = {}) {
  if (typeof document === 'undefined') return;

  const shopName = settings.shop_name || 'ZenMarket';
  const rawLogo = settings.logo_url && !settings.logo_url.includes('placeholder') ? settings.logo_url : '';
  const logo = safeImage(rawLogo);
  const description = settings.tagline || settings.about_text || '';

  if (logo) {
    upsertLink('icon', logo, 'image/png');
    upsertLink('apple-touch-icon', logo, 'image/png');
  }

  const url = window.location.origin + window.location.pathname;
  if (!document.head.querySelector('meta[name="description"]') && description) {
    upsertMeta('meta[name="description"]', 'name', 'description', description);
  }
  upsertLink('canonical', url);
  upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', shopName);
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', document.title || shopName);
  upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);
  if (description) upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
  if (logo) upsertMeta('meta[property="og:image"]', 'property', 'og:image', logo);

  upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', logo ? 'summary_large_image' : 'summary');
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', document.title || shopName);
  if (description) upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  if (logo) upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', logo);
}
