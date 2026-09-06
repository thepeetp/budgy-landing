// Pure-logic tests for assets/site-logic.js (the hero demo categorizer and the
// split-bill calculator). Run: node --test test/site-logic.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../assets/site-logic.js');
const { categorize, parseAmount, splitBill, formatBaht, demoResult } = logic;

test('categorize: Thai food keyword', () => {
  assert.equal(categorize('ข้าวมันไก่ 50').key, 'food');
  assert.equal(categorize('กาแฟลาเต้ 85 บาท').key, 'food');
  assert.equal(categorize('ชาไข่มุก 65').key, 'food');
});

test('categorize: transport, utilities, shopping, entertainment', () => {
  assert.equal(categorize('Grab ไปทำงาน 120').key, 'transport');
  assert.equal(categorize('BTS 42').key, 'transport');
  assert.equal(categorize('ค่าเน็ต 599 บาท').key, 'utilities');
  assert.equal(categorize('ค่าไฟ 1,200').key, 'utilities');
  assert.equal(categorize('เสื้อยืด 390').key, 'shopping');
  assert.equal(categorize('Netflix 419').key, 'entertainment');
});

test('categorize: matching is case-insensitive and ignores the amount', () => {
  assert.equal(categorize('NETFLIX 419').key, 'entertainment');
  assert.equal(categorize('grab 80').key, 'transport');
});

test('categorize: unknown text falls back to other', () => {
  const r = categorize('xyzzy 100');
  assert.equal(r.key, 'other');
  assert.equal(typeof r.label, 'string');
  assert.ok(r.label.length > 0);
});

test('categorize: every category has label, icon and gradient', () => {
  for (const c of Object.values(logic.CATEGORIES)) {
    assert.ok(c.label && c.icon && c.gradient, JSON.stringify(c));
    assert.match(c.icon, /^i-/);
  }
});

test('parseAmount: plain, comma, decimal, currency markers', () => {
  assert.equal(parseAmount('ข้าวมันไก่ 50'), 50);
  assert.equal(parseAmount('ค่าไฟ 1,200'), 1200);
  assert.equal(parseAmount('กาแฟ 85.50 บาท'), 85.5);
  assert.equal(parseAmount('฿120 Grab'), 120);
  assert.equal(parseAmount('120บาท'), 120);
});

test('parseAmount: no number returns null', () => {
  assert.equal(parseAmount('ข้าวมันไก่'), null);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('   '), null);
});

test('demoResult: combines category and amount; missing amount is flagged', () => {
  const ok = demoResult('ข้าวมันไก่ 50');
  assert.equal(ok.category.key, 'food');
  assert.equal(ok.amount, 50);
  assert.equal(ok.needsAmount, false);
  const missing = demoResult('ข้าวมันไก่');
  assert.equal(missing.needsAmount, true);
  assert.equal(missing.amount, null);
});

test('splitBill: divides and rounds to satang', () => {
  assert.deepEqual(splitBill(1240, 4), { perPerson: 310, owedToYou: 930 });
  assert.deepEqual(splitBill(1000, 3), { perPerson: 333.33, owedToYou: 666.66 });
  assert.deepEqual(splitBill(1240, 5), { perPerson: 248, owedToYou: 992 });
});

test('splitBill: rejects fewer than 2 people or a non-positive total', () => {
  assert.equal(splitBill(1240, 1), null);
  assert.equal(splitBill(0, 4), null);
  assert.equal(splitBill(NaN, 4), null);
});

test('formatBaht: thousands separator', () => {
  assert.equal(formatBaht(310, 2), '฿310.00');
  assert.equal(formatBaht(1240, 2), '฿1,240.00');
  assert.equal(formatBaht(1234567.5, 2), '฿1,234,567.50');
});

test('formatBaht: whole amounts drop the decimals by default', () => {
  assert.equal(formatBaht(50), '฿50');
  assert.equal(formatBaht(85.5), '฿85.50');
  assert.equal(formatBaht(1200), '฿1,200');
});
