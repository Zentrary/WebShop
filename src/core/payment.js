import { escapeHTML, formatTHB, maskPromptPayTarget } from '/src/core/lib.js';
import { t } from '/src/core/i18n.js';

const FONT = "'Prompt', 'Noto Sans Thai', system-ui, sans-serif";
const INK = '#0f1b2d';
const INK_SOFT = '#6b7c93';
const LINE = '#e8edf5';
const BLUE = '#0f4c9c';
const RED = '#d23b3b';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawThaiQrMark(ctx, x, y) {
  ctx.strokeStyle = RED;
  ctx.lineWidth = 3;
  [
    [0, 0],
    [26, 0],
    [0, 26],
  ].forEach(([dx, dy]) => {
    roundRect(ctx, x + dx, y + dy, 16, 16, 4);
    ctx.stroke();
  });
  ctx.fillStyle = BLUE;
  ctx.font = `700 19px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('THAI QR', x + 52, y + 14);
  ctx.fillText('PAYMENT', x + 52, y + 36);
}

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

export async function promptPayCardDataURL({ qrDataURL, amount = 0, recipient = '', target = '' } = {}) {
  const W = 760;
  const H = 1000;
  const pad = 44;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  try {
    await document.fonts?.ready;
  } catch {
    /* ignore */
  }

  try {
    const logo = await loadImage('/images/promptpay.png');
    const logoH = 62;
    ctx.drawImage(logo, pad, pad, (logo.width / logo.height) * logoH, logoH);
  } catch {
    /* logo is optional */
  }
  drawThaiQrMark(ctx, W - pad - 158, pad + 12);

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, pad + 96);
  ctx.lineTo(W - pad, pad + 96);
  ctx.stroke();

  const qrSize = 520;
  const qrTop = pad + 136;
  try {
    const qr = await loadImage(qrDataURL);
    ctx.drawImage(qr, (W - qrSize) / 2, qrTop, qrSize, qrSize);
  } catch {
    /* ignore */
  }

  let y = qrTop + qrSize + 78;
  ctx.textAlign = 'center';
  if (amount > 0) {
    ctx.fillStyle = INK;
    ctx.font = `700 68px ${FONT}`;
    ctx.fillText(formatTHB(amount), W / 2, y);
    y += 52;
  }
  if (recipient) {
    ctx.fillStyle = '#24344d';
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(String(recipient).trim(), W / 2, y);
    y += 44;
  }
  if (target) {
    ctx.fillStyle = INK_SOFT;
    ctx.font = `400 27px ${FONT}`;
    ctx.fillText(`พร้อมเพย์ · ${maskPromptPayTarget(target)}`, W / 2, y);
    y += 34;
  }

  y += 10;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(pad + 26, y);
  ctx.lineTo(W - pad - 26, y);
  ctx.stroke();

  ctx.fillStyle = INK_SOFT;
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText(t('payment.scan_hint'), W / 2, y + 42);

  return canvas.toDataURL('image/png');
}
