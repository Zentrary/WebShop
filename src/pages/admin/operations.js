/**
 * ZenMarket Admin Operations
 * หน้าศูนย์แจ้งเตือน, สถานะ cron คืนสต็อก, บันทึกข้อผิดพลาด และดาวน์โหลด Backup
 */

import { notify } from '/src/core/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initBackup();
});

function initBackup() {
  const downloadBtn = document.getElementById('backup-download-btn');
  const uploadBtn = document.getElementById('backup-upload-btn');
  const fileInput = document.getElementById('backup-file-input');
  const passwordInput = document.getElementById('backup-password');

  downloadBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (!password) {
      notify('กรุณาระบุรหัสผ่านสำหรับเข้ารหัส', 'error');
      return;
    }

    try {
      const backupData = {
        store_settings: localStorage.getItem('zenmarket_store_settings'),
        cart: localStorage.getItem('zenmarket_cart'),
        exported_at: new Date().toISOString(),
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(backupData));
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      const result = {
        salt: Array.from(salt),
        iv: Array.from(iv),
        ciphertext: Array.from(new Uint8Array(encrypted)),
      };

      const blob = new Blob([JSON.stringify(result)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zenmarket_backup_${new Date().toISOString().slice(0, 10)}.zenbackup`;
      a.click();
      URL.revokeObjectURL(url);

      notify('สำรองข้อมูลสำเร็จ', 'success');
    } catch (err) {
      console.error(err);
      notify('เกิดข้อผิดพลาดในการสำรองข้อมูล', 'error');
    }
  });

  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const password = passwordInput.value;
    if (!password) {
      notify('กรุณาระบุรหัสผ่านสำหรับถอดรหัส', 'error');
      return;
    }

    try {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = async (event) => {
        const backupData = JSON.parse(event.target.result);
        const encoder = new TextEncoder();

        const salt = new Uint8Array(backupData.salt);
        const iv = new Uint8Array(backupData.iv);
        const ciphertext = new Uint8Array(backupData.ciphertext);

        const passwordKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 },
          passwordKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          ciphertext
        );

        const restored = JSON.parse(new TextDecoder().decode(decrypted));

        if (restored.store_settings) {
          localStorage.setItem('zenmarket_store_settings', restored.store_settings);
        }
        if (restored.cart) {
          localStorage.setItem('zenmarket_cart', restored.cart);
        }

        notify('กู้คืนข้อมูลสำเร็จ', 'success');
        setTimeout(() => location.reload(), 1000);
      };
    } catch (err) {
      console.error(err);
      notify('เกิดข้อผิดพลาดในการกู้คืนข้อมูล', 'error');
    }
  });
}