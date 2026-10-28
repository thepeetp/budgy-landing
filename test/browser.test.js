// Browser tests for the interactive parts of index.html. Serves the repo over a
// local static server and drives headless Chromium through Playwright.
// Run: npm run test:browser
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
               '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml' };

let server, baseURL, browser;

test.before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseURL = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});

test.after(async () => {
  await browser?.close();
  server?.close();
});

async function open(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(baseURL, { waitUntil: 'load' });
  return { page, context, errors };
}

test('hero demo: typing an expense shows category and amount', async () => {
  const { page, context, errors } = await open();
  await page.fill('#typingInput', 'ข้าวมันไก่ 50');
  await page.waitForSelector('#typingResult.show');
  const text = await page.textContent('#resultText');
  assert.match(text, /อาหาร/);
  assert.match(text, /฿50/);
  await page.fill('#typingInput', 'xyzzy 100');
  await page.waitForFunction(() => document.querySelector('#resultText').textContent.includes('อื่นๆ'));
  await page.fill('#typingInput', 'ข้าวมันไก่');
  await page.waitForFunction(() => document.querySelector('#resultText').textContent.includes('ใส่จำนวนเงิน'));
  assert.deepEqual(errors, []);
  await context.close();
});

test('hero demo: quick-try chip fills input and shows result', async () => {
  const { page, context } = await open();
  const chip = page.locator('.demo-chip').nth(1);
  const expected = await chip.getAttribute('data-text');
  await chip.click();
  assert.equal(await page.inputValue('#typingInput'), expected);
  await page.waitForSelector('#typingResult.show');
  const text = await page.textContent('#resultText');
  assert.match(text, /฿\d/);
  await context.close();
});

test('hero demo: auto-typing stops once the visitor types', async () => {
  const { page, context } = await open();
  // Idle: the showcase types by itself.
  await page.waitForFunction(() => document.querySelector('#typingInput').value.length > 3);
  // Interact: from here on the field belongs to the visitor.
  await page.fill('#typingInput', 'BTS 42');
  await page.waitForTimeout(4500);
  assert.equal(await page.inputValue('#typingInput'), 'BTS 42');
  assert.match(await page.textContent('#resultText'), /เดินทาง/);
  await context.close();
});

test('phone showcase: dots match screenshots and clicking one jumps', async () => {
  const { page, context } = await open();
  const imgCount = await page.locator('.phone-img').count();
  const dots = page.locator('#phoneDots button');
  assert.equal(await dots.count(), imgCount);
  const firstAlt = await page.locator('.phone-img.active').getAttribute('alt');
  assert.equal((await page.textContent('#phoneCaption')).trim(), firstAlt);
  const target = 3;
  await dots.nth(target).click();
  await page.waitForTimeout(800);
  const alt = await page.locator('.phone-img').nth(target).getAttribute('alt');
  assert.equal((await page.textContent('#phoneCaption')).trim(), alt);
  assert.ok(await page.locator('.phone-img').nth(target).evaluate((el) => el.classList.contains('active')));
  assert.equal(await dots.nth(target).getAttribute('aria-current'), 'true');
  await context.close();
});

test('faq: opening an item rotates the plus sign', async () => {
  const { page, context } = await open();
  const item = page.locator('#faq details').first();
  await item.scrollIntoViewIfNeeded();
  const sign = item.locator('summary span');
  assert.equal(await sign.evaluate((el) => getComputedStyle(el).transform), 'none');
  await item.locator('summary').click();
  await page.waitForTimeout(500);
  assert.ok(await item.evaluate((el) => el.open));
  const t = await sign.evaluate((el) => getComputedStyle(el).transform);
  assert.notEqual(t, 'none');
  // matrix(cos, sin, -sin, cos, 0, 0) for 45deg: cos = sin ~ 0.7071
  const [a, b] = t.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
  assert.ok(Math.abs(a - 0.7071) < 0.01 && Math.abs(b - 0.7071) < 0.01, t);
  await item.locator('summary').click();
  await page.waitForTimeout(500);
  assert.equal(await sign.evaluate((el) => getComputedStyle(el).transform), 'none');
  await context.close();
});

test('scroll progress bar fills as the page scrolls', async () => {
  const { page, context } = await open();
  const scale = () => page.evaluate(() => {
    const m = document.getElementById('scrollProgress').style.transform.match(/scaleX\(([\d.]+)\)/);
    return m ? Number(m[1]) : null;
  });
  assert.equal(await scale(), 0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  assert.ok((await scale()) > 0.99, `expected ~1, got ${await scale()}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  assert.equal(await scale(), 0);
  await context.close();
});

test('reduced motion: demo shows a static result, no typing', async () => {
  const { page, context } = await open({ reducedMotion: 'reduce' });
  await page.waitForTimeout(1500);
  const v1 = await page.inputValue('#typingInput');
  assert.ok(v1.length > 3, 'static example expected immediately');
  assert.ok(await page.locator('#typingResult.show').count() === 1);
  await page.waitForTimeout(2500);
  assert.equal(await page.inputValue('#typingInput'), v1, 'must not cycle under reduced motion');
  await context.close();
});

test('mobile: no horizontal overflow at 390px', async () => {
  const { page, context } = await open({ viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(500);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(sw <= 390, `scrollWidth ${sw} > 390`);
  await context.close();
});

// Drag the phone screen sideways with a real pointer, like a swipe.
async function swipe(page, fromX, toX, steps = 8) {
  const box = await page.locator('#phoneRotator').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * fromX, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * toX, y + 2, { steps });
  await page.mouse.up();
  await page.waitForTimeout(700);
}
const activeIndex = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.phone-img')].findIndex((el) => el.classList.contains('active')));

test('phone showcase: swiping left goes forward, swiping right goes back (and wraps)', async () => {
  const { page, context, errors } = await open();
  const count = await page.locator('.phone-img').count();
  await page.locator('#phoneRotator').scrollIntoViewIfNeeded();
  assert.equal(await activeIndex(page), 0);
  await swipe(page, 0.8, 0.2);
  assert.equal(await activeIndex(page), 1, 'swipe left should show the next screen');
  assert.equal((await page.textContent('#phoneCaption')).trim(),
    await page.locator('.phone-img').nth(1).getAttribute('alt'));
  await swipe(page, 0.2, 0.8);
  assert.equal(await activeIndex(page), 0, 'swipe right should come back');
  await swipe(page, 0.2, 0.8);
  assert.equal(await activeIndex(page), count - 1, 'swiping back from the first wraps to the last');
  assert.equal(await page.locator('#phoneDots button[aria-current="true"]').count(), 1);
  // Nothing is left half-dragged: every inline transform is cleared.
  const stray = await page.evaluate(() => [...document.querySelectorAll('.phone-img')]
    .filter((el) => el.style.transform !== '').length);
  assert.equal(stray, 0, 'inline drag transforms must be cleared after a swipe');
  assert.deepEqual(errors, []);
  await context.close();
});

test('phone showcase: a slow short drag snaps back, and the page keeps vertical scroll', async () => {
  const { page, context } = await open();
  await page.locator('#phoneRotator').scrollIntoViewIfNeeded();
  const box = await page.locator('#phoneRotator').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  // 30px over ~200ms: slow enough that it is a drag, not a flick.
  for (let i = 1; i <= 5; i++) { await page.mouse.move(box.x + box.width * 0.5 + i * 6, y); await page.waitForTimeout(40); }
  await page.mouse.up();
  await page.waitForTimeout(700);
  assert.equal(await activeIndex(page), 0, 'a slow drag under a quarter of the width must not change the screen');
  assert.equal(await page.locator('#phoneRotator').evaluate((el) => getComputedStyle(el).touchAction), 'pan-y');
  await context.close();
});

test('phone showcase: a quick flick changes the screen even when it is short', async () => {
  const { page, context } = await open();
  await page.locator('#phoneRotator').scrollIntoViewIfNeeded();
  await swipe(page, 0.55, 0.3, 3);
  assert.equal(await activeIndex(page), 1);
  await context.close();
});

test('phone showcase: a bare mouseenter (what iOS fires on a tap) does not freeze the autoplay', async () => {
  // iOS Safari fires mouseenter on a tap and never mouseleave, so a hover-pause
  // keyed on mouseenter stays paused for good. Only a real mouse pointer may pause.
  const { page, context } = await open();
  await page.locator('#phoneRotator').scrollIntoViewIfNeeded();
  await page.locator('#phoneRotator').dispatchEvent('mouseenter');
  const before = await activeIndex(page);
  await page.waitForTimeout(4600);
  assert.notEqual(await activeIndex(page), before, 'autoplay should keep going');
  await context.close();
});
