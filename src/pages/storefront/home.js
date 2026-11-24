/**
 * ZenMarket Home Page
 * หน้าแรก Editorial (Hero, 3 ขั้นตอนสั่งซื้อ, รีวิวจริง 4-5 ดาว, FAQ Accordion, การ์ดติดต่อ)
 */

import { initApp } from '/src/app.js';
import { t, translatePage } from '/src/core/i18n.js';
import { notify } from '/src/core/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  translatePage();

  // FAQ Accordion
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = btn.nextElementSibling;
      const isOpen = !answer.classList.contains('hidden');
      
      // Close all answers
      document.querySelectorAll('.faq-answer').forEach(a => {
        a.classList.add('hidden');
      });
      
      // Toggle current
      if (!isOpen) {
        answer.classList.remove('hidden');
      }
    });
  });
});