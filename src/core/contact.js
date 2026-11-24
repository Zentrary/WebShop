import { safeLink } from '/src/core/lib.js';
import { t } from '/src/core/i18n.js';

/**
 * Every channel the shop can talk to the customer on.
 * The list is derived from the store settings, so an admin can add, change
 * or clear a channel and both the home page and the footer follow along.
 */
const CHANNEL_ICONS = {
  line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>',
  tiktok:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v9.5a3.5 3.5 0 1 1-3-3.46"/><path d="M14 6.2A4.8 4.8 0 0 0 18.8 9"/></svg>',
  email:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.26-1.26a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.9z"/></svg>',
  address:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
};

export const CHANNEL_ICON = CHANNEL_ICONS;

/**
 * Turns a channel URL into a short handle the customer recognises
 * (`@shop` for TikTok/Instagram, `/shop` for the rest). It is used as the
 * second line of a channel card, so the card never repeats its own title.
 */
export function channelHandle(url) {
  const href = safeLink(url);
  if (!href) return '';
  try {
    const parsed = new URL(href);
    const segments = parsed.pathname.split('/').filter(Boolean);
    let last = segments[segments.length - 1] || '';
    if (!last || last.includes('.') || last.includes('?')) {
      last = parsed.hostname.replace(/^www\./, '');
    }
    return `@${last.replace(/^@/, '')}`;
  } catch {
    return '';
  }
}

/** Social channels that are actually configured, in a stable order. */
export function socialChannels(settings = {}) {
  const channels = [];

  const add = (key, labelKey, url) => {
    const href = safeLink(url);
    if (!href) return;
    channels.push({
      key,
      label: t(labelKey),
      href,
      value: channelHandle(url),
      icon: CHANNEL_ICONS[key] || '',
    });
  };

  add('line', 'common.line', settings.line_url);
  add('facebook', 'common.facebook', settings.facebook_url);
  add('instagram', 'common.instagram', settings.instagram_url);
  add('tiktok', 'common.tiktok', settings.tiktok_url);

  return channels;
}

/** Phone / e-mail / address that the customer can reach the shop on. */
export function contactDetails(settings = {}) {
  const details = [];

  if (settings.contact_phone) {
    details.push({
      key: 'phone',
      label: t('common.phone'),
      value: settings.contact_phone,
      href: safeLink(`tel:${settings.contact_phone}`),
      icon: CHANNEL_ICONS.phone,
    });
  }

  if (settings.contact_email) {
    details.push({
      key: 'email',
      label: t('common.email'),
      value: settings.contact_email,
      href: safeLink(`mailto:${settings.contact_email}`),
      icon: CHANNEL_ICONS.email,
    });
  }

  if (settings.contact_address) {
    details.push({
      key: 'address',
      label: t('common.address'),
      value: settings.contact_address,
      href: '',
      icon: CHANNEL_ICONS.address,
    });
  }

  return details;
}

/** True when the shop has anything worth showing in a contact block. */
export function hasContactContent(settings = {}) {
  return socialChannels(settings).length > 0 || contactDetails(settings).length > 0;
}

function escapeHTML(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Fills a contact block from the store settings.
 * The element carrying `data-contact-band` is hidden entirely when the shop
 * switched the section off or has no channel configured.
 */
export function renderContactBand(root, settings = {}) {
  if (!root) return;

  if (settings.show_contact === false || !hasContactContent(settings)) {
    root.classList.add('hidden');
    return;
  }
  root.classList.remove('hidden');

  const detailsEl = root.querySelector('[data-contact-details]');
  if (detailsEl) {
    const details = contactDetails(settings);
    detailsEl.innerHTML = details
      .map(
        (d) => `
        <div>
          <dt>${escapeHTML(d.label)}</dt>
          <dd>${d.href ? `<a href="${escapeHTML(d.href)}">${escapeHTML(d.value)}</a>` : escapeHTML(d.value)}</dd>
        </div>`,
      )
      .join('');
  }

  const channelsEl = root.querySelector('[data-contact-channels]');
  if (channelsEl) {
    const channels = socialChannels(settings);
    channelsEl.innerHTML = channels
      .map((c) => {
        const sub =
          c.value && c.value !== c.label ? `<span class="contact-channel-value">${escapeHTML(c.value)}</span>` : '';
        return `
        <a class="contact-channel" href="${escapeHTML(c.href)}" target="_blank" rel="noopener noreferrer">
          <span class="contact-channel-icon">${c.icon}</span>
          <span class="contact-channel-text">
            <span class="contact-channel-name">${escapeHTML(c.label)}</span>
            ${sub}
          </span>
        </a>`;
      })
      .join('');
  }
}

/** Renders every contact block on the page. */
export function renderContactBands(settings = {}) {
  document.querySelectorAll('[data-contact-band]').forEach((el) => renderContactBand(el, settings));
}
