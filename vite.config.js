import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function getHtmlEntries(dir) {
  const entries = {};
  function scanDir(currentDir, baseDir) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        scanDir(fullPath, baseDir);
      } else if (item.name.endsWith('.html')) {
        const relativePath = path.relative(baseDir, fullPath);
        const name = relativePath.replace(/\\/g, '/').replace(/\.html$/, '');
        entries[name] = path.resolve(fullPath);
      }
    }
  }
  scanDir(dir, dir);
  return entries;
}

export default defineConfig({
  root: 'web',
  envDir: '..',
  publicDir: '../public',
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: getHtmlEntries(path.resolve('web')),
    },
  },
  resolve: {
    alias: {
      '/src': path.resolve('./src'),
    },
  },
});
