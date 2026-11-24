export const AUDIENCE_GUEST = 'guest';
export const AUDIENCE_MEMBER = 'member';
export const AUDIENCE_OWNER = 'owner';

let currentAudience = null;
let currentUser = null;
let customerViewMode = null;

export function setAudience(audience, user = null) {
  currentAudience = audience;
  currentUser = user;
  try {
    localStorage.setItem('zenmarket_audience', audience);
    if (user) {
      localStorage.setItem('zenmarket_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('zenmarket_user');
    }
  } catch {}
}

export function getAudience() {
  if (currentAudience) return currentAudience;
  try {
    const stored = localStorage.getItem('zenmarket_audience');
    if (stored === AUDIENCE_MEMBER || stored === AUDIENCE_OWNER || stored === AUDIENCE_GUEST) {
      currentAudience = stored;
    } else {
      currentAudience = AUDIENCE_GUEST;
    }
  } catch {
    currentAudience = AUDIENCE_GUEST;
  }
  return currentAudience;
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

export function isSignedIn() {
  return isMember() || isOwner();
}

export function setCustomerView(enabled) {
  customerViewMode = enabled;
  try {
    localStorage.setItem('zenmarket_customer_view', String(enabled));
  } catch {}
}

export function getCustomerView() {
  if (customerViewMode !== null) return customerViewMode;
  try {
    customerViewMode = localStorage.getItem('zenmarket_customer_view') === 'true';
  } catch {
    customerViewMode = false;
  }
  return customerViewMode;
}

export function logout() {
  currentAudience = AUDIENCE_GUEST;
  currentUser = null;
  customerViewMode = false;
  try {
    localStorage.removeItem('zenmarket_audience');
    localStorage.removeItem('zenmarket_user');
    localStorage.removeItem('zenmarket_customer_view');
    localStorage.removeItem('zenmarket_session_token');
  } catch {}
}

export function clearStaleRole() {
  if (currentAudience === AUDIENCE_GUEST && !currentUser) return;
  logout();
}
