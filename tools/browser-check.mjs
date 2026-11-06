// A throwaway Chrome for checking the site: its own temporary profile (never anyone's own browser or sign-ins), headless,
// driven over the DevTools protocol; it takes screenshots over time and can run a script in the page. A watchdog
// closes it after 70 s whatever happens, and its profile is deleted. Needs Google Chrome 157+ (for HTML in Canvas).
//   node tools/browser-check.mjs URL OUTDIR [WIDTH HEIGHT light|dark SHOTS GAP_MS START_MS]
//   EVAL=check.js  run that file's expression after the shots and print its result
//   FIRST=step.js  run that file's expression before the shots (e.g. a navigation to watch)
// Run one at a time: two at once can leave a Chrome behind (pgrep -f skool-chrome- to check).
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, W = '1600', H = '1000', scheme = 'light', shots = '8', gap = '250', start = '600'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'skool-chrome-'));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
// watchdog: never leave a test Chrome behind, even if a step hangs
setTimeout(() => { try { chrome.kill('SIGKILL'); rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(3); }, 70000).unref();
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const wait = new Map(); const logs = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + m.params.exceptionDetails.exception?.description);
  });
  const send = (method, params = {}) => new Promise(r => { const n = ++id; wait.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(+start);
  if (process.env.FIRST) {
    const { readFileSync } = await import('node:fs');
    await send('Runtime.evaluate', { expression: readFileSync(process.env.FIRST, 'utf8'), awaitPromise: true, userGesture: true });
  }
  for (let i = 0; i < +shots; i++) {
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    writeFileSync(join(out, `shot-${String(i).padStart(2, '0')}.jpg`), Buffer.from(r.result.data, 'base64'));
    await sleep(+gap);
  }
  if (process.env.EVAL) {
    const { readFileSync } = await import('node:fs');
    const r = await send('Runtime.evaluate', { expression: readFileSync(process.env.EVAL, 'utf8'), awaitPromise: true, returnByValue: true, userGesture: true });
    console.log('EVAL', JSON.stringify(r.result.result?.value ?? r.result.exceptionDetails?.exception?.description));
  }
  const probe = await send('Runtime.evaluate', { expression: `JSON.stringify({ api: 'drawElementImage' in CanvasRenderingContext2D.prototype, nib: !!document.querySelector('ink-nib'), canvases: document.querySelectorAll('canvas').length })`, returnByValue: true });
  console.log(probe.result.result.value);
  console.log(logs.join('\n'));
  ws.close();
} finally {
  chrome.kill('SIGTERM');
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
