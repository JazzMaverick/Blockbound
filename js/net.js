// Listen-server networking over the artifact platform's `room` capability.
// The host browser runs the Sim; clients send commands and render host snapshots.
import { enc1, enc2, dec1, dec2, encodeMap, decodeMap, KINDS, KI, HEROES, randomHero } from './data.js';

export function claudeUse(name, ms = 10000) {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') return Promise.resolve(null);
  return Promise.race([c.use(name).catch(() => null), new Promise(r => setTimeout(() => r(null), ms))]);
}
export const ROOM_PREFIX = 'ashvale-';
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
export const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const validPick = p => (HEROES.includes(p) || p === 'random') ? p : 'random';
export const cleanCode = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
const str = (v, n = 24) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, n) : '';
const rid = () => Math.random().toString(36).slice(2, 10);

// ---------- snapshot packing (16 chars per entity) ----------
const ST = 'iagbsdct';
const TAU = Math.PI * 2;
function packEnt(e) {
  const c = v => Math.max(0, Math.min(4095, Math.round(v * 64)));
  return enc2(e.id) + enc1(e.k) + enc1(e.o) + enc2(c(e.x)) + enc2(c(e.z)) + enc2(Math.min(4095, e.hp)) +
    enc1(Math.round(((e.face % TAU + TAU) % TAU) / TAU * 64)) + enc1(Math.max(0, ST.indexOf(e.st))) + enc1(e.ac) + enc2(e.tg) + enc1(e.ex);
}
function unpackEnts(d, out) {
  for (let i = 0; i + 16 <= d.length; i += 16) {
    const k = dec1(d, i + 2), o = dec1(d, i + 3);
    if (k >= KINDS.length || o > 5) continue;
    out.push({ id: dec2(d, i), k, o, x: dec2(d, i + 4) / 64, z: dec2(d, i + 6) / 64, hp: dec2(d, i + 8),
      face: dec1(d, i + 10) / 64 * TAU, st: ST[dec1(d, i + 11)] || 'i', ac: dec1(d, i + 12), tg: dec2(d, i + 13), ex: dec1(d, i + 15) });
  }
}
export function encodeSnap(s, seq) {
  const head = JSON.stringify({ t: Math.round(s.t * 10) / 10, r: s.r, hs: s.hs, q: s.q, tr: s.tr.map(enc2).join(''),
    fx: s.fx.map(f => [f.i, f.k, Math.round(f.x * 10), Math.round(f.z * 10), f.o, f.v]), ov: s.ov });
  const parts = [[]]; let size = head.length + 80;
  for (const e of s.ents) { if (size + 16 > 3700) { parts.push([]); size = 80; } parts[parts.length - 1].push(packEnt(e)); size += 16; }
  return parts.map((p, i) => ({ s: seq, i, n: parts.length, h: i === 0 ? head : undefined, d: p.join('') }));
}
export function decodeSnap(parts) {
  try {
    const H = JSON.parse(parts[0].h);
    const ents = []; for (const p of parts) if (typeof p.d === 'string') unpackEnts(p.d, ents);
    const tr = []; const ts = str(H.tr, 20000); for (let i = 0; i + 1 < ts.length; i += 2) tr.push(dec2(ts, i));
    const arr = (v, n) => Array.isArray(v) ? v.slice(0, n) : [];
    const r = arr(H.r, 4).map(p => arr(p, 9).map(v => +v || 0));
    const fx = arr(H.fx, 80).filter(Array.isArray).map(f => ({ i: +f[0] || 0, k: str(f[1], 8), x: (+f[2] || 0) / 10, z: (+f[3] || 0) / 10, o: +f[4], v: +f[5] || 0 }));
    const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    return { t: +H.t || 0, r, hs: obj(H.hs), q: obj(H.q), tr, fx, ov: H.ov && typeof H.ov === 'object' ? { team: +H.ov.team } : null, ents };
  } catch { return null; }
}

// ---------- Host (listen server) ----------
export class HostServer {
  constructor(R, code, me, cb, init) {
    this.R = R; this.code = code; this.cb = cb; this.me = me; this.sid = rid(); this.st = 'lobby'; this.sent = new Map(); this.fog = true; this.ranked = false;
    this.slots = [
      { t: 'h', team: 1, host: 1, by: me.id || null, nm: me.nm || '', pick: validPick(me.pick) },
      { t: 'o', team: 1, pick: 'random' }, { t: 'a', team: 2, pick: 'random' }, { t: 'c', team: 2, pick: 'random' },
    ];
    this.mapCode = ''; this.mapName = '';
    if (init) { Object.assign(this, { sid: init.sid, st: 'game', slots: init.slots, fog: init.fog, ranked: !!init.ranked, mapCode: encodeMap(init.map), mapName: init.map.name, maxSlots: init.map.starts.length }); }
    this.unsub = [R.onPeers(ch => this.onPeers(ch)), R.on('cmd', m => this.onCmd(m))];
    this.canSend = true;
    if (init) this.push();
  }
  setMap(map) { this.mapCode = encodeMap(map); this.mapName = map.name; this.maxSlots = map.starts.length; this.fixSlots(); this.push(); }
  fixSlots() { this.slots.forEach((s, i) => { if (i >= this.maxSlots && s.t !== 'h') Object.assign(s, { t: 'c', peer: null, by: null, nm: '' }); }); }
  push() {
    const lob = { st: this.st, sid: this.sid, map: this.mapName, max: this.maxSlots, fog: this.fog ? 1 : 0, ranked: this.ranked ? 1 : 0,
      slots: this.slots.map(s => ({ t: s.t, team: s.team, peer: s.peer || null, by: s.by || null, nm: s.nm || '', host: s.host ? 1 : 0, gone: s.gone ? 1 : 0, pick: s.pick || 'random', hero: s.hero || null })) };
    this.R.presence({ role: 'host', code: this.code, lob }).catch(() => {});
    this.cb.change();
  }
  slotOf(p) { return this.slots.findIndex(s => s.t === 'h' && !s.host && ((p.by && s.by === p.by) || (p.peer && s.peer === p.peer))); }
  onPeers(ch) {
    let dirty = false;
    for (const p of [...ch.joined, ...ch.updated]) {
      if (p.sameTab || p.kind !== 'viewer') continue;
      const pr = p.presence || {};
      if (pr.role !== 'client' || pr.code !== this.code) continue;
      let i = this.slotOf(p);
      if (i >= 0) {
        const s = this.slots[i]; if (s.peer !== p.peer || s.gone) { s.peer = p.peer; s.gone = 0; dirty = true; }
        const nm = str(pr.nm); if (nm !== s.nm) { s.nm = nm; dirty = true; }
        if (this.st === 'lobby' && pr.pick && validPick(pr.pick) !== s.pick) { s.pick = validPick(pr.pick); dirty = true; }
      } else if (this.st === 'lobby') {
        i = this.slots.findIndex((s, j) => s.t === 'o' && j < this.maxSlots);
        if (i >= 0) { Object.assign(this.slots[i], { t: 'h', peer: p.peer, by: p.by || null, nm: str(pr.nm), gone: 0, pick: validPick(pr.pick) }); dirty = true; }
      }
      if (this.st === 'game' && (pr.need === this.sid || ch.joined.includes(p))) this.sendStart(p.peer);
    }
    for (const p of ch.left) {
      const i = this.slots.findIndex(s => s.peer === p.peer && !s.host);
      if (i < 0) continue;
      if (this.st === 'lobby') Object.assign(this.slots[i], { t: 'o', peer: null, by: null, nm: '' }); else this.slots[i].gone = 1;
      dirty = true;
    }
    if (dirty) this.push();
  }
  setSlot(i, patch) {
    const s = this.slots[i]; if (!s || s.host) return;
    if (patch.t && s.t === 'h' && patch.t !== 'h') Object.assign(s, { peer: null, by: null, nm: '' });
    Object.assign(s, patch); this.push();
  }
  // Resolves random picks; returns the slot list the Sim needs.
  start() {
    this.st = 'game'; this.sid = rid();
    this.slots.forEach(s => { s.hero = s.t === 'h' || s.t === 'a' ? (s.pick && s.pick !== 'random' ? s.pick : randomHero()) : null; });
    this.push(); this.sendStart(null);
    return this.slots.map(s => ({ t: s.t === 'o' ? 'c' : s.t, team: s.team, hero: s.hero || 'warden' }));
  }
  sendStart(peer) {
    const now = Date.now(), last = this.sent.get(peer || '*') || 0; if (now - last < 1500) return; this.sent.set(peer || '*', now);
    const c = this.mapCode, n = Math.ceil(c.length / 3000);
    for (let i = 0; i < n; i++) this.emit('map', { sid: this.sid, i, n, c: c.slice(i * 3000, (i + 1) * 3000) });
    this.emit('start', { sid: this.sid, fog: this.fog ? 1 : 0, ranked: this.ranked ? 1 : 0, slots: this.slots.map(s => ({ t: s.t === 'o' ? 'c' : s.t, team: s.team, peer: s.peer || null, by: s.by || null, hero: s.hero || null })) });
  }
  emit(topic, data) {
    this.R.emit(topic, data).catch(e => { if (e && e.code === 'not_permitted' && this.canSend) { this.canSend = false; this.cb.error('send'); } });
  }
  broadcast(snap) {
    for (const part of encodeSnap(snap, Math.round(snap.t * 20))) this.emit('snap', { sid: this.sid, ...part });
  }
  onCmd(m) {
    if (this.st !== 'game' || !m.data || m.data.sid !== this.sid || m.sameTab) return;
    const i = this.slotOf(m); if (i < 0) return;
    this.cb.command(i, m.data.c);
  }
  close() { this.unsub.forEach(f => f && f()); this.R.leave().catch(() => {}); }
}

// ---------- Client ----------
export class ClientConn {
  constructor(R, code, me, cb) {
    this.R = R; this.code = code; this.me = me; this.cb = cb; this.hostPeer = null; this.lob = null; this.myPeer = null;
    this.map = { sid: null, parts: [] }; this.startMsg = null; this.started = null; this.snaps = new Map(); this.lastSeq = 0; this.hadHost = false;
    this.unsub = [
      R.onPeers(() => this.scan()),
      R.on('map', m => this.onMap(m)), R.on('start', m => this.onStart(m)), R.on('snap', m => this.onSnap(m)),
    ];
    this.pres = { role: 'client', code, nm: str(me.nm), need: null, pick: validPick(me.pick), ing: null };
    R.presence(this.pres).catch(() => {});
    this.timer = setTimeout(() => { if (!this.hostPeer) this.cb.noHost(); }, 7000);
  }
  scan() {
    const peers = this.R.peers();
    const mine = peers.find(p => p.sameTab); if (mine) this.myPeer = mine.peer;
    const hosts = peers.filter(p => !p.sameTab && p.presence && p.presence.role === 'host' && p.presence.code === this.code).sort((a, b) => a.peer < b.peer ? -1 : 1);
    const h = hosts[0];
    if (!h) { if (this.hadHost) { this.hadHost = false; this.cb.hostLost(); } return; }
    if (this.hostPeer && this.hostPeer !== h.peer) { this.lastSeq = 0; this.snaps.clear(); }
    if (!this.hadHost && this.started) this.cb.hostBack && this.cb.hostBack();
    this.hadHost = true; this.hostPeer = h.peer; this.hostBy = h.by;
    const lob = h.presence.lob; if (!lob || !Array.isArray(lob.slots)) return;
    this.lob = lob;
    this.mySlot = lob.slots.findIndex(s => s && s.t === 'h' && !s.host && ((s.peer && s.peer === this.myPeer) || (s.by && this.me.id && s.by === this.me.id)));
    this.cb.lobby(lob, this.mySlot, h);
    if (lob.st === 'game' && this.started !== lob.sid && this.pres.need !== lob.sid) { this.pres.need = lob.sid; this.R.presence({ need: lob.sid }).catch(() => {}); }
  }
  fromHost(m) { return m.peer === this.hostPeer && m.data && typeof m.data === 'object'; }
  onMap(m) {
    if (!this.fromHost(m)) return;
    const { sid, i, n, c } = m.data; if (typeof c !== 'string' || !(n > 0 && n < 8)) return;
    if (this.map.sid !== sid) this.map = { sid, parts: [] };
    this.map.parts[i] = c; this.map.n = n; this.tryStart();
  }
  onStart(m) { if (!this.fromHost(m)) return; this.startMsg = m.data; this.tryStart(); }
  tryStart() {
    const s = this.startMsg; if (!s || this.started === s.sid || this.map.sid !== s.sid) return;
    if (this.map.parts.filter(p => typeof p === 'string').length !== this.map.n) return;
    const map = decodeMap(this.map.parts.join('')); if (!map) return;
    const slots = Array.isArray(s.slots) ? s.slots.slice(0, 4).map(x => x && typeof x === 'object' ? x : {}) : [];
    const mySlot = slots.findIndex(x => x && x.t === 'h' && ((x.peer && x.peer === this.myPeer) || (x.by && this.me.id && x.by === this.me.id)));
    this.started = s.sid; this.sid = s.sid; this.snaps.clear(); this.lastSeq = 0;
    this.pres.need = null; this.pres.ing = s.sid; this.R.presence({ need: null, ing: s.sid }).catch(() => {});
    this.cb.start(map, slots.map(x => ({ t: ['h', 'a', 'c'].includes(x.t) ? x.t : 'c', team: Math.max(1, Math.min(4, +x.team || 1)), hero: KI[x.hero] && KI[x.hero].hero ? x.hero : 'warden' })), mySlot, !!s.fog, !!s.ranked);
  }
  onSnap(m) {
    if (!this.fromHost(m) || m.data.sid !== this.sid) return;
    const p = m.data; if (!(p.n > 0 && p.n < 16) || !(p.s > this.lastSeq)) return;
    let set = this.snaps.get(p.s); if (!set) { set = []; this.snaps.set(p.s, set); }
    set[p.i] = p;
    if (set.filter(Boolean).length === p.n && set[0]) {
      this.lastSeq = p.s;
      for (const k of this.snaps.keys()) if (k <= p.s) this.snaps.delete(k);
      const snap = decodeSnap(set); if (snap) this.cb.snap(snap);
    }
  }
  setPick(p) { this.pres.pick = validPick(p); this.R.presence({ pick: this.pres.pick }).catch(() => {}); }
  // Candidates to take over hosting: clients in this game, lowest peer label first.
  successor() {
    return this.R.peers().filter(p => p.kind === 'viewer' && p.presence && p.presence.role === 'client' && p.presence.code === this.code && p.presence.ing === this.sid)
      .sort((a, b) => a.peer < b.peer ? -1 : 1)[0] || null;
  }
  send(c) {
    if (!this.sid) return;
    this.R.emit('cmd', { sid: this.sid, c }).catch(e => { if (e && e.code === 'not_permitted') this.cb.error('send'); });
  }
  close(leaveRoom = true) { clearTimeout(this.timer); this.unsub.forEach(f => f && f()); if (leaveRoom) this.R.leave().catch(() => {}); }
}
