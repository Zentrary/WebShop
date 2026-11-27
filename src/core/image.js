/**
 * งานภาพของหลังบ้าน: อ่านไฟล์รูป, ทำ "ลายนิ้วมือ" เพื่อตรวจรูปซ้ำ
 * และคำนวณเรขาคณิตที่ใช้ทั้งตอนพรีวิวและตอนตัดรูปจริง
 *
 * ทุกอย่างทำงานในเบราว์เซอร์ ไม่ต้องพึ่งไลบรารีภายนอก
 */

const HASH_W = 9;
const HASH_H = 8;

/** โหลดไฟล์รูปเป็น HTMLImageElement + คืน object URL ให้ผู้เรียก revoke เอง */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      reject(new Error('invalid-type'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode-failed'));
    };
    img.src = url;
  });
}

/**
 * โหลดรูปจาก URL (ใช้ตรวจรูปที่พิมพ์ URL เองหรือรูปเก่าในฐานข้อมูล)
 * ถ้าเซิร์ฟเวอร์ไม่ส่ง CORS มาให้ จะได้ error ตอนอ่านพิกเซล แล้วผู้เรียกจัดการต่อ
 */
export function urlToImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('no-url'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load-failed'));
    img.src = url;
  });
}

function canvasContext(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas-unavailable');
  // พื้นขาวก่อนวาด เพื่อไม่ให้รูปโปร่งใสกลายเป็นดำตอนคำนวณความสว่าง
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  return ctx;
}

/**
 * dHash (difference hash) ขนาด 8x8 = 64 บิต เขียนเป็น hex 16 ตัว
 * - ย่อรูปเป็น 9x8 แล้วเทียบความสว่างของพิกเซลข้างกัน
 * - ทนต่อการบีบอัด/ย่อขนาด และไม่สนใจสัดส่วนรูป (บีบเป็นตารางเท่ากันหมด)
 */
export function dHash(source) {
  if (!source) return '';
  const ctx = canvasContext(HASH_W, HASH_H);
  try {
    ctx.drawImage(source, 0, 0, HASH_W, HASH_H);
  } catch {
    return '';
  }
  let data;
  try {
    data = ctx.getImageData(0, 0, HASH_W, HASH_H).data;
  } catch {
    // canvas ถูกทำให้เสียสิทธิ์ (รูปต่างโดเมนที่ไม่มี CORS)
    return '';
  }
  const gray = new Float32Array(HASH_W * HASH_H);
  for (let i = 0; i < HASH_W * HASH_H; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  let bits = '';
  for (let y = 0; y < HASH_H; y++) {
    for (let x = 0; x < HASH_W - 1; x++) {
      bits += gray[y * HASH_W + x] < gray[y * HASH_W + x + 1] ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** ระยะห่าง Hamming ระหว่างสอง hash (0 = เหมือนกันเป๊ะ, 64 = ต่างกันสุดขั้ว) */
export function hashDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16);
    const y = parseInt(b[i], 16);
    if (Number.isNaN(x) || Number.isNaN(y)) return Infinity;
    let z = x ^ y;
    while (z) {
      diff += z & 1;
      z >>= 1;
    }
  }
  return diff;
}

/** แปลงระยะห่างเป็นเปอร์เซ็นต์ความเหมือน (ใช้แสดงให้แอดมินเห็นภาพ) */
export function hashSimilarity(distance) {
  if (!Number.isFinite(distance)) return 0;
  return Math.max(0, Math.round((1 - distance / 64) * 100));
}

/** ระยะห่างที่ถือว่า "รูปเดียวกัน" — 10/64 เผื่อการบีบอัด/ย่อขนาดเล็กน้อย */
export const SAME_IMAGE_DISTANCE = 10;

/* ------------------------------------------------------------------ *
 * เรขาคณิตของตัวแก้ไขรูป (crop / หมุน / ซูม)
 * ใช้หน่วย CSS px ของ "เวที" (stage) ทั้งหมด เพื่อให้พรีวิวกับไฟล์ที่
 * ได้ออกมาตรงกันเป๊ะ เพราะวาดด้วยฟังก์ชันเดียวกัน
 * ------------------------------------------------------------------ */

export function normalizeAngle(deg) {
  const value = Math.round(Number(deg) || 0) % 360;
  return value < 0 ? value + 360 : value;
}

/** ขนาดของรูปหลังหมุน 90° ทีละครั้ง */
export function rotatedSize(width, height, angle) {
  const a = normalizeAngle(angle);
  return a === 90 || a === 270 ? { width: height, height: width } : { width, height };
}

/** กรอบตัดรูป: อยู่กลางเวที ขนาดพอดีกับสัดส่วนที่เลือก และเผื่อขอบรอบด้าน */
export function cropFrame(stageWidth, stageHeight, aspect) {
  const pad = Math.min(stageWidth, stageHeight) * 0.08;
  const maxW = Math.max(80, stageWidth - pad * 2);
  const maxH = Math.max(80, stageHeight - pad * 2);
  const ratio = aspect > 0 ? aspect : 1;
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  return {
    x: (stageWidth - width) / 2,
    y: (stageHeight - height) / 2,
    width,
    height,
  };
}

/**
 * คำนวณสเกล/ตำแหน่งจริงของรูปในขณะหนึ่ง
 * - cover = สเกลที่ทำให้รูป "เต็ม" กรอบตัดพอดีตอนซูม 1 เท่า
 * - จำกัดการเลื่อนไม่ให้กรอบตัดหลุดออกนอกเนื้อรูป
 */
export function computeLayout({ imageWidth, imageHeight, angle, zoom, offset, stage, frame }) {
  const size = rotatedSize(imageWidth, imageHeight, angle);
  const cover = Math.max(frame.width / size.width, frame.height / size.height) || 1;
  const scale = cover * Math.max(1, Number(zoom) || 1);
  const halfW = (size.width * scale) / 2;
  const halfH = (size.height * scale) / 2;
  const limitX = Math.max(0, halfW - frame.width / 2);
  const limitY = Math.max(0, halfH - frame.height / 2);
  const clamp = (value, limit) => Math.min(limit, Math.max(-limit, Number(value) || 0));
  const clamped = { x: clamp(offset?.x, limitX), y: clamp(offset?.y, limitY) };
  return {
    scale,
    cover,
    offset: clamped,
    limitX,
    limitY,
    centerX: stage.width / 2 + clamped.x,
    centerY: stage.height / 2 + clamped.y,
    rotatedWidth: size.width,
    rotatedHeight: size.height,
    // ความกว้างของเนื้อรูป (px จริง) ที่ปรากฏในกรอบตัด ใช้จำกัดความละเอียดตอนบันทึก
    sourceWidthInFrame: frame.width / scale,
  };
}

/** วาดรูปตามสถานะปัจจุบันลงใน context ที่เตรียมไว้ (หน่วยเป็น CSS px ของเวที) */
export function paintImage(ctx, { img, angle, flip, layout }) {
  ctx.save();
  ctx.translate(layout.centerX, layout.centerY);
  ctx.rotate((normalizeAngle(angle) * Math.PI) / 180);
  ctx.scale(layout.scale, layout.scale);
  if (flip) ctx.scale(-1, 1);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
