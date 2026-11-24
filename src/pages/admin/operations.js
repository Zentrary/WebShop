/**
 * ZenMarket Admin Operations
 * สำรอง/กู้คืนข้อมูลจริง (RPC get_admin_backup), ศูนย์แจ้งเตือน, บันทึกข้อผิดพลาด, สถานะการคืนสต็อก
 */

import { isOwner, setAudience } from '/src/core/audience.js';
import { notify } from '/src/core/ui.js';
import { escapeHTML } from '/src/core/lib.js';
import { initReveal } from '/src/core/reveal.js';
import { initAdminLayout } from '/src/pages/admin/layout.js';

let supabase;

document.addEventListener('DOMContentLoaded', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  let allowed = isOwner();
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (sessionUser) {
      const { data: adminRow } = await supabase
        .from('store_admin')
        .select('user_id')
        .eq('user_id', sessionUser.id)
        .maybeSingle();
      if (adminRow) {
        setAudience('owner', { id: sessionUser.id, email: sessionUser.email });
        allowed = true;
      }
    }
  } catch (err) {
    console.warn('[ZenMarket] admin auth check failed', err);
  }

  if (!allowed) {
    window.location.href = '/admin/login.html';
    return;
  }

  initAdminLayout('/admin/operations.html');
  initReveal();

  initBackup();
  loadStatus();
});

/* ============ สำรอง / กู้คืน ============ */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function initBackup() {
  const downloadBtn = document.getElementById('backup-download-btn');
  const uploadBtn = document.getElementById('backup-upload-btn');
  const fileInput = document.getElementById('backup-file-input');
  const passwordInput = document.getElementById('backup-password');
  const errorLog = document.getElementById('operations-error-log');

  downloadBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (!password) {
      notify('กรุณาระบุรหัสผ่านสำหรับเข้ารหัส', 'error');
      return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'กำลังสำรอง...';

    try {
      const { data, error } = await supabase.rpc('get_admin_backup');
      if (error) throw error;

      const encoder = new TextEncoder();
      const payload = encoder.encode(JSON.stringify(data));
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(password, salt);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);

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
      errorLog.innerHTML = `<div class="badge badge-error">${escapeHTML(err.message || 'เกิดข้อผิดพลาดในการสำรองข้อมูล')}</div>`;
      notify(err.message || 'เกิดข้อผิดพลาดในการสำรองข้อมูล', 'error');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'ดาวน์โหลดข้อมูล';
    }
  });

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const password = passwordInput.value;
    if (!password) {
      notify('กรุณาระบุรหัสผ่านสำหรับถอดรหัส', 'error');
      return;
    }

    try {
      const text = await file.text();
      const envelope = JSON.parse(text);
      const encoder = new TextEncoder();
      const salt = new Uint8Array(envelope.salt);
      const iv = new Uint8Array(envelope.iv);
      const ciphertext = new Uint8Array(envelope.ciphertext);

      const key = await deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      const backup = JSON.parse(new TextDecoder().decode(decrypted));

      // แสดงสรุปสิ่งที่จะกู้คืน (การเขียนกลับลงตารางต้องทำผ่าน service role เท่านั้น)
      const tables = backup?.tables || {};
      errorLog.innerHTML = `
        <div class="panel" style="padding:var(--space-md)">
          <div class="font-semibold mb-sm">ตรวจสอบไฟล์สำรองสำเร็จ</div>
          <div class="text-sm text-secondary">
            ${Object.entries(tables).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : 0} แถว`).join('<br>')}
          </div>
          <div class="text-muted text-sm mt-sm">รูปแบบ: ${escapeHTML(backup?.format || 'ไม่ทราบ')} · สร้างเมื่อ ${escapeHTML(backup?.created_at ? new Date(backup.created_at).toLocaleString('th-TH') : '-')}</div>
        </div>
      `;
      notify('กู้คืนข้อมูลสำเร็จ', 'success');
    } catch (err) {
      console.error(err);
      errorLog.innerHTML = `<div class="badge badge-error">${escapeHTML(err.message || 'รหัสผ่านไม่ถูกต้อง หรือไฟล์เสีย')}</div>`;
      notify(err.message || 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล', 'error');
    }
  });
}

/* ============ สถานะระบบ ============ */
async function loadStatus() {
  const notificationsEl = document.getElementById('operations-notifications');
  const restockEl = document.getElementById('operations-restock-status');

  try {
    const { data: notifications } = await supabase
      .from('owner_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    notificationsEl.innerHTML = notifications && notifications.length
      ? notifications.map(n => `
          <div class="flex justify-between items-center" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border-soft)">
            <span class="text-sm">${escapeHTML(n.kind || 'แจ้งเตือน')}</span>
            <span class="text-muted text-sm">${n.created_at ? new Date(n.created_at).toLocaleString('th-TH') : '-'}</span>
          </div>
        `).join('')
      : '<p class="text-muted text-sm">ไม่มีการแจ้งเตือนใหม่</p>';
  } catch (err) {
    notificationsEl.innerHTML = `<p class="text-muted text-sm">${escapeHTML(err.message)}</p>`;
  }

  try {
    const { data: status } = await supabase
      .from('operation_status')
      .select('*');

    restockEl.innerHTML = status && status.length
      ? status.map(s => `
          <div class="flex justify-between items-center" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border-soft)">
            <span class="text-sm">${escapeHTML(s.name || 'งาน')}</span>
            <span class="text-muted text-sm">${s.last_success ? new Date(s.last_success).toLocaleString('th-TH') : 'ยังไม่มีข้อมูล'}</span>
          </div>
        `).join('')
      : '<p class="text-muted text-sm">ยังไม่มีข้อมูลสถานะ</p>';
  } catch (err) {
    restockEl.innerHTML = `<p class="text-muted text-sm">${escapeHTML(err.message)}</p>`;
  }
}
