/**
 * ZenMarket Customer Account - Part 1
 */

import { initApp, state } from '/src/app.js';
import { setAudience, isMember, logout } from '/src/core/audience.js';
import { t, translatePage } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import { initCaptcha, hasCaptcha, renderTurnstile } from '/src/core/captcha.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  translatePage();
  initCaptcha();

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
function initRegisterPage() {
  const form = document.getElementById('register-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
      notify('รหัสผ่านไม่ตรงกัน', 'error');
      return;
    }

    try {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            user_name: username,
            phone: phone,
            full_name: username,
          },
        },
      });

      if (error) throw error;

      notify('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ', 'success');
      window.location.href = '/auth/login.html';
    } catch (err) {
      console.error(err);
      notify(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก', 'error');
    }
  });
}

function initResetPasswordPage() {
function initAccountPage() {
  if (!isMember()) {
    window.location.href = '/auth/login.html';
    return;
  }

  const user = state.user;
  document.getElementById('account-name').textContent = user.user_name || user.email;
  document.getElementById('account-email').textContent = user.email;

  const profileForm = document.getElementById('profile-form');
  document.getElementById('profile-username').value = user.user_name || '';
  document.getElementById('profile-email').value = user.email || '';
  document.getElementById('profile-phone').value = user.phone || '';

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { error } = await state.supabase.auth.updateUser({
        email: document.getElementById('profile-email').value,
      });
      if (error) throw error;

      await state.supabase
        .from('profiles')
        .update({ phone: document.getElementById('profile-phone').value })
        .eq('id', user.id);

      notify('อัปเดตโปรไฟล์สำเร็จ', 'success');
    } catch (err) {
      notify(err.message || 'เกิดข้อผิดพลาดในการอัปเดต', 'error');
    }
  });

  document.querySelectorAll('.account-sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.textContent.trim();
      document.querySelectorAll('.account-section').forEach(s => s.classList.add('hidden'));
      document.querySelectorAll('.account-sidebar a').forEach(a => a.classList.remove('bg-primary', 'text-white'));
      link.classList.add('bg-primary', 'text-white');

      if (target.includes('โปรไฟล์')) {
        document.getElementById('account-profile').classList.remove('hidden');
      } else if (target.includes('สมุดที่อยู่')) {
        document.getElementById('account-addresses').classList.remove('hidden');
      } else if (target.includes('คำสั่งซื้อ')) {
        document.getElementById('account-orders').classList.remove('hidden');
      } else if (target.includes('รายการโปรด')) {
        document.getElementById('account-favorites').classList.remove('hidden');
      }
    });
  });
}

function initFavoritesPage() {
  if (!isMember()) {
    window.location.href = '/auth/login.html';
    return;
  }
}
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
      console.error(err);
      notify(err.message || 'เกิดข้อผิดพลาดในการตั้งรหัสผ่าน', 'error');
    }
  });
}
    const identifier = document.getElementById('login-identifier').value;
    const password = document.getElementById('login-password').value;

    try {
      const { data, error } = await state.supabase.rpc('username_login', {
        p_identifier: identifier,
        p_password: password,
      });

      if (error) throw error;

      if (data && data.success) {
        setAudience('member', data.user);
        state.user = data.user;
        state.audience = 'member';
        notify('เข้าสู่ระบบสำเร็จ', 'success');
        window.location.href = '/account/index.html';
      } else {
        notify('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
      }
    } catch (err) {
      console.error(err);
      notify('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
    }
  });
}