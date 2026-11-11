// Group invite links on budgy.life (thepeetp/budgy#1524). Run: node --test test/invite-link.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../assets/invite-link.js');

const TOKEN = '3f2b8c1e-7a4d-4e5f-9b6a-0c1d2e3f4a5b';
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('both AASA files claim /invite/* for the app, next to /ref/*', () => {
  for (const file of ['.well-known/apple-app-site-association', 'apple-app-site-association']) {
    const aasa = JSON.parse(read(file));
    const detail = aasa.applinks.details[0];
    assert.deepEqual(detail.appIDs, ['TWY9VQV23Y.io.budgy.mobile'], file);
    const paths = detail.components.map((c) => c['/']);
    assert.ok(paths.includes('/invite/*'), `${file} must claim /invite/*`);
    assert.ok(paths.includes('/ref/*'), `${file} must keep /ref/*`);
    assert.ok(!paths.includes('/*'), `${file} must not claim the whole host`);
  }
});

test('tokenFromPath reads /invite/group/<token> and nothing else', () => {
  assert.equal(I.tokenFromPath(`/invite/group/${TOKEN}`), TOKEN);
  assert.equal(I.tokenFromPath(`/invite/group/${TOKEN}/`), TOKEN);
  for (const p of ['/invite/group/', '/invite/group/short', `/invite/${TOKEN}`,
                   `/ref/${TOKEN}`, `/invite/group/${TOKEN}/x`, '/invite/group/<script>']) {
    assert.equal(I.tokenFromPath(p), null, p);
  }
});

test('404 rewrite: an invite path goes to the invite page, token and query kept', () => {
  assert.equal(
    I.fallbackLocation(`/invite/group/${TOKEN}`, '?openExternalBrowser=1'),
    `/invite/?code=${TOKEN}&openExternalBrowser=1`,
  );
  assert.equal(I.fallbackLocation(`/invite/group/${TOKEN}`, ''), `/invite/?code=${TOKEN}`);
  assert.equal(I.fallbackLocation('/ref/ABCDEFGH', ''), null, 'referral paths are not touched');
});

test('404.html loads the invite logic before it routes', () => {
  const html = read('404.html');
  const script = html.indexOf('/assets/invite-link.js');
  const route = html.indexOf('BudgyInvite.fallbackLocation');
  assert.ok(script > 0 && route > script, 'invite-link.js must load before the router uses it');
});

test('tokenFromSearch reads ?code= and rejects anything that is not a token', () => {
  assert.equal(I.tokenFromSearch(`?code=${TOKEN}&openExternalBrowser=1`), TOKEN);
  assert.equal(I.tokenFromSearch('?code='), null);
  assert.equal(I.tokenFromSearch('?code=%3Cscript%3E'), null);
  assert.equal(I.tokenFromSearch(''), null);
});

test('the ways into the app carry the same link the share button sends', () => {
  assert.equal(I.inviteUrl(TOKEN), `https://budgy.life/invite/group/${TOKEN}`);
  assert.equal(
    I.smartBannerContent(TOKEN),
    `app-id=6756961804, app-argument=https://budgy.life/invite/group/${TOKEN}`,
  );
  const intent = I.androidIntentUrl(TOKEN);
  assert.match(intent, new RegExp(`^intent://budgy\\.life/invite/group/${TOKEN}#Intent;`));
  assert.match(intent, /scheme=https;package=io\.budgy\.mobile;/);
  assert.match(intent, /S\.browser_fallback_url=https%3A%2F%2Fplay\.google\.com/);
});

test("inside LINE's in-app browser the page asks LINE for the system browser, once", () => {
  const line = 'Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 Line/14.0.0';
  assert.equal(
    I.lineExternalUrl(`https://budgy.life/invite/?code=${TOKEN}`, line),
    `https://budgy.life/invite/?code=${TOKEN}&openExternalBrowser=1`,
  );
  assert.equal(
    I.lineExternalUrl(`https://budgy.life/invite/?code=${TOKEN}&openExternalBrowser=1`, line),
    null,
  );
  assert.equal(I.lineExternalUrl('https://budgy.life/invite/', 'Mozilla/5.0 Safari'), null);
});

test('the invite page: Thai first, store links, no emoji, tells the reader to tap the link again', () => {
  const html = read('invite/index.html');
  assert.match(html, /<html lang="th">/);
  assert.ok(html.includes('src="/assets/invite-link.js"'));
  assert.ok(html.includes('https://apps.apple.com/app/budgy/id6756961804'));
  assert.ok(html.includes('https://play.google.com/store/apps/details?id=io.budgy.mobile'));
  assert.ok(html.includes('แตะลิงก์เชิญอีกครั้ง'));
  assert.ok(html.includes('id="openInApp"') && html.includes('id="badLink"'));
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}]/u;
  assert.equal(html.match(emoji), null);
});
