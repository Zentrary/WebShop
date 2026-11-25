#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src', import.meta.url));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const GLOBALS = new Set([
  'window',
  'document',
  'console',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
  'fetch',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'Promise',
  'Math',
  'JSON',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Date',
  'RegExp',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Symbol',
  'BigInt',
  'Proxy',
  'Reflect',
  'URL',
  'URLSearchParams',
  'Blob',
  'File',
  'FileReader',
  'FormData',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'TextEncoder',
  'TextDecoder',
  'crypto',
  'structuredClone',
  'Intl',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'encodeURIComponent',
  'decodeURIComponent',
  'encodeURI',
  'decodeURI',
  'escape',
  'unescape',
  'undefined',
  'NaN',
  'Infinity',
  'globalThis',
  'queueMicrotask',
  'structuredClone',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'IntersectionObserver',
  'MutationObserver',
  'ResizeObserver',
  'performance',
  'atob',
  'btoa',
  'Intl',
  'ArrayBuffer',
  'Uint8Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
  'Uint8ClampedArray',
  'DataView',
  'WeakRef',
  'FinalizationRegistry',
  'import',
  'supabase',
  'CSS',
  'DOMParser',
  'XMLSerializer',
  'Image',
  'createImageBitmap',
  'Audio',
  'Notification',
  'getComputedStyle',
  'matchMedia',
  'scrollTo',
  'alert',
  'confirm',
  'prompt',
  'fetch',
  'self',
  'postMessage',
  'requestIdleCallback',
  'cancelIdleCallback',
  'print',
  'close',
  'open',
  'focus',
  'blur',
]);

const ALLOW = new Set(['arguments', 'this', 'super', 'await']);

const BUILTIN_METHODS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'slice',
  'splice',
  'concat',
  'join',
  'indexOf',
  'lastIndexOf',
  'includes',
  'find',
  'findIndex',
  'findLast',
  'filter',
  'map',
  'forEach',
  'reduce',
  'reduceRight',
  'some',
  'every',
  'sort',
  'reverse',
  'flat',
  'flatMap',
  'keys',
  'values',
  'entries',
  'from',
  'set',
  'get',
  'has',
  'delete',
  'clear',
  'add',
  'test',
  'exec',
  'match',
  'replace',
  'replaceAll',
  'trim',
  'trimStart',
  'trimEnd',
  'padStart',
  'padEnd',
  'toLowerCase',
  'toUpperCase',
  'toString',
  'toFixed',
  'charAt',
  'charCodeAt',
  'codePointAt',
  'split',
  'repeat',
  'startsWith',
  'endsWith',
  'at',
  'getTime',
  'getFullYear',
  'getMonth',
  'getDate',
  'getHours',
  'getMinutes',
  'getSeconds',
  'getMilliseconds',
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'toISOString',
  'log',
  'warn',
  'error',
  'info',
  'debug',
  'trace',
  'groupBy',
  'assign',
  'freeze',
  'entries',
  'createElement',
  'createTextNode',
  'createDocumentFragment',
  'appendChild',
  'removeChild',
  'insertBefore',
  'replaceChild',
  'replaceWith',
  'remove',
  'append',
  'prepend',
  'before',
  'after',
  'setAttribute',
  'getAttribute',
  'removeAttribute',
  'hasAttribute',
  'classList',
  'querySelector',
  'querySelectorAll',
  'getElementById',
  'getElementsByClassName',
  'getElementsByTagName',
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'preventDefault',
  'stopPropagation',
  'stopImmediatePropagation',
  'closest',
  'matches',
  'contains',
  'appendData',
  'setPointerCapture',
  'focus',
  'blur',
  'click',
  'select',
  'reset',
  'submit',
  'check',
  'scrollTo',
  'scrollIntoView',
  'getBoundingClientRect',
  'getRandomValues',
  'randomUUID',
  'now',
  'signInWithPassword',
  'signUp',
  'signOut',
  'resetPasswordForEmail',
  'updateUser',
  'getSession',
  'getUser',
  'onAuthStateChange',
  'rpc',
  'from',
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'contains',
  'overlaps',
  'match',
  'order',
  'limit',
  'range',
  'single',
  'maybeSingle',
  'throwOnError',
  'count',
  'explain',
  'then',
  'catch',
  'finally',
  'upload',
  'download',
  'getPublicUrl',
  'createSignedUrl',
  'list',
  'move',
  'copy',
  'storage',
  'encrypt',
  'decrypt',
  'importKey',
  'deriveKey',
  'digest',
  'sign',
  'verify',
  'random',
  'createObjectURL',
  'revokeObjectURL',
  'arrayBuffer',
  'text',
  'json',
  'blob',
  'formData',
  'observe',
  'unobserve',
  'disconnect',
  'takeRecords',
  'format',
  'checkValidity',
  'reportValidity',
  'setCustomValidity',
  'toDataURL',
  'readAsText',
  'readAsDataURL',
  'abs',
  'ceil',
  'floor',
  'round',
  'min',
  'max',
  'pow',
  'sqrt',
  'randomUUID',
  'getComputedStyle',
  'watch',
  'unwatch',
  'stringify',
  'parse',
  'number',
  'stringify',
  'bigint',
  'charCodeAt',
  'unshift',
  'hasOwnProperty',
]);

const MASK_REGEX_PRECEDING = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '~',
  '^',
  '<',
  '>',
  '\n',
]);
const MASK_REGEX_WORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'do',
  'else',
  'case',
  'yield',
  'await',
  'throw',
]);

function maskLiterals(src) {
  let out = '';
  let i = 0;
  let lastChar = '';
  let lastWord = '';
  const stack = [];
  const top = () => (stack.length ? stack[stack.length - 1] : null);

  const canStartRegex = () => {
    if (lastChar === '') return true;
    if (MASK_REGEX_PRECEDING.has(lastChar)) return true;
    if (lastWord && MASK_REGEX_WORDS.has(lastWord)) return true;
    return false;
  };

  const pushChar = (ch) => {
    out += ch;
    if (!/\s/.test(ch)) {
      lastChar = ch;
      if (/[A-Za-z0-9_$]/.test(ch)) lastWord += ch;
      else lastWord = '';
    }
  };

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (top()?.type === 'template') {
      if (ch === '\\') {
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === '`') {
        out += ' ';
        stack.pop();
        lastChar = '`';
        lastWord = '';
        i += 1;
        continue;
      }
      if (ch === '$' && next === '{') {
        out += '  ';
        stack.push({ type: 'expr', depth: 0 });
        lastChar = '{';
        lastWord = '';
        i += 2;
        continue;
      }
      out += ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      i += 2;
      out += '  ';
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ' ';
      i += 1;
      while (i < src.length) {
        const c = src[i];
        if (c === '\\') {
          out += '  ';
          i += 2;
          continue;
        }
        out += ' ';
        i += 1;
        if (c === quote) break;
      }
      lastChar = quote;
      lastWord = '';
      continue;
    }

    if (ch === '`') {
      out += ch;
      stack.push({ type: 'template', depth: 0 });
      lastChar = '`';
      lastWord = '';
      i += 1;
      continue;
    }

    if (ch === '{') {
      const current = top();
      if (current?.type === 'expr') current.depth += 1;
      pushChar(ch);
      i += 1;
      continue;
    }

    if (ch === '}') {
      const current = top();
      if (current?.type === 'expr') {
        if (current.depth > 0) current.depth -= 1;
        else stack.pop();
      }
      pushChar(ch);
      i += 1;
      continue;
    }

    if (ch === '/' && canStartRegex()) {
      out += ' ';
      i += 1;
      let inClass = false;
      while (i < src.length) {
        const c = src[i];
        if (c === '\\') {
          out += '  ';
          i += 2;
          continue;
        }
        out += ' ';
        i += 1;
        if (c === '\n') break;
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
      }
      lastChar = '/';
      lastWord = '';
      continue;
    }

    pushChar(ch);
    i += 1;
  }

  return out;
}

const problems = [];

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  const defined = new Set();

  const importRe = /import\s+([^'"]+?)\s+from\s+['"][^'"]+['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const clause = m[1].trim();
    if (clause.startsWith('{')) {
      for (const part of clause.slice(1, -1).split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          .trim();
        if (name) defined.add(name);
      }
    } else if (clause.startsWith('*')) {
      const n = clause.replace(/^\*\s*as\s*/, '').trim();
      if (n) defined.add(n);
    } else {
      defined.add(clause);
    }
  }

  const declRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = declRe.exec(src))) defined.add(m[1]);

  const destrRe = /\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g;
  while ((m = destrRe.exec(src))) {
    for (const part of m[1].split(',')) {
      const name = part.split(':').pop().trim().split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name);
    }
  }
  const destrArrRe = /\b(?:const|let|var)\s*\[([^\]]*)\]\s*=/g;
  while ((m = destrArrRe.exec(src))) {
    for (const part of m[1].split(',')) {
      const name = part.split(':').pop().trim().split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name);
    }
  }

  const fnRe = /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
  while ((m = fnRe.exec(src))) defined.add(m[1]);
  const clsRe = /\bclass\s+([A-Za-z_$][\w$]*)/g;
  while ((m = clsRe.exec(src))) defined.add(m[1]);

  const paramRe = /\(([^()]*)\)\s*(?:=>|\{)/g;
  while ((m = paramRe.exec(src))) {
    for (const part of m[1].split(',')) {
      const name = part
        .split('=')[0]
        .trim()
        .replace(/^\.\.\./, '');
      if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name);
    }
  }

  const catchRe = /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
  while ((m = catchRe.exec(src))) defined.add(m[1]);

  const forRe = /\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = forRe.exec(src))) defined.add(m[1]);

  let code = maskLiterals(src);

  code = code.replace(/(?:\?\.|\.)\s*[A-Za-z_$][\w$]*\s*\(/g, '.__MEMBER__(');

  const used = new Map();
  const useRe = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = useRe.exec(code))) {
    const name = m[1];
    if (GLOBALS.has(name) || ALLOW.has(name) || defined.has(name)) continue;
    if (BUILTIN_METHODS.has(name)) continue;
    if (name === '__MEMBER__' || name === '__dyn') continue;
    if (
      /^(if|for|while|switch|catch|function|return|typeof|await|new|delete|void|in|of|do|else|try|finally|throw|case|default|break|continue|class|extends|super|this|import|export|from|as|get|set|constructor|async|yield|static|instanceof)$/.test(
        name,
      )
    )
      continue;
    if (!used.has(name)) used.set(name, m.index);
  }

  for (const [name, idx] of used) {
    const line = src.slice(0, idx).split('\n').length;
    problems.push(`${rel}:${line} → เรียกใช้ '${name}' แต่ไม่ได้ import/ประกาศ`);
  }
}

if (problems.length) {
  console.log(`พบปัญหา ${problems.length} รายการ:`);
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('no-undef: ไม่พบปัญหา');
