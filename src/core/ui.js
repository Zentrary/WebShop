const popupQueue = [];
let isProcessing = false;
let activeDialog = null;

export function notify(message, type = 'info', duration = 4000) {
  return new Promise((resolve) => {
    popupQueue.push({ type: 'notify', message, type, duration, resolve });
    processQueue();
  });
}

export function confirmAction(message, options = {}) {
  return new Promise((resolve) => {
    popupQueue.push({
      type: 'confirm',
      message,
      confirmText: options.confirmText || 'ยืนยัน',
      cancelText: options.cancelText || 'ยกเลิก',
      resolve,
    });
    processQueue();
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

function processQueue() {
  if (isProcessing || popupQueue.length === 0) return;
  if (activeDialog) return;

  isProcessing = true;
  const item = popupQueue.shift();
  showPopup(item);
}

function showPopup(item) {
  if (item.type === 'notify') {
    showNotify(item);
  } else if (item.type === 'confirm') {
    showConfirm(item);
  }
}

function showNotify(item) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('role', 'alertdialog');
  dialog.className = `popup-notify popup-${item.type}`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => {
    dialog.close();
    cleanup(item);
  };

  const msg = document.createElement('div');
  msg.className = 'popup-message';
  msg.textContent = item.message;

  dialog.appendChild(closeBtn);
  dialog.appendChild(msg);
  document.body.appendChild(dialog);

  activeDialog = dialog;

  dialog.showModal();

  setTimeout(() => {
    if (!dialog.open) return;
    dialog.close();
    cleanup(item);
  }, item.duration);
}

function showConfirm(item) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('role', 'alertdialog');
  dialog.className = 'popup-confirm';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => {
    dialog.close();
    cleanup(item, false);
  };

  const msg = document.createElement('div');
  msg.className = 'popup-message';
  msg.textContent = item.message;

  const btnContainer = document.createElement('div');
  btnContainer.className = 'popup-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-outline';
  cancelBtn.textContent = item.cancelText;
  cancelBtn.onclick = () => {
    dialog.close();
    cleanup(item, false);
  };

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = item.confirmText;
  confirmBtn.onclick = () => {
    dialog.close();
    cleanup(item, true);
  };

  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(confirmBtn);

  dialog.appendChild(closeBtn);
  dialog.appendChild(msg);
  dialog.appendChild(btnContainer);
  document.body.appendChild(dialog);

  activeDialog = dialog;
  dialog.showModal();
}

function cleanup(item, result) {
  if (activeDialog && document.body.contains(activeDialog)) {
    document.body.removeChild(activeDialog);
  }
  activeDialog = null;
  isProcessing = false;
  item.resolve(result);
  processQueue();
}

export function closeAllPopups() {
  if (activeDialog) {
    activeDialog.close();
    document.body.removeChild(activeDialog);
    activeDialog = null;
  }
  isProcessing = false;
  popupQueue.length = 0;
}