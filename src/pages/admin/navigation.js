/**
 * ZenMarket Admin Navigation
 * แถบเมนูหลังบ้าน 8 เมนู (Sidebar บนจอใหญ่ + `<details class="workspace-mobile-nav">` บนจอมือถือ)
 */

import { isOwner, logout } from '/src/core/audience.js';

document.addEventListener('DOMContentLoaded', () => {
  if (!isOwner()) {
    window.location.href = '/admin/login.html';
    return;
  }

  const logoutBtn = document.getElementById('admin-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
      window.location.href = '/admin/login.html';
    });
  }
});