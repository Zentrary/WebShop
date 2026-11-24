/**
 * Shared chrome for the authentication pages (login / register / forgot /
 * reset / admin login).
 *
 * The auth pages are deliberately standalone: no site header, no site footer
 * and no logo image — just typography, the shop name as text and a language
 * switcher.  This module owns the small amount of runtime wiring they need.
 */
import { state } from '/src/core/state.js';
import { getLanguage, toggleLanguage, onLanguageChange } from '/src/core/i18n.js';

export function paintAuthBrand() {
  const brand = document.getElementById('auth-brand-name');
  if (brand) brand.textContent = state.storeSettings?.shop_name || 'ZenMarket';
}

export function initAuthShell() {
  paintAuthBrand();

  const toggle = document.getElementById('auth-lang-toggle');
  if (toggle) {
    const label = () => {
      toggle.textContent = getLanguage() === 'th' ? 'TH / EN' : 'EN / TH';
    };
    label();
    toggle.addEventListener('click', () => toggleLanguage());
    onLanguageChange(label);
  }

  onLanguageChange(paintAuthBrand);

  if (typeof window !== 'undefined') {
    window.addEventListener('zenmarket:store-settings', paintAuthBrand);
  }
}
