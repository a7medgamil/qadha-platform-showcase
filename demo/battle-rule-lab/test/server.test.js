import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createServer, SECURITY_HEADERS } from '../server.js';

let server; let port;
before(async () => { server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); port = server.address().port; });
after(async () => { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
function request(path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
      let body = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
}
test('server listens only on IPv4 loopback and serves the labelled lab', async () => {
  assert.equal(server.address().address, '127.0.0.1');
  const res = await request('/'); assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/html/);
  assert.match(res.body, /Independent synthetic battle-rules lab — not QADHA production\./);
});
test('only the five explicit public assets are served with correct content types', async () => {
  for (const path of ['/app.js', '/styles.css', '/src/engine.js', '/src/scenario.js']) {
    const res = await request(path); assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], path.endsWith('.css') ? /^text\/css/ : /^text\/javascript/);
  }
});
test('HEAD has the same content metadata and no response body', async () => {
  const get = await request('/'); const head = await request('/', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], get.headers['content-length']);
  assert.equal(head.headers['content-type'], get.headers['content-type']);
});
test('traversal, encoded paths, query strings and private files fail closed', async () => {
  for (const path of ['/../README.md', '/%2e%2e/README.md', '/src/../server.js', '/%2fapp.js', '/%00', '/?x=1', '/app.js?v=1', '/.git/config', '/package.json', '/server.js', '/no-such-route', '//app.js', '/favicon.ico']) {
    const res = await request(path); assert.equal(res.status, 404, path); assert.equal(res.body, 'Not found.');
  }
});
test('mutation and preflight methods are rejected with an accurate Allow header', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const res = await request('/', { method }); assert.equal(res.status, 405);
    assert.equal(res.headers.allow, 'GET, HEAD'); assert.equal(res.headers['access-control-allow-origin'], undefined);
  }
});
test('security and no-store headers are consistent on success, not-found and method errors', async () => {
  for (const [path, method] of [['/', 'GET'], ['/missing', 'GET'], ['/', 'POST']]) {
    const res = await request(path, { method });
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(res.headers[name.toLowerCase()], value);
    assert.equal(res.headers['set-cookie'], undefined); assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.match(res.headers['content-security-policy'], /connect-src 'none'/);
  }
});
test('host rebinding and cross-site fetch headers are denied without echoing input', async () => {
  for (const headers of [{ host: `localhost:${port}` }, { host: `attacker.invalid:${port}` }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }]) {
    const res = await request('/', { headers }); assert.equal(res.status, 403);
    assert.ok(!res.body.includes('attacker')); assert.equal(res.headers['cache-control'], 'no-store');
  }
});
test('same-origin asset requests and direct navigation are allowed', async () => {
  for (const site of ['same-origin', 'none']) assert.equal((await request('/app.js', { headers: { 'sec-fetch-site': site } })).status, 200);
});
