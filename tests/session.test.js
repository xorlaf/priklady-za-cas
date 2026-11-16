import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  maxMistakes,
  createSession,
  recordAnswer,
  evaluate,
  formatDuration,
  acceptedToday,
  dailyLimitReached,
} from '../js/session.js';

const RULES = { count: 10, minAccuracy: 80, minSecondsPerTask: 2 };

test('povolený počet chyb', () => {
  assert.equal(maxMistakes(10, 80), 2); // 10/12 = 83 %, 10/13 = 77 %
  assert.equal(maxMistakes(10, 100), 0);
  assert.equal(maxMistakes(10, 50), 10);
  assert.equal(maxMistakes(5, 90), 0); // 5/6 = 83 %
  assert.equal(maxMistakes(20, 90), 2); // 20/22 = 90,9 %
});

test('bez chyby a dost pomalu → uznáno', () => {
  const s = createSession(RULES, 0);
  let st;
  for (let i = 0; i < 10; i++) st = recordAnswer(s, true);
  assert.equal(st, 'complete');
  const r = evaluate(s, 60_000);
  assert.equal(r.accepted, true);
  assert.equal(r.accuracy, 100);
});

test('dvě chyby projdou, třetí sadu ukončí', () => {
  const s = createSession(RULES, 0);
  assert.equal(recordAnswer(s, false), 'continue');
  assert.equal(recordAnswer(s, false), 'continue');
  assert.equal(recordAnswer(s, false), 'failed');
  assert.equal(evaluate(s, 60_000).reason, 'mistakes');
});

test('dvě chyby a deset správně → uznáno', () => {
  const s = createSession(RULES, 0);
  recordAnswer(s, false);
  recordAnswer(s, false);
  let st;
  for (let i = 0; i < 10; i++) st = recordAnswer(s, true);
  assert.equal(st, 'complete');
  const r = evaluate(s, 60_000);
  assert.equal(r.accepted, true);
  assert.equal(r.accuracy, 83);
});

test('moc rychle → neuznáno', () => {
  const s = createSession(RULES, 0);
  for (let i = 0; i < 10; i++) recordAnswer(s, true);
  assert.equal(evaluate(s, 19_999).reason, 'tooFast');
  assert.equal(evaluate(s, 20_000).accepted, true);
});

test('formát délky', () => {
  assert.equal(formatDuration(4_000), '4 s');
  assert.equal(formatDuration(252_000), '4 min 12 s');
});

test('denní strop počítá jen dnešní uznané sady', () => {
  const now = new Date(2026, 10, 16, 18, 0).getTime();
  const yesterday = new Date(2026, 10, 15, 20, 0).getTime();
  const history = [
    { accepted: true, finishedAt: now - 3600_000 },
    { accepted: false, finishedAt: now - 1800_000 },
    { accepted: true, finishedAt: yesterday },
  ];
  assert.equal(acceptedToday(history, now), 1);
  assert.equal(dailyLimitReached(history, 2, now), false);
  assert.equal(dailyLimitReached([...history, { accepted: true, finishedAt: now }], 2, now), true);
  assert.equal(dailyLimitReached(history, 0, now), false); // 0 = bez omezení
});
