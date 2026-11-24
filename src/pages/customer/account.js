import { initApp, state, requireSupabase } from '/src/app.js';
import { setAudience, isSignedIn } from '/src/core/audience.js';
import { translatePage, t, onLanguageChange } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';
import { initCaptcha, hasCaptcha, renderTurnstile } from '/src/core/captcha.js';
import { formatTHB, escapeHTML, safeImage, safeReturnPath } from '/src/core/lib.js';
import {
  validateAddress,
  validateProfile,
  normalizeThaiPhone,
  USERNAME_PATTERN,
  passwordStrength,
} from '/src/core/validation.js';
import { getStockStatusText, getStockStatusClass } from '/src/core/customer.js';
import { loadFavoriteProducts, toggleFavorite, isFavorite, canUseFavorites } from '/src/core/favorites.js';
import { initAuthShell } from '/src/core/auth-shell.js';

const isAuthPage = () => window.location.pathname.includes('/auth/');

document.addEventListener('DOMContentLoaded', async () => {
  // The authentication pages are standalone: no site header, no site footer.
  await initApp({ shell: !isAuthPage() });
  translatePage();
  initCaptcha();
  if (isAuthPage()) initAuthShell();

  if (!requireSupabase()) return;

  const path = window.location.pathname;

  if (path.includes('/auth/login.html')) {
    initLoginPage();
  } else if (path.includes('/auth/register.html')) {
    initRegisterPage();
  } else if (path.includes('/auth/forgot-password.html')) {
    initForgotPasswordPage();
  } else if (path.includes('/auth/reset-password.html')) {
    initResetPasswordPage();
  } else if (path.includes('/account/index.html')) {
    initAccountPage();
  } else if (path.includes('/account/favorites.html')) {
    initFavoritesPage();
  }
});

function bindPasswordStrength(inputId, hintId) {
  const input = document.getElementById(inputId);
  const hint = document.getElementById(hintId);
  if (!input) return;
  const baseText = hint ? hint.textContent : '';
  input.addEventListener('input', () => {
    const value = input.value;
    if (!hint) return;
    if (!value) {
      hint.textContent = baseText;
      hint.className = 'auth-hint';
      input.setAttribute('aria-invalid', 'false');
      return;
    }
    const result = passwordStrength(value);
    hint.textContent = result.ok ? t('auth.password_ok') : t(result.errorKey);
    hint.className = result.ok ? 'auth-hint auth-hint-ok' : 'auth-hint auth-hint-bad';
    input.setAttribute('aria-invalid', result.ok ? 'false' : 'true');
  });
}

function initLoginPage() {
  const form = document.getElementById('login-form');
  const turnstileContainer = document.getElementById('turnstile-container');
  if (!form) return;

  if (hasCaptcha()) {
    if (turnstileContainer) turnstileContainer.style.display = 'block';
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
    btn.textContent = t('common.loading');

    try {
      const bucketKey = `login:${identifier.toLowerCase()}`;
      const { data: allowed, error: allowErr } = await state.supabase.rpc('login_allow', { bucket_key: bucketKey });
      if (allowErr) console.warn('[ZenMarket] login_allow failed', allowErr);
      if (allowed === false) {
        notify(t('toast.too_many_login'), 'error');
        btn.disabled = false;
        btn.textContent = t('auth.submit_login');
        return;
      }

      let email = identifier;
      if (!identifier.includes('@')) {
        const { data: resolved, error: rpcErr } = await state.supabase.rpc('login_email', {
          login_name: identifier.toLowerCase(),
        });
        if (rpcErr || !resolved) throw new Error(t('auth.invalid_credentials'));
        email = resolved;
      }

      const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: profile } = await state.supabase.from('profiles').select('*').eq('id', data.user.id).single();

      const user = {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username || '',
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        nickname: profile?.nickname || '',
        phone: profile?.phone || '',
        age: profile?.age ?? null,
      };
      setAudience('member', user);
      state.user = user;
      state.audience = 'member';

      notify(t('toast.login_success'), 'success');
      const returnPath = safeReturnPath(sessionStorage.getItem('zenmarket_return_path'), '/account/index.html');
      sessionStorage.removeItem('zenmarket_return_path');
      window.location.href = returnPath;
    } catch (err) {
      console.error('[ZenMarket] login failed');
      document.getElementById('login-password').value = '';
      notify(t('auth.invalid_credentials'), 'error');
      btn.disabled = false;
      btn.textContent = t('auth.submit_login');
    }
  });
}

function initRegisterPage() {
  const form = document.getElementById('register-form');
  if (!form) return;
  bindPasswordStrength('register-password', 'register-password-hint');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim().toLowerCase();
    const email = document.getElementById('register-email').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const firstName = document.getElementById('register-first-name').value.trim();
    const lastName = document.getElementById('register-last-name').value.trim();
    const age = document.getElementById('register-age').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (!USERNAME_PATTERN.test(username)) {
      notify(t('validation.username_invalid'), 'error');
      return;
    }
    const normalizedPhone = normalizeThaiPhone(phone);
    if (!normalizedPhone) {
      notify(t('validation.phone_invalid'), 'error');
      return;
    }

    const profile = validateProfile(
      {
        username,
        first_name: firstName,
        last_name: lastName,
        age: age === '' ? null : Number(age),
        phone: normalizedPhone,
      },
      { requireNames: true },
    );
    if (!profile.ok) {
      notify(t(profile.errorKey), 'error');
      return;
    }

    if (password !== confirmPassword) {
      notify(t('auth.password_mismatch'), 'error');
      return;
    }
    const strength = passwordStrength(password);
    if (!strength.ok) {
      notify(t(strength.errorKey), 'error');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = t('common.loading');

    try {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            phone: normalizedPhone,
            first_name: profile.value.first_name,
            last_name: profile.value.last_name,
            age: profile.value.age,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        await state.supabase.rpc('save_profile', {
          p_first_name: profile.value.first_name,
          p_last_name: profile.value.last_name,
          p_nickname: null,
          p_phone: normalizedPhone,
          p_age: profile.value.age,
          p_username: username,
        });
      }

      notify(t('toast.register_success'), 'success');
      setTimeout(() => {
        window.location.href = '/auth/login.html';
      }, 700);
    } catch (err) {
      console.error('[ZenMarket] registration failed');
      const message = /already registered/i.test(err?.message || '') ? t('auth.email_taken') : t('toast.error_generic');
      notify(message, 'error');
      btn.disabled = false;
      btn.textContent = t('auth.submit_register');
    }
  });
}

function initForgotPasswordPage() {
  const form = document.getElementById('forgot-password-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = t('common.loading');

    try {
      const { error } = await state.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password.html`,
      });
      if (error) throw error;
      notify(t('auth.forgot_sent'), 'success');
      form.reset();
    } catch (err) {
      console.error(err);
      notify(err.message || t('toast.error_generic'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('auth.forgot_submit');
    }
  });
}

function initResetPasswordPage() {
  const form = document.getElementById('reset-password-form');
  if (!form) return;
  bindPasswordStrength('reset-password', 'reset-password-hint');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (password !== confirmPassword) {
      notify(t('auth.password_mismatch'), 'error');
      return;
    }
    const strength = passwordStrength(password);
    if (!strength.ok) {
      notify(t(strength.errorKey), 'error');
      return;
    }

    try {
      const { error } = await state.supabase.auth.updateUser({ password });
      if (error) throw error;
      notify(t('auth.reset_success'), 'success');
      setTimeout(() => {
        window.location.href = '/auth/login.html';
      }, 700);
    } catch (err) {
      notify(err.message || t('toast.error_generic'), 'error');
    }
  });
}

async function initAccountPage() {
  if (!isSignedIn() || !state.user) {
    sessionStorage.setItem('zenmarket_return_path', window.location.pathname + window.location.search);
    window.location.href = '/auth/login.html';
    return;
  }

  const user = state.user;
  renderAccountIdentity(user);

  document.getElementById('profile-username').value = user.username || '';
  document.getElementById('profile-firstname').value = user.first_name || '';
  document.getElementById('profile-lastname').value = user.last_name || '';
  document.getElementById('profile-phone').value = user.phone || '';

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const checked = validateProfile({
        first_name: document.getElementById('profile-firstname').value,
        last_name: document.getElementById('profile-lastname').value,
        nickname: user.nickname || '',
        phone: document.getElementById('profile-phone').value,
        age: user.age ?? null,
        username: document.getElementById('profile-username').value || user.username,
      });
      if (!checked.ok) {
        notify(t(checked.errorKey), 'error');
        return;
      }

      const { error } = await state.supabase.rpc('save_profile', {
        p_first_name: checked.value.first_name,
        p_last_name: checked.value.last_name,
        p_nickname: checked.value.nickname,
        p_phone: checked.value.phone,
        p_age: checked.value.age,
        p_username: checked.value.username,
      });
      if (error) throw error;
      notify(t('account.profile_saved'), 'success');
    } catch (err) {
      notify(err.message || t('toast.error_generic'), 'error');
    }
  });

  document.querySelectorAll('.side-nav a[data-tab]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.side-nav a').forEach((a) => a.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.account-section').forEach((s) => s.classList.add('hidden'));
      document.getElementById(`account-${link.getAttribute('data-tab')}`).classList.remove('hidden');
    });
  });

  await loadRecentOrders(user);
  initAddressForm(user);
  await loadAddresses(user);

  onLanguageChange(() => {
    renderAccountIdentity(user);
    loadRecentOrders(user);
    loadAddresses(user);
  });
}

function renderAccountIdentity(user) {
  if (!user) return;
  const nameEl = document.getElementById('account-name');
  const emailEl = document.getElementById('account-email');
  const avatarEl = document.getElementById('account-avatar');
  if (!nameEl) return;

  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email || t('common.user');
  nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = user.email || '';
  if (avatarEl) {
    const initial = (displayName[0] || t('common.user')[0] || '?').toUpperCase();
    avatarEl.textContent = initial;
  }
}

async function loadRecentOrders(user) {
  const list = document.getElementById('customer-orders-list');
  if (!list) return;
  try {
    const { data: orders } = await state.supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    if (orders && orders.length) {
      list.innerHTML = orders
        .map(
          (o) => `
        <a href="/account/order.html?id=${o.id}" class="flex justify-between items-center" style="padding:0.75rem 0;border-bottom:1px solid var(--color-border-soft)">
          <span class="font-semibold">#${o.id.slice(0, 8)} <span class="text-muted" style="font-weight:400">${o.created_at ? new Date(o.created_at).toLocaleDateString('th-TH') : ''}</span></span>
          <span class="text-accent font-semibold">${formatTHB(o.total)}</span>
        </a>
      `,
        )
        .join('');
    } else {
      list.innerHTML = `<p class="text-muted text-sm">${t('account.no_orders')}</p>`;
    }
  } catch (err) {
    console.warn('[ZenMarket] load recent orders failed', err);
  }
}

async function loadAddresses(user) {
  const list = document.getElementById('addresses-list');
  if (!list) return;

  try {
    const { data: addresses, error } = await state.supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;

    if (!addresses || addresses.length === 0) {
      list.innerHTML = `<p class="text-muted text-sm">${t('account.no_address')}</p>`;
      return;
    }

    list.innerHTML = addresses
      .map(
        (a) => `
      <div class="panel" style="padding:1rem;margin-bottom:0.75rem">
        <div class="flex justify-between items-center">
          <div class="font-semibold">${escapeHTML(a.label || t('account.address_label'))}</div>
          ${a.is_default ? `<span class="badge badge-success">${t('account.default_badge')}</span>` : ''}
        </div>
        <div class="text-secondary text-sm">${escapeHTML(a.recipient || '')} ${escapeHTML(a.phone || '')}</div>
        <div class="text-secondary text-sm">${escapeHTML(a.address || '')}</div>
        <div class="flex gap-sm mt-sm" style="flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" data-edit-address="${a.id}">${t('common.edit')}</button>
          <button class="btn btn-danger btn-sm" data-del-address="${a.id}">${t('common.delete')}</button>
        </div>
      </div>
    `,
      )
      .join('');

    list.querySelectorAll('[data-edit-address]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = addresses.find((x) => x.id === btn.getAttribute('data-edit-address'));
        if (!target) return;
        openAddressForm(target);
      });
    });

    list.querySelectorAll('[data-del-address]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!window.confirm(t('account.delete_address_confirm'))) return;
        try {
          const { error } = await state.supabase.rpc('delete_address', { p_id: btn.getAttribute('data-del-address') });
          if (error) throw error;
          notify(t('account.address_deleted'), 'success');
          loadAddresses(user);
        } catch (err) {
          notify(err.message || t('toast.error_generic'), 'error');
        }
      });
    });
  } catch (err) {
    console.warn('[ZenMarket] load addresses failed', err);
    list.innerHTML = `<p class="text-muted text-sm">${t('toast.error_generic')}</p>`;
  }
}

function openAddressForm(address = null) {
  const form = document.getElementById('address-form');
  if (!form) return;
  const labelInput = document.getElementById('address-label');
  const recipientInput = document.getElementById('address-recipient');
  const phoneInput = document.getElementById('address-phone');
  const addressInput = document.getElementById('address-address');
  const defaultInput = document.getElementById('address-default');
  const title = document.getElementById('address-form-title');

  form.dataset.addressId = address?.id || '';
  if (title) title.textContent = address ? t('account.edit_address') : t('account.add_address');
  labelInput.value = address?.label || '';
  recipientInput.value = address?.recipient || '';
  phoneInput.value = address?.phone || '';
  addressInput.value = address?.address || '';
  defaultInput.checked = !!address?.is_default;

  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function initAddressForm(user) {
  const form = document.getElementById('address-form');
  if (!form) return;

  const addBtn = document.getElementById('address-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => openAddressForm(null));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const checked = validateAddress({
        label: document.getElementById('address-label').value,
        recipient: document.getElementById('address-recipient').value,
        phone: document.getElementById('address-phone').value,
        address: document.getElementById('address-address').value,
      });
      if (!checked.ok) {
        notify(t(checked.errorKey), 'error');
        return;
      }

      const { error } = await state.supabase.rpc('save_address', {
        p_id: form.dataset.addressId || null,
        p_label: checked.value.label,
        p_recipient: checked.value.recipient,
        p_phone: checked.value.phone,
        p_address: checked.value.address,
        p_default: document.getElementById('address-default').checked,
      });
      if (error) throw error;
      notify(t('account.address_saved'), 'success');
      form.classList.add('hidden');
      form.reset();
      loadAddresses(user);
    } catch (err) {
      notify(err.message || t('toast.error_generic'), 'error');
    }
  });

  const cancelBtn = document.getElementById('address-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      form.classList.add('hidden');
      form.reset();
    });
  }
}

async function initFavoritesPage() {
  if (!isSignedIn() || !state.user) {
    sessionStorage.setItem('zenmarket_return_path', window.location.pathname + window.location.search);
    window.location.href = '/auth/login.html';
    return;
  }

  const grid = document.getElementById('favorites-grid');
  if (!grid) return;

  async function render() {
    grid.innerHTML = '<div class="skeleton" style="height:220px"></div>';
    try {
      const products = await loadFavoriteProducts();
      if (!products.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.7-7.8 1.1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
          <p>${t('account.favorites_empty')}</p>
          <a href="/shop/index.html" class="btn btn-primary mt-md">${t('home.cta_shop')}</a>
        </div>`;
        return;
      }

      grid.innerHTML = '';
      products.forEach((product) => {
        const card = document.createElement('article');
        card.className = 'card product-card reveal';
        const image = product.image_url ? safeImage(product.image_url) : '/images/placeholder.svg';
        const favActive = isFavorite(product.id);
        card.innerHTML = `
          <div class="thumb">
            <img src="${image}" alt="${escapeHTML(product.name)}" loading="lazy">
            <button class="favorite-btn ${favActive ? 'active' : ''}" data-favorite="${product.id}" title="${t(favActive ? 'product.favorite_remove' : 'product.favorite_add')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.7-7.8 1.1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
            </button>
            <button class="btn btn-primary btn-sm quick-add" data-add-to-cart="${product.id}">${t('product.add_to_cart')}</button>
          </div>
          <div class="body">
            <span class="cat">${escapeHTML(product.category || '')}</span>
            <h3 class="name">${escapeHTML(product.name)}</h3>
            <div class="foot">
              <span class="price">${formatTHB(product.price)}</span>
              <span class="stock-tag ${getStockStatusClass(product.stock)}">${getStockStatusText(product.stock)}</span>
            </div>
          </div>
        `;
        card.addEventListener('click', async (e) => {
          if (e.target.closest('[data-add-to-cart]')) return;
          const favBtn = e.target.closest('[data-favorite]');
          if (favBtn) {
            e.preventDefault();
            e.stopPropagation();
            const result = await toggleFavorite(product.id);
            if (result === null) return;
            if (!result) {
              card.remove();
              if (!grid.querySelector('.product-card')) render();
            } else {
              favBtn.classList.add('active');
            }
            return;
          }
          window.location.href = `/shop/product.html?id=${product.id}`;
        });
        grid.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>${t('toast.error_generic')}</p></div>`;
    }
  }

  await render();
  onLanguageChange(() => render());
}
