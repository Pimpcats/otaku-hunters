// Smoke test: does the PRODUCTION build actually load in a real browser?
//
// Builds are deployed to GitHub Pages, where a blank page (stale SW, bad asset
// path, boot exception) doesn't show up in `tsc`/`vite build`. This serves the
// built `dist/` with `vite preview` and drives it with headless Chromium,
// asserting the game canvas renders with no page errors, no failed requests, and
// no service-worker reload loop. Run via `npm run smoke` (which builds first).
//
// Chromium comes from playwright-core. We resolve it from the local dep or the
// global install; if neither exists the browser check is skipped (with a loud
// warning) rather than failing, so the script still runs in bare environments.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PORT = 4319;

function log(msg) {
  console.log(`[smoke] ${msg}`);
}

async function loadChromium() {
  const candidates = [
    'playwright',
    'playwright-core',
    '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core',
  ];
  for (const c of candidates) {
    try {
      return require(c).chromium;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Start `vite preview` and resolve with its base URL once it's listening. */
function startPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['vite', 'preview', '--port', String(PORT), '--strictPort'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    const onData = (buf) => {
      out += buf.toString();
      const m = out.match(/Local:\s+(http:\/\/\S+)/);
      if (m) resolve({ proc, url: m[1].replace(/\/+$/, '/') });
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (code) => reject(new Error(`vite preview exited early (code ${code})\n${out}`)));
    setTimeout(() => reject(new Error(`vite preview did not start in 20s\n${out}`)), 20000);
  });
}

async function main() {
  const { proc, url } = await startPreview();
  log(`preview serving ${url}`);
  let failed = false;
  try {
    const chromium = await loadChromium();
    if (!chromium) {
      log('WARNING: playwright-core not found — skipping browser check.');
      return;
    }
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    const reqFails = [];
    let navs = 0;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console.error: ${m.text()}`));
    page.on('requestfailed', (r) => reqFails.push(`${r.url()} :: ${r.failure()?.errorText}`));
    page.on('framenavigated', (f) => f === page.mainFrame() && navs++);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(5000); // let any SW self-destruct / reload settle

    const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));

    log(`canvas rendered: ${hasCanvas}`);
    log(`main-frame navigations: ${navs} (a reload loop would be high)`);
    if (reqFails.length) log(`failed requests:\n  ${reqFails.join('\n  ')}`);
    if (errors.length) log(`page errors:\n  ${errors.join('\n  ')}`);

    // Asset 404s (real failures) vs benign ones we ignore: none expected.
    if (!hasCanvas) { failed = true; log('FAIL: no <canvas> — the game did not boot.'); }
    if (errors.length) { failed = true; log('FAIL: page/console errors during load.'); }
    if (reqFails.length) { failed = true; log('FAIL: a request failed to load.'); }
    if (navs > 3) { failed = true; log('FAIL: looks like a service-worker reload loop.'); }

    await browser.close();
    if (!failed) log('PASS: site loads cleanly.');
  } finally {
    proc.kill('SIGTERM');
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('[smoke] ERROR:', e.message);
  process.exit(1);
});
