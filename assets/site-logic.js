/*
 * Pure logic for the interactive bits of budgy.life: the hero "type an expense"
 * demo and the split-bill calculator. No DOM in here so it runs under Node's
 * test runner as well as in the browser (see test/site-logic.test.js).
 *
 * The categorizer is a deliberately small keyword map. It is a taste of what
 * the app does, not the app's model, and the page says so next to the demo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BudgyLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATEGORIES = {
    food:          { key: 'food',          label: 'อาหาร & เครื่องดื่ม', icon: 'i-coffee', gradient: 'linear-gradient(135deg, #FB923C, #F5A623)' },
    transport:     { key: 'transport',     label: 'เดินทาง',            icon: 'i-car',    gradient: 'linear-gradient(135deg, #06B6D4, #3B82F6)' },
    utilities:     { key: 'utilities',     label: 'สาธารณูปโภค',        icon: 'i-bolt',   gradient: 'linear-gradient(135deg, #14B8A6, #06B6D4)' },
    shopping:      { key: 'shopping',      label: 'ช้อปปิ้ง',           icon: 'i-bag',    gradient: 'linear-gradient(135deg, #A855F7, #EC4899)' },
    entertainment: { key: 'entertainment', label: 'บันเทิง',            icon: 'i-film',   gradient: 'linear-gradient(135deg, #8B5CF6, #6366F1)' },
    health:        { key: 'health',        label: 'สุขภาพ',             icon: 'i-heart',  gradient: 'linear-gradient(135deg, #F43F5E, #FB7185)' },
    housing:       { key: 'housing',       label: 'ที่อยู่อาศัย',        icon: 'i-home',   gradient: 'linear-gradient(135deg, #0EA5E9, #14B8A6)' },
    education:     { key: 'education',     label: 'การศึกษา',           icon: 'i-book',   gradient: 'linear-gradient(135deg, #F59E0B, #F97316)' },
    other:         { key: 'other',         label: 'อื่นๆ',              icon: 'i-tag',    gradient: 'linear-gradient(135deg, #64748B, #94A3B8)' }
  };

  // Order matters: the first list that matches wins, so the specific bills
  // (ค่าน้ำ) sit above the broad ones (น้ำ).
  var RULES = [
    ['utilities', ['ค่าน้ำ', 'ค่าไฟ', 'ไฟฟ้า', 'ประปา', 'ค่าเน็ต', 'เน็ต', 'อินเทอร์เน็ต', 'ค่าโทร', 'ค่ามือถือ', 'มือถือ', 'true', 'ais', 'dtac', 'wifi', 'internet', 'electric', 'water bill', 'phone bill']],
    ['housing', ['ค่าเช่า', 'เช่า', 'หอพัก', 'ค่าหอ', 'คอนโด', 'ค่าบ้าน', 'ผ่อนบ้าน', 'ค่าส่วนกลาง', 'ซ่อมบ้าน', 'เฟอร์นิเจอร์', 'แม่บ้าน', 'rent', 'ikea', 'homepro', 'โฮมโปร']],
    ['transport', ['grab', 'bolt', 'uber', 'bts', 'mrt', 'arl', 'แท็กซี่', 'taxi', 'รถ', 'น้ำมัน', 'ปตท', 'ptt', 'ทางด่วน', 'จอดรถ', 'วินมอ', 'มอเตอร์ไซค์', 'เครื่องบิน', 'เที่ยวบิน', 'airasia', 'nokair', 'บขส', 'ค่าเดินทาง', 'เดินทาง', 'ค่าโดยสาร', 'airport', 'flight', 'bus', 'train', 'gas', 'fuel']],
    ['entertainment', ['netflix', 'spotify', 'youtube', 'disney', 'hbo', 'viu', 'iqiyi', 'เกม', 'game', 'steam', 'playstation', 'nintendo', 'หนัง', 'ภาพยนตร์', 'โรงหนัง', 'major', 'sf cinema', 'คอนเสิร์ต', 'concert', 'คาราโอเกะ', 'karaoke', 'บาร์', 'ผับ', 'apple music', 'บอร์ดเกม']],
    ['health', ['หมอ', 'โรงพยาบาล', 'คลินิก', 'ค่ายา', 'ร้านยา', 'ยา ', 'ฟิตเนส', 'fitness', 'gym', 'ยิม', 'วิตามิน', 'ทันตกรรม', 'ทำฟัน', 'ประกัน', 'insurance', 'hospital', 'doctor', 'pharmacy', 'นวด', 'massage', 'สปา', 'spa']],
    ['education', ['คอร์ส', 'course', 'เรียน', 'หนังสือ', 'book', 'ติว', 'udemy', 'coursera', 'ค่าเทอม', 'โรงเรียน', 'มหาวิทยาลัย', 'kindle', 'สอบ']],
    ['shopping', ['เสื้อ', 'กางเกง', 'รองเท้า', 'กระเป๋า', 'shopee', 'lazada', 'tiktok shop', 'uniqlo', 'ช้อป', 'shop', 'zara', 'h&m', 'เครื่องสำอาง', 'สกินแคร์', 'skincare', 'ของใช้', 'ห้าง', 'central', 'เซ็นทรัล', 'lotus', 'โลตัส', 'big c', 'บิ๊กซี', 'makro', 'แม็คโคร', 'watsons', 'ของขวัญ', 'gift', 'muji', 'iphone', 'หูฟัง', 'decathlon', 'daiso']],
    ['food', ['กาแฟ', 'ลาเต้', 'latte', 'coffee', 'cafe', 'คาเฟ่', 'ชา', 'tea', 'ข้าว', 'ก๋วยเตี๋ยว', 'อาหาร', 'กิน', 'ขนม', 'เค้ก', 'cake', 'น้ำ', 'เบียร์', 'beer', 'หมูกระทะ', 'ชาบู', 'ปิ้งย่าง', 'ส้มตำ', 'ผัดไทย', 'บุฟเฟ่ต์', 'buffet', 'พิซซ่า', 'pizza', 'ซูชิ', 'sushi', 'kfc', 'mcdonald', 'แมค', 'starbucks', 'amazon', 'อเมซอน', 'lunch', 'dinner', 'breakfast', 'food', 'grabfood', 'lineman', 'foodpanda', 'robinhood', '7-11', 'เซเว่น', 'ไก่ทอด', 'ไอติม', 'ไอศกรีม', 'มื้อ', 'ของกิน', 'นม', 'ขนมปัง', 'เบเกอรี่', 'bakery', 'ร้านอาหาร', 'สั่งอาหาร', 'ข้าวเย็น', 'ข้าวเช้า']]
  ];

  function categorize(text) {
    var t = String(text || '').toLowerCase();
    // Strip the amount so "50 บาท" never matches a keyword by accident.
    t = t.replace(/[\d,.]+/g, ' ');
    for (var i = 0; i < RULES.length; i++) {
      var words = RULES[i][1];
      for (var j = 0; j < words.length; j++) {
        if (t.indexOf(words[j]) !== -1) return CATEGORIES[RULES[i][0]];
      }
    }
    return CATEGORIES.other;
  }

  function parseAmount(text) {
    var m = String(text || '').match(/(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/);
    if (!m) return null;
    var whole = Number(m[1].replace(/,/g, ''));
    var frac = m[2] ? Number('0.' + m[2]) : 0;
    var n = whole + frac;
    return isFinite(n) ? n : null;
  }

  function demoResult(text) {
    var amount = parseAmount(text);
    return { category: categorize(text), amount: amount, needsAmount: amount === null };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function splitBill(total, people) {
    total = Number(total); people = Number(people);
    if (!(total > 0) || !(people >= 2)) return null;
    var perPerson = round2(total / people);
    return { perPerson: perPerson, owedToYou: round2(perPerson * (people - 1)) };
  }

  function formatBaht(n, decimals) {
    if (decimals === undefined) decimals = Number.isInteger(n) ? 0 : 2;
    return '฿' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  return { CATEGORIES: CATEGORIES, categorize: categorize, parseAmount: parseAmount,
           demoResult: demoResult, splitBill: splitBill, formatBaht: formatBaht };
});
