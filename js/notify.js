// Oznámení rodiči přes ntfy (https://ntfy.sh). Bez vlastního serveru:
// aplikace pošle zprávu do „tématu“, které má rodič odebírané v aplikaci ntfy v telefonu.

import { formatDuration } from './session.js';

export const DEFAULT_NTFY_SERVER = 'https://ntfy.sh';

// Česká množná čísla: 1 příklad, 2–4 příklady, 5+ příkladů.
export function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

export function mistakesText(n) {
  if (n === 0) return 'bez chyby';
  return `${n} ${plural(n, 'chyba', 'chyby', 'chyb')}`;
}

function clock(ts) {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function buildMessage(result, childName, finishedAt) {
  const who = (childName || '').trim() || 'Dítě';
  const count = `${result.count} ${plural(result.count, 'příklad', 'příklady', 'příkladů')}`;
  return {
    title: `${who}: příklady hotové`,
    message:
      `Splněno ${count}, ${mistakesText(result.wrong)}, ` +
      `za ${formatDuration(result.durationMs)} (dokončeno v ${clock(finishedAt)}). ` +
      'Můžeš přidat bonusový čas ve Family Link.',
  };
}

// Náhodné téma, které nejde uhodnout (80 bitů náhody).
export function randomTopic(cryptoImpl = globalThis.crypto) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(16);
  cryptoImpl.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `priklady-${s}`;
}

export function topicUrl(server, topic) {
  return `${server.replace(/\/+$/, '')}/${encodeURIComponent(topic)}`;
}

// Odešle zprávu jako JSON na kořen serveru. Tělo jde jako text/plain (výchozí pro string),
// takže prohlížeč nedělá CORS preflight a české znaky v titulku nevadí (nejsou v hlavičce).
export async function sendNtfy(server, topic, { title, message }, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(`${server.replace(/\/+$/, '')}/`, {
    method: 'POST',
    body: JSON.stringify({ topic, title, message, tags: ['white_check_mark'], priority: 4 }),
  });
  if (!res.ok) throw new Error(`ntfy odpověděl ${res.status}`);
}
