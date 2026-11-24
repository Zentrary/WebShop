/**
 * ZenMarket Admin Login
 * หน้าเข้าสู่ระบบสำหรับเจ้าของร้าน (ใช้ Supabase Auth + ตรวจ is_admin)
 */

import { setAudience } from '/src/core/audience.js';
import { notify } from '/src/core/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('admin-login-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'กำลังเข้าสู่ระบบ...';

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      // username → email ผ่าน RPC
      let email = username;
      if (!username.includes('@')) {
        const { data: resolved } = await supabase.rpc('login_email', { login_name: username.toLowerCase() });
        if (!resolved) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        email = resolved;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // ตรวจสิทธิ์แอดมิน
      const { data: adminCheck } = await supabase.rpc('is_admin');
      if (!adminCheck) {
        await supabase.auth.signOut();
        throw new Error('บัญชีนี้ไม่มีสิทธิ์เข้าถึงหลังบ้าน');
      }

      setAudience('owner', { id: data.user.id, email: data.user.email, username });
      window.location.href = '/admin/dashboard.html';
    } catch (err) {
      console.error(err);
      notify(err.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
      btn.disabled = false;
      btn.textContent = 'เข้าสู่ระบบแอดมิน';
    }
  });
});
