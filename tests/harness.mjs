import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

process.on('unhandledRejection', (r) => {
  console.log('UNHANDLED REJECTION:', r && r.stack ? r.stack : r);
});

export function resetModuleCache() {
  for (const k of Object.keys(globalThis.__MOD_CACHE__ || {})) delete globalThis.__MOD_CACHE__[k];
}
globalThis.__MOD_CACHE__ = globalThis.__MOD_CACHE__ || {};

async function importFresh(spec) {
  const gen = globalThis.__MOD_GEN__ || 0;
  const url = pathToFileURL(spec).href + '?g=' + gen;
  if (globalThis.__MOD_CACHE__[url]) return globalThis.__MOD_CACHE__[url];
  const mod = await import(url);
  globalThis.__MOD_CACHE__[url] = mod;
  return mod;
}

export async function makeSupabaseMock(opts = {}) {
  const { makeSupabaseMock: mk } = await import('./supabase-mock.mjs');
  return mk(opts);
}

export async function loadPage({ htmlPath, scripts = [], supabase, globals = {}, url, storage = {} }) {
  if (!url) {
    const rel = path.relative(path.join(ROOT, 'web'), htmlPath).split(path.sep).join('/');
    url = 'https://zenmarket.test/' + rel;
  }
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(/<script[^>]*type="module"[^>]*><\/script>/g, '');

  const vc = new VirtualConsole();
  const logs = [];
  vc.on('jsdomError', (e) => logs.push(['jsdomError', e.message]));
  ['error', 'warn', 'log', 'info'].forEach((lvl) => vc.on(lvl, (...a) => logs.push([lvl, a.map(String).join(' ')])));

  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const { window } = dom;

  window.matchMedia =
    window.matchMedia ||
    ((q) => ({
      matches: false,
      media: q,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    }));
  window.scrollTo = () => {};
  window.confirm = () => window.__confirmResult !== false;
  window.alert = () => {};
  window.open = () => null;
  window.URL.createObjectURL = () => 'blob:mock';
  window.URL.revokeObjectURL = () => {};
  window.fetch = async () => ({ ok: true, json: async () => ({}) });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.Element.prototype.scrollIntoView = () => {};
  if (!window.crypto) window.crypto = {};
  if (!window.crypto.subtle) {
    window.crypto.subtle = {
      importKey: async () => ({}),
      deriveKey: async () => ({}),
      encrypt: async () => new ArrayBuffer(16),
      digest: async () => new ArrayBuffer(32),
    };
  }
  if (!window.crypto.getRandomValues) {
    window.crypto.getRandomValues = (arr) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    };
  }

  for (const [k, v] of Object.entries(globals)) {
    try {
      Object.defineProperty(window, k, { value: v, writable: true, configurable: true });
    } catch {
      window[k] = v;
    }
  }
  const nativeLS = window.localStorage;
  for (const [k, v] of Object.entries(storage)) {
    try {
      nativeLS.setItem(k, String(v));
    } catch {}
  }
  const localStorageStub = {
    get length() {
      return nativeLS.length;
    },
    getItem: (k) => nativeLS.getItem(k),
    setItem: (k, v) => nativeLS.setItem(k, String(v)),
    removeItem: (k) => nativeLS.removeItem(k),
    clear: () => nativeLS.clear(),
    key: (i) => nativeLS.key(i),
  };
  try {
    Object.defineProperty(window, 'localStorage', { value: nativeLS, writable: true, configurable: true });
  } catch {}

  globalThis.__SUPABASE_MOCK__ = supabase;
  globalThis.__MOD_GEN__ = (globalThis.__MOD_GEN__ || 0) + 1;
  globalThis.window = window;
  globalThis.document = window.document;
  const safeSet = (k, v) => {
    try {
      Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true });
    } catch {}
  };
  safeSet('navigator', window.navigator);
  safeSet('location', window.location);
  safeSet('localStorage', window.localStorage);
  safeSet('sessionStorage', window.sessionStorage);
  safeSet('getComputedStyle', window.getComputedStyle.bind(window));
  safeSet('requestAnimationFrame', window.requestAnimationFrame.bind(window));
  safeSet('cancelAnimationFrame', window.cancelAnimationFrame.bind(window));
  safeSet('Event', window.Event);
  safeSet('CustomEvent', window.CustomEvent);
  safeSet('HTMLElement', window.HTMLElement);
  safeSet('Node', window.Node);
  safeSet('FormData', window.FormData);
  safeSet('Blob', window.Blob);
  safeSet('File', window.File);
  safeSet('FileReader', window.FileReader);
  safeSet(
    'IntersectionObserver',
    class {
      constructor(cb) {
        this.cb = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  safeSet(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  safeSet(
    'MutationObserver',
    class {
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  window.IntersectionObserver = globalThis.IntersectionObserver;
  window.ResizeObserver = globalThis.ResizeObserver;
  window.MutationObserver = globalThis.MutationObserver;
  globalThis.__VITE_ENV__ = {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    MODE: 'test',
    PROD: false,
    DEV: true,
  };

  for (const s of scripts) {
    const resolved = path.resolve(ROOT, s);
    const mod = await importFresh(resolved);
    window.__mods = window.__mods || {};
    window.__mods[s] = mod;
    const evt = new window.Event('DOMContentLoaded');
    window.document.dispatchEvent(evt);
    await new Promise((r) => setTimeout(r, 0));
  }
  await new Promise((r) => setTimeout(r, 80));

  return { dom, window, document: window.document, logs, supabase };
}

/**
 * Import a module that belongs to the *currently loaded page* so that it is
 * the very same instance the page script uses.  Without this, `import('/src/…')`
 * from a test file resolves to a different generation and module-level state
 * (language listeners, for instance) would not be shared with the page.
 */
export async function importPage(spec) {
  const gen = globalThis.__MOD_GEN__ || 0;
  let p = path.join(ROOT, spec.replace(/^\/+/, ''));
  if (!fs.existsSync(p) && fs.existsSync(p + '.js')) p += '.js';
  const url = pathToFileURL(p).href + '?g=' + gen;
  if (!globalThis.__MOD_CACHE__[url]) {
    globalThis.__MOD_CACHE__[url] = await import(url);
  }
  return globalThis.__MOD_CACHE__[url];
}

export function el(doc, id) {
  const e = doc.getElementById(id);
  if (!e) throw new Error(`element #${id} not found`);
  return e;
}

export function setVal(doc, id, value) {
  const e = el(doc, id);
  e.value = value;
  e.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
  e.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
  return e;
}

export function fire(doc, id, type = 'click') {
  const e = el(doc, id);
  e.dispatchEvent(new doc.defaultView.Event(type, { bubbles: true, cancelable: true }));
  return e;
}

export function submit(doc, formId) {
  const form = el(doc, formId);
  form.dispatchEvent(new doc.defaultView.Event('submit', { bubbles: true, cancelable: true }));
}

export function wait(ms = 80) {
  return new Promise((r) => setTimeout(r, ms));
}

export function makeAssert() {
  const state = { pass: 0, fail: 0 };
  const eq = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) state.pass++;
    else {
      state.fail++;
      console.log('FAIL:', name, '\n  got :', JSON.stringify(actual), '\n  want:', JSON.stringify(expected));
    }
  };
  const ok = (name, cond) => {
    if (cond) state.pass++;
    else {
      state.fail++;
      console.log('FAIL:', name);
    }
  };
  const report = (label = '') => {
    console.log(`\n[${label}] pass=${state.pass} fail=${state.fail}`);
    return state.fail;
  };
  return { eq, ok, report, state };
}
