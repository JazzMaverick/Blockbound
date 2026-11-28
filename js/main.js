import { View } from './view.js';
import { audio } from './audio.js';
import { tl, setLang, getLang, detectLang, LANG_NAMES } from './i18n.js';
import { Sim } from './sim.js';
import { HostServer, ClientConn, claudeUse, newCode, cleanCode, ROOM_PREFIX, validPick } from './net.js';
import { KINDS, KI, TEAM_COLORS, SLOT_NAMES, TILES, HERO_XP, heroMaxHp, heroMaxMana, defaultMap, encodeMap, decodeMap, cloneMap, blankMap, footprint, validateMap, FACTIONS, ABIL, HEROES, heroFac, randomHero, CAMPS, CREEP, NEUTRAL, upgradable } from './data.js';

{
const $ = s => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'svg') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
};
// Trusted, constant SVG paths only.
const PATHS = {
  move: '<path d="M3 11h12.2l-4.6-4.6L12 5l7 7-7 7-1.4-1.4 4.6-4.6H3z"/>',
  stop: '<path d="M8 2h8l6 6v8l-6 6H8l-6-6V8zm-1 9v2h10v-2z"/>',
  atk: '<path d="M3 3l2 .2 8.5 8.5-1.8 1.8L3.2 5zM21 3l-.2 2-8.5 8.5-1.8-1.8L19 3.2zM6 14l4 4-1.5 1.5-1.2-1.2L5 20.5 3.5 19l2.2-2.3-1.2-1.2zm12 0 1.5 1.5-1.2 1.2 2.2 2.3-1.5 1.5-2.3-2.2-1.2 1.2L14 18z"/>',
  gather: '<path d="M2 8.5C6 3 16 2 22 6.5c-4-1.2-7.4-1.2-9.6-.4L5 21l-2-1 7.3-14c-2.6-.2-5.4.6-8.3 2.5z"/>',
  build: '<path d="M3 5h10l3 3-2.2 2.2L12 8.4h-1.5v1.8L5 21l-2-1 5.5-10.5V8.4H3zM15 13l6 6-2 2-6-6z"/>',
  clap: '<path d="M13 1 5 13h5.5L9 23l9-13h-5.6zM2 19.5a10 3 0 0 0 20 0h-2a8 2 0 0 1-16 0z"/>',
  rally: '<path d="M5 2h2v20H5zm3 1h12l-3 4.5 3 4.5H8z"/>',
  cancel: '<path d="M5 6.4 6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6z"/>',
  back: '<path d="M21 11H8.8l4.6-4.6L12 5l-7 7 7 7 1.4-1.4L8.8 13H21z"/>',
  worker: '<path d="M12 2.5a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zM6.5 21.5V15c0-3 2.4-5 5.5-5s5.5 2 5.5 5v6.5z"/>',
  footman: '<path d="M12 2 4 5v6c0 5.2 3.4 9.2 8 11 4.6-1.8 8-5.8 8-11V5zm0 3.2 5 1.9V11c0 3.6-2.1 6.5-5 8z"/>',
  archer: '<path d="M6 2c8.5 3 8.5 17 0 20l-1-1.8c6.4-3.2 6.4-13.2 0-16.4zM5 11h12.5l-2.5-2.5 1.4-1.4L21.3 12l-4.9 4.9L15 15.5l2.5-2.5H5z"/>',
  hero: '<path d="M2.5 8 7 12l5-7.5L17 12l4.5-4L19 19H5zM5 20.5h14V22H5z"/>',
  hall: '<path d="M2.5 21.5V10l3-2v3h3V6.5L12 3l3.5 3.5V11h3V8l3 2v11.5h-7V16h-5v5.5z"/>',
  barracks: '<path d="M2 11.5 12 3l10 8.5V21H2zm7.5 9.5h5v-5.5h-5zM5 13v3h3v-3zm11 0v3h3v-3z"/>',
  farm: '<path d="M11 22V10h2v12zM12 1.8c2 2 2 4.3 0 6.3-2-2-2-4.3 0-6.3zM6.6 5.6c3 0 4.4 2 4.4 4.2-3 0-4.4-2-4.4-4.2zm10.8 0c-3 0-4.4 2-4.4 4.2 3 0 4.4-2 4.4-4.2zM6.6 11c3 0 4.4 2 4.4 4.2-3 0-4.4-2-4.4-4.2zm10.8 0c-3 0-4.4 2-4.4 4.2 3 0 4.4-2 4.4-4.2z"/>',
  tower: '<path d="M6 2h2.4v2.2h2.4V2h2.4v2.2h2.4V2H18v5.5L16 9.4V22H8V9.4L6 7.5zm5 9v3h2v-3z"/>',
  mine: '<path d="M3.5 17 8 7.5 14.5 5l6 6.5L18.5 20H5.5z"/>',
  gold: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5v11M9 9h5a1.8 1.8 0 0 1 0 3.5h-4a1.8 1.8 0 0 0 0 3.5h5" stroke="#6b4a10" stroke-width="1.8" fill="none"/>',
  wood: '<path d="M3 15.5 15.5 3 21 8.5 8.5 21zM16 4.5l3.5 3.5" /><circle cx="6" cy="18" r="2.4" fill="#8a6234"/>',
  food: '<path d="M2.5 11h19a9.5 9.5 0 0 1-19 0zM8 3.5c1.2 2-1 3.2 0 5.5M12 3c1.2 2-1 3.2 0 5.5M16 3.5c1.2 2-1 3.2 0 5.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M2.5 11h19a9.5 9.5 0 0 1-19 0z"/>',
  box: '<path d="M3 3h4v2H5v2H3zm6 0h6v2H9zm8 0h4v4h-2V5h-2zM3 9h2v6H3zm16 0h2v6h-2zM3 17h2v2h2v2H3zm16 0h2v4h-4v-2h2zM9 19h6v2H9z"/>',
  add: '<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/>',
  army: '<path d="M7 2 9 4l-1 1 5 5-2 2-5-5-1 1-2-2zm10 0 2 2-1 1 1 1-5 5-2-2 5-5zM6 15l3 3-4 4-3-3zm12 0 4 4-3 3-4-4z"/>',
  idle: '<path d="M10 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM5 21v-6c0-3 2.2-5 5-5 1.6 0 3 .6 4 1.8V21zM15 3h6v1.6l-3.6 4.2H21V10h-6V8.4l3.6-4.2H15z"/>',
  zin: '<path d="M10 3a7 7 0 0 1 5.6 11.2l5.6 5.6-1.4 1.4-5.6-5.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM9 7h2v2h2v2h-2v2H9v-2H7V9h2z"/>',
  zout: '<path d="M10 3a7 7 0 0 1 5.6 11.2l5.6 5.6-1.4 1.4-5.6-5.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM7 9h6v2H7z"/>',
  forge: '<path d="M3 8h13c0 2.8-2 4.5-5 5v2h3v2H6v-2h3v-2C6 12.5 4 11 3 8zm14 0h4v2h-4z"/>',
  lodge: '<path d="M12 2 2 13h3v8h14v-8h3zm-2 19v-5h4v5zM6 6 4 3h2l2 3zm12 0 2-3h-2l-2 3z"/>',
  burrow: '<path d="M2 20c0-6 4.5-10 10-10s10 4 10 10zm8 0h4v-3a2 2 0 0 0-4 0z"/>',
  spire: '<path d="M10 22V9L8 7l2-1 2-4 2 4 2 1-2 2v13zm1-11v3h2v-3z"/>',
  brute: '<path d="M14 2l6 6-2.5 2.5-1.5-1.5-8.5 8.5 1.5 1.5L6.5 21 3 17.5l2.5-2.5L7 16.5 15.5 8 14 6.5z"/>',
  spearman: '<path d="M20 2l-1 6-2-2L5.5 17.5l1 1-1.5 1.5-1-1L2 21l-1-1 2-2-1-1 1.5-1.5 1 1L16 5l-2-2z"/>',
  warden: '<path d="M2.5 8 7 12l5-7.5L17 12l4.5-4L19 19H5zM5 20.5h14V22H5z"/>',
  sage: '<path d="M11 8h2v14h-2zM12 1l1.6 3.4L17 6l-3.4 1.6L12 11l-1.6-3.4L7 6l3.4-1.6z"/>',
  reaver: '<path d="M6 2h2v20H6zM8 3c5 0 8 2.5 8 6s-3 6-8 6zm8 9h2v10h-2zm2 1c3 0 4 1.6 4 3.5S21 20 18 20z"/>',
  seer: '<path d="M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z"/>',
  paw: '<path d="M12 11c3.5 0 6 3.5 6 6 0 2-1.5 3-3 3-1.3 0-2-1-3-1s-1.7 1-3 1c-1.5 0-3-1-3-3 0-2.5 2.5-6 6-6zM6 6.5a2 2.5 0 1 1 0 5 2 2.5 0 0 1 0-5zm12 0a2 2.5 0 1 1 0 5 2 2.5 0 0 1 0-5zM9.5 2.5a2 2.5 0 1 1 0 5 2 2.5 0 0 1 0-5zm5 0a2 2.5 0 1 1 0 5 2 2.5 0 0 1 0-5z"/>',
  rock: '<path d="M3 18 7 8l5-4 5 3 4 11z"/>',
  rally2: '<path d="M3 10h3l9-6v16l-9-6H3zm14-1h4v2h-4zm0 4h4v2h-4z"/>',
  mend: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M11 1h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8-1.4 1.4zm11.4 11.4 1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4l2.8-2.8 1.4 1.4-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4L17 8.4z"/>',
  whirl: '<path d="M12 3a9 9 0 1 1-9 9h2.5A6.5 6.5 0 1 0 12 5.5 4 4 0 1 0 16 9.5h2.5A6.5 6.5 0 1 1 12 3z"/>',
  frenzy: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-.5-6 1-9z"/>',
  snare: '<path d="M4 20c4-1 5-5 4-9 3 2 3 6 2 9h3c-1-4 0-9 4-12-1 4 0 9 3 12z"/>',
  upw: '<path d="M14 2h2l1 7-7 7-2-2 7-7zM6 15l3 3-3 3-3-3zM18 14l3 3h-2v5h-2v-5h-2z"/>',
  upa: '<path d="M10 2 3 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5zM19 9l3 3h-2v6h-2v-6h-2z"/>',
  chat: '<path d="M3 4h18v12H8l-5 4z"/>',
  snd: '<path d="M3 9h4l5-4v14l-5-4H3zm12.5-1.5a6 6 0 0 1 0 9l-1.4-1.4a4 4 0 0 0 0-6.2zm2.8-2.8a10 10 0 0 1 0 14.6l-1.4-1.4a8 8 0 0 0 0-11.8z"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3zm12.3.7 1.4-1.4 2.3 2.3 2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3z"/>',
};
const ICON_ALIAS = { wolves: 'paw', gatherer: 'worker', bonecraft: 'forge', warcamp: 'barracks', ashwolf: 'paw', spiritwolf: 'paw', hexer: 'seer', stonehide: 'rock', upw1: 'upw', upw2: 'upw', upa1: 'upa', upa2: 'upa' };
const icon = n => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${PATHS[ICON_ALIAS[n] || n] || PATHS.worker}</svg>`;
const store = {
  get(k, d) { try { const v = localStorage.getItem('ashvale.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ashvale.' + k, JSON.stringify(v)); return true; } catch { return false; } },
};
const settings = Object.assign({ shadows: true, bloom: true, ui: 'auto', edge: true, scale: 1, nick: '', pick: 'random', fog: true, music: 0.5, sfx: 0.8, muted: false }, store.get('settings', {}));
const mapName = n => n === 'Ashvale Crossing' ? tl(n) : n;
const kn = k => k ? tl(k.name) : '', kd = k => k && k.desc ? tl(k.desc) : '', sn = i => tl(SLOT_NAMES[i] || '');
const pickLabel = v => v === 'random' ? tl('Random hero') : `${tl(FACTIONS[heroFac(v)].name)} · ${tl(KI[v].name)}`;
const pickSelect = (id, val) => { const s = h('select', { id }); for (const v of ['random', ...HEROES]) s.append(h('option', { value: v, text: pickLabel(v) })); s.value = val; return s; };
const isTouchUI = () => settings.ui === 'tablet' || (settings.ui === 'auto' && matchMedia('(pointer: coarse)').matches);
const ERR = { 1: "Can't build there", 2: 'Not enough gold', 3: 'Not enough lumber', 4: 'Not enough food. Build a Farm.', 5: 'Training queue is full' };
settings.lang = setLang(settings.lang || detectLang());
function applyStatic() {
  document.documentElement.lang = getLang() === 'zh-Hant' ? 'zh-Hant' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tl(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = tl(el.dataset.i18nPh);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', tl(el.dataset.i18nAria));
  document.title = tl('Ashvale RTS');
  const ls = document.querySelector('#langSel'); if (ls) ls.value = getLang();
}
applyStatic();
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const view = new View($('#gl'), $('#ov'));
const me = { id: null, name: '', avatar: '' };
let roomNS = null, userNS = null, G = null, ED = null, server = null, conn = null, clientLob = null, tickFn = null, WEB = null, PLATFORM = 'claude';
const snapEvery = () => PLATFORM === 'web' ? 2 : 3;
const names = new Map();
const myName = () => settings.nick.trim() || me.name || tl('You');

// ---------- ticker (worker timers keep the listen server running in background tabs) ----------
try {
  const w = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),50)'], { type: 'text/javascript' })));
  w.onmessage = () => tickFn && tickFn();
} catch { setInterval(() => tickFn && tickFn(), 50); }

// ---------- small UI helpers ----------
function toast(msg) {
  const t = $('#toast'); t.append(h('div', { text: msg }));
  while (t.children.length > 3) t.firstChild.remove();
  setTimeout(() => t.firstChild && t.firstChild.remove(), 2700);
}
function showScreen(id) {
  for (const s of ['title', 'lobby', 'hud', 'editor']) $('#' + s).classList.toggle('on', s === id);
  document.body.classList.toggle('tablet', isTouchUI());
}
function modal(build) { const b = $('#mbody'); b.replaceChildren(); build(b); $('#modal').classList.add('on'); if (G && G.mode === 'local') G.paused = true; }
function closeModal() { $('#modal').classList.remove('on'); if (G && G.mode === 'local') G.paused = false; }
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
async function copy(text) { try { await navigator.clipboard.writeText(text); toast(tl('Copied')); } catch { toast(tl('Copy blocked here. Select the text and copy it.')); } }
async function resolveNames(ids) {
  ids = ids.filter(id => id && !names.has(id)); if (!userNS || !ids.length) return false;
  try { const ps = await userNS.profiles(ids); let got = false; for (const id of ids) { names.set(id, (ps[id] && ps[id].name) || ''); got = true; } return got; } catch { return false; }
}
function slotLabel(s, i, mine) {
  if (!s) return tl('Closed');
  if (s.t === 'a') return tl('Computer'); if (s.t === 'o') return tl('Open'); if (s.t === 'c') return tl('Closed');
  if (mine) return myName();
  return (s.by && names.get(s.by)) || s.nm || tl('{slot} player', { slot: sn(i) });
}
const savedMaps = () => store.get('maps', {});
function mapChoices() {
  const out = [{ name: tl('Ashvale Crossing'), code: encodeMap(defaultMap()), builtin: true }];
  for (const [name, code] of Object.entries(savedMaps())) if (decodeMap(code)) out.push({ name, code });
  return out;
}
function drawPreview(cv, map) {
  const c = cv.getContext('2d'); cv.width = map.w; cv.height = map.h; const img = c.createImageData(map.w, map.h);
  const tc = TILES.map(t => [1, 3, 5].map(i => parseInt(t.col.slice(i, i + 2), 16)));
  for (let i = 0; i < map.tiles.length; i++) { const col = map.trees.has(i) ? [34, 70, 30] : tc[map.tiles[i]]; img.data.set([...col, 255], i * 4); }
  c.putImageData(img, 0, 0);
  for (const [x, y] of map.mines) { c.fillStyle = '#ffd34d'; c.fillRect(x - 1, y - 1, 3, 3); }
  map.starts.forEach(([x, y], i) => { c.fillStyle = TEAM_COLORS[i]; c.fillRect(x - 1, y - 1, 3, 3); });
}

// ---------- the game controller ----------
class Game {
  constructor(mode, map, slots, mySlot, fog) {
    this.mode = mode; this.map = map; this.slots = slots; this.mySlot = mySlot; this.teams = slots.map(s => s.team); view.maxD = 46; this.fog = !!fog;
    this.fac = mySlot >= 0 ? heroFac(slots[mySlot].hero) : 0; this.F = FACTIONS[this.fac];
    view.reset(); view.setMap(map); view.mySlot = mySlot; view.teams = this.teams; view.labels = null; view.setFog(this.fog, mySlot, this.teams);
    view.snapInt = mode === 'client' ? (PLATFORM === 'web' ? 0.1 : 0.16) : 0.05;
    this.snap = null; this.groups = {}; this.paused = false; this.cardMode = null; this.target = null;
    this.hudT = 0; this.miniT = 0; this.plT = 0; this.overShown = false; this.lastCard = []; this.boxMode = false; this.addMode = false;
    if (mode !== 'client') {
      this.sim = new Sim(map, slots); this.t0 = performance.now(); this.steps = 0;
      const s = this.sim.snapshot(); view.apply(s, { silent: true }); this.onSnap(s);
      tickFn = () => this.tick();
    } else tickFn = null;
    const st = map.starts[this.startIndex()] || [map.w / 2, map.h / 2];
    view.centerOn(st[0] + 0.5, st[1] + 1.5, true); view.cam.td = view.cam.d = mode === 'attract' ? 36 : 27;
  }
  startIndex() { let si = 0; for (let i = 0; i < this.slots.length; i++) { const on = this.slots[i].t === 'h' || this.slots[i].t === 'a'; if (i === this.mySlot) return on ? si : 0; if (on) si++; } return 0; }
  tick() {
    if (this.paused) { this.t0 = performance.now() - this.steps * 50; return; }
    if (this.mode === 'attract' && this.sim.time < 150) { for (let i = 0; i < 24; i++) { this.sim.step(); this.steps++; } this.t0 = performance.now() - this.steps * 50; view.apply(this.sim.snapshot(), { silent: true }); return; }
    const target = Math.floor((performance.now() - this.t0) / 50);
    if (target - this.steps > 60) this.steps = target - 6;
    let n = Math.min(6, target - this.steps), did = false;
    while (n-- > 0) {
      this.sim.step(); this.steps++; did = true;
      if (this.mode === 'host' && server && this.steps % snapEvery() === 0) server.broadcast(this.sim.snapshot());
    }
    if (did) { const s = this.sim.snapshot(); view.apply(s); this.onSnap(s); }
  }
  onSnap(s) {
    this.snap = s;
    if (s.ov && !this.overShown) {
      this.overShown = true;
      if (this.mode === 'attract') setTimeout(() => { if (G === this) startAttract(); }, 5000); else showOver(s.ov);
    }
  }
  issue(c) { if (this.mode === 'client') { if (conn) conn.send(c); } else if (this.sim && this.mySlot >= 0) this.sim.command(this.mySlot, c); }
  sel() { return [...view.sel].map(id => view.ents.get(id)).filter(e => e && e.st !== 'd'); }
  own(e) { return e && e.o === this.mySlot; }
  enemy(e) { return e && this.mySlot >= 0 && (e.o === CREEP || (e.o < 4 && this.teams[e.o] !== this.teams[this.mySlot])); }
  units() { return this.sel().filter(e => this.own(e) && KINDS[e.k].u); }
  setSel(list) {
    const before = [...view.sel].join(','); view.sel = new Set(list.slice(0, 24).map(e => e.id)); this.cardMode = null; this.setTarget(null); this.hudT = 0;
    const e = list[0]; if (e && [...view.sel].join(',') !== before) audio.play(!this.own(e) ? 'ui' : KINDS[e.k].hero ? 'selectHero' : KINDS[e.k].b ? 'selectBuilding' : 'select');
  }
  click(e, add, dbl) {
    if (!e) { if (!add) this.setSel([]); return; }
    if (dbl && this.own(e)) return this.selectType(e);
    if (add && this.own(e) && KINDS[e.k].u) {
      const cur = this.sel().filter(x => this.own(x) && KINDS[x.k].u);
      return this.setSel(cur.some(x => x.id === e.id) ? cur.filter(x => x.id !== e.id) : [...cur, e]);
    }
    this.setSel([e]);
  }
  selectType(e) { this.setSel([...view.ents.values()].filter(x => x.k === e.k && this.own(x) && x.st !== 'd' && view.onScreen(x))); }
  boxSelect(list) {
    const u = list.filter(e => this.own(e) && KINDS[e.k].u);
    if (u.length) return this.setSel(u.sort((a, b) => (KINDS[b.k].hero ? 1 : 0) - (KINDS[a.k].hero ? 1 : 0)));
    const b = list.filter(e => this.own(e)); if (b.length) this.setSel([b[0]]);
  }
  setTarget(t) {
    this.target = t; view.setGhost([]);
    const txt = !t ? '' : t.k === 'build' ? tl(isTouchUI() ? 'Place {name} — tap to position, tap again to build' : 'Place {name} (Shift to place more)', { name: kn(KI[t.kind]) })
      : t.k === 'cast' ? tl('{name}: choose a spot', { name: tl(ABIL[t.ab].name) })
      : tl({ amove: 'Attack: choose a target or spot', move: 'Move: choose a destination', gather: 'Gather: choose a gold mine or tree', rally: 'Rally: choose a point' }[t.k]);
    $('#modeTxt').textContent = txt; $('#mode').classList.toggle('on', !!t);
    $('#gl').style.cursor = t ? 'crosshair' : '';
  }
  treeAt(px, pz) { for (const dy of [0, 1, 2]) { const i = view.isTree(Math.floor(px), Math.floor(pz) + dy); if (i >= 0) return i; } return -1; }
  canAfford(k, food) {
    const r = this.snap && this.snap.r[this.mySlot]; if (!r) return false;
    if (r[0] < k.cost[0]) { toast(tl(ERR[2])); audio.play('error'); return false; }
    if (r[1] < k.cost[1]) { toast(tl(ERR[3])); audio.play('error'); return false; }
    if (food && r[2] + (k.food || 0) > r[3]) { toast(tl(ERR[4])); audio.play('error'); return false; }
    return true;
  }
  spendFx(k) { audio.play('coins'); if (k.cost[0]) floatRes('#cG', '-' + k.cost[0]); if (k.cost[1]) floatRes('#cL', '-' + k.cost[1]); }
  smart(px, pz, hit, gatherOnly) {
    const u = this.units(), ids = u.map(e => e.id), workers = u.filter(e => KINDS[e.k].worker);
    if (!u.length) {
      const b = this.sel().find(e => this.own(e) && KINDS[e.k].trains);
      if (b) { this.issue({ k: 'p', b: b.id, x: px, z: pz }); view.marker(px, pz, false); toast(tl('Rally point set')); audio.play('ack'); }
      return;
    }
    if (hit && this.enemy(hit)) { this.issue({ k: 't', u: ids, t: hit.id }); view.marker(hit.rx, hit.rz, true); audio.play('ackAtk'); return; }
    if (workers.length) {
      if (hit && KINDS[hit.k].neutral) { this.issue({ k: 'g', u: ids, t: hit.id, x: px, z: pz }); view.marker(hit.rx, hit.rz, false); audio.play('ackWork'); return; }
      const tr = hit ? -1 : this.treeAt(px, pz);
      if (tr >= 0) { audio.play('ackWork'); this.issue({ k: 'g', u: ids, tree: tr, x: px, z: pz }); view.marker(tr % this.map.w + .5, Math.floor(tr / this.map.w) + .5, false); return; }
      if (hit && this.own(hit) && KINDS[hit.k].drop) { this.issue({ k: 'g', u: ids, t: hit.id, x: px, z: pz }); audio.play('ackWork'); return; }
    }
    if (gatherOnly) { toast(tl('Choose a gold mine or a tree')); audio.play('error'); return; }
    this.issue({ k: 'm', u: ids, x: px, z: pz }); view.marker(px, pz, false); audio.play('ack');
  }
  execTarget(px, pz, hit, shift, touch) {
    const t = this.target, ids = this.units().map(e => e.id);
    if (t.k === 'amove') { if (hit && this.enemy(hit)) this.issue({ k: 't', u: ids, t: hit.id }); else this.issue({ k: 'a', u: ids, x: px, z: pz }); view.marker(px, pz, true); audio.play('ackAtk'); }
    else if (t.k === 'move') { this.issue({ k: 'm', u: ids, x: px, z: pz }); view.marker(px, pz, false); audio.play('ack'); }
    else if (t.k === 'gather') this.smart(px, pz, hit, true);
    else if (t.k === 'cast') { this.issue({ k: 'c', u: [t.hero], ab: t.ab, x: px, z: pz }); view.marker(px, pz, true); audio.play('ackAtk'); }
    else if (t.k === 'rally') { const b = this.sel().find(e => this.own(e) && KINDS[e.k].trains); if (b) this.issue({ k: 'p', b: b.id, x: px, z: pz }); view.marker(px, pz, false); audio.play('ack'); }
    else if (t.k === 'build') {
      let tx = Math.floor(px), ty = Math.floor(pz);
      if (touch) {
        const f = t.at && footprint(KI[t.kind].size, t.at[0], t.at[1]);
        if (!f || tx < f.x0 || tx > f.x1 || ty < f.y0 || ty > f.y1) { t.at = [tx, ty]; view.setGhost(view.canPlace(t.kind, tx, ty)); return; }
        [tx, ty] = t.at;
      }
      if (!view.canPlace(t.kind, tx, ty).every(x => x[2])) { toast(tl(ERR[1])); audio.play('error'); return; }
      const k = KI[t.kind]; if (!this.canAfford(k)) return this.setTarget(null);
      const ws = this.units().filter(e => KINDS[e.k].worker); if (!ws.length) return this.setTarget(null);
      ws.sort((a, b) => Math.hypot(a.rx - tx, a.rz - ty) - Math.hypot(b.rx - tx, b.rz - ty));
      this.issue({ k: 'b', u: [ws[0].id], kind: t.kind, x: tx, z: ty }); this.spendFx(k); audio.play('ackWork');
      if (shift) { t.at = null; return; }
    }
    this.setTarget(null);
  }
  card() {
    const own = this.sel().filter(e => this.own(e)), r = (this.snap && this.snap.r[this.mySlot]) || [0, 0, 0, 0];
    const units = own.filter(e => KINDS[e.k].u), isW = e => KINDS[e.k].worker, B = new Array(12).fill(null);
    if (this.mySlot < 0) return B;
    const poor = k => r[0] < k.cost[0] || r[1] < k.cost[1];
    if (this.cardMode === 'build' && units.some(isW)) {
      this.F.build.forEach((id, i) => {
        const k = KI[id]; B[i] = { key: 'QWERA'[i], icon: id, name: kn(k), desc: kd(k), cost: k.cost, dis: poor(k), act: () => { if (this.canAfford(k)) this.setTarget({ k: 'build', kind: id }); } };
      });
      B[11] = { key: 'ESCAPE', label: 'Esc', icon: 'back', name: tl('Back'), act: () => { this.cardMode = null; this.hudT = 0; } };
      return B;
    }
    if (units.length) {
      const ids = units.map(e => e.id);
      B[0] = { key: 'M', icon: 'move', name: tl('Move'), act: () => this.setTarget({ k: 'move' }) };
      B[1] = { key: 'S', icon: 'stop', name: tl('Stop'), act: () => { this.issue({ k: 's', u: ids }); audio.play('ack'); } };
      B[3] = { key: 'A', icon: 'atk', name: tl('Attack'), desc: tl('Attack a unit, or attack-move to a spot and fight along the way.'), act: () => this.setTarget({ k: 'amove' }) };
      if (units.some(isW)) {
        B[4] = { key: 'G', icon: 'gather', name: tl('Gather'), desc: tl('Mine gold from a mine or chop lumber from trees.'), act: () => this.setTarget({ k: 'gather' }) };
        B[5] = { key: 'B', icon: 'build', name: tl('Build'), desc: tl('Open the build menu.'), act: () => { this.cardMode = 'build'; this.hudT = 0; } };
      }
      const hero = units.find(e => KINDS[e.k].hero);
      if (hero) {
        const hk = KINDS[hero.k], hs = (this.snap && this.snap.hs[hero.id]) || [0, 1, 0, 0, 0, 0];
        hk.abil.forEach((id, i) => {
          const A = ABIL[id], cd = (i ? hs[5] : hs[2]) / 10, locked = hs[1] < (A.lvl || 1), L = hs[1];
          const extra = A.dmg ? ' ' + tl('Damage {n}.', { n: A.dmg + A.per * (L - 1) }) : A.heal ? ' ' + tl('Heals {n}.', { n: A.heal + A.per * (L - 1) }) : '';
          B[8 + i] = { key: 'QW'[i], icon: A.icon, name: tl(A.name), desc: `${tl(A.desc)}${extra} ${tl('{mana} mana, {cd} s cooldown.', { mana: A.mana, cd: A.cd })}${locked ? ' ' + tl('Unlocks at hero level {n}.', { n: A.lvl }) : ''}`,
            dis: locked || hs[0] < A.mana || cd > 0, cdFrac: locked ? 1 : Math.min(1, cd / A.cd),
            act: () => {
              if (locked) return toast(tl('{name} unlocks at hero level {n}', { name: tl(A.name), n: A.lvl }));
              if (cd > 0) return toast(tl('{name} is recharging', { name: tl(A.name) }));
              if (hs[0] < A.mana) return toast(tl('Not enough mana'));
              if (A.tgt === 'point') this.setTarget({ k: 'cast', ab: id, hero: hero.id }); else this.issue({ k: 'c', u: [hero.id], ab: id });
            } };
        });
      }
      return B;
    }
    const b = own.find(e => KINDS[e.k].b);
    if (b && b.st !== 'c') {
      const k = KINDS[b.k], q = (this.snap && this.snap.q[b.id]) || [];
      (k.trains || []).forEach((id, i) => {
        const uk = KI[id]; B[i] = { key: 'QWE'[i], icon: id, name: tl('Train {name}', { name: kn(uk) }), desc: kd(uk), cost: uk.cost, food: uk.food,
          dis: poor(uk) || r[2] + uk.food > r[3], act: () => { if (this.canAfford(uk, true)) { this.issue({ k: 'r', b: b.id, kind: id }); this.spendFx(uk); } } };
      });
      if (k.research) ['w', 'a'].forEach((tr, i) => {
        const lvl = (tr === 'w' ? r[6] : r[7]) | 0, queued = [...view.ents.values()].some(e => e.o === this.mySlot && ((this.snap.q[e.id] || []).slice(1).some(ki => KINDS[ki].research === tr)));
        const uk = KI[`up${tr}${lvl + 1}`];
        if (!uk) { B[i] = { key: 'QW'[i], icon: 'up' + tr, name: tl(tr === 'w' ? 'Weapons fully upgraded' : 'Armor fully upgraded'), dis: true, act: () => toast(tl('Already at the highest level')) }; return; }
        B[i] = { key: 'QW'[i], icon: 'up' + tr, name: tl('Research {name}', { name: kn(uk) }), desc: kd(uk), cost: uk.cost, dis: poor(uk) || queued,
          act: () => { if (queued) return toast(tl('Already researching')); if (this.canAfford(uk)) { this.issue({ k: 'r', b: b.id, kind: uk.id }); this.spendFx(uk); } } };
      });
      if (k.trains) B[3] = { key: 'R', icon: 'rally', name: tl('Set rally point'), desc: tl('New units walk here.'), act: () => this.setTarget({ k: 'rally' }) };
      if (q.length > 1) B[11] = { key: 'ESCAPE', label: 'Esc', icon: 'cancel', name: tl('Cancel last in queue'), act: () => this.issue({ k: 'x', b: b.id }) };
    }
    return B;
  }
  frame(dt) {
    if (this.mode === 'attract') { const t = view.clock * 0.035; view.cam.tx = this.map.w / 2 + Math.cos(t) * 15; view.cam.tz = this.map.h / 2 + 3 + Math.sin(t * 1.3) * 13; return; }
    let dx = 0, dz = 0;
    if (keys.has('ArrowLeft')) dx -= 1; if (keys.has('ArrowRight')) dx += 1; if (keys.has('ArrowUp')) dz -= 1; if (keys.has('ArrowDown')) dz += 1;
    if (settings.edge && mouse.inWin && !isTouchUI() && !$('#modal').classList.contains('on')) {
      if (mouse.x < 6) dx -= 1; if (mouse.x > innerWidth - 6) dx += 1; if (mouse.y < 6) dz -= 1; if (mouse.y > innerHeight - 6) dz += 1;
    }
    if (dx || dz) view.pan(dx * dt * view.cam.d * 1.1, dz * dt * view.cam.d * 1.1);
    view.hover = mouse.onCanvas && !touchActive() ? ((view.pickEnt(mouse.x, mouse.y) || {}).id || 0) : 0;
    if (this.target && this.target.k === 'cast' && mouse.onCanvas) {
      const p = view.pickGround(mouse.x, mouse.y), r = ABIL[this.target.ab].radius, g = [];
      if (p) for (let y = Math.floor(p.z - r); y <= p.z + r; y++) for (let x = Math.floor(p.x - r); x <= p.x + r; x++) if (Math.hypot(x + .5 - p.x, y + .5 - p.z) <= r) g.push([x, y, true]);
      view.setGhost(g);
    }
    if (this.target && this.target.k === 'build' && !this.target.at && mouse.onCanvas) {
      const p = view.pickGround(mouse.x, mouse.y); if (p) view.setGhost(view.canPlace(this.target.kind, Math.floor(p.x), Math.floor(p.z)));
    }
    if ((this.hudT -= dt) <= 0) { this.hudT = 0.15; renderHud(this); }
    if ((this.musT = (this.musT || 0) - dt) <= 0) { this.musT = 0.5; if (!this.overShown && audio.music) audio.music.setIntensity(Math.min(1, view.combat / 6)); view.combat *= 0.55; }
    if ((this.miniT -= dt) <= 0) { this.miniT = 0.2; view.drawMinimap($('#mini')); }
  }
}

// ---------- HUD ----------
function floatRes(sel, text) {
  const box = $(sel); if (!box) return; box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
  const s = h('span', { class: 'spend' + (text[0] === '+' ? ' plus' : ''), text }); box.append(s); setTimeout(() => s.remove(), 1150);
}
for (const [id, ic] of [['#cG', 'gold'], ['#cL', 'wood'], ['#cF', 'food']]) $(id).innerHTML = icon(ic) + '<b>0</b>';
function renderHud(g) {
  const s = g.snap; if (!s) return;
  const r = s.r[g.mySlot] || [0, 0, 0, 0];
  $('#cG b').textContent = g.mySlot >= 0 ? r[0] : '–'; $('#cL b').textContent = g.mySlot >= 0 ? r[1] : '–';
  $('#cF b').textContent = g.mySlot >= 0 ? `${r[2]}/${r[3]}` : '–'; $('#cF').style.color = r[2] >= r[3] && r[3] > 0 ? '#ff8a7a' : '';
  $('#clock').textContent = fmtT(s.t);
  if ((g.plT -= 0.15) <= 0) {
    g.plT = 1;
    const pl = $('#plist'); pl.replaceChildren();
    g.slots.forEach((sl, i) => {
      if (sl.t !== 'h' && sl.t !== 'a') return;
      const st = s.r[i] || [], out = st[4] === 2;
      const lab = g.mode === 'client' || g.mode === 'host' ? slotLabel(lobbySlot(i) || sl, i, i === g.mySlot) : (sl.t === 'a' ? tl('Computer') : myName());
      pl.append(h('span', { class: 'pl' + (out ? ' out' : ''), title: `${sn(i)} · ${tl('Team {n}', { n: sl.team })} · ${tl(FACTIONS[heroFac(sl.hero)].name)}` }, h('i', { style: `background:${TEAM_COLORS[i]}` }), lab));
    });
  }
  renderCard(g); renderInfo(g);
}
function lobbySlot(i) { if (server) return server.slots[i]; if (clientLob) return clientLob.lob.slots[i]; return null; }
let cardSig = '';
function renderCard(g) {
  const B = g.card(); g.lastCard = B;
  const sig = B.map(b => b ? b.key + b.icon : '-').join('|');
  const card = $('#card');
  if (sig !== cardSig) {
    cardSig = sig; card.replaceChildren();
    B.forEach((b, i) => {
      if (!b) { card.append(h('div', { class: 'cmd panel empty' })); return; }
      const btn = h('button', { class: 'cmd', 'aria-label': b.name, svg: icon(b.icon) });
      btn.append(h('span', { class: 'hk', text: b.label || b.key }));
      if (b.cost) btn.append(h('span', { class: 'cost', text: b.cost[1] ? `${b.cost[0]} · ${b.cost[1]}` : `${b.cost[0]}` }));
      btn.append(h('span', { class: 'cd', style: 'transform:scaleY(0)' }));
      btn.addEventListener('click', () => { const cur = g.lastCard[i]; if (cur) cur.act(); });
      btn.addEventListener('pointerenter', () => showTip(btn, g.lastCard[i]));
      btn.addEventListener('pointerleave', hideTip);
      card.append(btn);
    });
  }
  B.forEach((b, i) => {
    const el = card.children[i]; if (!b || !el) return;
    el.style.opacity = b.dis ? 0.5 : 1;
    const cd = el.querySelector('.cd'); if (cd) cd.style.transform = `scaleY(${b.cdFrac || 0})`;
  });
}
function showTip(el, b) {
  if (!b || isTouchUI()) return;
  const t = $('#tip'); t.replaceChildren(h('b', { text: `${b.name} (${b.label || b.key})` }));
  if (b.cost) t.append(h('div', { style: 'color:#ffd76a', text: [tl('{n} gold', { n: b.cost[0] }), b.cost[1] && tl('{n} lumber', { n: b.cost[1] }), b.food && tl('{n} food', { n: b.food })].filter(Boolean).join(' · ') }));
  if (b.desc) t.append(h('div', { class: 'mut', text: b.desc }));
  const r = el.getBoundingClientRect(); t.style.display = 'block';
  t.style.left = Math.max(8, Math.min(innerWidth - 290, r.left - 120)) + 'px'; t.style.top = (r.top - t.offsetHeight - 10) + 'px';
}
function hideTip() { $('#tip').style.display = 'none'; }
const bar = (cls, frac, text) => { const b = h('div', { class: 'bar ' + cls }, h('i', { style: `width:${Math.max(0, Math.min(100, frac * 100))}%` })); if (text) b.append(h('b', { text })); return b; };
let infoSig = '';
function renderInfo(g) {
  const sel = g.sel(), box = $('#info'), s = g.snap;
  const sig = sel.map(e => `${e.id}:${e.hp}:${e.st}:${e.ex}`).join(',') + '|' + JSON.stringify(sel.length === 1 ? [s.hs[sel[0].id], s.q[sel[0].id]] : 0);
  if (sig === infoSig) return; infoSig = sig; box.replaceChildren();
  if (!sel.length) {
    box.append(h('h3', { text: tl(g.mySlot < 0 ? 'Spectating' : 'Your forces') }),
      h('p', { class: 'stats', text: tl(isTouchUI() ? 'Tap a unit to select it. Tap the ground, a mine, a tree or an enemy to command. Drag to scroll, pinch to zoom. Use BOX to select many.'
        : 'Click or drag to select. Right-click to move, attack or gather. Hold Alt to show all health bars.') }));
    return;
  }
  if (sel.length === 1) {
    const e = sel[0], k = KINDS[e.k], max = k.hero ? heroMaxHp(k, e.ex || 1) : k.hp;
    const owner = e.o === NEUTRAL ? tl('Neutral') : e.o === CREEP ? tl('Neutral hostile') : `${sn(e.o)}${e.o === g.mySlot ? ' · ' + tl('you') : ''}`;
    const rr = s.r[e.o] || [], upW = upgradable(k) ? (rr[6] | 0) * 2 : 0, upA = upgradable(k) ? (rr[7] | 0) * 2 : 0;
    box.append(h('h3', {}, k.hero ? tl('{name} · Level {n}', { name: kn(k), n: e.ex }) : kn(k), h('span', { class: 'mut', style: 'font:500 14px Alegreya Sans,sans-serif;margin-left:8px', text: owner })));
    if (k.neutral) { box.append(bar('', e.ex / 60, tl('{n} gold left', { n: e.ex * 100 })), h('p', { class: 'stats', text: kd(k) })); return; }
    box.append(bar('', e.hp / max, `${e.hp} / ${max}`));
    const hs = s.hs[e.id];
    if (k.hero && hs) {
      box.append(bar('mp', hs[0] / heroMaxMana(k, hs[1]), tl('{a} / {b} mana', { a: hs[0], b: heroMaxMana(k, hs[1]) }))); const nx = HERO_XP[hs[1]];
      box.append(bar('xp', nx ? (hs[3] - HERO_XP[hs[1] - 1]) / (nx - HERO_XP[hs[1] - 1]) : 1, nx ? tl('XP {a} / {b}', { a: hs[3], b: nx }) : tl('Max level')));
      if (hs[6]) box.append(h('p', { class: 'stats', style: 'color:#ffd76a', text: [(hs[6] & 1) && tl('Rallied'), (hs[6] & 2) && tl('Frenzied')].filter(Boolean).join(' · ') }));
    }
    if (k.u) box.append(h('p', { class: 'stats', text: [
      tl('Attack {n}', { n: k.hero ? k.dmg + 3 * ((e.ex || 1) - 1) : k.dmg }) + (upW ? ` (+${upW})` : ''), tl('Armor {n}', { n: k.armor }) + (upA ? ` (+${upA})` : ''),
      k.range > 1 ? tl('Ranged {n}', { n: k.range }) : tl('Melee'), tl('Speed {n}', { n: k.spd }),
      e.ex && k.worker ? tl(e.ex === 1 ? 'Carrying 10 gold' : 'Carrying 10 lumber') : '', k.bounty ? tl('Bounty {n} gold', { n: k.bounty }) : ''].filter(Boolean).join(' · ') }));
    if (k.b && e.st === 'c') box.append(h('p', { class: 'stats', text: tl('Under construction · {n}%', { n: Math.round(e.ex / 63 * 100) }) }));
    else if (k.b) box.append(h('p', { class: 'stats', text: kd(k) }));
    const q = s.q[e.id];
    if (q && e.o === g.mySlot) {
      const row = h('div', { class: 'queue' });
      q.slice(1).forEach((ki, i) => {
        const p = h('button', { class: 'pic', title: tl('Cancel'), svg: icon(KINDS[ki].id) });
        if (i === 0) p.append(bar('', q[0] / 100));
        p.addEventListener('pointerdown', ev => { ev.preventDefault(); g.issue({ k: 'x', b: e.id }); });
        row.append(p);
      });
      box.append(row);
    }
    return;
  }
  const grid = h('div', { class: 'grid' });
  for (const e of sel) {
    const k = KINDS[e.k], max = k.hero ? heroMaxHp(k, e.ex || 1) : k.hp;
    const p = h('button', { class: 'pic', title: kn(k), svg: icon(k.id) }); p.append(bar('', e.hp / max));
    p.addEventListener('pointerdown', ev => { ev.preventDefault(); if (ev.shiftKey) g.setSel(sel.filter(x => x.id !== e.id)); else g.setSel([e]); });
    grid.append(p);
  }
  box.append(h('h3', { text: tl('{n} selected', { n: sel.length }) }), grid);
}
view.onFx = f => {
  if (!G || G.mode === 'attract') return;
  const mine = f.o === G.mySlot;
  if (f.k === 'err' && mine) { toast(tl(ERR[f.v] || 'Cannot do that')); audio.play('error'); }
  else if (f.k === 'dep' && mine) { view.floater(f.x, f.z, '+' + Math.abs(f.v), f.v > 0 ? '#ffd76a' : '#e0b98a'); const c = $(f.v > 0 ? '#cG' : '#cL'); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }
  else if (f.k === 'done' && mine) toast(tl('{name} complete', { name: KINDS[f.v] ? kn(KINDS[f.v]) : tl('Building') }));
  else if (f.k === 'bounty' && mine) { view.floater(f.x, f.z, '+' + f.v, '#ffd76a'); floatRes('#cG', '+' + f.v); }
  else if (f.k === 'upg' && mine) toast(tl('{name} researched', { name: KINDS[f.v] ? kn(KINDS[f.v]) : tl('Upgrade') }));
  else if (f.k === 'elim' && f.v >= 0 && f.v < 4) audio.play('gong', { force: true }), toast(f.v === G.mySlot ? tl('You have been defeated') : tl('{slot} has been defeated', { slot: sn(f.v) }));
};
function showOver(ov) {
  const g = G, win = g.mySlot >= 0 && ov.team === g.teams[g.mySlot];
  $('#overT').textContent = tl(g.mySlot < 0 ? 'Game over' : win ? 'Victory' : 'Defeat');
  $('#overP').textContent = `${tl(win ? 'Your enemies have fallen.' : g.mySlot < 0 ? 'The battle is decided.' : 'Your banners have fallen.')} ${tl('Game time {t}.', { t: fmtT(g.snap.t) })}`;
  $('#over').classList.add('on');
  if (audio.music) audio.music.stop(0.8);
  setTimeout(() => audio.play(g.mySlot >= 0 && !win ? 'defeat' : 'victory', { force: true }), 300);
  const rr = $('#overR'); rr.hidden = true;
  if (g.ranked && WEB && WEB.ladder && g.mySlot >= 0 && g.sid) {
    rr.hidden = false; rr.textContent = tl('Ranked: sending the result…');
    WEB.ladder.settle(g.sid, g.teams[g.mySlot], ov.team, st => {
      rr.textContent = st.state === 'waiting' ? tl('Ranked: waiting for every player to confirm…')
        : st.state === 'done' ? tl('Rating {a} → {b} ({d})', { a: st.from, b: st.to, d: (st.delta > 0 ? '+' : '') + st.delta }) : `${tl('Ranked result not counted.')} ${st.why ? tl(st.why) : ''}`;
    }).catch(() => { rr.textContent = tl('Ranked result not counted.'); });
  }
}
$('#overB').onclick = () => { $('#over').classList.remove('on'); leave(); };

// ---------- input ----------
const cv = $('#gl'), keys = new Set();
const mouse = { x: 0, y: 0, inWin: false, onCanvas: false, down: null, pan: null, lastClick: 0, lastId: 0 };
const touches = new Map(); let gesture = null, longTimer = 0;
const touchActive = () => touches.size > 0;
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.inWin = true; mouse.onCanvas = e.target === cv; } });
document.addEventListener('pointerleave', () => { mouse.inWin = false; mouse.onCanvas = false; });
addEventListener('blur', () => { keys.clear(); mouse.inWin = false; view.showAllBars = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); view.zoom(e.deltaY > 0 ? 1.1 : 0.91); }, { passive: false });
const active = () => ED || (G && G.mode !== 'attract');
function panScreen(a, b) {
  const g0 = view.pickGround(a.x, a.y), g1 = view.pickGround(b.x, b.y); if (!g0 || !g1) return;
  view.pan(g0.x - g1.x, g0.z - g1.z); view.cam.x = view.cam.tx; view.cam.z = view.cam.tz;
}
cv.addEventListener('pointerdown', e => {
  if (!active()) return;
  cv.focus({ preventScroll: true });
  try { cv.setPointerCapture(e.pointerId); } catch {}
  if (e.pointerType === 'touch') return touchDown(e);
  const x = e.clientX, y = e.clientY;
  if (e.button === 1 || (e.button === 2 && ED)) { mouse.pan = { x, y }; e.preventDefault(); return; }
  if (ED) { if (e.button === 0) { ED.stroke = true; ED.paintAt(x, y, true); } return; }
  if (e.button === 2) {
    if (G.target) return G.setTarget(null);
    const p = view.pickGround(x, y); if (p) G.smart(p.x, p.z, view.pickEnt(x, y));
    return;
  }
  if (e.button === 0) mouse.down = { x, y };
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return touchMove(e);
  const x = e.clientX, y = e.clientY;
  if (mouse.pan) { panScreen(mouse.pan, { x, y }); mouse.pan = { x, y }; return; }
  if (ED) { ED.hoverAt(x, y); if (ED.stroke) ED.paintAt(x, y, false); return; }
  if (mouse.down && G && !G.target && Math.hypot(x - mouse.down.x, y - mouse.down.y) > 6) view.box = { x0: mouse.down.x, y0: mouse.down.y, x1: x, y1: y };
});
cv.addEventListener('pointerup', e => {
  if (e.pointerType === 'touch') return touchUp(e);
  const x = e.clientX, y = e.clientY;
  if (mouse.pan) { mouse.pan = null; return; }
  if (ED) { if (ED.stroke) { ED.stroke = false; ED.endStroke(); } return; }
  if (!G || !mouse.down || e.button !== 0) return;
  mouse.down = null;
  if (view.box) { const b = view.box; view.box = null; G.boxSelect(view.inRect(b.x0, b.y0, b.x1, b.y1)); return; }
  const p = view.pickGround(x, y), hit = view.pickEnt(x, y);
  if (G.target) { if (p) G.execTarget(p.x, p.z, hit, e.shiftKey, false); return; }
  const now = performance.now(), dbl = hit && hit.id === mouse.lastId && now - mouse.lastClick < 320;
  mouse.lastClick = now; mouse.lastId = hit ? hit.id : 0;
  G.click(hit, e.shiftKey, dbl);
});
cv.addEventListener('pointercancel', e => { if (e.pointerType === 'touch') { touches.delete(e.pointerId); if (!touches.size) { gesture = null; view.box = null; } } mouse.down = null; mouse.pan = null; view.box = null; });
const tdist = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
const tmid = () => { const [a, b] = [...touches.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
function touchDown(e) {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  clearTimeout(longTimer);
  if (touches.size === 1) {
    gesture = { type: 'tap', x: e.clientX, y: e.clientY };
    if (ED) { if (ED.tool !== 'hand') { gesture.type = 'paint'; ED.paintAt(e.clientX, e.clientY, true); } else gesture.type = 'pan'; return; }
    longTimer = setTimeout(() => { if (gesture && gesture.type === 'tap') { gesture.type = 'long'; const hit = view.pickEnt(gesture.x, gesture.y, 1.4); if (hit && G.own(hit)) G.selectType(hit); } }, 520);
  } else if (touches.size === 2) {
    if (ED && gesture && gesture.type === 'paint') ED.endStroke();
    gesture = { type: 'pinch', d: tdist(), mid: tmid() }; view.box = null;
  }
}
function touchMove(e) {
  const t = touches.get(e.pointerId); if (!t || !gesture) return;
  const prev = { x: t.x, y: t.y }; t.x = e.clientX; t.y = e.clientY;
  if (gesture.type === 'pinch') { if (touches.size < 2) return; const d = tdist(), m = tmid(); view.zoom(gesture.d / d); view.cam.d = view.cam.td; gesture.d = d; panScreen(gesture.mid, m); gesture.mid = m; return; }
  if (gesture.type === 'paint') { ED.paintAt(t.x, t.y, false); return; }
  if (gesture.type === 'tap' && Math.hypot(t.x - gesture.x, t.y - gesture.y) > 12) { clearTimeout(longTimer); gesture.type = G && G.boxMode ? 'box' : 'pan'; }
  if (gesture.type === 'pan') panScreen(prev, t);
  if (gesture.type === 'box') view.box = { x0: gesture.x, y0: gesture.y, x1: t.x, y1: t.y };
}
function touchUp(e) {
  touches.delete(e.pointerId); clearTimeout(longTimer);
  if (!gesture || touches.size) return;
  const g = gesture; gesture = null;
  if (g.type === 'paint') ED.endStroke();
  if (g.type === 'box' && view.box) { const b = view.box; view.box = null; G.boxSelect(view.inRect(b.x0, b.y0, b.x1, b.y1)); G.boxMode = false; $('#tBox').classList.remove('on'); }
  if (g.type === 'tap' && G) {
    const p = view.pickGround(g.x, g.y); if (!p) return;
    const hit = view.pickEnt(g.x, g.y, 1.4);
    if (G.target) return G.execTarget(p.x, p.z, hit, false, true);
    if (hit && G.own(hit)) return G.click(hit, G.addMode);
    if (G.sel().some(x => G.own(x))) return G.smart(p.x, p.z, hit);
    G.click(hit, false);
  }
}
addEventListener('keydown', e => {
  if (e.target.matches && e.target.matches('input,textarea,select')) return;
  if ($('#modal').classList.contains('on')) { if (e.key === 'Escape') closeModal(); return; }
  keys.add(e.key);
  if (e.key.startsWith('Arrow')) e.preventDefault();
  if (ED || !G || G.mode === 'attract') return;
  if (e.key === 'Alt') { view.showAllBars = true; e.preventDefault(); return; }
  if (e.key === 'Enter') { e.preventDefault(); openChat(); return; }
  if (/^[1-9]$/.test(e.key)) {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); G.groups[e.key] = [...view.sel]; toast(tl('Group {n} set', { n: e.key })); return; }
    const ids = (G.groups[e.key] || []).filter(id => view.ents.has(id)); if (!ids.length) return;
    const now = performance.now();
    if (G.lastGroup === e.key && now - G.lastGroupT < 350) { const u = view.ents.get(ids[0]); view.centerOn(u.rx, u.rz); }
    G.lastGroup = e.key; G.lastGroupT = now; G.setSel(ids.map(id => view.ents.get(id))); return;
  }
  if (e.key === 'F1') { e.preventDefault(); selectHero(); return; }
  if (e.key === ' ') { e.preventDefault(); const s = G.sel()[0]; if (s) view.centerOn(s.rx, s.rz); return; }
  if (e.key === 'Escape') {
    const esc = G.lastCard.find(b => b && b.key === 'ESCAPE');
    if (G.target) G.setTarget(null); else if (G.cardMode) { G.cardMode = null; G.hudT = 0; } else if (esc) esc.act(); else openMenu();
    return;
  }
  const b = G.lastCard.find(b => b && b.key === e.key.toUpperCase());
  if (b && !e.ctrlKey && !e.metaKey) { e.preventDefault(); b.act(); G.hudT = 0; }
});
addEventListener('keyup', e => { keys.delete(e.key); if (e.key === 'Alt') view.showAllBars = false; });

// minimap
const mini = $('#mini');
function miniPoint(e) { const r = mini.getBoundingClientRect(), m = view.map; return { x: (e.clientX - r.left) / r.width * m.w, z: (e.clientY - r.top) / r.height * m.h }; }
mini.addEventListener('contextmenu', e => e.preventDefault());
mini.addEventListener('pointerdown', e => {
  if (!G || G.mode === 'attract') return; const p = miniPoint(e);
  if (e.button === 2) { G.smart(p.x, p.z, null); return; }
  mini.setPointerCapture(e.pointerId); mini.drag = true; view.centerOn(p.x, p.z, true);
});
mini.addEventListener('pointermove', e => { if (mini.drag) { const p = miniPoint(e); view.centerOn(p.x, p.z, true); } });
mini.addEventListener('pointerup', () => { mini.drag = false; });

// toolbar
function selectHero() { const hr = [...view.ents.values()].find(e => G.own(e) && KINDS[e.k].hero && e.st !== 'd'); if (hr) { G.setSel([hr]); view.centerOn(hr.rx, hr.rz); } else toast(tl('Your hero is reviving')); }
for (const [id, ic, lab] of [['#tChat', 'chat', 'Chat'], ['#tBox', 'box', 'Box'], ['#tAdd', 'add', 'Add'], ['#tArmy', 'army', 'Army'], ['#tIdle', 'idle', 'Idle'], ['#tHero', 'hero', 'Hero'], ['#tClear', 'cancel', 'Clear'], ['#tZin', 'zin', 'Zoom +'], ['#tZout', 'zout', 'Zoom −']]) {
  const b = $(id); b.innerHTML = icon(ic); b.append(h('span', { 'data-i18n': lab, text: tl(lab) })); b.setAttribute('aria-label', tl(lab));
}
$('#tBox').onclick = () => { G.boxMode = !G.boxMode; $('#tBox').classList.toggle('on', G.boxMode); if (G.boxMode) toast(tl('Drag to select a group')); };
$('#tAdd').onclick = () => { G.addMode = !G.addMode; $('#tAdd').classList.toggle('on', G.addMode); };
$('#tArmy').onclick = () => G.setSel([...view.ents.values()].filter(e => G.own(e) && KINDS[e.k].u && !KINDS[e.k].worker && e.st !== 'd'));
$('#tIdle').onclick = () => {
  const idle = [...view.ents.values()].filter(e => G.own(e) && KINDS[e.k].worker && e.st === 'i' && Math.hypot(e.vx, e.vz) < 0.1 && !e.ex);
  if (!idle.length) return toast(tl('No idle workers'));
  G.idleI = ((G.idleI || 0) + 1) % idle.length; const w = idle[G.idleI]; G.setSel([w]); view.centerOn(w.rx, w.rz);
};
$('#tHero').onclick = () => selectHero();
$('#tClear').onclick = () => G.setSel([]);
$('#tZin').onclick = () => view.zoom(0.8); $('#tZout').onclick = () => view.zoom(1.25);
$('#modeX').onclick = () => G && G.setTarget(null);
$('#bMenu').onclick = () => openMenu();
function applySound() { audio.set({ vol: { music: settings.music, sfx: settings.sfx }, muted: settings.muted }); const b = $('#bSnd'); if (b) { b.innerHTML = icon(settings.muted ? 'mute' : 'snd'); b.setAttribute('aria-label', tl(settings.muted ? 'Sound off' : 'Sound on')); } }
$('#bSnd').onclick = () => { settings.muted = !settings.muted; store.set('settings', settings); applySound(); audio.unlock(); };
// Browsers start audio only after a user gesture; also choose the soundtrack for the current screen.
function musicFor() {
  if (!audio.music) return;
  if (ED) audio.music.start('editor', 0);
  else if (G && G.mode === 'attract') audio.music.start('title', 0);
  else if (G && !G.overShown) audio.music.start('game', G.fac || 0);
}
const unlockAudio = () => { const fresh = !audio.ctx; audio.unlock(); if (fresh && audio.ctx) applySound(); musicFor(); };
addEventListener('pointerdown', unlockAudio, true); addEventListener('keydown', unlockAudio, true);
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.classList.contains('cmd') && !b.classList.contains('pic') && b.id !== 'bSnd') audio.play('ui'); }, true);
// "Under attack" alerts for your own units and buildings that are off screen.
let lastAlert = -1e9;
view.onAlert = e => {
  if (!G || G.mode === 'attract' || view.onScreen(e)) return;
  const now = performance.now(); if (now - lastAlert < 20000) return; lastAlert = now;
  toast(tl(KINDS[e.k].b ? 'Your base is under attack!' : 'Your forces are under attack!')); audio.play('alarm', { force: true }); view.ping(e.rx, e.rz);
};
view.onSound = (name, x, z, g = 1) => {
  if (!audio.ready) return;
  const p = view.project(x, view.heightAt(x, z) + 0.5, z), on = p.z < 1 && p.x >= -40 && p.x <= view.W + 40 && p.y >= -40 && p.y <= view.H + 40;
  const c = view.cam, d = Math.hypot(x - c.x, z - (c.z - 3));
  let gain = on ? 1 : Math.max(0, 0.55 - (d - 14) / 40);
  gain *= Math.max(0.55, Math.min(1.1, 30 / c.d)) * g;
  if (!(gain >= 0.06)) return;
  audio.play(name, { pan: on ? Math.max(-0.8, Math.min(0.8, (p.x / view.W - 0.5) * 1.5)) : Math.sign(x - c.x) * 0.6, g: gain });
};

// ---------- menus ----------
function openMenu() {
  modal(b => {
    b.append(h('h2', { text: tl(G && G.mode === 'local' ? 'Paused' : 'Menu') }));
    if (G && G.mode !== 'local' && G.mode !== 'attract') b.append(h('p', { class: 'note', text: tl('Online games keep running while this menu is open.') }));
    b.append(h('button', { class: 'primary', text: tl('Resume'), onclick: closeModal }),
      h('button', { text: tl('Settings'), onclick: openSettings }), h('button', { text: tl('How to play'), onclick: openHelp }),
      h('button', { text: tl('Leave game'), onclick: () => { closeModal(); leave(); } }));
    if (server && G && G.mode === 'host') b.append(h('p', { class: 'note', text: tl('If you leave, another player takes over hosting and a computer plays your side.') }));
  });
}
function openSettings() {
  modal(b => {
    b.append(h('h2', { text: tl('Settings') }));
    const tog = (key, label) => { const i = h('input', { type: 'checkbox', id: 'set-' + key }); i.checked = !!settings[key]; i.style.minHeight = '0'; i.style.width = '22px'; i.style.height = '22px'; return h('label', { class: 'row', for: 'set-' + key, style: 'color:var(--ink);font-size:16px' }, i, tl(label)); };
    const sel = (key, label, opts) => { const s = h('select', { id: 'set-' + key }); for (const [v, t] of opts) s.append(h('option', { value: v, text: tl(t) })); s.value = String(settings[key]); return h('div', { class: 'row' }, h('label', { for: 'set-' + key, style: 'min-width:120px', text: tl(label) }), s); };
    const slider = (key, label) => { const r = h('input', { type: 'range', id: 'set-' + key, min: 0, max: 100, step: 5, style: 'flex:1;min-height:0' }); r.value = Math.round(settings[key] * 100); r.oninput = () => { audio.set({ vol: { [key]: r.value / 100 } }); if (key === 'sfx') audio.play('select'); }; return h('div', { class: 'row' }, h('label', { for: 'set-' + key, style: 'min-width:120px', text: tl(label) }), r); };
    const nick = h('input', { id: 'set-nick', maxlength: 20, placeholder: me.name || tl('Your name'), value: settings.nick });
    b.append(tog('shadows', 'Shadows'), tog('bloom', 'Glow and light effects'), sel('scale', 'Resolution', [['1', '100%'], ['0.75', '75%'], ['0.5', '50%']]),
      sel('ui', 'Interface', [['auto', 'Automatic'], ['desktop', 'Desktop'], ['tablet', 'Tablet']]), tog('edge', 'Scroll at screen edges'),
      h('div', { class: 'row' }, h('label', { for: 'set-nick', style: 'min-width:120px', text: tl('Name for others') }), nick),
      slider('music', 'Music'), slider('sfx', 'Sound effects'), tog('muted', 'Mute all sound'),
      sel('lang', 'Language', Object.entries(LANG_NAMES)),
      h('p', { class: 'note', text: tl('Leave the name empty to show your account name to other players.') }),
      h('button', { class: 'primary', text: tl('Save'), onclick: () => {
        settings.shadows = $('#set-shadows').checked; settings.bloom = $('#set-bloom').checked; settings.edge = $('#set-edge').checked;
        if ($('#set-lang').value !== settings.lang) changeLang($('#set-lang').value);
        settings.music = $('#set-music').value / 100; settings.sfx = $('#set-sfx').value / 100; settings.muted = $('#set-muted').checked; applySound();
        settings.scale = +$('#set-scale').value; settings.ui = $('#set-ui').value; settings.nick = nick.value.replace(/[\u0000-\u001f]/g, '').slice(0, 20);
        store.set('settings', settings); view.setQuality({ shadows: settings.shadows, bloom: settings.bloom, scale: settings.scale });
        document.body.classList.toggle('tablet', isTouchUI()); renderWho(); closeModal();
      } }));
  });
}
function openHelp() {
  modal(b => {
    b.append(h('h2', { text: tl('How to play') }),
      h('p', { text: tl('Destroy every enemy building. Workers mine gold and chop lumber. Spend it on food buildings, soldiers, towers and Forge upgrades. Your hero levels up from kills; a second ability unlocks at level 3. Neutral monster camps guard the map and pay gold bounties. With fog of war on, you only see what your team can see.') }));
    const kv = (rows) => { const d = h('div', { class: 'kv' }); for (const [k, v] of rows) d.append(h('b', { text: tl(k) }), h('span', { text: tl(v) })); return d; };
    b.append(h('h3', { text: tl('Desktop') }), kv([['Left click / drag', 'Select, box select'], ['Shift + click', 'Add or remove from selection'], ['Double-click', 'Select all of that type on screen'], ['Right click', 'Move, attack, gather, set rally'], ['A then click', 'Attack-move'], ['Arrows / screen edge', 'Scroll'], ['Wheel', 'Zoom'], ['Ctrl+1–9, 1–9', 'Control groups'], ['Q / W', 'Hero abilities'], ['F1 / Space', 'Select hero / center on selection'], ['Alt', 'Show all health bars'], ['Enter', 'Chat (online games)'], ['Speaker button', 'Sound on or off (volumes in Settings)']]),
      h('h3', { text: tl('Tablet') }), kv([['Tap', 'Select a unit, or command the selection'], ['Drag / pinch', 'Scroll / zoom'], ['Long press', 'Select all of that type'], ['BOX, then drag', 'Select a group'], ['ADD', 'Tap units to add them'], ['Build', 'Tap to place the outline, tap it again to build']]),
      h('button', { class: 'primary', text: tl('Got it'), onclick: closeModal }));
  });
}
function openSolo() {
  modal(b => {
    const maps = mapChoices();
    const ms = h('select', { id: 'soloMap' }); maps.forEach((m, i) => ms.append(h('option', { value: i, text: mapName(m.name) })));
    const mode = h('select', { id: 'soloMode' });
    const fill = () => {
      const m = decodeMap(maps[ms.value].code), n = m ? m.starts.length : 2; mode.replaceChildren();
      mode.append(h('option', { value: 'duel', text: tl('1 vs 1 computer') }));
      if (n >= 4) mode.append(h('option', { value: 'coop', text: tl('2 vs 2 · you and a computer ally') }));
      if (n >= 3) mode.append(h('option', { value: 'ffa', text: tl('Free-for-all · {n} computers', { n: n - 1 }) }));
    };
    ms.onchange = fill; fill();
    const pk = pickSelect('soloPick', settings.pick), fog = h('input', { type: 'checkbox', id: 'soloFog', style: 'width:22px;height:22px;min-height:0' }); fog.checked = settings.fog;
    b.append(h('h2', { text: tl('Play vs computer') }), h('div', { class: 'row' }, h('label', { for: 'soloMap', style: 'min-width:70px', text: tl('Map') }), ms),
      h('div', { class: 'row' }, h('label', { for: 'soloMode', style: 'min-width:70px', text: tl('Mode') }), mode),
      h('div', { class: 'row' }, h('label', { for: 'soloPick', style: 'min-width:70px', text: tl('Hero') }), pk),
      h('label', { class: 'row', for: 'soloFog', style: 'color:var(--ink);font-size:16px' }, fog, tl('Fog of war')),
      WEB && WEB.configured && me.id ? h('button', { text: tl('Pick from the map library'), onclick: () => openLibrary((m, code) => { const dm = decodeMap(code); if (dm) { dm.libId = m.id; startLocal(dm, dm.starts.length >= 4 ? 'coop' : 'duel', pk.value, fog.checked); } }) }) : null,
      h('button', { class: 'primary', text: tl('Start'), onclick: () => {
        settings.pick = pk.value; settings.fog = fog.checked; store.set('settings', settings);
        const m = decodeMap(maps[ms.value].code); if (m) startLocal(m, mode.value, pk.value, fog.checked);
      } }));
  });
}
function startLocal(map, mode, pick = settings.pick, fog = settings.fog) {
  const n = map.starts.length, slots = [{ t: 'h', team: 1, hero: pick === 'random' || !HEROES.includes(pick) ? randomHero() : pick }];
  for (let i = 1; i < 4; i++) slots.push(i >= n || (mode === 'duel' && i > 1) ? { t: 'c', team: 2, hero: 'warden' } : { t: 'a', team: mode === 'coop' ? (i === 1 ? 1 : 2) : mode === 'ffa' ? i + 1 : 2, hero: randomHero() });
  startGame('local', map, slots, 0, fog);
}
function startGame(mode, map, slots, mySlot, fog, ranked) {
  closeModal(); $('#over').classList.remove('on'); if (ED) { ED = null; view.labels = null; }
  G = new Game(mode, map, slots, mySlot, fog); cardSig = ''; infoSig = ''; chatLog.replaceChildren();
  G.ranked = !!ranked; G.sid = server ? server.sid : conn ? conn.sid : null;
  if (map.libId && WEB && WEB.maps && mode !== 'client') WEB.maps.played(map.libId);
  $('#tChat').style.display = mode === 'host' || mode === 'client' ? '' : 'none';
  view.quiet = false; musicFor(); audio.play('start', { force: true });
  showScreen('hud');
  toast(mySlot >= 0 ? tl('You are {slot}. Build up and destroy the enemy.', { slot: sn(mySlot) }) : tl('Watching as a spectator'));
}
function startAttract() {
  ED = null; view.labels = null;
  G = new Game('attract', defaultMap(), [1, 2, 3, 4].map(team => ({ t: 'a', team, hero: randomHero() })), -1, false);
  view.quiet = true; musicFor();
}
function leave() {
  renderLobby.humans = 0;
  if (server) { server.close(); server = null; }
  if (conn) { conn.close(); conn = null; }
  if (chatUnsub) { chatUnsub(); chatUnsub = null; } closeChat();
  clientLob = null; $('#over').classList.remove('on');
  startAttract(); showScreen('title');
}

// ---------- title + identity ----------
function renderWho() {
  const img = $('#avatar');
  if (me.avatar && /^(https:|data:|\/)/.test(me.avatar)) { img.src = me.avatar; img.style.display = ''; } else img.style.display = 'none';
  const web = PLATFORM === 'web', cfg = web && WEB && WEB.configured;
  $('#whoName').textContent = settings.nick.trim() || me.name || tl(me.id ? 'Signed in' : web ? 'Not signed in' : 'Guest');
  $('#whoLine').textContent = tl(web ? (!cfg ? 'Online play is not set up on this site yet' : me.id ? 'Signed in with Google' : 'Sign in with Google to play online')
    : me.id ? 'Signed in with your Claude account' : userNS ? 'Not signed in' : 'Offline · open on claude.ai to sign in');
  $('#bSignIn').hidden = !(cfg && !me.id); $('#bSignOut').hidden = !(cfg && me.id); $('#bLadder').hidden = !(cfg && me.id);
  $('#ePublish').hidden = $('#eLib').hidden = !(cfg && me.id);
}
function renderNet() {
  const ok = !!roomNS;
  $('#bHost').disabled = !ok; $('#bJoin').disabled = !ok; $('#joinCode').disabled = !ok;
  $('#netNote').textContent = tl(PLATFORM === 'web'
    ? (ok ? 'Host a game and send friends the room code. They sign in on this site and join.' : WEB && WEB.configured ? 'Sign in to host or join online games. Playing the computer and the editor work without signing in.' : 'Add your Firebase settings to firebase-config.js to turn on online play (see README).')
    : ok ? 'Share this page with friends (Contributor access), host a game, then send them the room code.' : 'Online play needs this page open on claude.ai while signed in. You can still play against the computer.');
}
$('#bSignIn').onclick = () => WEB && WEB.signIn().catch(e => toast(tl('Sign-in failed') + (e && e.code ? ` (${e.code})` : '')));
$('#bSignOut').onclick = () => { if (server || conn) leave(); WEB && WEB.signOut(); };
$('#bLadder').onclick = () => openLadder();
async function openLadder() {
  modal(b => b.append(h('h2', { text: tl('Ladder') }), h('p', { class: 'note', text: tl('Loading…') })));
  let rows = []; try { rows = await WEB.ladder.top(50); } catch { }
  const b = $('#mbody'); b.replaceChildren(h('h2', { text: tl('Ladder') }), h('p', { class: 'note', text: tl('Ranked matches move ratings. Everyone starts at 1200; a result counts once every player confirms it.') }));
  const t = h('table', { class: 'lad' }, h('thead', {}, h('tr', {}, ...['#', 'Player', 'Rating', 'Wins', 'Games'].map(x => h('th', { text: tl(x) })))));
  const tb = h('tbody'); rows.forEach((r, i) => tb.append(h('tr', { class: r.uid === me.id ? 'me' : '' }, h('td', { class: 'n', text: String(i + 1) }), h('td', { text: String(r.name || tl('Player')) }), h('td', { class: 'n', text: String(r.rating | 0) }), h('td', { class: 'n', text: String(r.wins | 0) }), h('td', { class: 'n', text: String(r.games | 0) }))));
  t.append(tb); b.append(rows.length ? t : h('p', { text: tl('No ranked players yet.') }), h('button', { class: 'primary', text: tl('Close'), onclick: closeModal }));
}
// Shared map library (website only). onPick(entry, code) is called with a validated map code.
async function openLibrary(onPick) {
  let sort = 'createdAt', all = [], q = '';
  const draw = () => {
    const b = $('#mbody'); b.replaceChildren(h('h2', { text: tl('Map library') }));
    const tabs = h('div', { class: 'tabs' }, ...[['createdAt', 'Newest'], ['plays', 'Most played']].map(([k, t]) => h('button', { class: sort === k ? 'on' : '', text: tl(t), onclick: () => { sort = k; load(); } })));
    const search = h('input', { placeholder: tl('Search by name'), 'aria-label': tl('Search maps'), value: q }); search.oninput = () => { q = search.value; list(); search.focus(); };
    const box = h('div', { class: 'maps' });
    const list = () => {
      box.replaceChildren();
      const items = all.filter(m => !q || String(m.name).toLowerCase().includes(q.toLowerCase()));
      if (!items.length) box.append(h('p', { class: 'note', text: tl(all.length ? 'No maps match.' : 'No maps published yet. Publish one from the editor.') }));
      for (const m of items) box.append(h('div', { class: 'row' }, h('div', {}, h('b', { text: String(m.name) }), h('div', { class: 'meta', text: tl('{size}×{size} · {starts} starts · {camps} camps · by {author} · played {plays}×', { size: m.size, starts: m.starts, camps: m.camps || 0, author: m.authorName || tl('Player'), plays: m.plays | 0 }) })),
        h('div', { class: 'row' }, h('button', { class: 'primary', text: tl('Use'), onclick: () => { if (!decodeMap(m.code)) return toast(tl('That map is damaged')); closeModal(); onPick(m, m.code); } }),
          m.author === me.id ? h('button', { text: tl('Delete'), onclick: async () => { await WEB.maps.remove(m.id).catch(() => toast(tl('Delete failed'))); load(); } }) : null)));
    };
    b.append(tabs, search, box, h('button', { text: tl('Close'), onclick: closeModal })); list();
  };
  const load = async () => { try { all = await WEB.maps.list(sort); } catch { all = []; toast(tl('Could not load the library')); } draw(); };
  modal(b => b.append(h('h2', { text: tl('Map library') }), h('p', { class: 'note', text: tl('Loading…') }))); load();
}
$('#bSolo').onclick = openSolo;
$('#langSel').onchange = e => changeLang(e.target.value);
// Switch language and redraw everything that holds text.
function changeLang(code) {
  settings.lang = setLang(code); store.set('settings', settings);
  applyStatic(); renderWho(); renderNet(); applySound();
  if (view.backend) $('#gpu').textContent = tl(view.backend === 'WebGPU' ? 'Rendering with WebGPU' : 'WebGPU unavailable here, using WebGL 2');
  $('#chatTo').textContent = tl(chatTeam ? 'Team' : 'All');
  cardSig = ''; infoSig = ''; if (G) { G.hudT = 0; G.plT = 0; if (G.target) G.setTarget(G.target); }
  if ($('#lobby').classList.contains('on')) renderLobby();
  if (ED) ED.palette();
}
$('#bHelp').onclick = openHelp;
$('#bSettings').onclick = openSettings;
$('#bEdit').onclick = () => { const saved = store.get('lastEdit', null); new Editor((saved && decodeMap(saved)) || defaultMap()); };
$('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#bJoin').click(); });

// ---------- chat (online games) ----------
const chatLog = $('#chatLog'); let chatUnsub = null, chatTeam = false, lastChat = 0;
function senderLabel(m) {
  const slots = server ? server.slots : clientLob ? clientLob.lob.slots : null;
  const i = slots ? slots.findIndex(s => s && ((s.peer && s.peer === m.peer) || (s.by && s.by === m.by) || (s.host && m.peer === (conn && conn.hostPeer)))) : -1;
  if (m.sameTab) return { name: myName(), col: TEAM_COLORS[G ? G.mySlot : 0] || '#ccc', slot: G ? G.mySlot : -1 };
  if (i < 0) return { name: tl('Spectator'), col: '#bbb', slot: -1 };
  return { name: slotLabel(slots[i], i, false), col: TEAM_COLORS[i], slot: i };
}
function listenChat(R) {
  if (chatUnsub) chatUnsub();
  chatUnsub = R.on('chat', m => {
    const d = m.data; if (!d || typeof d.t !== 'string' || !G || (G.mode !== 'host' && G.mode !== 'client')) return;
    const who = senderLabel(m);
    if (d.team && (G.mySlot < 0 || +d.team !== G.teams[G.mySlot])) return;
    const line = h('div', { class: 'cl' }, h('b', { style: `color:${who.col}`, text: `${d.team ? tl('[Team]') + ' ' : ''}${who.name}: ` }), d.t.replace(/[\u0000-\u001f]/g, ' ').slice(0, 120));
    chatLog.append(line); while (chatLog.children.length > 7) chatLog.firstChild.remove();
    if (!m.sameTab) audio.play('chat');
    setTimeout(() => line.classList.add('old'), 12000);
  });
}
function chatRoom() { return server ? server.R : conn ? conn.R : null; }
function openChat() {
  if (!chatRoom() || !G || (G.mode !== 'host' && G.mode !== 'client')) { toast(tl('Chat works in online games')); return; }
  $('#chatBox').classList.add('on'); $('#chatIn').focus();
  $('#chatTo').textContent = tl(chatTeam ? 'Team' : 'All');
}
function closeChat() { $('#chatBox').classList.remove('on'); $('#chatIn').value = ''; $('#chatIn').blur(); }
function sendChat() {
  const t = $('#chatIn').value.trim().slice(0, 120); const R = chatRoom();
  if (t && R && performance.now() - lastChat > 700) {
    lastChat = performance.now();
    R.emit('chat', { sid: server ? server.sid : conn ? conn.sid : '', t, team: chatTeam && G.mySlot >= 0 ? G.teams[G.mySlot] : 0 })
      .catch(e => toast(tl(e && e.code === 'not_permitted' ? 'Chat needs Contributor access to this page' : 'Message not sent')));
  }
  closeChat();
}
$('#chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } else if (e.key === 'Escape') closeChat(); e.stopPropagation(); });
$('#chatTo').onclick = () => { chatTeam = !chatTeam; $('#chatTo').textContent = tl(chatTeam ? 'Team' : 'All'); $('#chatIn').focus(); };
$('#chatSend').onclick = () => sendChat();
$('#tChat').onclick = () => openChat();

// ---------- lobby ----------
let lobbyMaps = [];
async function hostGame() {
  if (!roomNS) return;
  const code = newCode(); let R;
  try { R = await roomNS.join(ROOM_PREFIX + code); } catch (e) { toast(tl('Could not open a room') + (e && e.code ? ` (${e.code})` : '')); return; }
  server = new HostServer(R, code, { id: me.id, nm: settings.nick.trim(), pick: settings.pick }, hostCb());
  listenChat(R);
  lobbyMaps = mapChoices(); server.setMap(decodeMap(lobbyMaps[0].code));
  showScreen('lobby'); renderLobby();
}
async function joinGame() {
  if (!roomNS) return;
  const code = cleanCode($('#joinCode').value); if (code.length < 4) return toast(tl('Enter the room code from the host'));
  let R; try { R = await roomNS.join(ROOM_PREFIX + code); } catch (e) { toast(tl('Could not join that room') + (e && e.code ? ` (${e.code})` : '')); return; }
  clientLob = null;
  conn = new ClientConn(R, code, { id: me.id, nm: settings.nick.trim(), pick: settings.pick }, {
    lobby: (lob, mySlot) => { clientLob = { lob, mySlot }; if ($('#lobby').classList.contains('on')) renderLobby(); },
    start: (map, slots, mySlot, fog, ranked) => startGame('client', map, slots, mySlot, fog, ranked),
    snap: s => { if (G && G.mode === 'client') { view.apply(s); G.onSnap(s); } },
    hostLost: () => hostLost(),
    hostBack: () => { if (G && G.mode === 'client') { clearTimeout(G.migTimer); toast(tl('Game resumed with a new host')); } },
    noHost: () => { if (!clientLob) $('#lStatus').textContent = tl('No host found in room {code} yet. Check the code with the host.', { code: code.toUpperCase() }); },
    error: () => toast(tl('You need Contributor access to this page to send orders. Ask the owner to share it with you.')),
  });
  listenChat(R);
  showScreen('lobby'); renderLobby();
}
$('#bHost').onclick = hostGame; $('#bJoin').onclick = joinGame;
function hostCb() {
  return {
    change: () => { if ($('#lobby').classList.contains('on')) renderLobby(); },
    command: (i, c) => { if (G && G.sim && G.mode === 'host') G.sim.command(i, c); },
    error: () => toast(tl('This account cannot send game updates here. Ask the page owner for Contributor access.')),
  };
}
// Host migration: when the host disappears mid-game, the client with the lowest peer label rebuilds the game from its last snapshot and hosts it.
function hostLost() {
  if (!G || G.mode !== 'client' || !conn || !G.snap) { toast(tl('The host left')); leave(); return; }
  toast(tl('The host left. Moving the game to a new host…'));
  clearTimeout(G.migTimer);
  setTimeout(() => { if (conn && G && G.mode === 'client' && !conn.hadHost) { const next = conn.successor(); if (next && next.sameTab) becomeHost(); } }, 1200);
  G.migTimer = setTimeout(() => { if (G && G.mode === 'client' && conn && !conn.hadHost) { toast(tl('No one could take over hosting')); leave(); } }, 12000);
}
function becomeHost() {
  const c = conn, g = G, L = clientLob && clientLob.lob; if (!c || !g || !L) return;
  const old = L.slots.findIndex(s => s && s.host);
  const slots = L.slots.map((s, i) => ({ t: s.t === 'o' ? 'c' : s.t, team: s.team, peer: s.peer || null, by: s.by || null, nm: s.nm || '', gone: s.gone ? 1 : 0, pick: s.pick || 'random', hero: g.slots[i] && g.slots[i].hero, host: 0 }));
  if (old >= 0) Object.assign(slots[old], { t: 'a', peer: null, by: null, nm: '' });
  if (g.mySlot >= 0) slots[g.mySlot].host = 1;
  g.slots = g.slots.map((s, i) => ({ ...s, t: i === old ? 'a' : s.t }));
  c.close(false); conn = null; clientLob = null;
  server = new HostServer(c.R, c.code, { id: me.id, nm: settings.nick.trim(), pick: settings.pick }, hostCb(), { sid: c.sid, slots, fog: g.fog, map: g.map, ranked: g.ranked });
  g.sim = Sim.fromSnapshot(g.map, g.slots, g.snap);
  g.mode = 'host'; view.snapInt = 0.05; g.t0 = performance.now(); g.steps = 0; tickFn = () => g.tick();
  clearTimeout(g.migTimer); g.plT = 0;
  toast(tl('You are now hosting this game. A computer took over the old host’s side.'));
}
$('#bLeave').onclick = () => leave();
$('#bCopy').onclick = () => copy((server ? server.code : conn ? conn.code : '').toUpperCase());
$('#lFog').onchange = () => { if (server) { server.fog = $('#lFog').checked; server.push(); } };
$('#lRanked').onchange = () => { if (server) { server.ranked = $('#lRanked').checked; if (server.ranked) server.fog = true; server.push(); if (server.ranked && rankedProblem()) toast(rankedProblem()); } };
$('#lLib').onclick = () => openLibrary((m, code) => { lobbyMaps.push({ name: m.name, code, libId: m.id }); const dm = decodeMap(code); if (dm) server.setMap(dm); renderLobby(); });
$('#lMap').onchange = () => { if (!server) return; const m = decodeMap(lobbyMaps[$('#lMap').value].code); if (m) server.setMap(m); };
$('#bStart').onclick = () => {
  if (!server) return;
  const map = decodeMap(server.mapCode); if (!map) return;
  const lib = lobbyMaps.find(m => m.name === server.mapName && m.libId); if (lib) map.libId = lib.libId;
  if (server.ranked && rankedProblem()) return toast(rankedProblem());
  const players = server.slots.map((s, i) => ({ uid: s.by, team: s.team, i })).filter(p => server.slots[p.i].t === 'h');
  const slots = server.start(); startGame('host', map, slots, 0, server.fog, server.ranked);
  if (server.ranked && WEB) WEB.ladder.createMatch(server.sid, players, map.name).catch(() => toast(tl('Could not record the ranked match')));
};
function rankedProblem() {
  const act = server.slots.filter((s, i) => (s.t === 'h' || s.t === 'a') && i < (server.maxSlots || 4));
  if (act.some(s => s.t === 'a')) return tl('Ranked matches are for players only. Close the computer slots.');
  if (act.some(s => !s.by)) return tl('Every player must be signed in for a ranked match.');
  if (new Set(act.map(s => s.team)).size < 2) return tl('Ranked matches need at least two teams.');
  return '';
}
function renderLobby() {
  const host = !!server, code = host ? server.code : conn ? conn.code : '';
  $('#lCode').textContent = code.toUpperCase();
  const L = host ? { slots: server.slots, st: server.st, map: server.mapName, max: server.maxSlots } : clientLob && clientLob.lob;
  const mySlot = host ? 0 : clientLob ? clientLob.mySlot : -1;
  const box = $('#slots'); box.replaceChildren();
  $('#bStart').style.display = host ? '' : 'none';
  if (L) { const humans = L.slots.filter(s => s && s.t === 'h').length; if (humans > (renderLobby.humans || 0) && renderLobby.humans) audio.play('join'); renderLobby.humans = humans; }
  if (!L) { box.append(h('p', { class: 'note', text: tl('Looking for the host…') })); $('#lStatus').textContent = ''; return; }
  resolveNames(L.slots.map(s => s && s.by).filter(Boolean)).then(got => { if (got) renderLobby(); });
  L.slots.forEach((s, i) => {
    const row = h('div', { class: 'slot' }, h('div', { class: 'chip', style: `background:${TEAM_COLORS[i]}` }));
    const nm = h('div', { class: 'nm' }, slotLabel(s, i, i === mySlot)); if (s.host) nm.append(h('small', { text: tl('host') })); if (i === mySlot && !s.host) nm.append(h('small', { text: tl('you') })); if (s.gone) nm.append(h('small', { text: tl('left') }));
    row.append(nm);
    if (host && !s.host && i < (L.max || 4)) {
      const t = h('select', { 'aria-label': `Slot ${i + 1} type` });
      if (s.t === 'h') t.append(h('option', { value: 'h', text: tl('Player') }));
      for (const [v, n] of [['o', 'Open'], ['a', 'Computer'], ['c', 'Closed']]) t.append(h('option', { value: v, text: tl(n) }));
      t.value = s.t; t.onchange = () => server.setSlot(i, { t: t.value }); row.append(t);
    } else row.append(h('div', { class: 'mut', text: tl(i >= (L.max || 4) ? 'Not on this map' : { h: 'Player', a: 'Computer', o: 'Open', c: 'Closed' }[s.t]) }));
    const tm = h('select', { class: 'team', 'aria-label': `Slot ${i + 1} team`, disabled: !host });
    for (let k = 1; k <= 4; k++) tm.append(h('option', { value: k, text: tl('Team {n}', { n: k }) })); tm.value = s.team; tm.onchange = () => server.setSlot(i, { team: +tm.value });
    row.append(tm);
    if (s.t === 'h' || s.t === 'a') {
      const canPick = i === mySlot || (host && s.t === 'a');
      const pk = pickSelect(`pick${i}`, validPick(s.pick)); pk.className = 'pick'; pk.disabled = !canPick; pk.setAttribute('aria-label', `Slot ${i + 1} hero`);
      pk.onchange = () => {
        if (i === mySlot) { settings.pick = pk.value; store.set('settings', settings); }
        if (host) server.setSlot(i, { pick: pk.value }); else if (conn) conn.setPick(pk.value);
      };
      row.append(pk);
    }
    box.append(row);
  });
  const ms = $('#lMap'); ms.replaceChildren(); ms.disabled = !host;
  if (host) { lobbyMaps.forEach((m, i) => ms.append(h('option', { value: i, text: mapName(m.name) }))); ms.value = Math.max(0, lobbyMaps.findIndex(m => m.name === server.mapName)); drawPreview($('#lPrev'), decodeMap(server.mapCode)); }
  else ms.append(h('option', { text: L.map ? mapName(L.map) : '—' }));
  $('#lMapNote').textContent = tl('{n} start locations', { n: L.max || '?' });
  const fog = $('#lFog'); fog.checked = host ? server.fog : !!L.fog; fog.disabled = !host;
  $('#lRankedRow').hidden = PLATFORM !== 'web'; $('#lRanked').checked = host ? server.ranked : !!L.ranked; $('#lRanked').disabled = !host;
  $('#lLib').hidden = !(host && WEB && WEB.maps && roomNS);
  const teams = new Set(L.slots.filter((s, i) => (s.t === 'h' || s.t === 'a') && i < (L.max || 4)).map(s => s.team));
  $('#bStart').disabled = teams.size < 2 || (host && server.ranked && !!rankedProblem());
  $('#lStatus').textContent = host ? tl(teams.size < 2 ? 'Put at least two teams in the game to start.' : 'Friends join with the code above. Open slots stay empty if nobody joins.')
    : L.st === 'game' ? tl('Game in progress, joining…') : mySlot >= 0 ? tl('You are {slot}. Waiting for the host to start.', { slot: sn(mySlot) }) : tl('The room is full. You will watch as a spectator.');
}

// ---------- map editor ----------
const ETOOLS = [
  ['Terrain', [['t0', 'Grass', TILES[0].col], ['t1', 'Dirt', TILES[1].col], ['t2', 'Cobble', TILES[2].col], ['t3', 'Water', TILES[3].col], ['t4', 'Rock', TILES[4].col]]],
  ['Objects', [['tree', 'Trees', '#2f5d2a'], ['untree', 'Clear trees', '#6b4a2a'], ['mine', 'Gold mine', '#ffd34d'], ['unmine', 'Remove mine', '#7a6e5e']]],
  ['Start locations', TEAM_COLORS.slice(0, 4).map((c, i) => ['s' + i, SLOT_NAMES[i], c])],
  ['Monster camps', [['c1', 'Easy camp', '#c9a45a'], ['c2', 'Medium camp', '#d87a3a'], ['c3', 'Hard camp', '#c0392b'], ['uncamp', 'Remove camp', '#7a6e5e']]],
  ['Brush', [['b1', 'Small', ''], ['b2', 'Medium', ''], ['b3', 'Large', '']]],
  ['View', [['hand', 'Pan (touch)', '']]],
];
class Editor {
  constructor(map) {
    if (server || conn) leave();
    G = null; tickFn = null; ED = this;
    this.map = cloneMap(map); this.tool = 't0'; this.brush = 1; this.last = null; this.dirtyT = false; this.dirtyTr = false; this.tT = 0;
    view.reset(); view.setMap(this.map); view.mySlot = 0; view.teams = [1, 2, 3, 4];
    view.maxD = 90; view.centerOn(this.map.w / 2, this.map.h / 2 - 1, true); view.cam.td = view.cam.d = this.map.w * 1.15;
    this.syncEnts(); this.palette(); $('#eName').value = mapName(this.map.name); showScreen('editor');
    view.quiet = true; musicFor();
  }
  palette() {
    const p = $('#epal'); p.replaceChildren();
    for (const [title, list] of ETOOLS) {
      p.append(h('h3', { text: tl(title) })); const g = h('div', { class: 'tools' });
      for (const [id, label, col] of list) {
        const b = h('button', { 'data-t': id }, col ? h('span', { class: 'sw', style: `background:${col}` }) : null, tl(label));
        b.onclick = () => { if (id[0] === 'b') this.brush = +id[1]; else this.tool = id; this.palette(); };
        if (id === this.tool || id === 'b' + this.brush) b.classList.add('on');
        g.append(b);
      }
      p.append(g);
    }
    p.append(h('p', { class: 'note', text: tl('{w} × {h} · {s} starts · {m} mines · {c} camps · {t} trees', { w: this.map.w, h: this.map.h, s: this.map.starts.length, m: this.map.mines.length, c: this.map.camps.length, t: this.map.trees.size }) }));
  }
  syncEnts() {
    const ents = []; let id = 1;
    for (const [x, y] of this.map.mines) { const f = footprint(3, x, y); ents.push({ id: id++, k: KI.mine.i, o: 4, x: f.cx, z: f.cz, hp: 2000, face: 0, st: 'i', ac: 0, tg: 0, ex: 60 }); }
    this.map.starts.forEach(([x, y], i) => { const f = footprint(3, x, y); ents.push({ id: 300 + i, k: KI.hall.i, o: i, x: f.cx, z: f.cz, hp: 1500, face: 0, st: 'i', ac: 0, tg: 0, ex: 0 }); });
    this.map.camps.forEach(([x, y, l], ci) => CAMPS[l].forEach((kid, j) => { const a = j / 3 * 6.283; ents.push({ id: 400 + ci * 4 + j, k: KI[kid].i, o: CREEP, x: x + .5 + Math.cos(a) * .9, z: y + .5 + Math.sin(a) * .9, hp: KI[kid].hp, face: 0, st: 'i', ac: 0, tg: 0, ex: 0 }); }));
    view.apply({ ents, tr: [], fx: [], r: [], hs: {}, q: {} }, { silent: true });
    for (const e of view.ents.values()) { e.rx = e.x; e.rz = e.z; }
    view.labels = this.map.starts.map(([x, y], i) => ({ x: x + .5, z: y + .5, t: String(i + 1), c: TEAM_COLORS[i] }));
  }
  tileAt(sx, sy) { const p = view.pickGround(sx, sy); return p ? [Math.floor(p.x), Math.floor(p.z)] : null; }
  occupied(tx, ty, pad = 0) {
    const m = this.map;
    for (const [x, y] of [...m.mines, ...m.starts]) if (Math.abs(tx - x) <= 1 + pad && Math.abs(ty - y) <= 1 + pad) return true;
    for (const [x, y] of m.camps) if (Math.abs(tx - x) <= 1 + pad && Math.abs(ty - y) <= 1 + pad) return true;
    return false;
  }
  campOk(tx, ty) {
    const m = this.map;
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (x < 0 || y < 0 || x >= m.w || y >= m.h || !TILES[m.tiles[y * m.w + x]].walk) return false;
    for (const [x, y] of m.starts) if (Math.hypot(tx - x, ty - y) < 9) return false;
    for (const [x, y] of [...m.mines, ...m.camps]) if (Math.abs(tx - x) < 3 && Math.abs(ty - y) < 3) return false;
    return true;
  }
  footOk(tx, ty, ignoreStart = -1) {
    const m = this.map;
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (x < 0 || y < 0 || x >= m.w || y >= m.h || !TILES[m.tiles[y * m.w + x]].walk) return false;
    for (const [x, y] of m.mines) if (Math.abs(tx - x) < 5 && Math.abs(ty - y) < 5) return false;
    for (const [x, y] of m.camps) if (Math.abs(tx - x) < 3 && Math.abs(ty - y) < 3) return false;
    for (let i = 0; i < m.starts.length; i++) if (i !== ignoreStart && Math.abs(tx - m.starts[i][0]) < 6 && Math.abs(ty - m.starts[i][1]) < 6) return false;
    return true;
  }
  brushTiles(tx, ty) {
    const r = this.brush - 1, out = [];
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (Math.hypot(x - tx, y - ty) <= r + 0.5 && x >= 0 && y >= 0 && x < this.map.w && y < this.map.h) out.push([x, y]);
    return out;
  }
  hoverAt(sx, sy) {
    const t = this.tileAt(sx, sy); if (!t) return view.setGhost([]);
    if (this.tool === 'hand') return view.setGhost([]);
    if (this.tool[0] === 'c' && this.tool.length === 2) { const ok = this.campOk(t[0], t[1]); const g = []; for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) g.push([t[0] + x, t[1] + y, ok]); return view.setGhost(g); }
    if (this.tool === 'mine' || this.tool[0] === 's') { const ok = this.footOk(t[0], t[1], this.tool[0] === 's' ? +this.tool[1] : -1); const g = []; for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) g.push([t[0] + x, t[1] + y, ok]); return view.setGhost(g); }
    view.setGhost(this.brushTiles(t[0], t[1]).map(([x, y]) => [x, y, true]));
  }
  paintAt(sx, sy, first) {
    const t = this.tileAt(sx, sy); if (!t) return;
    const key = t.join(','); if (!first && key === this.last) return; this.last = key;
    const m = this.map, [tx, ty] = t, tool = this.tool;
    if (tool === 'hand') return;
    if (tool[0] === 't' && tool.length === 2) {
      const tt = +tool[1];
      for (const [x, y] of this.brushTiles(tx, ty)) {
        if (!TILES[tt].walk && this.occupied(x, y)) continue;
        const i = y * m.w + x; if (m.tiles[i] === tt) continue;
        m.tiles[i] = tt; if (!TILES[tt].walk && m.trees.delete(i)) this.dirtyTr = true; this.dirtyT = true;
      }
      audio.play('paint');
    } else if (tool === 'tree' || tool === 'untree') {
      for (const [x, y] of this.brushTiles(tx, ty)) {
        const i = y * m.w + x;
        if (tool === 'untree') { if (m.trees.delete(i)) this.dirtyTr = true; }
        else if (TILES[m.tiles[i]].walk && !this.occupied(x, y, 1) && !m.trees.has(i) && (this.brush === 1 || Math.random() < 0.7)) { m.trees.add(i); this.dirtyTr = true; }
      }
      audio.play('paint');
    } else if (first && tool === 'mine') {
      if (!this.footOk(tx, ty)) return toast(tl('Gold mines need open ground, away from other mines and starts'));
      if (m.mines.length >= 16) return toast(tl('Up to 16 gold mines'));
      m.mines.push([tx, ty]); this.clearTrees(tx, ty, 1); this.syncEnts(); audio.play('thump');
    } else if (first && tool[0] === 'c' && tool.length === 2) {
      if (!this.campOk(tx, ty)) return toast(tl('Camps need open ground, at least 9 tiles from start locations'));
      if (m.camps.length >= 24) return toast(tl('Up to 24 camps'));
      m.camps.push([tx, ty, +tool[1]]); this.clearTrees(tx, ty, 1); this.syncEnts(); audio.play('thump');
    } else if (first && tool === 'uncamp') {
      const i = m.camps.findIndex(([x, y]) => Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1); if (i >= 0) { m.camps.splice(i, 1); this.syncEnts(); }
    } else if (first && tool === 'unmine') {
      const i = m.mines.findIndex(([x, y]) => Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1); if (i >= 0) { m.mines.splice(i, 1); this.syncEnts(); }
    } else if (first && tool[0] === 's') {
      const si = +tool[1];
      if (si > m.starts.length) return toast(tl('Place start {n} first', { n: m.starts.length + 1 }));
      if (!this.footOk(tx, ty, si)) return toast(tl('Start locations need open ground away from mines and other starts'));
      m.starts[si] = [tx, ty]; this.clearTrees(tx, ty, 3); this.syncEnts(); audio.play('thump');
    }
    this.palette.pending = true;
  }
  clearTrees(tx, ty, r) { const m = this.map; for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (m.trees.delete(y * m.w + x)) this.dirtyTr = true; }
  endStroke() { this.last = null; this.flush(true); this.palette(); this.save(true); }
  flush(force) {
    if (this.dirtyT) { view.refreshTerrain(); this.dirtyT = false; this.dirtyTr = true; }
    if (this.dirtyTr && (force || this.tT <= 0)) { view.setTrees(this.map.trees); view.rebuildBlk(); this.dirtyTr = false; this.tT = 0.15; }
  }
  frame(dt) {
    this.tT -= dt; this.flush(false);
    let dx = 0, dz = 0; if (keys.has('ArrowLeft')) dx -= 1; if (keys.has('ArrowRight')) dx += 1; if (keys.has('ArrowUp')) dz -= 1; if (keys.has('ArrowDown')) dz += 1;
    if (dx || dz) view.pan(dx * dt * view.cam.d, dz * dt * view.cam.d);
  }
  save(quiet) { this.map.name = $('#eName').value.replace(/[|\u0000-\u001f]/g, '').slice(0, 32) || 'Untitled'; store.set('lastEdit', encodeMap(this.map)); if (!quiet) toast(tl('Draft kept')); }
}
$('#eNew').onclick = () => { const s = +$('#eSize').value, m = blankMap(s, tl('New map')); new Editor(m); };
$('#eSave').onclick = () => {
  ED.save(true); const all = savedMaps(); all[ED.map.name] = encodeMap(ED.map);
  const ok = store.set('maps', all) && savedMaps()[ED.map.name];
  toast(ok ? tl('Saved “{name}”. Pick it in the lobby or vs computer.', { name: ED.map.name }) : tl('This browser blocked saving. Use Export to keep a copy.'));
};
$('#eOpen').onclick = () => modal(b => {
  b.append(h('h2', { text: tl('Open map') })); const list = h('div', { class: 'maps' });
  const add = (name, code, del) => list.append(h('div', { class: 'row' }, h('span', { text: name }), h('div', { class: 'row' },
    h('button', { text: tl('Open'), onclick: () => { const m = decodeMap(code); if (m) { closeModal(); new Editor(m); } } }),
    del ? h('button', { text: tl('Delete'), onclick: () => { const all = savedMaps(); delete all[name]; store.set('maps', all); closeModal(); $('#eOpen').click(); } }) : null)));
  add(tl('Ashvale Crossing (built in)'), encodeMap(defaultMap()), false);
  for (const [n, c] of Object.entries(savedMaps())) add(n, c, true);
  b.append(list, h('button', { text: tl('Close'), onclick: closeModal }));
});
$('#eExport').onclick = () => modal(b => {
  ED.save(true); const code = encodeMap(ED.map), ta = h('textarea', { readonly: true, 'aria-label': tl('Map code') }); ta.value = code;
  b.append(h('h2', { text: tl('Export map') }), h('p', { class: 'note', text: tl('Send this code to a friend; they can paste it into Import.') }), ta,
    h('div', { class: 'row' }, h('button', { class: 'primary', text: tl('Copy'), onclick: () => copy(code) }), h('button', { text: tl('Close'), onclick: closeModal })));
});
$('#eImport').onclick = () => modal(b => {
  const ta = h('textarea', { 'aria-label': tl('Map code'), placeholder: tl('Paste a map code (starts with A1|)') });
  b.append(h('h2', { text: tl('Import map') }), ta, h('div', { class: 'row' }, h('button', { class: 'primary', text: tl('Load'), onclick: () => { const m = decodeMap(ta.value); if (!m) return toast(tl("That map code isn't valid")); closeModal(); new Editor(m); } }), h('button', { text: tl('Close'), onclick: closeModal })));
});
$('#ePublish').onclick = () => {
  ED.save(true); const iss = validateMap(ED.map); if (iss.length) return toast(tl(iss[0]));
  modal(b => b.append(h('h2', { text: tl('Publish to the map library') }), h('p', { text: tl('“{name}” will be visible to everyone who signs in on this site, with your name as the author.', { name: ED.map.name }) }),
    h('div', { class: 'row' }, h('button', { class: 'primary', text: tl('Publish'), onclick: async () => { try { await WEB.maps.publish(ED.map, encodeMap(ED.map)); toast(tl('Published')); closeModal(); } catch { toast(tl('Publishing failed')); } } }), h('button', { text: tl('Cancel'), onclick: closeModal }))));
};
$('#eLib').onclick = () => openLibrary((m, code) => { const dm = decodeMap(code); if (dm) new Editor(dm); });
$('#eTest').onclick = () => { ED.save(true); const iss = validateMap(ED.map); if (iss.length) return toast(tl(iss[0])); const m = cloneMap(ED.map); startLocal(m, m.starts.length >= 4 ? 'coop' : 'duel', settings.pick, settings.fog); };
$('#eExit').onclick = () => { if (ED) ED.save(true); leave(); };
$('#eName').addEventListener('change', () => ED && ED.save(true));

// ---------- main loop ----------
let lastT = performance.now();
function loop(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  try { if (ED) ED.frame(dt); else if (G) G.frame(dt); view.frame(dt); } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
async function boot() {
  try { await view.init({ shadows: settings.shadows, bloom: settings.bloom, scale: settings.scale, forceWebGL: /[?&]gl=1/.test(location.search) }); }
  catch (e) { console.error(e); $('#boot').textContent = tl('This browser cannot start WebGPU or WebGL 2. Try a recent Chrome, Edge or Safari.'); return; }
  $('#gpu').textContent = tl(view.backend === 'WebGPU' ? 'Rendering with WebGPU' : 'WebGPU unavailable here, using WebGL 2');
  startAttract(); showScreen('title'); renderNet(); renderWho();
  applySound();
  $('#boot').remove();
  requestAnimationFrame(loop);
  if (window.claude && typeof window.claude.use === 'function') {
    claudeUse('user').then(async u => { userNS = u; if (u) { try { const v = await u.me(); me.id = v.id; me.name = v.name || ''; me.avatar = v.avatarUrl || ''; } catch {} } renderWho(); });
    claudeUse('room').then(r => { roomNS = r; renderNet(); });
  } else {
    PLATFORM = 'web';
    try { WEB = await (await import('./web.js')).initWeb(); } catch (e) { console.warn('website platform unavailable', e); WEB = { configured: false }; }
    renderWho(); renderNet();
    if (WEB.configured) {
      userNS = WEB.user;
      WEB.onIssue(() => toast(tl('Could not connect directly to a player. Their network may need a TURN server (see README).')));
      WEB.onAuth(async u => {
        if (u) { const v = await WEB.user.me(); me.id = v.id; me.name = v.name; me.avatar = v.avatarUrl; roomNS = WEB.room; WEB.ladder.ensure().catch(() => {}); }
        else { me.id = null; me.name = ''; me.avatar = ''; roomNS = null; }
        renderWho(); renderNet();
      });
    }
  }
  window.__ashvale = { view, get G() { return G; }, get server() { return server; }, get conn() { return conn; } };
}
boot();
}
