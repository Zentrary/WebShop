import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.vercel', 'coverage']);
const TARGET_DIRS = ['src', 'web', 'scripts', 'tests', 'supabase'];

const REGEX_PRECEDING_CHARS = new Set([
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
const REGEX_PRECEDING_WORDS = new Set([
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

function stripJsComments(source) {
  let out = '';
  let i = 0;
  let lastChar = '';
  let lastWord = '';
  const stack = [];

  const canStartRegex = () => {
    if (lastChar === '') return true;
    if (REGEX_PRECEDING_CHARS.has(lastChar)) return true;
    if (lastWord && REGEX_PRECEDING_WORDS.has(lastWord)) return true;
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

  const top = () => (stack.length ? stack[stack.length - 1] : null);

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (top()?.type === 'template') {
      if (ch === '\\') {
        out += ch + (next ?? '');
        i += 2;
        continue;
      }
      if (ch === '`') {
        out += ch;
        stack.pop();
        lastChar = '`';
        lastWord = '';
        i += 1;
        continue;
      }
      if (ch === '$' && next === '{') {
        out += '${';
        stack.push({ type: 'expr', depth: 0 });
        lastChar = '{';
        lastWord = '';
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
      out += ' ';
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < source.length) {
        const c = source[i];
        if (c === '\\') {
          out += c + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += c;
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
      out += ch;
      i += 1;
      let inClass = false;
      while (i < source.length) {
        const c = source[i];
        if (c === '\\') {
          out += c + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += c;
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

function stripCssComments(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < source.length) {
        const c = source[i];
        if (c === '\\') {
          out += c + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += c;
        i += 1;
        if (c === quote) break;
      }
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
      out += ' ';
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function stripHtmlComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\n]/g, ''));
}

function stripSqlComments(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < source.length) {
        const c = source[i];
        if (c === quote && source[i - 1] !== '\\') {
          out += c;
          i += 1;
          break;
        }
        out += c;
        i += 1;
      }
      continue;
    }
    if (ch === '-' && source[i + 1] === '-') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
      out += ' ';
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const handlers = {
  '.js': stripJsComments,
  '.mjs': stripJsComments,
  '.css': stripCssComments,
  '.html': stripHtmlComments,
  '.sql': stripSqlComments,
};

const cliFiles = process.argv.slice(2);

if (cliFiles.length > 0) {
  for (const file of cliFiles) {
    const handler = handlers[extname(file)];
    if (!handler) continue;
    const source = await readFile(file, 'utf8');
    const next = handler(source);
    if (next !== source) {
      await writeFile(file, next, 'utf8');
      console.log('  ' + file);
    }
  }
} else {
  const changed = [];
  for (const dir of TARGET_DIRS) {
    const full = join(ROOT, dir);
    let files = [];
    try {
      files = [...walk(full)];
    } catch {
      continue;
    }
    for (const file of files) {
      const handler = handlers[extname(file)];
      if (!handler) continue;
      const source = await readFile(file, 'utf8');
      const next = handler(source);
      if (next !== source) {
        await writeFile(file, next, 'utf8');
        changed.push(file.replace(ROOT, ''));
      }
    }
  }

  console.log(`stripped comments: ${changed.length} file(s)`);
  for (const file of changed) console.log('  ' + file);
}
