import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, mistakesText, plural, randomTopic, sendNtfy, topicUrl } from '../js/notify.js';

test('množná čísla', () => {
  assert.equal(plural(1, 'příklad', 'příklady', 'příkladů'), 'příklad');
  assert.equal(plural(3, 'příklad', 'příklady', 'příkladů'), 'příklady');
  assert.equal(plural(10, 'příklad', 'příklady', 'příkladů'), 'příkladů');
  assert.equal(mistakesText(0), 'bez chyby');
  assert.equal(mistakesText(1), '1 chyba');
  assert.equal(mistakesText(2), '2 chyby');
  assert.equal(mistakesText(5), '5 chyb');
});

test('text zprávy', () => {
  const finishedAt = new Date(2026, 10, 16, 18, 5).getTime();
  const m = buildMessage({ count: 10, wrong: 1, durationMs: 252_000 }, 'Anička', finishedAt);
  assert.equal(m.title, 'Anička: příklady hotové');
  assert.equal(
    m.message,
    'Splněno 10 příkladů, 1 chyba, za 4 min 12 s (dokončeno v 18:05). Můžeš přidat bonusový čas ve Family Link.',
  );
  assert.match(buildMessage({ count: 10, wrong: 0, durationMs: 1000 }, '  ', finishedAt).title, /^Dítě:/);
});

test('náhodné téma', () => {
  const a = randomTopic();
  const b = randomTopic();
  assert.match(a, /^priklady-[a-z0-9]{16}$/);
  assert.notEqual(a, b);
  assert.equal(topicUrl('https://ntfy.sh/', a), `https://ntfy.sh/${a}`);
});

test('odeslání posílá JSON na kořen serveru bez vlastních hlaviček', async () => {
  let call;
  const fakeFetch = async (url, opts) => {
    call = { url, opts };
    return { ok: true, status: 200 };
  };
  await sendNtfy('https://ntfy.sh', 'priklady-x', { title: 'Ťuk', message: 'Žluťoučký' }, fakeFetch);
  assert.equal(call.url, 'https://ntfy.sh/');
  assert.equal(call.opts.method, 'POST');
  assert.equal(call.opts.headers, undefined);
  const body = JSON.parse(call.opts.body);
  assert.equal(body.topic, 'priklady-x');
  assert.equal(body.title, 'Ťuk');

  await assert.rejects(
    sendNtfy('https://ntfy.sh', 't', { title: 'a', message: 'b' }, async () => ({ ok: false, status: 429 })),
    /429/,
  );
});
