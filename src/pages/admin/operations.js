import { isOwner, setAudience } from '/src/core/audience.js';
import { notify } from '/src/core/ui.js';
import { escapeHTML, bindOnce, formatDateTime } from '/src/core/lib.js';
import { initReveal } from '/src/core/reveal.js';
import { initAdminLayout } from '/src/pages/admin/layout.js';
import { initI18n, t, translatePage, onLanguageChange } from '/src/core/i18n.js';
import { reportClientError } from '/src/core/errors.js';

let supabase;

document.addEventListener('DOMContentLoaded', async () => {
  initI18n();
  translatePage();

  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

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
    window.location.href = '/admin/login';
    return;
  }

  initAdminLayout('/admin/operations');
  initReveal();

  initBackup();
  loadStatus();
  loadAudit();

  onLanguageChange(() => {
    translatePage();
    loadStatus();
    loadAudit();
  });
});

async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function initBackup() {
  const downloadBtn = document.getElementById('backup-download-btn');
  const uploadBtn = document.getElementById('backup-upload-btn');
  const fileInput = document.getElementById('backup-file-input');
  const passwordInput = document.getElementById('backup-password');
  const errorLog = document.getElementById('operations-error-log');

  bindOnce(downloadBtn, 'click', async () => {
    const password = passwordInput.value;
    if (!password) {
      notify(t('admin.backup_password_required'), 'error');
      return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = t('common.loading');

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

      notify(t('admin.backup_saved'), 'success');
    } catch (err) {
      console.error(err);
      errorLog.innerHTML = `<div class="badge badge-error">${escapeHTML(err.message || t('toast.error_generic'))}</div>`;
      notify(err.message || t('toast.error_generic'), 'error');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = t('admin.backup_download');
    }
  });

  bindOnce(uploadBtn, 'click', () => fileInput.click());

  bindOnce(fileInput, 'change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const password = passwordInput.value;
    if (!password) {
      notify(t('admin.backup_password_required'), 'error');
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

      if (backup?.format !== 'zenmarket-data-v1') {
        throw new Error(t('admin.backup_invalid_format'));
      }
      const tables = backup?.tables || {};

      errorLog.innerHTML = `
        <div class="panel" style="padding:var(--space-md)">
          <div class="font-semibold mb-sm">${t('admin.backup_preview')}</div>
          <div class="text-sm text-secondary">
            ${Object.entries(tables)
              .map(([k, v]) => `${escapeHTML(k)}: ${Array.isArray(v) ? v.length : 0}`)
              .join('<br>')}
          </div>
          <div class="text-muted text-sm mt-sm">${escapeHTML(backup?.format || '-')} · ${escapeHTML(backup?.created_at ? formatDateTime(backup.created_at) : '-')}</div>
          <p class="text-sm mt-md" style="color:var(--color-warning, #b45309)">${t('admin.backup_restore_warning')}</p>
          <div class="flex gap-sm mt-md">
            <button id="backup-restore-confirm-btn" class="btn btn-primary btn-sm">${t('admin.backup_restore_confirm_btn')}</button>
            <button id="backup-restore-cancel-btn" class="btn btn-ghost btn-sm">${t('common.cancel')}</button>
          </div>
        </div>
      `;
      notify(t('admin.backup_ok'), 'success');

      const confirmBtn = document.getElementById('backup-restore-confirm-btn');
      const cancelBtn = document.getElementById('backup-restore-cancel-btn');

      bindOnce(cancelBtn, 'click', () => {
        errorLog.innerHTML = '';
        fileInput.value = '';
      });

      bindOnce(confirmBtn, 'click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = t('common.loading');
        try {
          const { data: restored, error: restoreErr } = await supabase.rpc('restore_admin_backup', {
            p_backup: backup,
          });
          if (restoreErr) throw restoreErr;

          errorLog.innerHTML = `
            <div class="panel" style="padding:var(--space-md)">
              <div class="font-semibold mb-sm">${t('admin.backup_restored')}</div>
              <div class="text-sm text-secondary">
                ${Object.entries(restored || {})
                  .map(([k, v]) => `${escapeHTML(k)}: ${v}`)
                  .join('<br>')}
              </div>
            </div>
          `;
          notify(t('admin.backup_restored'), 'success');
          loadStatus();
          loadAudit();
        } catch (err) {
          console.error(err);
          reportClientError('admin', err?.message || 'DATABASE');
          errorLog.innerHTML = `<div class="badge badge-error">${escapeHTML(err.message || t('toast.error_generic'))}</div>`;
          notify(err.message || t('toast.error_generic'), 'error');
        } finally {
          fileInput.value = '';
        }
      });
    } catch (err) {
      console.error(err);
      reportClientError('admin', err?.message || 'DATABASE');
      errorLog.innerHTML = `<div class="badge badge-error">${escapeHTML(err.message || t('toast.error_generic'))}</div>`;
      notify(err.message || t('toast.error_generic'), 'error');
    }
  });
}

const EMPTY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 12h6"/></svg>';

function emptyBlock(message) {
  return `<div class="log-empty">${EMPTY_ICON}<p>${escapeHTML(message)}</p></div>`;
}

function logRow({ dot = 'info', title = '', sub = '', meta = '' }) {
  return `<div class="log-row">
    <span class="log-dot ${dot}"></span>
    <div class="log-main"><b>${escapeHTML(title || '-')}</b>${sub ? `<span>${escapeHTML(sub)}</span>` : ''}</div>
    <span class="log-meta">${escapeHTML(meta || '-')}</span>
  </div>`;
}

function timeText(value) {
  return value ? formatDateTime(value) || '-' : '-';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function withinDay(value, hours = 24) {
  if (!value) return false;
  const diff = Date.now() - new Date(value).getTime();
  return diff >= 0 && diff <= hours * 3600 * 1000;
}

async function loadAudit() {
  const errorsEl = document.getElementById('operations-client-errors');
  const attemptsEl = document.getElementById('operations-login-attempts');

  try {
    const { data: errors } = await supabase
      .from('client_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (errorsEl) {
      errorsEl.innerHTML =
        errors && errors.length
          ? errors
              .map((e) =>
                logRow({
                  dot: 'error',
                  title: e.area || '-',
                  sub: e.code || '-',
                  meta: timeText(e.created_at),
                }),
              )
              .join('')
          : emptyBlock(t('admin.no_client_errors'));
    }
    setText('ops-errors-badge', String(errors?.length || 0));
    setText('ops-errors-value', String((errors || []).filter((e) => withinDay(e.created_at)).length));
  } catch (err) {
    if (errorsEl) errorsEl.innerHTML = emptyBlock(err.message);
  }

  try {
    const { data: attempts } = await supabase
      .from('login_attempts')
      .select('*')
      .order('expires', { ascending: false })
      .limit(20);
    if (attemptsEl) {
      attemptsEl.innerHTML =
        attempts && attempts.length
          ? attempts
              .map((a) =>
                logRow({
                  dot: a.hits > 3 ? 'error' : 'warn',
                  title: a.key || '-',
                  sub: `${a.hits || 0} ครั้ง`,
                  meta: timeText(a.expires),
                }),
              )
              .join('')
          : emptyBlock(t('admin.no_login_attempts'));
    }
    setText('ops-attempts-badge', String(attempts?.length || 0));
    setText('ops-attempts-value', String(attempts?.length || 0));
  } catch (err) {
    if (attemptsEl) attemptsEl.innerHTML = emptyBlock(err.message);
  }
}

async function loadStatus() {
  const notificationsEl = document.getElementById('operations-notifications');
  const restockEl = document.getElementById('operations-restock-status');

  try {
    const { data: notifications } = await supabase
      .from('owner_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    notificationsEl.innerHTML =
      notifications && notifications.length
        ? notifications
            .map((n) =>
              logRow({
                dot: n.kind === 'new_slip' ? 'warn' : 'info',
                title: n.kind || t('admin.notifications'),
                sub: withinDay(n.created_at) ? t('admin.ops_today') : '',
                meta: timeText(n.created_at),
              }),
            )
            .join('')
        : emptyBlock(t('admin.no_notifications'));
    setText('ops-notifications-value', String(notifications?.length || 0));
  } catch (err) {
    notificationsEl.innerHTML = emptyBlock(err.message);
  }

  try {
    const { data: status } = await supabase.from('operation_status').select('*');

    restockEl.innerHTML =
      status && status.length
        ? status
            .map((s) =>
              logRow({
                dot: s.last_success ? (withinDay(s.last_success, 48) ? 'ok' : 'warn') : 'warn',
                title: s.name || '-',
                sub: s.last_success ? '' : t('admin.no_data'),
                meta: timeText(s.last_success),
              }),
            )
            .join('')
        : emptyBlock(t('admin.no_data'));

    const healthy = (status || []).length > 0 && (status || []).every((s) => withinDay(s.last_success, 48));
    setText('ops-health-value', t(healthy ? 'admin.ops_healthy' : 'admin.ops_attention'));
    setText('ops-health-note', `${(status || []).length} ${t('admin.ops_services')}`);
    const card = document.getElementById('ops-stat-health');
    if (card) {
      card.classList.toggle('is-ok', healthy);
      card.classList.toggle('is-warn', !healthy);
    }
  } catch (err) {
    restockEl.innerHTML = emptyBlock(err.message);
    setText('ops-health-value', t('admin.ops_attention'));
  }
}
