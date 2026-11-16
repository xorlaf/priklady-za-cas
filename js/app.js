// Uživatelské rozhraní aplikace. Logika výpočtů je v generator.js a session.js.

import { generateProblem, generateUnique, enabledKinds } from './generator.js';
import { createSession, recordAnswer, evaluate, formatDuration, acceptedToday, dailyLimitReached, maxMistakes } from './session.js';
import { buildMessage, sendNtfy, randomTopic, topicUrl, plural, mistakesText } from './notify.js';
import * as store from './storage.js';
import qrcode from './vendor/qrcode.mjs';

const VERSION = '1.0.0';
const $ = (id) => document.getElementById(id);

let settings = store.loadSettings();
let current = null;
const keyHandlers = {}; // obsluha fyzické klávesnice podle obrazovky

// ---------- Přepínání obrazovek ----------

const SCREENS = ['setup', 'home', 'play', 'result', 'pin', 'settings'];

function show(name) {
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  current = name;
  window.scrollTo(0, 0);
  if (name === 'home') renderHome();
}

// Systémové „zpět“ v Androidu: z vnořené obrazovky vrátí na úvod místo zavření aplikace.
function navigate(name) {
  if (current === 'home' && name !== 'home') history.pushState({ screen: name }, '');
  show(name);
}

window.addEventListener('popstate', () => {
  if (current === 'setup' && !store.hasPin()) return;
  if (current === 'play') play = null;
  show('home');
});

// ---------- Číselná klávesnice ----------

function buildKeypad(el, onKey, { withOk = true } = {}) {
  el.textContent = '';
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', withOk ? 'ok' : '']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key';
    if (!k) {
      b.style.visibility = 'hidden';
      b.tabIndex = -1;
    } else if (k === 'back') {
      b.textContent = '⌫';
      b.setAttribute('aria-label', 'Smazat');
    } else if (k === 'ok') {
      b.textContent = 'OK';
      b.classList.add('key-ok');
    } else {
      b.textContent = k;
    }
    b.dataset.key = k;
    el.appendChild(b);
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.key');
    if (b && b.dataset.key) onKey(b.dataset.key);
  });
}

function flashKey(keypadEl, k) {
  const b = keypadEl.querySelector(`[data-key="${k}"]`);
  if (!b) return;
  b.classList.add('pressed');
  setTimeout(() => b.classList.remove('pressed'), 120);
}

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  let k = null;
  if (/^[0-9]$/.test(e.key)) k = e.key;
  else if (e.key === 'Backspace') k = 'back';
  else if (e.key === 'Enter') k = 'ok';
  const handler = keyHandlers[current];
  if (k && handler) {
    e.preventDefault();
    handler(k);
  }
});

// Zadávání čtyřmístného PINu s tečkami.
function createPinPad(dotsEl, keypadEl, onComplete) {
  let value = '';
  let locked = false;
  const render = () => {
    dotsEl.textContent = '';
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('span');
      d.className = 'pin-dot' + (i < value.length ? ' filled' : '');
      dotsEl.appendChild(d);
    }
  };
  const press = (k) => {
    if (locked) return;
    flashKey(keypadEl, k);
    if (k === 'back') value = value.slice(0, -1);
    else if (/^\d$/.test(k) && value.length < 4) value += k;
    render();
    if (value.length === 4) {
      const v = value;
      locked = true;
      setTimeout(() => {
        value = '';
        locked = false;
        render();
        onComplete(v);
      }, 150);
    }
  };
  buildKeypad(keypadEl, press, { withOk: false });
  render();
  return {
    press,
    reset() {
      value = '';
      render();
    },
    shake() {
      dotsEl.classList.remove('shake');
      void dotsEl.offsetWidth;
      dotsEl.classList.add('shake');
    },
  };
}

// ---------- Nastavení PINu (první spuštění i změna) ----------

let setupMode = 'first';
let setupFirstPin = null;

const setupPad = createPinPad($('setup-dots'), $('setup-keypad'), async (pin) => {
  if (setupFirstPin === null) {
    setupFirstPin = pin;
    $('setup-prompt').textContent = 'Zadejte PIN ještě jednou';
    $('setup-error').textContent = '';
    return;
  }
  if (pin !== setupFirstPin) {
    setupFirstPin = null;
    $('setup-prompt').textContent = 'Zvolte PIN (4 číslice)';
    $('setup-error').textContent = 'PINy se neshodují, zkuste to znovu.';
    setupPad.shake();
    return;
  }
  await store.setPin(pin);
  setupFirstPin = null;
  openSettings();
  if (setupMode === 'change') $('settings-error').textContent = '';
});
keyHandlers.setup = (k) => setupPad.press(k);

function openSetup(mode) {
  setupMode = mode;
  setupFirstPin = null;
  $('setup-prompt').textContent = mode === 'change' ? 'Zvolte nový PIN (4 číslice)' : 'Zvolte PIN (4 číslice)';
  $('setup-error').textContent = '';
  $('setup-cancel').hidden = mode !== 'change';
  setupPad.reset();
  show('setup');
}

$('setup-cancel').addEventListener('click', () => openSettings());

// ---------- PIN před vstupem do nastavení ----------

let pinFails = 0;
let pinLockedUntil = 0;

const pinPad = createPinPad($('pin-dots'), $('pin-keypad'), async (pin) => {
  if (Date.now() < pinLockedUntil) return;
  if (await store.checkPin(pin)) {
    pinFails = 0;
    openSettings();
    return;
  }
  pinFails += 1;
  pinPad.shake();
  if (pinFails >= 5) {
    pinFails = 0;
    pinLockedUntil = Date.now() + 30_000;
    $('pin-error').textContent = 'Moc pokusů. Zkuste to za 30 sekund.';
    setTimeout(() => ($('pin-error').textContent = ''), 30_000);
  } else {
    $('pin-error').textContent = 'Špatný PIN.';
  }
});
keyHandlers.pin = (k) => pinPad.press(k);

$('home-settings').addEventListener('click', () => {
  if (Date.now() >= pinLockedUntil) $('pin-error').textContent = '';
  pinPad.reset();
  navigate('pin');
});
$('pin-back').addEventListener('click', () => show('home'));

// ---------- Úvod ----------

function renderHome() {
  const name = settings.childName.trim();
  $('home-hello').textContent = name ? `Ahoj, ${name}!` : 'Ahoj!';
  const n = settings.count;
  $('home-lead').textContent = `Chceš čas navíc? Vypočítej ${n} ${plural(n, 'příklad', 'příklady', 'příkladů')}.`;
  const history = store.loadHistory();
  const reached = dailyLimitReached(history, settings.dailyLimit);
  $('home-start').disabled = reached;
  if (reached) $('home-limit').textContent = 'Na dnešek máš splněno. Zítra zase! 🌙';
  else if (settings.dailyLimit > 0)
    $('home-limit').textContent = `Dnes splněno: ${acceptedToday(history)} z ${settings.dailyLimit}`;
  else $('home-limit').textContent = '';
  renderOutboxStatus();
}

$('home-start').addEventListener('click', startPlay);

// ---------- Počítání ----------

let play = null;
const PRAISE = ['Správně!', 'Výborně!', 'Super!', 'Paráda!', 'Bezva!', 'Přesně tak!'];

const playKeypad = $('play-keypad');
buildKeypad(playKeypad, onPlayKey);
keyHandlers.play = (k) => {
  flashKey(playKeypad, k);
  onPlayKey(k);
};

function startPlay() {
  if (dailyLimitReached(store.loadHistory(), settings.dailyLimit)) return show('home');
  play = {
    session: createSession({
      count: settings.count,
      minAccuracy: settings.minAccuracy,
      minSecondsPerTask: settings.minSecondsPerTask,
    }),
    seen: new Set(),
    input: '',
    busy: false,
    problem: null,
  };
  nextProblem();
  if (current === 'home') navigate('play');
  else show('play');
}

function nextProblem() {
  play.problem = generateUnique(settings.problems, play.seen);
  play.seen.add(play.problem.text);
  play.input = '';
  setFeedback('', '');
  renderProblem('');
  renderPlayBar();
}

function renderProblem(state) {
  const el = $('play-problem');
  const [before, after] = play.problem.text.split('?');
  const box = document.createElement('span');
  box.className = 'answer-box' + (state ? ` ${state}` : '');
  box.textContent = play.input || ' ';
  el.textContent = '';
  el.append(before, box, after);
  fitProblem(el);
}

// Dlouhé příklady (12 − (14 + 3) = ?) zmenší, aby se vešly na šířku.
function fitProblem(el) {
  el.style.fontSize = '';
  if (el.scrollWidth > el.clientWidth) {
    const base = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${Math.floor((base * el.clientWidth) / el.scrollWidth) - 1}px`;
  }
}

function renderPlayBar() {
  const s = play.session;
  $('play-progress-fill').style.width = `${(s.correct / s.count) * 100}%`;
  $('play-progress-text').textContent = `${s.correct} / ${s.count}`;
  const left = Math.max(0, s.allowedMistakes - s.wrong);
  const hearts = $('play-hearts');
  if (s.allowedMistakes === 0) hearts.textContent = '';
  else if (s.allowedMistakes <= 6) hearts.textContent = '♥'.repeat(left) + '♡'.repeat(s.allowedMistakes - left);
  else hearts.textContent = `♥ ${left}`;
  hearts.title = `Ještě můžeš udělat ${left} ${plural(left, 'chybu', 'chyby', 'chyb')}`;
}

function setFeedback(text, cls) {
  const f = $('play-feedback');
  f.textContent = text;
  f.className = 'feedback' + (cls ? ` ${cls}` : '');
}

function onPlayKey(k) {
  if (!play || play.busy) return;
  if (k === 'back') play.input = play.input.slice(0, -1);
  else if (k === 'ok') return submitAnswer();
  else if (/^\d$/.test(k) && play.input.length < 4) play.input = play.input === '0' ? k : play.input + k;
  renderProblem('');
}

function submitAnswer() {
  if (play.input === '') return;
  const correct = Number(play.input) === play.problem.answer;
  const status = recordAnswer(play.session, correct);
  play.busy = true;
  playKeypad.classList.add('disabled');
  renderProblem(correct ? 'ok' : 'bad');
  renderPlayBar();
  setFeedback(
    correct ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : `Ještě ne. Správně je ${play.problem.answer}.`,
    correct ? 'ok' : 'bad',
  );
  const p = play;
  setTimeout(
    () => {
      if (play !== p) return; // mezitím ukončeno
      play.busy = false;
      playKeypad.classList.remove('disabled');
      if (status === 'continue') nextProblem();
      else finishPlay();
    },
    correct ? 700 : 2200,
  );
}

$('play-quit').addEventListener('click', () => {
  if (confirm('Opravdu skončit? Rozpočítané příklady se nezapočítají.')) {
    play = null;
    show('home');
  }
});

// ---------- Výsledek ----------

let resultOutboxId = null;

function finishPlay() {
  const finishedAt = Date.now();
  const r = evaluate(play.session, finishedAt);
  play = null;
  store.addHistory({
    finishedAt,
    accepted: r.accepted,
    reason: r.reason,
    count: r.count,
    correct: r.correct,
    wrong: r.wrong,
    durationMs: r.durationMs,
  });

  resultOutboxId = null;
  if (r.accepted) {
    const msg = buildMessage(r, settings.childName, finishedAt);
    const item = { id: `${finishedAt}-${Math.random().toString(36).slice(2, 8)}`, createdAt: finishedAt, ...msg };
    store.saveOutbox([...store.loadOutbox(), item]);
    resultOutboxId = item.id;
    $('result-emoji').textContent = '🎉';
    $('result-title').textContent = 'Hotovo!';
    $('result-text').textContent =
      `${r.count} ${plural(r.count, 'příklad', 'příklady', 'příkladů')}, ${mistakesText(r.wrong)}, za ${formatDuration(r.durationMs)}.`;
    $('result-retry').hidden = true;
    flushOutbox();
  } else {
    $('result-emoji').textContent = r.reason === 'tooFast' ? '🐢' : '💪';
    $('result-title').textContent = 'Tentokrát to nevyšlo';
    $('result-text').textContent =
      r.reason === 'tooFast'
        ? 'To bylo moc rychlé. Počítej v klidu a pečlivě.'
        : 'Bylo tam moc chyb. Zkus to znovu, určitě to dáš!';
    $('result-retry').hidden = false;
  }
  renderOutboxStatus();
  show('result');
}

$('result-retry').addEventListener('click', startPlay);
$('result-home').addEventListener('click', () => show('home'));

// ---------- Fronta zpráv rodiči ----------

let flushing = false;
let lastSendFailed = false;

async function flushOutbox() {
  if (flushing) return;
  flushing = true;
  renderOutboxStatus();
  try {
    for (const item of store.loadOutbox()) {
      try {
        await sendNtfy(settings.ntfyServer, settings.ntfyTopic, item);
        store.saveOutbox(store.loadOutbox().filter((i) => i.id !== item.id));
        lastSendFailed = false;
      } catch {
        lastSendFailed = true;
        break;
      }
    }
  } finally {
    flushing = false;
    renderOutboxStatus();
  }
}

function renderOutboxStatus() {
  const pending = store.loadOutbox();
  const waitingText = 'Zpráva rodiči čeká na internet. Pošle se sama, jakmile bude připojení.';

  const homeEl = $('home-outbox');
  homeEl.hidden = pending.length === 0;
  if (pending.length) homeEl.textContent = flushing ? 'Posílám zprávu rodiči…' : waitingText;

  const resEl = $('result-notify');
  if (!resultOutboxId) {
    resEl.hidden = true;
    return;
  }
  resEl.hidden = false;
  const stillPending = pending.some((i) => i.id === resultOutboxId);
  if (!stillPending) resEl.textContent = '✔ Rodič dostal zprávu. Teď počkej, až ti přidá čas.';
  else if (flushing || !lastSendFailed) resEl.textContent = 'Posílám zprávu rodiči…';
  else resEl.textContent = waitingText;
}

window.addEventListener('online', flushOutbox);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    flushOutbox();
    if (current === 'home') renderHome();
  }
});
setInterval(() => {
  if (store.loadOutbox().length) flushOutbox();
}, 20_000);

// ---------- Nastavení ----------

const ROW_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
for (const id of ['s-rows-from', 's-rows-to']) {
  for (const n of ROW_OPTIONS) $(id).add(new Option(String(n), String(n)));
}

function openSettings() {
  fillSettingsForm();
  renderHistory();
  $('settings-error').textContent = '';
  $('s-test-status').textContent = '';
  if (current === 'home') navigate('settings');
  else show('settings');
}

function fillSettingsForm() {
  const p = settings.problems;
  $('s-name').value = settings.childName;
  $('s-add').checked = p.add;
  $('s-sub').checked = p.sub;
  $('s-max').value = String(p.max);
  $('s-cross').checked = p.crossTen;
  $('s-mul').checked = p.mul;
  $('s-div').checked = p.div;
  $('s-rows-from').value = String(p.rowsFrom);
  $('s-rows-to').value = String(p.rowsTo);
  $('s-missing').checked = p.missing;
  $('s-three').checked = p.threeTerms;
  $('s-count').value = settings.count;
  $('s-accuracy').value = settings.minAccuracy;
  $('s-minsec').value = settings.minSecondsPerTask;
  $('s-daily').value = settings.dailyLimit;
  $('s-topic').value = settings.ntfyTopic;
  $('s-server').value = settings.ntfyServer;
  $('s-version').textContent = VERSION;
  updateSettingsUi();
}

function readSettingsForm() {
  return {
    ...settings,
    childName: $('s-name').value,
    problems: {
      add: $('s-add').checked,
      sub: $('s-sub').checked,
      max: Number($('s-max').value),
      crossTen: $('s-cross').checked,
      mul: $('s-mul').checked,
      div: $('s-div').checked,
      rowsFrom: Number($('s-rows-from').value),
      rowsTo: Number($('s-rows-to').value),
      missing: $('s-missing').checked,
      threeTerms: $('s-three').checked,
    },
    count: $('s-count').value,
    minAccuracy: $('s-accuracy').value,
    minSecondsPerTask: $('s-minsec').value,
    dailyLimit: $('s-daily').value,
    ntfyServer: $('s-server').value.trim(),
  };
}

function onSettingsChange(e) {
  const next = readSettingsForm();
  if (enabledKinds(next.problems).length === 0) {
    if (e && e.target.type === 'checkbox') e.target.checked = true;
    $('settings-error').textContent = 'Zapněte aspoň sčítání, odčítání, násobení nebo dělení.';
    return;
  }
  $('settings-error').textContent = '';
  const serverBefore = settings.ntfyServer;
  store.saveSettings(next);
  settings = store.loadSettings();
  // Po opuštění políčka přepíšeme hodnoty na platné (např. 99 → 30).
  if (e && e.type === 'change' && e.target.type === 'number') fillSettingsForm();
  else updateSettingsUi(serverBefore !== settings.ntfyServer);
}

function updateSettingsUi(redrawQr = true) {
  const p = settings.problems;
  const addSub = p.add || p.sub;
  $('s-max').disabled = !addSub;
  $('s-cross').disabled = !addSub;
  $('s-rows-from').disabled = !(p.mul || p.div);
  $('s-rows-to').disabled = !(p.mul || p.div);
  renderSample();
  const m = maxMistakes(settings.count, settings.minAccuracy);
  const minTime = settings.count * settings.minSecondsPerTask * 1000;
  $('s-rules-hint').textContent =
    `Při ${settings.count} ${plural(settings.count, 'příkladu', 'příkladech', 'příkladech')} a ${settings.minAccuracy} % smí dítě udělat ` +
    `nejvýš ${m} ${plural(m, 'chybu', 'chyby', 'chyb')}.` +
    (minTime > 0 ? ` Sada se uzná, jen když trvá aspoň ${formatDuration(minTime)}.` : '');
  if (redrawQr) renderQr();
}

function renderSample() {
  const items = [];
  try {
    for (let i = 0; i < 3; i++) items.push(generateProblem(settings.problems).text);
  } catch {
    /* žádný typ není zapnutý */
  }
  $('s-sample').textContent = items.join('  |  ');
}

function renderQr() {
  const url = topicUrl(settings.ntfyServer, settings.ntfyTopic);
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('s-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true, alt: url });
  $('s-qr').title = url;
}

function renderHistory() {
  const list = $('s-history');
  list.textContent = '';
  const items = store.loadHistory().slice(0, 20);
  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Zatím žádné sady.';
    list.appendChild(li);
    return;
  }
  const fmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  for (const h of items) {
    const li = document.createElement('li');
    const left = document.createElement('span');
    left.textContent = `${fmt.format(new Date(h.finishedAt))} · ${h.correct} správně, ${mistakesText(h.wrong)}, ${formatDuration(h.durationMs)}`;
    const right = document.createElement('span');
    if (h.accepted) {
      right.className = 'yes';
      right.textContent = '✔ uznáno';
    } else {
      right.className = 'no';
      right.textContent = h.reason === 'tooFast' ? '✖ moc rychle' : '✖ moc chyb';
    }
    li.append(left, right);
    list.appendChild(li);
  }
}

for (const el of document.querySelectorAll('#screen-settings input, #screen-settings select')) {
  if (el.readOnly) continue;
  // text se ukládá průběžně, čísla a adresa po opuštění políčka, zaškrtávátka a výběry hned
  el.addEventListener(el.type === 'text' ? 'input' : 'change', onSettingsChange);
}

$('s-sample-new').addEventListener('click', renderSample);

$('s-new-topic').addEventListener('click', () => {
  if (!confirm('Vygenerovat nové téma? V aplikaci ntfy v telefonu ho pak musíte přidat znovu.')) return;
  store.saveSettings({ ...settings, ntfyTopic: randomTopic() });
  settings = store.loadSettings();
  fillSettingsForm();
});

$('s-test').addEventListener('click', async () => {
  const status = $('s-test-status');
  const btn = $('s-test');
  btn.disabled = true;
  status.textContent = 'Posílám…';
  try {
    await sendNtfy(settings.ntfyServer, settings.ntfyTopic, {
      title: 'Zkušební zpráva',
      message: 'Zprávy z aplikace Příklady za čas fungují.',
    });
    status.textContent = '✔ Odesláno. Zkontrolujte telefon.';
  } catch (err) {
    status.textContent = `Nepodařilo se odeslat (${navigator.onLine ? err.message : 'tablet není připojený k internetu'}).`;
  } finally {
    btn.disabled = false;
  }
});

$('s-change-pin').addEventListener('click', () => openSetup('change'));

$('settings-close').addEventListener('click', () => {
  onSettingsChange();
  if ($('settings-error').textContent) return;
  show('home');
});

// ---------- Start ----------

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (store.hasPin()) show('home');
else openSetup('first');
flushOutbox();
