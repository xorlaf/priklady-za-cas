import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateProblem,
  generateUnique,
  enabledKinds,
  normalizeProblems,
  crossesTenAdd,
  crossesTenSub,
  DEFAULT_PROBLEMS,
  MINUS,
  TIMES,
} from '../js/generator.js';

// Deterministický generátor náhody (mulberry32), ať jsou testy opakovatelné.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Vyhodnotí text příkladu s dosazenou odpovědí a ověří, že rovnost platí.
function checkProblem(pr) {
  assert.equal((pr.text.match(/\?/g) || []).length, 1, `právě jeden otazník: ${pr.text}`);
  assert.ok(Number.isInteger(pr.answer) && pr.answer >= 0, `odpověď je nezáporné celé číslo: ${pr.text} → ${pr.answer}`);
  const filled = pr.text.replace('?', String(pr.answer));
  const [left, right] = filled.split('=').map((s) => s.trim());
  const js = (s) => s.replaceAll(MINUS, '-').replaceAll(TIMES, '*').replaceAll(':', '/');
  const l = Function(`return (${js(left)})`)();
  const r = Function(`return (${js(right)})`)();
  assert.equal(l, r, `rovnost platí: ${filled}`);
}

const RUNS = 3000;

test('výchozí nastavení: + a − do 10', () => {
  const rng = seeded(1);
  for (let i = 0; i < RUNS; i++) {
    const pr = generateProblem(DEFAULT_PROBLEMS, rng);
    assert.ok(['add', 'sub'].includes(pr.kind));
    checkProblem(pr);
    const nums = pr.text.match(/\d+/g).map(Number);
    for (const n of [...nums, pr.answer]) assert.ok(n <= 10, `${pr.text} nepřekročí 10`);
  }
});

for (const max of [20, 100, 1000]) {
  test(`+ a − do ${max}, výsledky ani mezivýsledky nepřekročí rozsah`, () => {
    const rng = seeded(max);
    const p = { ...DEFAULT_PROBLEMS, max, missing: true, threeTerms: true };
    for (let i = 0; i < RUNS; i++) {
      const pr = generateProblem(p, rng);
      checkProblem(pr);
      for (const n of [...pr.text.match(/\d+/g).map(Number), pr.answer]) assert.ok(n <= max, `${pr.text}`);
    }
  });
}

test('bez přechodu přes desítku', () => {
  const rng = seeded(7);
  const p = { ...DEFAULT_PROBLEMS, max: 100, crossTen: false };
  for (let i = 0; i < RUNS; i++) {
    const pr = generateProblem(p, rng);
    const [a, b] = pr.text.match(/\d+/g).map(Number);
    if (pr.kind === 'add') assert.ok(!crossesTenAdd(a, b), pr.text);
    if (pr.kind === 'sub') assert.ok(!crossesTenSub(a, b), pr.text);
  }
});

test('definice přechodu přes desítku', () => {
  assert.equal(crossesTenAdd(8, 5), true);
  assert.equal(crossesTenAdd(8, 2), false); // 10 není přechod
  assert.equal(crossesTenAdd(17, 3), false);
  assert.equal(crossesTenAdd(27, 6), true);
  assert.equal(crossesTenSub(13, 5), true);
  assert.equal(crossesTenSub(10, 3), false);
  assert.equal(crossesTenSub(20, 3), false);
  assert.equal(crossesTenSub(15, 3), false);
});

test('násobilka a dělení drží zvolené řady', () => {
  const rng = seeded(3);
  const p = { ...DEFAULT_PROBLEMS, add: false, sub: false, mul: true, div: true, rowsFrom: 3, rowsTo: 5, missing: true };
  const kinds = new Set();
  for (let i = 0; i < RUNS; i++) {
    const pr = generateProblem(p, rng);
    kinds.add(pr.kind);
    checkProblem(pr);
    const nums = pr.text.match(/\d+/g).map(Number);
    if (pr.kind === 'mul') assert.ok(nums.some((n) => n >= 3 && n <= 5), pr.text);
    if (pr.kind === 'div') assert.ok(nums[1] >= 3 && nums[1] <= 5 && pr.answer >= 1 && pr.answer <= 10, pr.text);
  }
  assert.deepEqual([...kinds].sort(), ['div', 'missingMul', 'mul']);
});

test('žádný zapnutý typ → srozumitelná chyba', () => {
  const p = { ...DEFAULT_PROBLEMS, add: false, sub: false };
  assert.deepEqual(enabledKinds(normalizeProblems(p)), []);
  assert.throws(() => generateProblem(p), /Není zapnutý/);
});

test('normalizace opraví nesmyslné hodnoty', () => {
  const p = normalizeProblems({ max: 37, rowsFrom: 9, rowsTo: 4 });
  assert.equal(p.max, 10);
  assert.equal(p.rowsFrom, 4);
  assert.equal(p.rowsTo, 9);
});

test('generateUnique se vyhne opakování, když to rozsah dovolí', () => {
  const rng = seeded(11);
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    const pr = generateUnique(DEFAULT_PROBLEMS, seen, rng);
    assert.ok(!seen.has(pr.text), `opakování: ${pr.text}`);
    seen.add(pr.text);
  }
});
