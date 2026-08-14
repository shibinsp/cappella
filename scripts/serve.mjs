// Zero-dependency static file server for the Cappella site.
// Usage: node scripts/serve.mjs [port]
// - Serves the repo root.
// - `/` maps to the homepage (index.html).
// - Path-traversal guarded (resolved path must stay inside the root).
// - Port resolution: argv > $PORT > 8788. argv stays first so `npm run serve`
//   and the Playwright webServer, which both pass 8788 explicitly, are
//   unaffected; $PORT is what lets a harness assign a free port when 8788 is
//   already taken by another copy of this server.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8788);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ts': 'text/plain; charset=utf-8'
};

http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (p === '/') p = '/index.html';
    const file = resolve(join(root, p));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});
