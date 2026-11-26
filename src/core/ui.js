import { t } from './i18n.js';

const ICONS = {
  success:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  warning:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

function getStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

export function notify(message, type = 'info', duration = 4000) {
  const stack = getStack();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `${ICONS[type] || ICONS.info}<span></span>`;
  toast.querySelector('span').textContent = message;
  stack.appendChild(toast);
  while (stack.children.length > 2) stack.firstElementChild.remove();

  const dismiss = () => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 260);
  };
  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
  return Promise.resolve();
}

export function confirmAction(message, options = {}) {
  const {
    title = t('common.confirm_title'),
    confirmText = t('common.confirm_ok'),
    cancelText = t('common.cancel'),
    danger = false,
  } = options;

  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-body">
        <h2 class="confirm-title"></h2>
        <p class="confirm-message"></p>
        <div class="confirm-actions">
          <button type="button" class="btn btn-outline" data-confirm-cancel></button>
          <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-confirm-ok></button>
        </div>
      </div>`;

    dialog.querySelector('.confirm-title').textContent = title;
    dialog.querySelector('.confirm-message').textContent = message;
    const cancelBtn = dialog.querySelector('[data-confirm-cancel]');
    const okBtn = dialog.querySelector('[data-confirm-ok]');
    cancelBtn.textContent = cancelText;
    okBtn.textContent = confirmText;

    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      if (dialog.open) dialog.close();
      dialog.remove();
    };

    okBtn.addEventListener('click', () => settle(true));
    cancelBtn.addEventListener('click', () => settle(false));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      settle(false);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) settle(false);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    cancelBtn.focus();
  });
}

/**
 * แผงฟอร์ม (edit sheet) — ใช้ร่วมกันทั้งหน้าสินค้าและหน้าคูปอง
 * เปิดเป็น modal บน <dialog> ที่มีอยู่แล้วในหน้า เพื่อให้ได้ focus trap,
 * ปุ่ม ESC และฉากหลังมืดจากเบราว์เซอร์โดยไม่ต้องเขียนเอง
 * ปิดได้ 3 ทาง (ปุ่ม × / ESC / คลิกฉากหลัง) และถามก่อนถ้ามีการแก้ไขค้าง
 */
export function formSheet({ dialog, form, titleEl, subEl, closeBtn }) {
  if (!dialog || !form) return null;

  const fields = () => [...form.querySelectorAll('input, select, textarea')];
  const snapshot = () =>
    fields()
      .map((el) => (el.type === 'checkbox' ? (el.checked ? '1' : '0') : String(el.value)))
      .join('\u0001');

  let baseline = snapshot();
  let titleKey = '';
  const isOpen = () => dialog.open;
  const isDirty = () => snapshot() !== baseline;
  const markClean = () => {
    baseline = snapshot();
  };

  const open = ({ titleKey: nextKey = '', sub = '' } = {}) => {
    titleKey = nextKey;
    if (titleEl && titleKey) titleEl.textContent = t(titleKey);
    if (subEl) {
      subEl.textContent = sub || '';
      subEl.hidden = !sub;
    }
    markClean();
    if (!dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('sheet-open');
    }
    requestAnimationFrame(() => {
      const first = form.querySelector('input:not([type="hidden"]):not([type="file"]), select, textarea');
      if (first) first.focus({ preventScroll: true });
    });
  };

  const closeNow = () => {
    if (dialog.open) dialog.close();
  };

  const requestClose = async () => {
    if (isDirty()) {
      const discard = await confirmAction(t('admin.sheet_unsaved_message'), {
        title: t('admin.sheet_unsaved_title'),
        confirmText: t('admin.sheet_discard'),
        cancelText: t('admin.sheet_keep_editing'),
        danger: true,
      });
      if (!discard) return false;
    }
    closeNow();
    return true;
  };

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) requestClose();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('sheet-open');
  });
  // สลับภาษาแล้วหัวแผงยังต้องถูก (ไม่ใช่กลับไปเป็น "เพิ่มสินค้าใหม่" ตอนกำลังแก้ไข)
  window.addEventListener('zenmarket:lang-change', () => {
    if (dialog.open && titleKey && titleEl) titleEl.textContent = t(titleKey);
  });
  if (closeBtn) closeBtn.addEventListener('click', () => requestClose());

  return { open, closeNow, requestClose, isOpen, isDirty, markClean };
}

/**
 * ถามข้อความสั้น ๆ ด้วยหน้าตาของร้าน แทน window.prompt()
 * คืนค่า string เมื่อกดยืนยัน และคืน null เมื่อยกเลิก (เหมือน prompt())
 */
export function askText({ title, hint = '', placeholder = '', confirmText, cancelText, danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-body">
        <h2 class="confirm-title"></h2>
        <p class="confirm-message"></p>
        <textarea class="form-input ask-input" rows="3"></textarea>
        <div class="confirm-actions">
          <button type="button" class="btn btn-outline" data-confirm-cancel></button>
          <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-confirm-ok></button>
        </div>
      </div>`;

    dialog.querySelector('.confirm-title').textContent = title || t('common.confirm_title');
    const hintEl = dialog.querySelector('.confirm-message');
    hintEl.textContent = hint;
    if (!hint) hintEl.hidden = true;
    const input = dialog.querySelector('.ask-input');
    input.placeholder = placeholder;
    const cancelBtn = dialog.querySelector('[data-confirm-cancel]');
    const okBtn = dialog.querySelector('[data-confirm-ok]');
    cancelBtn.textContent = cancelText || t('common.cancel');
    okBtn.textContent = confirmText || t('common.save');

    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      if (dialog.open) dialog.close();
      dialog.remove();
    };

    okBtn.addEventListener('click', () => settle(input.value));
    cancelBtn.addEventListener('click', () => settle(null));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      settle(null);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) settle(null);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    input.focus();
  });
}

export function flash() {
  try {
    const stored = sessionStorage.getItem('zenmarket_flash');
    if (stored) {
      const { message, type = 'info' } = JSON.parse(stored);
      sessionStorage.removeItem('zenmarket_flash');
      notify(message, type);
    }
  } catch {}
}

export function setFlash(message, type = 'info') {
  try {
    sessionStorage.setItem('zenmarket_flash', JSON.stringify({ message, type }));
  } catch {}
}

export function closeAllPopups() {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
}
