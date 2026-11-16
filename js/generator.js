// Generátor příkladů. Čistý modul bez DOM – testuje se v tests/generator.test.js.
//
// Každý příklad je { kind, text, answer }. `text` obsahuje právě jeden otazník,
// na jehož místo dítě doplní výsledek, např. "7 + 8 = ?" nebo "7 + ? = 15".

export const MINUS = '−'; // −
export const TIMES = '·'; // · (tak se násobí v českých školách)
export const DIVIDE = ':';

export const DEFAULT_PROBLEMS = Object.freeze({
  add: true,
  sub: true,
  max: 10, // 10 | 20 | 100 | 1000
  crossTen: true, // povolit přechod přes desítku
  mul: false,
  div: false,
  rowsFrom: 2, // násobilka: řady od–do
  rowsTo: 10,
  missing: false, // doplňování neznámé (7 + ? = 15)
  threeTerms: false, // tři čísla a závorky (12 − (4 + 3))
});

export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Přechod přes desítku u sčítání a + b: jednotky dají víc než 10 (8 + 5, 27 + 6).
// 8 + 2 = 10 ani 17 + 3 = 20 se za přechod nepovažují.
export function crossesTenAdd(a, b) {
  return (a % 10) + (b % 10) > 10;
}

// Odčítání a − b = c je zrcadlo sčítání c + b = a.
export function crossesTenSub(a, b) {
  return crossesTenAdd(a - b, b);
}

export function enabledKinds(p) {
  const kinds = [];
  if (p.add) kinds.push('add');
  if (p.sub) kinds.push('sub');
  if (p.mul) kinds.push('mul');
  if (p.div) kinds.push('div');
  if (p.missing) {
    if (p.add) kinds.push('missingAdd');
    if (p.sub) kinds.push('missingSub');
    if (p.mul) kinds.push('missingMul');
  }
  if (p.threeTerms && (p.add || p.sub)) kinds.push('three');
  return kinds;
}

export function normalizeProblems(p) {
  const out = { ...DEFAULT_PROBLEMS, ...p };
  out.max = [10, 20, 100, 1000].includes(Number(out.max)) ? Number(out.max) : 10;
  out.rowsFrom = clamp(Math.round(Number(out.rowsFrom) || 2), 1, 10);
  out.rowsTo = clamp(Math.round(Number(out.rowsTo) || 10), 1, 10);
  if (out.rowsFrom > out.rowsTo) [out.rowsFrom, out.rowsTo] = [out.rowsTo, out.rowsFrom];
  for (const k of ['add', 'sub', 'crossTen', 'mul', 'div', 'missing', 'threeTerms']) out[k] = Boolean(out[k]);
  return out;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function genAdd(rng, p) {
  for (;;) {
    const c = randInt(rng, 2, p.max);
    const a = randInt(rng, 1, c - 1);
    const b = c - a;
    if (!p.crossTen && crossesTenAdd(a, b)) continue;
    return { a, b, c };
  }
}

function genSub(rng, p) {
  for (;;) {
    const a = randInt(rng, 2, p.max);
    const b = randInt(rng, 1, a);
    if (!p.crossTen && crossesTenSub(a, b)) continue;
    return { a, b, c: a - b };
  }
}

function genMul(rng, p) {
  const row = randInt(rng, p.rowsFrom, p.rowsTo);
  const k = randInt(rng, 1, 10);
  return rng() < 0.5 ? { a: row, b: k, c: row * k } : { a: k, b: row, c: row * k };
}

function genThree(rng, p) {
  const ops = [];
  if (p.add) ops.push('+');
  if (p.sub) ops.push('-');
  const apply = (x, op, y) => (op === '+' ? x + y : x - y);
  const ok = (v) => v >= 0 && v <= p.max;
  const sym = (op) => (op === '+' ? '+' : MINUS);
  for (;;) {
    const op1 = pick(rng, ops);
    const op2 = pick(rng, ops);
    const a = randInt(rng, 1, p.max);
    const b = randInt(rng, 1, p.max);
    const c = randInt(rng, 1, p.max);
    if (rng() < 0.5) {
      // a op1 b op2 c, zleva doprava
      const x = apply(a, op1, b);
      const r = apply(x, op2, c);
      if (!ok(x) || !ok(r)) continue;
      return { text: `${a} ${sym(op1)} ${b} ${sym(op2)} ${c} = ?`, answer: r };
    }
    // a op1 (b op2 c)
    const inner = apply(b, op2, c);
    const r = apply(a, op1, inner);
    if (!ok(inner) || inner === 0 || !ok(r)) continue;
    return { text: `${a} ${sym(op1)} (${b} ${sym(op2)} ${c}) = ?`, answer: r };
  }
}

export function generateProblem(rawProblems, rng = Math.random) {
  const p = normalizeProblems(rawProblems);
  const kinds = enabledKinds(p);
  if (kinds.length === 0) throw new Error('Není zapnutý žádný typ příkladů.');
  const kind = pick(rng, kinds);
  switch (kind) {
    case 'add': {
      const { a, b, c } = genAdd(rng, p);
      return { kind, text: `${a} + ${b} = ?`, answer: c };
    }
    case 'sub': {
      const { a, b, c } = genSub(rng, p);
      return { kind, text: `${a} ${MINUS} ${b} = ?`, answer: c };
    }
    case 'mul': {
      const { a, b, c } = genMul(rng, p);
      return { kind, text: `${a} ${TIMES} ${b} = ?`, answer: c };
    }
    case 'div': {
      const divisor = randInt(rng, p.rowsFrom, p.rowsTo);
      const q = randInt(rng, 1, 10);
      return { kind, text: `${divisor * q} ${DIVIDE} ${divisor} = ?`, answer: q };
    }
    case 'missingAdd': {
      const { a, b, c } = genAdd(rng, p);
      return rng() < 0.5
        ? { kind, text: `${a} + ? = ${c}`, answer: b }
        : { kind, text: `? + ${b} = ${c}`, answer: a };
    }
    case 'missingSub': {
      const { a, b, c } = genSub(rng, p);
      return rng() < 0.5
        ? { kind, text: `${a} ${MINUS} ? = ${c}`, answer: b }
        : { kind, text: `? ${MINUS} ${b} = ${c}`, answer: a };
    }
    case 'missingMul': {
      const { a, b, c } = genMul(rng, p);
      return { kind, text: `${a} ${TIMES} ? = ${c}`, answer: b };
    }
    case 'three':
      return { kind, ...genThree(rng, p) };
    default:
      throw new Error(`Neznámý typ: ${kind}`);
  }
}

// Vrátí příklad, který se nepotkal s žádným z `avoidTexts` (pokud to jde).
export function generateUnique(rawProblems, avoidTexts, rng = Math.random) {
  let last;
  for (let i = 0; i < 50; i++) {
    last = generateProblem(rawProblems, rng);
    if (!avoidTexts.has(last.text)) return last;
  }
  return last; // u malého rozsahu (např. jen + do 10) se opakování nevyhneme
}
