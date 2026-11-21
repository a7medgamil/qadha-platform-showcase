import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ASSETS = new Map([
  ['/', ['./public/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['./public/app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['./public/styles.css', 'text/css; charset=utf-8']],
  ['/src/engine.js', ['./src/engine.js', 'text/javascript; charset=utf-8']],
  ['/src/scenario.js', ['./src/scenario.js', 'text/javascript; charset=utf-8']],
]);
export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cache-Control': 'no-store',
});

export function createServer() {
  return http.createServer(async (req, res) => {
    const finish = (status, body, extra = {}) => {
      res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...extra });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    // Reject rebinding hosts and cross-site resource requests. There are no write routes.
    const port = res.socket.localPort;
    if (req.headers.host !== `127.0.0.1:${port}`) return finish(403, 'Loopback host required.');
    if (req.headers['sec-fetch-site'] && !['none', 'same-origin'].includes(req.headers['sec-fetch-site'])) return finish(403, 'Same-origin navigation required.');
    if (!['GET', 'HEAD'].includes(req.method)) return finish(405, 'Read-only static server.', { Allow: 'GET, HEAD' });
    // Literal allowlist: never join a user-supplied path to the filesystem.
    const asset = ASSETS.get(req.url);
    if (!asset) return finish(404, 'Not found.');
    try {
      const bytes = await readFile(new URL(asset[0], import.meta.url));
      finish(200, bytes, { 'Content-Type': asset[1], 'Content-Length': bytes.byteLength });
    } catch {
      finish(500, 'Static asset unavailable.');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer from 1024 to 65535.');
  const server = createServer();
  server.on('error', (error) => { console.error(`Unable to start lab: ${error.code}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Independent synthetic lab: http://127.0.0.1:${port}\nNo production services. Stop with Ctrl+C.`));
}
