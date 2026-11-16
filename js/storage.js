// Uložení nastavení, historie a fronty zpráv v zařízení (localStorage).
// Vše je v try/catch: když úložiště nejde, aplikace poběží dál s výchozími hodnotami.

import { DEFAULT_PROBLEMS, normalizeProblems } from './generator.js';
import { DEFAULT_NTFY_SERVER, randomTopic } from './notify.js';

const KEY_SETTINGS = 'pzc.settings';
const KEY_HISTORY = 'pzc.history';
const KEY_OUTBOX = 'pzc.outbox';
const KEY_PIN = 'pzc.pin';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const clampInt = (v, lo, hi, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

export function normalizeSettings(s = {}) {
  return {
    childName: typeof s.childName === 'string' ? s.childName.slice(0, 30) : '',
    problems: normalizeProblems(s.problems || DEFAULT_PROBLEMS),
    count: clampInt(s.count, 3, 30, 10),
    minAccuracy: clampInt(s.minAccuracy, 50, 100, 80),
    minSecondsPerTask: clampInt(s.minSecondsPerTask, 0, 10, 2),
    dailyLimit: clampInt(s.dailyLimit, 0, 10, 2),
    ntfyServer: typeof s.ntfyServer === 'string' && /^https:\/\//.test(s.ntfyServer) ? s.ntfyServer : DEFAULT_NTFY_SERVER,
    ntfyTopic: typeof s.ntfyTopic === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s.ntfyTopic) ? s.ntfyTopic : '',
  };
}

export function loadSettings() {
  const s = normalizeSettings(read(KEY_SETTINGS, {}));
  if (!s.ntfyTopic) {
    s.ntfyTopic = randomTopic();
    saveSettings(s);
  }
  return s;
}

export function saveSettings(s) {
  return write(KEY_SETTINGS, normalizeSettings(s));
}

export function loadHistory() {
  const h = read(KEY_HISTORY, []);
  return Array.isArray(h) ? h : [];
}

export function addHistory(entry) {
  const h = [entry, ...loadHistory()].slice(0, 100);
  write(KEY_HISTORY, h);
  return h;
}

export function loadOutbox() {
  const o = read(KEY_OUTBOX, []);
  return Array.isArray(o) ? o : [];
}

export function saveOutbox(o) {
  write(KEY_OUTBOX, o);
}

// ---- PIN rodiče (uložen jen jako SHA-256 hash se solí) ----

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hasPin() {
  const p = read(KEY_PIN, null);
  return Boolean(p && p.hash && p.salt);
}

export async function setPin(pin) {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const hash = await sha256Hex(`${salt}:${pin}`);
  return write(KEY_PIN, { salt, hash });
}

export async function checkPin(pin) {
  const p = read(KEY_PIN, null);
  if (!p) return false;
  return (await sha256Hex(`${p.salt}:${pin}`)) === p.hash;
}
