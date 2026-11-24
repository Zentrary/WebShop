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
  return new Promise((resolve) => {
    const ok = window.confirm(message);
    resolve(ok);
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
