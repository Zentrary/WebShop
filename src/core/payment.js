import { escapeHTML, formatTHB, maskPromptPayTarget } from '/src/core/lib.js';
import { t } from '/src/core/i18n.js';

const THAI_QR_MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/>
<rect x="3" y="14" width="7" height="7" rx="1.2"/><path d="M14 14h3v3h-3zM20 14v1M20 18v3h-3M14 21h1"/>
</svg>`;

export function promptPayCardHTML({ qrDataURL, amount = 0, recipient = '', target = '' } = {}) {
  const name = String(recipient || '').trim();
  const ref = String(target || '').trim();
  return `<figure class="pp-card">
    <div class="pp-card__head">
      <img class="pp-card__brand" src="/images/promptpay.png" alt="PromptPay" />
      <span class="pp-card__thaiqr">${THAI_QR_MARK}<span>Thai QR<br />Payment</span></span>
    </div>
    <div class="pp-card__qr"><img src="${qrDataURL}" alt="PromptPay QR" /></div>
    <figcaption class="pp-card__info">
      ${amount > 0 ? `<div class="pp-card__amount">${escapeHTML(formatTHB(amount))}</div>` : ''}
      ${name ? `<div class="pp-card__name">${escapeHTML(name)}</div>` : ''}
      ${ref ? `<div class="pp-card__ref">พร้อมเพย์ · ${escapeHTML(maskPromptPayTarget(ref))}</div>` : ''}
    </figcaption>
    <div class="pp-card__foot">${escapeHTML(t('payment.scan_hint'))}</div>
  </figure>`;
}
