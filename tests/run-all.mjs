#!/usr/bin/env node
/**
 * ZenMarket test runner
 * รันชุดทดสอบ DOM ทั้งหมด (jsdom + โมดูลจริงของแอป) แล้วสรุปผล
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const files = fs.readdirSync(HERE)
  .filter((f) => f.startsWith('test_') && f.endsWith('.mjs'))
  .sort();

let totalFail = 0;
const summary = [];

for (const f of files) {
  const out = await new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(HERE, f)], { cwd: path.resolve(HERE, '..') });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.stderr.on('data', (d) => { buf += d; });
    p.on('close', (code) => resolve({ code, buf }));
  });
  const m = /\[([\w-]+)\] pass=(\d+) fail=(\d+)/.exec(out.buf);
  const label = m ? m[1] : f;
  const pass = m ? Number(m[2]) : 0;
  const fail = m ? Number(m[3]) : (out.code === 0 ? 0 : 1);
  totalFail += fail;
  summary.push({ file: f, label, pass, fail, code: out.code });

  if (fail > 0 || out.code !== 0) {
    console.log(`\n✗ ${f}`);
    console.log(out.buf.split('\n').filter((l) => l.startsWith('FAIL') || l.startsWith('Error')).join('\n'));
  }
}

console.log('\n===== สรุปการทดสอบ =====');
for (const s of summary) {
  console.log(`  ${s.fail === 0 && s.code === 0 ? '✓' : '✗'} ${s.label.padEnd(12)} pass=${String(s.pass).padStart(3)}  fail=${s.fail}`);
}
const totalPass = summary.reduce((a, s) => a + s.pass, 0);
console.log(`  รวม: pass=${totalPass} fail=${totalFail}`);
process.exit(totalFail ? 1 : 0);
