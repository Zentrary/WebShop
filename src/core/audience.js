export const AUDIENCE_GUEST = 'guest';
export const AUDIENCE_MEMBER = 'member';
export const AUDIENCE_OWNER = 'owner';

let currentAudience = AUDIENCE_GUEST;
let currentUser = null;
let customerViewMode = false;

export function setAudience(audience, user = null) {
  currentAudience = audience;
  currentUser = user;
  localStorage.setItem('zenmarket_audience', audience);
  if (user) {
    localStorage.setItem('zenmarket_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('zenmarket_user');
  }
}

export function getAudience() {
  if (currentAudience) return currentAudience;
  const stored = localStorage.getItem('zenmarket_audience');
  if (stored) currentAudience = stored;
  return currentAudience || AUDIENCE_GUEST;
}

export function getCurrentUser() {
  if (currentUser) return currentUser;
  try {
    const stored = localStorage.getItem('zenmarket_user');
    if (stored) currentUser = JSON.parse(stored);
  } catch {}
  return currentUser || null;
}

export function isOwner() {
  return getAudience() === AUDIENCE_OWNER;
}

export function isMember() {
  return getAudience() === AUDIENCE_MEMBER;
}

export function isGuest() {
  return getAudience() === AUDIENCE_GUEST;
}

export function setCustomerView(enabled) {
  customerViewMode = enabled;
  localStorage.setItem('zenmarket_customer_view', String(enabled));
}

export function getCustomerView() {
  if (customerViewMode !== undefined) return customerViewMode;
  customerViewMode = localStorage.getItem('zenmarket_customer_view') === 'true';
  return customerViewMode;
}

export function logout() {
  currentAudience = AUDIENCE_GUEST;
  currentUser = null;
  customerViewMode = false;
  localStorage.removeItem('zenmarket_audience');
  localStorage.removeItem('zenmarket_user');
  localStorage.removeItem('zenmarket_customer_view');
  localStorage.removeItem('zenmarket_session_token');
}