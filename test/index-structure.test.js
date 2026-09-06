// Static checks on index.html: the hooks the scripts rely on, the FAQ open
// state, and the marketing rule that the site never uses emoji.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('index.html contains no emoji', () => {
  // Misc symbols + pictographs (1F300-1FAFF), misc symbols/dingbats (2600-27BF),
  // plus the two stars that live outside those blocks.
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}]/u;
  const m = html.match(emoji);
  assert.equal(m, null, m && `found ${m[0]} at offset ${m.index}`);
});

test('scripts reference site-logic.js and hooks exist', () => {
  assert.match(html, /<script src="assets\/site-logic\.js(\?v=[\w.-]+)?"><\/script>/);
  for (const id of ['typingInput', 'typingResult', 'resultText', 'resultTag', 'demoChips',
                    'scrollProgress']) {
    assert.ok(html.includes(`id="${id}"`), `missing id="${id}"`);
  }
  // The demo must be a real text field, not a div, so phones show a keyboard.
  assert.match(html, /<input[^>]*id="typingInput"/);
  assert.ok((html.match(/class="demo-chip"/g) || []).length >= 3, 'need at least 3 quick-try chips');
});

test('the split-bill calculator is gone', () => {
  // Removed at the user's request on 2026-09-06: the หารบิล card keeps its copy
  // and its three bullets, but the interactive calculator is not on the page.
  for (const hook of ['splitCalc', 'splitTotal', 'splitPeople', 'splitMinus', 'splitPlus',
                      'splitPerPerson', 'splitOwed', 'splitAvatars']) {
    assert.ok(!html.includes(`id="${hook}"`), `calculator hook came back: id="${hook}"`);
  }
  assert.ok(!html.includes('split-calc'), 'calculator markup or CSS came back');
  assert.ok(!/BudgyLogic\s*\.\s*splitBill|L\.splitBill/.test(html), 'calculator script came back');
  // The card itself must stay.
  assert.ok(html.includes('หารบิลกับเพื่อน'), 'the split-bill feature card must stay');
  assert.ok(html.includes('class="split-points"'), 'the three split-bill bullets must stay');
});

test('phone caption and dots hooks exist', () => {
  assert.ok(html.includes('id="phoneCaption"'), 'missing id="phoneCaption"');
  assert.ok(html.includes('id="phoneDots"'), 'missing id="phoneDots"');
  // Every screenshot has an alt, which becomes the caption text.
  const imgs = html.match(/<img class="phone-img[^>]*>/g) || [];
  assert.ok(imgs.length >= 5, `expected several phone screenshots, got ${imgs.length}`);
  for (const img of imgs) assert.match(img, /alt="[^"]+"/, img);
});

test('FAQ open-state CSS exists', () => {
  assert.match(html, /#faq details\[open\] summary span\s*\{[^}]*rotate\(45deg\)/s);
  assert.match(html, /#faq details\[open\] > p\s*\{[^}]*animation/s);
});
