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

/**
 * ให้ dev/preview server รับ URL แบบ clean URL เหมือนบน Vercel
 * (/home → home.html, /shop → shop/index.html, /admin/dashboard → admin/dashboard.html)
 */
function cleanUrls(root) {
  const resolveFile = (url) => {
    const pathname = decodeURIComponent(url.split('?')[0]);
    if (pathname === '/' || pathname === '') return '/home.html';
    if (/\.[A-Za-z0-9]+$/.test(pathname)) return null;
    const direct = path.join(root, pathname);
    if (fs.existsSync(path.join(direct, 'index.html'))) return `${pathname.replace(/\/$/, '')}/index.html`;
    if (fs.existsSync(`${direct}.html`)) return `${pathname}.html`;
    return null;
  };
  const middleware = (req, res, next) => {
    const target = resolveFile(req.url);
    if (target) req.url = target;
    next();
  };
  return {
    name: 'zenmarket-clean-urls',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  root: 'web',
  envDir: '..',
  publicDir: '../public',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
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
  plugins: [cleanUrls(path.resolve('web'))],
});
