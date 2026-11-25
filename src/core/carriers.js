/**
 * ทะเบียนขนส่งไทย — ใช้แค่ "ชื่อขนส่ง" ที่แนบไปกับเลขพัสดุ
 * ไม่มีการเรียก API / ไม่มีลิงก์ไปหน้าขนส่ง: ลูกค้าคัดลอกเลขพัสดุไปเช็กเองได้
 */
import { t } from '/src/core/i18n.js';

export const CARRIERS = [
  { slug: 'thailand_post', nameKey: 'carrier.thailand_post', detect: (value) => /^[A-Za-z]{2}\d{9}TH$/.test(value) },
  { slug: 'kex', nameKey: 'carrier.kex', detect: (value) => /^(PRO|KEX)\d/i.test(value) },
  { slug: 'flash', nameKey: 'carrier.flash', detect: () => false },
  { slug: 'jt', nameKey: 'carrier.jt', detect: () => false },
  { slug: 'spx', nameKey: 'carrier.spx', detect: (value) => /^TH\d{10,}$/i.test(value) },
  { slug: 'other', nameKey: 'carrier.other', detect: () => false },
];

export const CARRIER_SLUGS = CARRIERS.map((carrier) => carrier.slug);

export function getCarrier(slug) {
  return CARRIERS.find((carrier) => carrier.slug === slug) || null;
}

/** ชื่อขนส่งตามภาษาปัจจุบัน (คืนค่าว่างถ้าไม่ได้ระบุ) */
export function carrierLabel(slug) {
  if (!slug) return '';
  const carrier = getCarrier(slug);
  return carrier ? t(carrier.nameKey) : '';
}

/** เดาชนส่งจากรูปแบบเลขพัสดุ — คืน slug หรือ '' ถ้าไม่มั่นใจ */
export function detectCarrier(tracking) {
  const value = String(tracking || '').replace(/\s+/g, '');
  if (!value) return '';
  const found = CARRIERS.find((carrier) => carrier.detect(value));
  return found && found.slug !== 'other' ? found.slug : '';
}

/** เติม <select> ตัวเลือกขนส่ง (ใช้ในหน้าแอดมิน) */
export function fillCarrierSelect(select, selected) {
  if (!select) return;
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = t('admin.carrier_none');
  select.appendChild(blank);
  CARRIERS.forEach((carrier) => {
    const option = document.createElement('option');
    option.value = carrier.slug;
    option.textContent = t(carrier.nameKey);
    select.appendChild(option);
  });
  select.value = selected && getCarrier(selected) ? selected : '';
}
