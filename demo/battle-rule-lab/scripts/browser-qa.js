// Optional integration QA: installed Chrome + built-in Node CDP client, no npm packages.
// Owns only a new headless process/profile; never attaches to user browser sessions.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from '../server.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
let executable;
for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
if (!executable) throw new Error('Browser QA blocked: Chrome not found. Set CHROME_PATH to an installed Chrome executable.');
const scratch = join(root, '.qa', `chrome-${process.pid}`);
const profile = join(scratch, 'profile');
await mkdir(profile, { recursive: true });
await mkdir(join(root, 'screenshots'), { recursive: true });
const server = createServer();
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
let chrome; let socket;
const checks = []; const errors = []; const deniedRequests = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function check(name, condition) { assert.ok(condition, name); checks.push(name); }
try {
  chrome = spawn(executable, [
    '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--disable-default-apps', '--disable-domain-reliability',
    '--disable-client-side-phishing-detection', '--metrics-recording-only', '--disable-crash-reporter',
    '--safebrowsing-disable-auto-update', '--no-proxy-server',
    '--disable-features=OptimizationHints,MediaRouter,AutofillServerCommunication',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', 'about:blank',
  ], { windowsHide: true, stdio: 'ignore', env: { ...process.env, TEMP: scratch, TMP: scratch } });
  let debugPort;
  for (let i = 0; i < 150; i++) {
    try { debugPort = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await sleep(100); }
  }
  assert.ok(debugPort, 'Fresh isolated Chrome startup');
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page');
  assert.ok(page, 'Isolated headless page exists');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); }, 10_000);
    pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id); if (!item) return;
      clearTimeout(item.timer); pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error' && !message.params.entry.text.includes('favicon.ico')) errors.push(message.params.entry.text);
    else if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      if (request.url.startsWith(`${origin}/`) || request.url === 'about:blank') {
        send('Fetch.continueRequest', { requestId }).catch((error) => errors.push(error.message));
      } else {
        deniedRequests.push(request.url);
        send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch((error) => errors.push(error.message));
      }
    }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Accessibility.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
  const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const set = (selector, value) => evaluate(`{ const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(String(value))}; el.dispatchEvent(new Event('change', {bubbles:true})); }`);
  const press = async (key, code = key, virtualCode = 13) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualCode, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualCode });
  };
  const noOverflow = () => evaluate('document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth');
  const contrast = () => evaluate(`(() => {
    const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
    const luminance = (v) => v.slice(0,3).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x+.055)/1.055)**2.4; }).reduce((s,x,i) => s+x*[.2126,.7152,.0722][i],0);
    const failures = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (!el.getClientRects().length || ['SCRIPT','STYLE'].includes(el.tagName) || el.closest(':disabled')) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const style = getComputedStyle(el); if (style.visibility === 'hidden') continue;
      const fg = rgb(style.color); let bg = [255,255,255,1];
      for (let parent=el; parent; parent=parent.parentElement) { const c = rgb(getComputedStyle(parent).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) === 1) {bg=c; break;} }
      const a = luminance(fg), b = luminance(bg), ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      const size = parseFloat(style.fontSize), large = size >= 24 || (size >= 18.66 && parseInt(style.fontWeight) >= 700);
      if (ratio + .01 < (large ? 3 : 4.5)) failures.push({text:el.textContent.trim().slice(0,60),ratio});
    }
    return failures;
  })()`);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: name === 'mobile' });
    await send('Page.navigate', { url: `${origin}/` });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('!!document.querySelector("#rounds .round-card")')) break;
      await sleep(50);
    }
    check(`${name}: initial fixture revision 0`, (await text('#revision')) === '0');
    check(`${name}: no horizontal overflow at ${width}px`, await noOverflow());
    check(`${name}: two visible boundary labels`, (await evaluate('[...document.querySelectorAll(".boundary, footer strong")].filter(el => el.textContent.includes("not QADHA production")).length')) === 2);
    await press('Tab', 'Tab', 9);
    check(`${name}: native Tab reaches visible skip link`, await evaluate('document.activeElement.matches(".skip-link") && document.activeElement.getBoundingClientRect().top >= 0'));
    await evaluate('document.querySelector("#step").focus()'); await press('Enter');
    check(`${name}: native Enter activates next step`, (await text('#revision')) === '1');
    check(`${name}: keyboard focus has visible outline`, await evaluate('getComputedStyle(document.activeElement).outlineStyle !== "none"'));
    await evaluate('document.querySelector("#run").focus()'); await press('Enter');
    check(`${name}: replay reaches revision 5 at 00:30`, (await text('#revision')) === '5' && (await text('#clock')) === '00:30');
    check(`${name}: event-derived counts are 5 / 5 / 1`, (await text('#accepted')) === '5' && (await text('#rejected')) === '5' && (await text('#replayed')) === '1');
    check(`${name}: terminal round labels`, await evaluate('[...document.querySelectorAll(".round-top .badge")].map(el => el.textContent).join() === "finalized,cancelled"'));
    check(`${name}: live status announces replay result`, (await text('#live-status')).includes('Replay complete. 5 accepted'));
    await click('#show-events');
    check(`${name}: complete ordered audit has 13 events`, await evaluate('document.querySelectorAll("#events li").length === 13 && document.querySelector("#events li").textContent.includes("#13")'));
    await click('#show-events');
    check(`${name}: rendered text contrast`, (await contrast()).length === 0);
    const ax = await send('Accessibility.getFullAXTree');
    const controls = ax.nodes.filter((n) => !n.ignored && ['button','combobox','spinbutton','textbox','link'].includes(n.role?.value));
    check(`${name}: every exposed control has an accessible name`, controls.length > 5 && controls.every((n) => n.name?.value.trim()));
    check(`${name}: polite status region exists`, await evaluate('document.querySelector("#live-status").getAttribute("aria-live") === "polite"'));
    check(`${name}: reduced motion preference is active`, await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'));

    // Capture synthetic-only full-page replay result, with stable 6-event preview.
    await evaluate('window.scrollTo(0,0); document.activeElement.blur()');
    const layout = await send('Page.getLayoutMetrics');
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.ceil(layout.cssContentSize.height), scale: 1 } });
    await writeFile(join(root, 'screenshots', `${name}-${width}.png`), Buffer.from(shot.data, 'base64'));

    await click('#sandbox-mode');
    check(`${name}: mode change resets fixture`, (await text('#revision')) === '0');
    check(`${name}: sandbox has no horizontal overflow`, await noOverflow());
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    check(`${name}: manual proposal applies`, (await text('#revision')) === '1');
    await click('#retry');
    check(`${name}: exact retry does not reapply`, (await text('#revision')) === '1' && (await text('#replayed')) === '1');
    await set('#actor', 'participant'); await set('#team', 'team-b');
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    check(`${name}: team permission rejection is visible`, (await text('#live-status')).includes('FORBIDDEN_TEAM'));
    await set('#actor', 'operator'); await set('#expected-revision', 0); await set('#action-key', 'qa-stale');
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    check(`${name}: stale write is rejected without state change`, (await text('#revision')) === '1' && (await text('#live-status')).includes('STALE_REVISION'));
    await set('#expected-revision', 1); await set('#action-key', 'qa-ready-b');
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    await set('#action', 'START'); await set('#action-key', 'qa-too-early');
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    check(`${name}: time gate rejection is visible`, (await text('#live-status')).includes('TOO_EARLY'));
    await click('#tick'); await set('#action-key', 'qa-start');
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    check(`${name}: explicit virtual clock enables start`, (await text('#revision')) === '3' && (await text('#clock')) === '00:10');
    await set('#actor', 'participant'); await set('#action', 'FINALIZE'); await set('#action-key', 'qa-forbidden');
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    check(`${name}: staff-only policy rejection is visible`, (await text('#live-status')).includes('FORBIDDEN_ACTION'));
    await click('#tick'); await click('#tick'); await set('#actor', 'operator'); await set('#action-key', 'qa-finalize');
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    check(`${name}: manual finalization at end gate`, (await text('#revision')) === '4');
    await set('#action', 'CANCEL'); await set('#action-key', 'qa-terminal');
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    check(`${name}: terminal mutation is rejected`, (await text('#live-status')).includes('TERMINAL_ROUND') && (await text('#revision')) === '4');
    await set('#action-key', 'manual-01');
    await evaluate('document.querySelector("#proposal-form").requestSubmit()');
    check(`${name}: changed payload under old key conflicts`, (await text('#live-status')).includes('IDEMPOTENCY_CONFLICT'));
    check(`${name}: sandbox rendered text contrast`, (await contrast()).length === 0);
    await click('#reset');
    check(`${name}: reset clears events and counters`, (await text('#decision-count')) === '0' && (await text('#revision')) === '0');
  }
  check('No page runtime or console errors (benign missing favicon excluded)', errors.length === 0);
  check('No attempted off-origin page requests', deniedRequests.length === 0);
  const version = await send('Browser.getVersion');
  const report = { observedAt: new Date().toISOString(), browser: version.product, node: process.version, isolation: 'Fresh headless Chrome profile; new owned process; loopback only; profile removed on completion.', checks, pageErrors: errors, deniedRequests, screenshots: ['screenshots/desktop-1440.png', 'screenshots/mobile-390.png'], limitations: 'Automated CDP and visual review; no assistive-technology user test or production certification.' };
  await writeFile(join(root, 'screenshots', 'browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PASS: ${checks.length} browser checks in ${version.product}; full-page 1440px and 390px screenshots saved.`);
} finally {
  if (socket) socket.close();
  if (chrome && chrome.exitCode === null) {
    const closed = once(chrome, 'exit'); chrome.kill();
    await Promise.race([closed, sleep(5000)]);
  }
  await new Promise((resolve) => server.close(resolve));
  // This path is constructed beneath this lab only. Never touch a user's browser profile.
  assert.ok(scratch.startsWith(join(root, '.qa') + (process.platform === 'win32' ? '\\' : '/')));
  await rm(scratch, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}
