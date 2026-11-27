/**
 * ตัวแก้ไขรูปสินค้า (หมุน / พลิก / ซูม / ย้าย / ครอปตามสัดส่วน)
 * ใช้ <dialog> เดียวในหน้า /admin/products — เปิดแล้วคืนค่าเป็น blob พร้อมอัปโหลด
 *
 * แนวคิด: กรอบตัดอยู่กลางจอเสมอ ผู้ใช้เลื่อน/ซูม "รูป" ใต้กรอบ (เหมือนแอปมือถือ)
 * จึงไม่ต้องลากมุมกรอบบนจอเล็ก และผลลัพธ์ตรงกับที่เห็นเพราะพรีวิวกับไฟล์จริง
 * วาดด้วยฟังก์ชันเดียวกัน (paintImage)
 */
import { t } from '/src/core/i18n.js';
import { cropFrame, computeLayout, paintImage, normalizeAngle, dHash } from '/src/core/image.js';

const TARGET_SIZES = [800, 1200, 1600];
const DEFAULT_SIZE = 1200;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

let initialized = false;
let session = null;

const el = (id) => document.getElementById(id);

/** true ถ้าหน้านี้มี markup ของตัวแก้ไขรูป (หน้าอื่นไม่ต้องพัง) */
export function hasImageEditor() {
  return !!el('image-editor');
}

function applyTranslations() {
  const dialog = el('image-editor');
  if (!dialog) return;
  dialog.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.getAttribute('data-i18n'));
  });
  dialog.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
    node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria-label')));
  });
}

function setupOnce() {
  if (initialized || !el('image-editor')) return;
  initialized = true;
  const dialog = el('image-editor');
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    session?.cancel();
  });
  el('image-editor-close')?.addEventListener('click', () => session?.cancel());
  el('image-editor-cancel')?.addEventListener('click', () => session?.cancel());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) session?.cancel();
  });
}

/**
 * เปิดตัวแก้ไขรูป
 * @param {File} file
 * @returns {Promise<{blob: Blob, hash: string, width: number, height: number, name: string} | null>}
 *          null = ผู้ใช้ยกเลิก
 */
export async function openImageEditor(file) {
  if (!file || !hasImageEditor()) return null;
  setupOnce();
  session?.cancel();

  const dialog = el('image-editor');
  const stage = el('image-editor-stage');
  const canvas = el('image-editor-canvas');
  const frameEl = el('image-editor-frame');
  const zoomInput = el('image-editor-zoom');
  const zoomValue = el('image-editor-zoom-value');
  const aspects = el('image-editor-aspects');
  const sizeSelect = el('image-editor-size');
  const status = el('image-editor-status');
  const applyBtn = el('image-editor-apply');
  const subEl = el('image-editor-sub');
  const outNote = el('image-editor-output');

  applyTranslations();
  if (status) status.textContent = '';
  if (subEl) {
    subEl.textContent = '';
    subEl.hidden = true;
  }

  const state = {
    img: null,
    angle: 0,
    flip: false,
    zoom: 1,
    offset: { x: 0, y: 0 },
    aspect: 1,
    outSize: DEFAULT_SIZE,
    keepAlpha: false,
    frame: null,
    layout: null,
  };

  if (sizeSelect) {
    sizeSelect.innerHTML = TARGET_SIZES.map(
      (size) => `<option value="${size}"${size === DEFAULT_SIZE ? ' selected' : ''}>${size} px</option>`,
    ).join('');
    sizeSelect.value = String(DEFAULT_SIZE);
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ctx = canvas.getContext('2d');
  let raf = 0;
  let observer = null;

  /* ---------- listener registry: เก็บไว้ถอดตอนปิด ไม่ให้ซ้ำเมื่อเปิดใหม่ ---------- */
  const bindings = [];
  const on = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    bindings.push(() => target.removeEventListener(type, handler, options));
  };

  const syncZoomLabel = () => {
    if (zoomInput) zoomInput.value = String(state.zoom);
    if (zoomValue) zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  };

  const setAspectButton = () => {
    aspects?.querySelectorAll('[data-aspect]').forEach((btn) => {
      const active = Math.abs(Number(btn.getAttribute('data-aspect')) - state.aspect) < 0.001;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  /** ขนาดไฟล์ที่จะได้จริง — ใช้ทั้งป้ายบอกผู้ใช้และตอนเรนเดอร์ เพื่อไม่ให้เลขไม่ตรงกัน */
  const outputDims = () => {
    if (!state.frame || !state.layout) return null;
    // ไม่ขยายเกินความละเอียดจริง: ครอปพื้นที่เล็กก็ไม่ต้องเรนเดอร์ใหญ่ตาม
    const sourceWidth = Math.round(state.layout.sourceWidthInFrame || state.outSize);
    const outWidth = Math.max(240, Math.min(state.outSize, sourceWidth));
    const outHeight = Math.max(1, Math.round((state.frame.height / state.frame.width) * outWidth));
    return { outWidth, outHeight };
  };

  const syncOutputNote = () => {
    if (!outNote) return;
    const dims = outputDims();
    if (!dims) {
      outNote.textContent = '';
      outNote.classList.remove('is-low');
      return;
    }
    // ถ้าได้เล็กกว่าที่เลือก แปลว่าเต็มความละเอียดของรูปต้นฉบับแล้ว (ไม่ยืดรูปให้แตก)
    const limited = dims.outWidth < state.outSize;
    outNote.textContent = limited
      ? t('admin.image_output_limited', { w: dims.outWidth, h: dims.outHeight })
      : t('admin.image_output', { w: dims.outWidth, h: dims.outHeight });
    outNote.classList.toggle('is-low', limited);
  };

  const measure = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height || !state.img) return false;
    state.frame = cropFrame(width, height, state.aspect);
    state.layout = computeLayout({
      imageWidth: state.img.naturalWidth,
      imageHeight: state.img.naturalHeight,
      angle: state.angle,
      zoom: state.zoom,
      offset: state.offset,
      stage: { width, height },
      frame: state.frame,
    });
    state.offset = { ...state.layout.offset };
    if (frameEl) {
      frameEl.style.left = `${state.frame.x}px`;
      frameEl.style.top = `${state.frame.y}px`;
      frameEl.style.width = `${state.frame.width}px`;
      frameEl.style.height = `${state.frame.height}px`;
    }
    syncOutputNote();
    return true;
  };

  const paint = () => {
    if (!state.layout || !state.img) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintImage(ctx, { img: state.img, angle: state.angle, flip: state.flip, layout: state.layout });
  };

  const render = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (measure()) paint();
    });
  };

  const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const rotate = (delta) => {
    state.angle = normalizeAngle(state.angle + delta);
    state.offset = { x: 0, y: 0 };
    render();
  };

  const flip = () => {
    state.flip = !state.flip;
    render();
  };

  const reset = () => {
    state.angle = 0;
    state.flip = false;
    state.zoom = 1;
    state.offset = { x: 0, y: 0 };
    state.aspect = 1;
    syncZoomLabel();
    setAspectButton();
    render();
  };

  /* ---------- ลาก / หยิกซูม / ล้อเมาส์ ---------- */
  const pointers = new Map();
  let pinchStart = 0;
  let pinchZoom = 1;

  const onPointerDown = (event) => {
    if (!state.img) return;
    stage.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      pinchZoom = state.zoom;
    }
    stage.classList.add('is-grabbing');
  };

  const onPointerMove = (event) => {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    const previous = { x: point.x, y: point.y };
    point.x = event.clientX;
    point.y = event.clientY;
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      state.zoom = clampZoom((pinchZoom * distance) / pinchStart);
      syncZoomLabel();
      render();
      return;
    }
    state.offset = {
      x: state.offset.x + (point.x - previous.x),
      y: state.offset.y + (point.y - previous.y),
    };
    render();
  };

  const onPointerUp = (event) => {
    pointers.delete(event.pointerId);
    if (!pointers.size) stage.classList.remove('is-grabbing');
    if (pointers.size < 2) pinchStart = 0;
  };

  const onWheel = (event) => {
    if (!state.img) return;
    event.preventDefault();
    const next = clampZoom(state.zoom * (event.deltaY < 0 ? 1.08 : 0.92));
    if (next === state.zoom) return;
    state.zoom = next;
    syncZoomLabel();
    render();
  };

  const onZoomInput = () => {
    state.zoom = clampZoom(Number(zoomInput?.value) || 1);
    syncZoomLabel();
    render();
  };

  const onAspectClick = (event) => {
    const btn = event.target.closest('[data-aspect]');
    if (!btn) return;
    state.aspect = Number(btn.getAttribute('data-aspect')) || 1;
    state.offset = { x: 0, y: 0 };
    setAspectButton();
    render();
  };

  const onKeyDown = (event) => {
    if (!state.img) return;
    const step = event.shiftKey ? 24 : 8;
    switch (event.key) {
      case 'ArrowLeft':
        state.offset.x -= step;
        break;
      case 'ArrowRight':
        state.offset.x += step;
        break;
      case 'ArrowUp':
        state.offset.y -= step;
        break;
      case 'ArrowDown':
        state.offset.y += step;
        break;
      case '+':
      case '=':
        state.zoom = clampZoom(state.zoom * 1.1);
        syncZoomLabel();
        break;
      case '-':
        state.zoom = clampZoom(state.zoom / 1.1);
        syncZoomLabel();
        break;
      default:
        return;
    }
    event.preventDefault();
    render();
  };

  const onRotateLeft = () => rotate(-90);
  const onRotateRight = () => rotate(90);
  const onSizeChange = () => {
    state.outSize = Number(sizeSelect?.value) || DEFAULT_SIZE;
    syncOutputNote();
  };

  /* ---------- สร้างไฟล์ผลลัพธ์ ---------- */
  async function exportBlob() {
    measure();
    const frame = state.frame;
    const layout = state.layout;
    const dims = outputDims();
    if (!dims) throw new Error('not-ready');
    const { outWidth, outHeight } = dims;
    const out = document.createElement('canvas');
    out.width = outWidth;
    out.height = outHeight;
    const octx = out.getContext('2d');
    if (state.keepAlpha) {
      octx.clearRect(0, 0, outWidth, outHeight);
    } else {
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, outWidth, outHeight);
    }
    const k = outWidth / frame.width;
    octx.setTransform(k, 0, 0, k, 0, 0);
    octx.translate(-frame.x, -frame.y);
    paintImage(octx, { img: state.img, angle: state.angle, flip: state.flip, layout });

    const type = state.keepAlpha ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) =>
      out.toBlob((value) => resolve(value), type, type === 'image/jpeg' ? 0.88 : undefined),
    );
    if (!blob) throw new Error('encode-failed');
    return { blob, hash: dHash(out), width: outWidth, height: outHeight, type };
  }

  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      bindings.splice(0).forEach((off) => off());
      observer?.disconnect();
      observer = null;
      if (dialog.open) dialog.close();
      if (applyBtn) applyBtn.disabled = false;
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      session = null;
      cleanup();
      const name = String(file.name || 'product').replace(/\.[^.]+$/, '') || 'product';
      resolve(value ? { ...value, name } : null);
    };

    const cancel = () => finish(null);

    const onApply = async () => {
      if (!state.img) return;
      if (applyBtn) applyBtn.disabled = true;
      if (status) status.textContent = t('admin.image_editor_working');
      try {
        finish(await exportBlob());
      } catch (err) {
        console.error(err);
        if (status) status.textContent = t('admin.image_editor_failed');
        if (applyBtn) applyBtn.disabled = false;
      }
    };

    session = { cancel };

    on(stage, 'pointerdown', onPointerDown);
    on(stage, 'pointermove', onPointerMove);
    on(stage, 'pointerup', onPointerUp);
    on(stage, 'pointercancel', onPointerUp);
    on(stage, 'wheel', onWheel, { passive: false });
    on(stage, 'keydown', onKeyDown);
    on(zoomInput, 'input', onZoomInput);
    on(aspects, 'click', onAspectClick);
    on(el('image-editor-rotate-left'), 'click', onRotateLeft);
    on(el('image-editor-rotate-right'), 'click', onRotateRight);
    on(el('image-editor-flip'), 'click', flip);
    on(el('image-editor-reset'), 'click', reset);
    on(sizeSelect, 'change', onSizeChange);
    on(applyBtn, 'click', onApply);
    on(window, 'resize', render);

    if ('ResizeObserver' in window) {
      observer = new ResizeObserver(() => render());
      observer.observe(stage);
    }

    dialog.showModal();
    syncZoomLabel();
    setAspectButton();

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        state.img = img;
        state.keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
        if (subEl) {
          subEl.textContent = `${file.name || ''} · ${img.naturalWidth}×${img.naturalHeight}`;
          subEl.hidden = false;
        }
        requestAnimationFrame(() => {
          render();
          stage.focus({ preventScroll: true });
        });
      };
      img.onerror = () => {
        if (status) status.textContent = t('admin.image_editor_load_failed');
        if (applyBtn) applyBtn.disabled = true;
      };
      img.src = String(reader.result || '');
    };
    reader.onerror = () => {
      if (status) status.textContent = t('admin.image_editor_load_failed');
      if (applyBtn) applyBtn.disabled = true;
    };
    reader.readAsDataURL(file);
  });
}
