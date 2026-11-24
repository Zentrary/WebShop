import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const HERE = path.dirname(new URL(import.meta.url).pathname);

function genOf(parentURL) {
  if (!parentURL) return '0';
  const m = /[?&]g=([^&]+)/.exec(parentURL);
  return m ? m[1] : '0';
}

function withGen(url, gen) {
  return url + (url.includes('?') ? '&' : '?') + 'g=' + gen;
}

export async function resolve(specifier, context, nextResolve) {
  const gen = genOf(context.parentURL);
  if (specifier === '@supabase/supabase-js') {
    const mock = pathToFileURL(path.join(HERE, 'supabase-mock.mjs')).href;
    return { url: withGen(mock, gen), shortCircuit: true };
  }
  if (specifier.startsWith('/src/') || specifier.startsWith('/web/')) {
    let p = path.join(ROOT, specifier);
    if (!fs.existsSync(p) && fs.existsSync(p + '.js')) p += '.js';
    return { url: withGen(pathToFileURL(p).href, gen), shortCircuit: true };
  }
  if (specifier.startsWith('/') && fs.existsSync(path.join(ROOT, specifier))) {
    return { url: withGen(pathToFileURL(path.join(ROOT, specifier)).href, gen), shortCircuit: true };
  }
  const r = await nextResolve(specifier, context);
  if (r.url.startsWith('node:') || r.url.startsWith('data:')) return r;
  return { ...r, url: withGen(r.url, gen) };
}

export async function load(url, context, nextLoad) {
  if (url.includes('supabase-mock.mjs')) {
    return nextLoad(url, context);
  }
  const r = await nextLoad(url, context);
  if (r.format === 'module' && typeof r.source !== 'undefined') {
    const src = r.source.toString();
    if (src.includes('import.meta.env')) {
      return {
        ...r,
        source: src.replace(/import\.meta\.env/g, 'globalThis.__VITE_ENV__'),
      };
    }
  }
  return r;
}
