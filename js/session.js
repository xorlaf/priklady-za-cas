// Vyhodnocení jedné sady příkladů. Čistý modul – testy v tests/session.test.js.
//
// Pravidla:
// - sada je splněná, až má dítě `count` správných odpovědí,
// - špatná odpověď se počítá jako chyba a místo ní přijde další příklad,
// - úspěšnost = správně / všechny odpovědi musí být aspoň `minAccuracy` %,
//   jakmile to už nejde stihnout, sada hned končí neúspěchem,
// - celá sada musí trvat aspoň count × minSecondsPerTask (ochrana proti ťukání naslepo).

export function maxMistakes(count, minAccuracy) {
  if (minAccuracy <= 0) return Infinity;
  // největší w, pro které count / (count + w) >= minAccuracy / 100
  return Math.floor((count * 100 - count * minAccuracy) / minAccuracy + 1e-9);
}

export function createSession(rules, startedAt = Date.now()) {
  return {
    count: rules.count,
    minAccuracy: rules.minAccuracy,
    minSecondsPerTask: rules.minSecondsPerTask,
    allowedMistakes: maxMistakes(rules.count, rules.minAccuracy),
    correct: 0,
    wrong: 0,
    startedAt,
  };
}

// Zaznamená odpověď a vrátí 'continue' | 'complete' | 'failed'.
export function recordAnswer(s, isCorrect) {
  if (isCorrect) s.correct += 1;
  else s.wrong += 1;
  if (s.wrong > s.allowedMistakes) return 'failed';
  if (s.correct >= s.count) return 'complete';
  return 'continue';
}

export function evaluate(s, finishedAt = Date.now()) {
  const durationMs = Math.max(0, finishedAt - s.startedAt);
  const total = s.correct + s.wrong;
  const accuracy = total === 0 ? 0 : Math.round((s.correct / total) * 100);
  const base = { durationMs, correct: s.correct, wrong: s.wrong, accuracy, count: s.count };
  if (s.wrong > s.allowedMistakes || s.correct < s.count) return { ...base, accepted: false, reason: 'mistakes' };
  if (durationMs < s.count * s.minSecondsPerTask * 1000) return { ...base, accepted: false, reason: 'tooFast' };
  return { ...base, accepted: true, reason: 'ok' };
}

export function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

// Místní datum ve tvaru 2026-11-16 (podle časového pásma zařízení).
export function localDateKey(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function acceptedToday(history, now = Date.now()) {
  const today = localDateKey(now);
  return history.filter((h) => h.accepted && localDateKey(h.finishedAt) === today).length;
}

// dailyLimit 0 = bez omezení
export function dailyLimitReached(history, dailyLimit, now = Date.now()) {
  return dailyLimit > 0 && acceptedToday(history, now) >= dailyLimit;
}
