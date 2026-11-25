/**
 * ทะเบียนขนส่งไทย (ใช้ร่วมกันระหว่างหน้าแอดมินและหน้าลูกค้า)
 * - url(tracking) คืนลิงก์หน้าตรวจสอบพัสดุของขนส่ง (null = ไม่มีหน้าเฉพาะ ต้องคัดลอกเลขไปวางเอง)
 * - detect(tracking) ใช้ "เดา" ขนส่งจากรูปแบบเลขพัสดุแบบที่มั่นใจสูงเท่านั้น ที่เหลือให้เลือกเอง
 */
import { t } from '/src/core/i18n.js';

export const CARRIERS = [
  {
    slug: 'thailand_post',
    nameKey: 'carrier.thailand_post',
    url: (tracking) => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(tracking || '')}`,
    detect: (value) => /^[A-Za-z]{2}\d{9}TH$/.test(value),
  },
  {
    slug: 'kex',
    nameKey: 'carrier.kex',
    url: () => 'https://th.kex-express.com/th/track/',
    detect: (value) => /^(PRO|KEX)\d/i.test(value),
  },
  {
    slug: 'flash',
    nameKey: 'carrier.flash',
    url: () => 'https://www.flashexpress.co.th/tracking/',
    detect: () => false,
  },
  {
    slug: 'jt',
    nameKey: 'carrier.jt',
    url: () => 'https://www.jtexpress.co.th/tracking',
    detect: () => false,
  },
  {
    slug: 'spx',
    nameKey: 'carrier.spx',
    url: () => 'https://spx.co.th/track',
    detect: (value) => /^TH\d{10,}$/i.test(value),
  },
  {
    slug: 'other',
    nameKey: 'carrier.other',
    url: () => null,
    detect: () => false,
  },
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

/** ลิงก์หน้าตรวจสอบพัสดุ หรือ null ถ้าขนส่งไม่มีหน้าเฉพาะ */
export function carrierTrackingUrl(slug, tracking) {
  const carrier = getCarrier(slug);
  if (!carrier) return null;
  return carrier.url(String(tracking || '').trim());
}

/** เติม <select> ตัวเลือกขนส่ง (ใช้ทั้งหน้าแอดมิน) */
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
