/**
 * ZenMarket Customer Account — เข้าสู่ระบบ / สมัคร / ตั้งรหัสผ่าน / โปรไฟล์ / รายการโปรด
 * Login: ใช้ RPC login_email แปลง username → email แล้ว signInWithPassword
 */

import { initApp, state, requireSupabase } from '/src/app.js';
import { setAudience, isMember } from '/src/core/audience.js';
import { translatePage } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import { initCaptcha, hasCaptcha, renderTurnstile } from '/src/core/captcha.js';
import { formatTHB, escapeHTML } from '/src/core/lib.js';

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  translatePage();
  initCaptcha();

  if (!requireSupabase()) return;

  const path = window.location.pathname;

  if (path.includes('/auth/login.html')) {
    initLoginPage();
  } else if (path.includes('/auth/register.html')) {
    initRegisterPage();
  } else if (path.includes('/auth/reset-password.html')) {
    initResetPasswordPage();
  } else if (path.includes('/account/index.html')) {
    initAccountPage();
  } else if (path.includes('/account/favorites.html')) {
    initFavoritesPage();
  }
});

/* ================= เข้าสู่ระบบ ================= */
function initLoginPage() {
  const form = document.getElementById('login-form');
  const turnstileContainer = document.getElementById('turnstile-container');

  if (hasCaptcha()) {
    turnstileContainer.style.display = 'block';
    renderTurnstile('turnstile-container', (token) => {
      form.dataset.turnstileToken = token;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'กำลังเข้าสู่ระบบ...';

    try {
      // แปลง username → email ผ่าน RPC
      let email = identifier;
      if (!identifier.includes('@')) {
        const { data: resolved, error: rpcErr } = await state.supabase.rpc('login_email', { login_name: identifier.toLowerCase() });
        if (rpcErr || !resolved) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        email = resolved;
      }

      const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // โหลดโปรไฟล์
      const { data: profile } = await state.supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const user = {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username || '',
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        phone: profile?.phone || '',
      };
      setAudience('member', user);
      state.user = user;
      state.audience = 'member';

      notify('เข้าสู่ระบบสำเร็จ', 'success');
      const returnPath = sessionStorage.getItem('zenmarket_return_path') || '/account/index.html';
      sessionStorage.removeItem('zenmarket_return_path');
      window.location.href = returnPath;
    } catch (err) {
      console.error(err);
      notify(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
      btn.disabled = false;
      btn.textContent = 'เข้าสู่ระบบ';
    }
  });
}

/* ================= สมัครสมาชิก ================= */
function initRegisterPage() {
  const form = document.getElementById('register-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
      notify('รหัสผ่านไม่ตรงกัน', 'error');
      return;
    }
    if (password.length < 6) {
      notify('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'กำลังสมัคร...';

    try {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase(),
            phone: phone || null,
          },
        },
      });
      if (error) throw error;

      // trigger handle_signup() สร้างแถวใน profiles ให้แล้ว
      // อัปเดตซ้ำผ่าน RPC (SECURITY DEFINER) เพื่อกันข้อมูลไม่ครบ
      if (data.user) {
        await state.supabase.rpc('save_profile', {
          p_first_name: null,
          p_last_name: null,
          p_nickname: null,
          p_phone: phone || null,
          p_age: null,
          p_username: username.toLowerCase(),
        });
      }

      notify('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ', 'success');
      window.location.href = '/auth/login.html';
    } catch (err) {
      console.error(err);
      notify(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก', 'error');
      btn.disabled = false;
      btn.textContent = 'สมัครสมาชิก';
    }
  });
}

/* ================= ตั้งรหัสผ่านใหม่ ================= */
function initResetPasswordPage() {
  const form = document.getElementById('reset-password-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (password !== confirmPassword) {
      notify('รหัสผ่านไม่ตรงกัน', 'error');
      return;
    }

    try {
      const { error } = await state.supabase.auth.updateUser({ password });
      if (error) throw error;
      notify('ตั้งรหัสผ่านใหม่สำเร็จ', 'success');
      window.location.href = '/auth/login.html';
    } catch (err) {
      notify(err.message || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

/* ================= บัญชีของฉัน ================= */
async function initAccountPage() {
  if (!isMember()) {
    window.location.href = '/auth/login.html';
    return;
  }

  const user = state.user || {};
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email || 'ผู้ใช้งาน';
  document.getElementById('account-name').textContent = displayName;
  document.getElementById('account-email').textContent = user.email || '';
  document.getElementById('account-avatar').textContent = (displayName[0] || 'ผ').toUpperCase();

  document.getElementById('profile-username').value = user.username || '';
  document.getElementById('profile-firstname').value = user.first_name || '';
  document.getElementById('profile-lastname').value = user.last_name || '';
  document.getElementById('profile-phone').value = user.phone || '';

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { error } = await state.supabase.rpc('save_profile', {
        p_first_name: document.getElementById('profile-firstname').value.trim(),
        p_last_name: document.getElementById('profile-lastname').value.trim(),
        p_nickname: null,
        p_phone: document.getElementById('profile-phone').value.trim(),
        p_age: null,
        p_username: document.getElementById('profile-username').value.trim().toLowerCase() || user.username,
      });
      if (error) throw error;
      notify('อัปเดตโปรไฟล์สำเร็จ', 'success');
    } catch (err) {
      notify(err.message || 'เกิดข้อผิดพลาดในการอัปเดต', 'error');
    }
  });

  // Sidebar tabs
  document.querySelectorAll('.side-nav a[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.side-nav a').forEach(a => a.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.account-section').forEach(s => s.classList.add('hidden'));
      document.getElementById(`account-${link.getAttribute('data-tab')}`).classList.remove('hidden');
    });
  });

  // โหลดคำสั่งซื้อล่าสุดในแท็บ
  try {
    const { data: orders } = await state.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    const list = document.getElementById('customer-orders-list');
    if (orders && orders.length) {
      list.innerHTML = orders.map(o => `
        <a href="/account/order.html?id=${o.id}" class="flex justify-between items-center" style="padding:0.75rem 0;border-bottom:1px solid var(--color-border-soft)">
          <span class="font-semibold">#${o.id.slice(0, 8)} <span class="text-muted" style="font-weight:400">${o.created_at ? new Date(o.created_at).toLocaleDateString('th-TH') : ''}</span></span>
          <span class="text-accent font-semibold">${formatTHB(o.total)}</span>
        </a>
      `).join('');
    } else {
      list.innerHTML = '<p class="text-muted text-sm">ยังไม่มีคำสั่งซื้อ</p>';
    }
  } catch {}

  // ที่อยู่
  try {
    const { data: addresses } = await state.supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', user.id);
    const list = document.getElementById('addresses-list');
    if (addresses && addresses.length) {
      list.innerHTML = addresses.map(a => `
        <div class="panel" style="padding:1rem;margin-bottom:0.75rem">
          <div class="font-semibold">${escapeHTML(a.label || 'ที่อยู่')}</div>
          <div class="text-secondary text-sm">${escapeHTML(a.recipient || '')} ${escapeHTML(a.phone || '')}</div>
          <div class="text-secondary text-sm">${escapeHTML(a.address || '')}</div>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<p class="text-muted text-sm">ยังไม่มีที่อยู่ที่บันทึก</p>';
    }
  } catch {}
}

/* ================= รายการโปรด ================= */
async function initFavoritesPage() {
  if (!isMember()) {
    window.location.href = '/auth/login.html';
    return;
  }
  const grid = document.getElementById('favorites-grid');
  grid.innerHTML = '<p class="text-muted">รายการโปรดจะแสดงที่นี่เมื่อคุณกดหัวใจที่สินค้า</p>';
}
