import { setAudience } from '/src/core/audience.js';
import { notify } from '/src/core/ui.js';
import { t, translatePage } from '/src/core/i18n.js';
import { initApp, state } from '/src/app.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Same site shell as every other page: header, footer and language switch.
  await initApp();
  translatePage();

  const form = document.getElementById('admin-login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = t('common.loading');

    try {
      const supabase = state.supabase;
      if (!supabase) throw new Error(t('auth.invalid_credentials'));

      try {
        const { data: allowed } = await supabase.rpc('login_allow', { bucket_key: `admin:${username.toLowerCase()}` });
        if (allowed === false) {
          notify(t('toast.too_many_login'), 'error');
          btn.disabled = false;
          btn.textContent = t('admin.login_title');
          return;
        }
      } catch {}

      let email = username;
      if (!username.includes('@')) {
        const { data: resolved } = await supabase.rpc('login_email', { login_name: username.toLowerCase() });
        if (!resolved) throw new Error(t('auth.invalid_credentials'));
        email = resolved;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: adminCheck } = await supabase.rpc('is_admin');
      if (!adminCheck) {
        await supabase.auth.signOut();
        throw new Error(t('admin.no_permission'));
      }

      setAudience('owner', { id: data.user.id, email: data.user.email, username });
      notify(t('toast.login_success'), 'success');
      setTimeout(() => {
        window.location.href = '/admin/dashboard';
      }, 400);
    } catch (err) {
      console.error(err);
      notify(err.message || t('auth.invalid_credentials'), 'error');
      btn.disabled = false;
      btn.textContent = t('admin.login_title');
    }
  });
});
