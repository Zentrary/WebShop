/**
 * ZenMarket Admin Login
 * หน้าเข้าสู่ระบบสำหรับเจ้าของร้าน
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('admin-login-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'กำลังเข้าสู่ระบบ...';

    try {
      const { data, error } = await supabaseAdminAuth(username, password);

      if (error) throw error;

      localStorage.setItem('zenmarket_audience', 'owner');
      localStorage.setItem('zenmarket_user', JSON.stringify({ user_name: username, role: 'owner' }));
      localStorage.setItem('zenmarket_session_token', data.session_token);

      window.location.href = '/admin/dashboard.html';
    } catch (err) {
      console.error(err);
      alert(err.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      btn.disabled = false;
      btn.textContent = 'เข้าสู่ระบบแอดมิน';
    }
  });
});

async function supabaseAdminAuth(username, password) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  return supabase.auth.signInWithPassword({
    email: username,
    password: password,
  });
}