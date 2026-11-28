// Authoritative game simulation. Runs only on the host (listen server) or offline.
import { KINDS, KI, TILES, footprint, HERO_XP, heroMaxHp, heroMaxMana, FACTIONS, ABIL, CAMPS, CREEP, NEUTRAL, heroFac, upgradable } from './data.js';

export const TICK = 0.05;
const ACQ = 6;
const ADJ = 0.8;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const num = (v, a, b) => clamp(Number.isFinite(+v) ? +v : 0, a, b);
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

class Heap {
  constructor() { this.i = []; this.f = []; }
  get size() { return this.i.length; }
  clear() { this.i.length = 0; this.f.length = 0; }
  push(i, f) {
    const I = this.i, F = this.f; let n = I.length; I.push(i); F.push(f);
    while (n > 0) { const p = (n - 1) >> 1; if (F[p] <= F[n]) break; [I[p], I[n]] = [I[n], I[p]]; [F[p], F[n]] = [F[n], F[p]]; n = p; }
  }
  pop() {
    const I = this.i, F = this.f, top = I[0], li = I.pop(), lf = F.pop();
    if (I.length) {
      I[0] = li; F[0] = lf; let n = 0;
      for (;;) {
        const l = 2 * n + 1, r = l + 1; let m = n;
        if (l < I.length && F[l] < F[m]) m = l; if (r < I.length && F[r] < F[m]) m = r;
        if (m === n) break; [I[m], I[n]] = [I[n], I[m]]; [F[m], F[n]] = [F[n], F[m]]; n = m;
      }
    }
    return top;
  }
}

export class Sim {
  constructor(map, slots, opts = {}) {
    this.map = map; const w = this.w = map.w, h = this.h = map.h;
    this.blk = new Uint8Array(w * h); this.occ = new Int32Array(w * h);
    for (let i = 0; i < w * h; i++) if (!TILES[map.tiles[i]].walk) this.blk[i] = 1;
    this.tree = new Map();
    for (const t of map.trees) if (!this.blk[t]) { this.blk[t] = 2; this.tree.set(t, 50); }
    this.removedTrees = [];
    this.gS = new Float32Array(w * h); this.came = new Int32Array(w * h);
    this.stamp = new Uint32Array(w * h); this.cst = new Uint32Array(w * h); this.gen = 0; this.heap = new Heap();
    this.ents = new Map(); this.nextId = 1; this.time = 0; this.tickN = 0;
    this.fx = []; this.fxId = 1; this.pending = []; this.over = null;
    this.camps = (map.camps || []).map(([x, y]) => ({ x: x + .5, z: y + .5 }));
    this.players = slots.map((s, i) => {
      const hero = KI[s.hero] && KI[s.hero].hero ? s.hero : 'warden', fac = heroFac(hero);
      return { slot: i, t: s.t, team: s.team, on: s.t === 'h' || s.t === 'a', g: 500, l: 200, used: 0, cap: 0, alive: false, ai: null, hero, fac, F: FACTIONS[fac], up: { w: 0, a: 0 } };
    });
    if (opts.empty) return;
    for (const [x, y] of map.mines) { const e = this.placeBuilding('mine', NEUTRAL, x, y, true); if (e) e.gold = 6000; }
    (map.camps || []).forEach(([x, y, lvl], ci) => {
      (CAMPS[lvl] || CAMPS[1]).forEach((kid, j) => {
        const a = j / 3 * 6.283, px = x + .5 + Math.cos(a) * 0.9, pz = y + .5 + Math.sin(a) * 0.9;
        const e = this.addEnt(KI[kid], CREEP, this.walkAt(px, pz) ? px : x + .5, this.walkAt(px, pz) ? pz : y + .5);
        e.camp = ci; e.face = Math.random() * 6.28;
      });
    });
    let si = 0;
    for (const p of this.players) {
      if (!p.on) continue;
      const st = map.starts[si++];
      const hall = st && this.placeBuilding(p.F.hall, p.slot, st[0], st[1], true);
      if (!hall) { p.on = false; continue; }
      p.alive = true;
      const mine = this.nearestMine(hall.x, hall.z, 20);
      for (let k = 0; k < 5; k++) { const w = this.spawnNear(hall, p.F.worker, p.slot); if (mine) w.ord = { k: 'gather', r: 'g', m: mine.id, ph: 'to' }; }
      this.spawnNear(hall, p.hero, p.slot);
      if (p.t === 'a') p.ai = new AI(this, p);
    }
    this.calcFood();
  }

  // Rebuild an authoritative sim from a client's last snapshot (host migration). Orders are not in snapshots, so units resume idle.
  static fromSnapshot(map, slots, s) {
    const sim = new Sim(map, slots, { empty: true });
    sim.time = s.t; sim.tickN = Math.round(s.t * 20);
    for (const t of s.tr) if (sim.tree.has(t)) sim.removeTree(t);
    s.r.forEach((r, i) => { const P = sim.players[i]; if (!P || !r) return; P.g = r[0] | 0; P.l = r[1] | 0; P.alive = r[4] === 1; P.up = { w: r[6] | 0, a: r[7] | 0 }; if (!P.alive) P.on = P.on && r[4] === 2; });
    const nearCamp = (x, z) => { let bi = 0, bd = 1e9; sim.camps.forEach((c, i) => { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; bi = i; } }); return bi; };
    for (const d of s.ents) {
      const k = KINDS[d.k]; if (!k || k.research) continue;
      if (k.b) {
        const e = sim.placeBuilding(k.id, d.o, Math.floor(d.x), Math.floor(d.z), true, d.id); if (!e) continue;
        e.hp = d.hp; if (d.st === 'c') e.bp = Math.max(0.02, d.ex / 63);
        if (k.neutral) e.gold = d.ex * 100;
        const q = s.q[d.id]; if (Array.isArray(q)) { e.q = q.slice(1).map(i => KINDS[i] && KINDS[i].id).filter(Boolean); if (e.q.length) e.qt = (q[0] / 100) * KI[e.q[0]].bt; }
      } else {
        const e = sim.addEnt(k, d.o, d.x, d.z, d.id); e.hp = d.hp; e.face = d.face;
        if (k.hero) { const hs = s.hs[d.id] || []; e.lvl = hs[1] || 1; e.xp = hs[3] || 0; e.mana = hs[0] || 0; e.cds = [(hs[2] || 0) / 10, (hs[5] || 0) / 10]; if (d.st === 'd') { e.st = 'd'; e.resp = hs[4] || 5; } }
        if (k.creep) e.camp = nearCamp(d.x, d.z);
        if (k.summon) e.life = 15;
        if (k.worker && d.o < 4) { if (d.ex) { e.carry = 10; e.ct = d.ex === 1 ? 'g' : 'l'; } e.ord = { k: 'gather', r: d.ex === 2 ? 'l' : 'g', m: 0, tr: -1, ph: d.ex ? 'back' : 'to' }; }
      }
    }
    let maxId = 0; for (const id of sim.ents.keys()) maxId = Math.max(maxId, id); sim.nextId = maxId % 4095 + 1;
    for (const P of sim.players) if (P.on && P.alive && P.t === 'a') P.ai = new AI(sim, P);
    sim.calcFood();
    return sim;
  }

  // ---------- grid ----------
  walk(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.blk[y * this.w + x] === 0; }
  walkAt(x, z) { return this.walk(Math.floor(x), Math.floor(z)); }
  areaFree(f, force) {
    for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      const b = this.blk[y * this.w + x];
      if (b === 1 || b === 3 || (b === 2 && !force)) return false;
    }
    return true;
  }
  // stricter check used by the AI so bases keep lanes open
  areaRoomy(f) {
    if (!this.areaFree(f, false)) return false;
    for (let y = f.y0 - 1; y <= f.y1 + 1; y++) for (let x = f.x0 - 1; x <= f.x1 + 1; x++) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      if (this.blk[y * this.w + x] === 3) return false;
    }
    for (const m of this.ents.values()) if (m.k.neutral && Math.abs(m.x - f.cx) < 4.5 && Math.abs(m.z - f.cz) < 4.5) return false;
    return true;
  }
  los(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0); if (d < 1e-3) return true;
    const n = Math.ceil(d / 0.25), px = -(z1 - z0) / d * 0.3, pz = (x1 - x0) / d * 0.3;
    for (let k = 1; k <= n; k++) {
      const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n;
      if (!this.walkAt(x, z) || !this.walkAt(x + px, z + pz) || !this.walkAt(x - px, z - pz)) return false;
    }
    return true;
  }
  nearestWalk(i) {
    const w = this.w, x0 = i % w, y0 = (i / w) | 0;
    for (let r = 1; r < 12; r++) {
      let best = -1, bd = 1e9;
      for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) {
        if (Math.max(Math.abs(x - x0), Math.abs(y - y0)) !== r || !this.walk(x, y)) continue;
        const d = Math.hypot(x - x0, y - y0); if (d < bd) { bd = d; best = y * w + x; }
      }
      if (best >= 0) return best;
    }
    return i;
  }

  findPath(sx, sz, gx, gz, rect) {
    const w = this.w, h = this.h;
    let s = clamp(Math.floor(sz), 0, h - 1) * w + clamp(Math.floor(sx), 0, w - 1);
    if (this.blk[s]) s = this.nearestWalk(s);
    let goalTest, hf, exactGoal = false;
    if (rect) {
      goalTest = i => { const x = i % w, y = (i / w) | 0; return x >= rect.x0 - 1 && x <= rect.x1 + 1 && y >= rect.y0 - 1 && y <= rect.y1 + 1; };
      hf = i => { const x = i % w, y = (i / w) | 0, dx = Math.max(rect.x0 - 1 - x, 0, x - rect.x1 - 1), dy = Math.max(rect.y0 - 1 - y, 0, y - rect.y1 - 1); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    } else {
      let g = clamp(Math.floor(gz), 0, h - 1) * w + clamp(Math.floor(gx), 0, w - 1);
      if (this.blk[g]) g = this.nearestWalk(g); else exactGoal = true;
      const gxi = g % w, gyi = (g / w) | 0;
      goalTest = i => i === g;
      hf = i => { const dx = Math.abs(i % w - gxi), dy = Math.abs(((i / w) | 0) - gyi); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    }
    if (goalTest(s)) return rect ? [] : [[exactGoal ? gx : (s % w) + .5, exactGoal ? gz : ((s / w) | 0) + .5]];
    const gen = ++this.gen, { gS, came, stamp, cst } = this, open = this.heap; open.clear();
    gS[s] = 0; stamp[s] = gen; came[s] = -1; open.push(s, hf(s));
    let best = s, bestH = hf(s), found = -1, iter = 0;
    while (open.size && iter++ < 3000) {
      const c = open.pop();
      if (cst[c] === gen) continue; cst[c] = gen;
      if (goalTest(c)) { found = c; break; }
      const cx = c % w, cy = (c / w) | 0;
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.walk(nx, ny)) continue;
        if (dx && dy && (!this.walk(cx + dx, cy) || !this.walk(cx, cy + dy))) continue;
        const ni = ny * w + nx; if (cst[ni] === gen) continue;
        const ng = gS[c] + cost;
        if (stamp[ni] !== gen || ng < gS[ni]) {
          stamp[ni] = gen; gS[ni] = ng; came[ni] = c; const hh = hf(ni); open.push(ni, ng + hh);
          if (hh < bestH) { bestH = hh; best = ni; }
        }
      }
    }
    const end = found >= 0 ? found : best, tiles = [];
    for (let c = end; c !== -1 && tiles.length < 400; c = came[c]) tiles.push(c);
    tiles.reverse(); tiles.shift();
    const pts = tiles.map(i => [i % w + .5, ((i / w) | 0) + .5]);
    if (found >= 0 && exactGoal && pts.length) pts[pts.length - 1] = [gx, gz];
    if (!pts.length) return [];
    const out = []; let ax = sx, az = sz, i = 0;
    while (i < pts.length) {
      let j = i;
      while (j + 1 < pts.length && this.los(ax, az, pts[j + 1][0], pts[j + 1][1])) j++;
      out.push(pts[j]); ax = pts[j][0]; az = pts[j][1]; i = j + 1;
    }
    return out;
  }

  // ---------- entities ----------
  addEnt(k, o, x, z, fixedId) {
    let id = fixedId;
    if (!id || this.ents.has(id)) { id = this.nextId; while (this.ents.has(id)) id = id % 4095 + 1; this.nextId = id % 4095 + 1; }
    const e = { id, k, o, x, z, hp: k.hp, face: 0, st: 'i', ac: 0, tg: 0, cd: 0, ord: null };
    if (k.u) Object.assign(e, { path: null, pkey: null, mvx: 0, mvz: 0, carry: 0, ct: null, slowT: 0, rootT: 0, rallyT: 0, frenzyT: 0, acqT: Math.random() * 0.4, castT: 0 });
    if (k.hero) Object.assign(e, { lvl: 1, xp: 0, mana: k.mana, cds: [0, 0], resp: 0 });
    this.ents.set(id, e); return e;
  }
  placeBuilding(kind, o, tx, ty, force, fixedId) {
    const k = KI[kind], f = footprint(k.size, tx, ty);
    if (!this.areaFree(f, force)) return null;
    const e = this.addEnt(k, o, f.cx, f.cz, fixedId);
    e.f = f; e.bp = force ? 1 : 0; e.hp = force ? k.hp : Math.max(1, k.hp * 0.1); e.q = []; e.qt = 0; e.rally = null;
    for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) {
      const i = y * this.w + x;
      if (this.blk[i] === 2) { this.tree.delete(i); this.removedTrees.push(i); }
      this.blk[i] = 3; this.occ[i] = e.id;
    }
    for (const u of this.ents.values()) if (u.k.u && u.st !== 'd' && u.x > f.x0 - u.k.r && u.x < f.x1 + 1 + u.k.r && u.z > f.y0 - u.k.r && u.z < f.y1 + 1 + u.k.r) {
      const p = this.freeSpotNear(f, null); u.x = p[0]; u.z = p[1]; u.path = null; u.pkey = null;
    }
    return e;
  }
  freeFoot(e) {
    const f = e.f;
    for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) { const i = y * this.w + x; if (this.occ[i] === e.id) { this.blk[i] = 0; this.occ[i] = 0; } }
  }
  unitNear(x, z, r) { for (const e of this.ents.values()) if (e.k.u && e.st !== 'd' && Math.abs(e.x - x) < r && Math.abs(e.z - z) < r) return true; return false; }
  freeSpotNear(f, pref) {
    for (let ring = 1; ring <= 7; ring++) {
      let best = null, bd = 1e9;
      for (let y = f.y0 - ring; y <= f.y1 + ring; y++) for (let x = f.x0 - ring; x <= f.x1 + ring; x++) {
        if (x > f.x0 - ring && x < f.x1 + ring && y > f.y0 - ring && y < f.y1 + ring) continue;
        if (!this.walk(x, y)) continue;
        const cx = x + .5, cz = y + .5;
        if (this.unitNear(cx, cz, 0.5)) continue;
        const d = pref ? Math.hypot(cx - pref.x, cz - pref.z) : Math.hypot(cx - f.cx, cz - (f.cz + 6));
        if (d < bd) { bd = d; best = [cx, cz]; }
      }
      if (best) return best;
    }
    return [f.cx, Math.min(this.h - 1, f.y1 + 1.5)];
  }
  spawnNear(b, kind, o) { const p = this.freeSpotNear(b.f, b.rally); const e = this.addEnt(KI[kind], o, p[0], p[1]); e.face = 0; return e; }
  team(o) { return o >= 0 && o < 4 ? this.players[o].team : -1; }
  isEnemy(a, b) {
    if (a.o === NEUTRAL || b.o === NEUTRAL) return false;
    if (a.o === CREEP || b.o === CREEP) return a.o !== b.o;
    return this.team(a.o) !== this.team(b.o);
  }
  armor(e) { const P = this.players[e.o]; return (e.k.armor || 0) + (P && upgradable(e.k) ? P.up.a * 2 : 0) + (e.rallyT > 0 ? 3 : 0); }
  alive(e) { return e && e.hp > 0 && e.st !== 'd'; }
  rectGap(a, f) {
    const dx = Math.max(f.x0 - a.x, 0, a.x - (f.x1 + 1)), dz = Math.max(f.y0 - a.z, 0, a.z - (f.y1 + 1));
    return Math.hypot(dx, dz) - (a.k.r || 0);
  }
  gap(a, b) {
    if (b.k.b) return this.rectGap(a, b.f);
    if (a.k.b) return this.rectGap(b, a.f);
    return Math.hypot(a.x - b.x, a.z - b.z) - a.k.r - b.k.r;
  }
  acquire(e, range) {
    let best = null, bs = 1e9;
    for (const t of this.ents.values()) {
      if (!this.alive(t) || !this.isEnemy(e, t)) continue;
      if (Math.abs(t.x - e.x) > range + 3 || Math.abs(t.z - e.z) > range + 3) continue;
      if (e.o === CREEP && this.camps[e.camp] && Math.hypot(t.x - this.camps[e.camp].x, t.z - this.camps[e.camp].z) > 8) continue;
      const g = this.gap(e, t); if (g > range) continue;
      const s = g + (t.k.b ? 4 : 0) + (t.k.worker ? 1 : 0);
      if (s < bs) { bs = s; best = t; }
    }
    return best;
  }
  maxHp(e) { return e.k.hero ? heroMaxHp(e.k, e.lvl) : e.k.hp; }
  fxAdd(k, x, z, o, v) {
    if ((k === 'err' || k === 'dep' || k === 'trained') && (!this.players[o] || this.players[o].t !== 'h')) return;
    if (k === 'trained') return;
    this.fx.push({ i: this.fxId++, k, x, z, o, v, t: this.time });
  }

  // ---------- commands (validated: input is untrusted) ----------
  setOrder(e, ord) {
    if (e.ord && e.ord.k === 'build' && !e.ord.bid) this.refund(e.o, KI[e.ord.kind]);
    e.ord = ord; e.path = null; e.pkey = null; e.tg = 0;
  }
  refund(o, k) { const P = this.players[o]; P.g += k.cost[0]; P.l += k.cost[1]; }
  spend(P, k, food) {
    if (P.g < k.cost[0]) return 2;
    if (P.l < k.cost[1]) return 3;
    if (food && P.used + (k.food || 0) > P.cap) return 4;
    P.g -= k.cost[0]; P.l -= k.cost[1]; return 0;
  }
  command(slot, c) {
    const P = this.players[slot];
    if (!P || !P.on || !P.alive || this.over || !c || typeof c !== 'object') return;
    const units = (Array.isArray(c.u) ? c.u.slice(0, 48) : []).map(id => this.ents.get(id | 0)).filter(e => e && e.o === slot && e.k.u && e.st !== 'd');
    const x = num(c.x, 0.3, this.w - 0.3), z = num(c.z, 0.3, this.h - 0.3);
    switch (c.k) {
      case 'm': case 'a': this.groupMove(units, x, z, c.k === 'm' ? 'move' : 'amove'); break;
      case 't': {
        const t = this.ents.get(c.t | 0); if (!this.alive(t)) break;
        for (const e of units) this.setOrder(e, this.isEnemy(e, t) ? { k: 'attack', t: t.id } : { k: 'move', x: t.x, z: t.z });
        break;
      }
      case 'g': {
        const m = this.ents.get(c.t | 0), tree = c.tree | 0;
        for (const e of units) {
          if (!e.k.worker) { this.setOrder(e, { k: 'move', x, z }); continue; }
          let o = null;
          if (m && m.k.neutral) o = { k: 'gather', r: 'g', m: m.id };
          else if (this.tree.has(tree)) o = { k: 'gather', r: 'l', tr: tree };
          else if (this.drop(e, c.t | 0)) o = { k: 'gather', r: e.ct === 'l' ? 'l' : 'g', m: 0, tr: -1, ph: 'back' };
          if (!o) { this.setOrder(e, { k: 'move', x, z }); continue; }
          o.ph = o.ph || (e.carry ? 'back' : 'to');
          this.setOrder(e, o);
        }
        break;
      }
      case 'b': {
        const k = KI[c.kind]; if (!k || !P.F.build.includes(k.id)) break;
        const e = units.find(u => u.k.worker); if (!e) break;
        const tx = num(c.x, 0, this.w - 1) | 0, ty = num(c.z, 0, this.h - 1) | 0;
        if (!this.areaFree(footprint(k.size, tx, ty), false)) { this.fxAdd('err', e.x, e.z, slot, 1); break; }
        const err = this.spend(P, k, false); if (err) { this.fxAdd('err', e.x, e.z, slot, err); break; }
        this.setOrder(e, { k: 'build', kind: k.id, tx, ty });
        break;
      }
      case 's': for (const e of units) { this.setOrder(e, null); e.st = 'i'; } break;
      case 'c': {
        const ab = ABIL[c.ab], e = ab && units.find(u => u.k.hero && u.k.abil.includes(c.ab)); if (!e) break;
        const i = e.k.abil.indexOf(c.ab);
        if (e.lvl < (ab.lvl || 1) || e.mana < ab.mana || e.cds[i] > 0) break;
        if (ab.tgt === 'point') this.setOrder(e, { k: 'cast', ab: c.ab, x, z }); else this.cast(e, c.ab, x, z);
        break;
      }
      case 'r': case 'x': case 'p': {
        const b = this.ents.get(c.b | 0); if (!b || b.o !== slot || !b.k.b || b.bp < 1) break;
        if (c.k === 'p') { b.rally = { x, z }; break; }
        if (c.k === 'x') { const kid = b.q.pop(); if (kid) this.refund(slot, KI[kid]); if (!b.q.length) b.qt = 0; break; }
        const k = KI[c.kind]; if (!k) break;
        if (k.research) { if (!b.k.research || !this.canResearch(P, k)) break; }
        else if (!(b.k.trains || []).includes(k.id)) break;
        if (b.q.length >= 5) { this.fxAdd('err', b.x, b.z, slot, 5); break; }
        const err = this.spend(P, k, !k.research); if (err) { this.fxAdd('err', b.x, b.z, slot, err); break; }
        b.q.push(k.id); P.used += k.food || 0;
        break;
      }
    }
  }
  researching(P, track) { for (const b of this.ents.values()) if (b.o === P.slot && b.q) for (const q of b.q) if (KI[q].research === track) return true; return false; }
  canResearch(P, k) { return P.up[k.research] === k.lvl - 1 && !this.researching(P, k.research); }
  drop(e, id) { const h = this.ents.get(id); return e.carry && h && h.o === e.o && h.k.drop && h.bp >= 1; }
  groupMove(units, x, z, kind) {
    if (!units.length) return;
    let cx = 0, cz = 0; for (const e of units) { cx += e.x; cz += e.z; } cx /= units.length; cz /= units.length;
    const spread = Math.sqrt(units.length) * 0.55;
    for (const e of units) {
      let ox = e.x - cx, oz = e.z - cz; const l = Math.hypot(ox, oz);
      if (l > spread) { ox *= spread / l; oz *= spread / l; }
      let tx = x + ox, tz = z + oz;
      if (units.length === 1 || !this.walkAt(tx, tz)) { tx = x; tz = z; }
      this.setOrder(e, { k: kind, x: tx, z: tz });
    }
  }
  cast(e, ab, x, z) {
    const A = ABIL[ab], i = e.k.abil.indexOf(ab), L = e.lvl;
    if (e.st === 'd' || i < 0 || e.mana < A.mana || e.cds[i] > 0 || L < (A.lvl || 1)) return;
    e.mana -= A.mana; e.cds[i] = A.cd; e.castT = 0.45;
    const near = (cx, cz, r, pred) => { const out = []; for (const t of this.ents.values()) if (t.k.u && this.alive(t) && pred(t) && Math.hypot(t.x - cx, t.z - cz) <= r + t.k.r) out.push(t); return out; };
    const foe = t => this.isEnemy(e, t), friend = t => !this.isEnemy(e, t) && t.o < 4 && this.team(t.o) === this.team(e.o);
    switch (ab) {
      case 'clap': for (const t of near(e.x, e.z, A.radius, foe)) { this.damage(t, A.dmg + A.per * (L - 1), e.id); t.slowT = 3; } this.fxAdd('clap', e.x, e.z, -1, 0); break;
      case 'whirl': for (const t of near(e.x, e.z, A.radius, foe)) this.damage(t, A.dmg + A.per * (L - 1), e.id); this.fxAdd('whirl', e.x, e.z, -1, 0); break;
      case 'rally': for (const t of near(e.x, e.z, A.radius, friend)) t.rallyT = A.dur; this.fxAdd('rally', e.x, e.z, -1, 0); break;
      case 'mend': for (const t of near(e.x, e.z, A.radius, friend)) t.hp = Math.min(this.maxHp(t), t.hp + A.heal + A.per * (L - 1)); this.fxAdd('mend', e.x, e.z, -1, 0); break;
      case 'frenzy': e.frenzyT = A.dur; this.fxAdd('frenzy', e.x, e.z, -1, 0); break;
      case 'sunburst': for (const t of near(x, z, A.radius, foe)) this.damage(t, A.dmg + A.per * (L - 1), e.id); this.fxAdd('sun', x, z, -1, 0); break;
      case 'snare': for (const t of near(x, z, A.radius, foe)) { this.damage(t, A.dmg + A.per * (L - 1), e.id); t.rootT = A.dur; } this.fxAdd('snare', x, z, -1, 0); break;
      case 'wolves': for (let n = 0; n < 2; n++) { const a = e.face + (n ? 1 : -1) * 0.9, px = e.x + Math.sin(a) * 1.2, pz = e.z + Math.cos(a) * 1.2; const w = this.addEnt(KI.spiritwolf, e.o, this.walkAt(px, pz) ? px : e.x, this.walkAt(px, pz) ? pz : e.z); w.life = A.dur; w.face = e.face; } this.fxAdd('wolves', e.x, e.z, -1, 0); break;
    }
  }

  // ---------- movement ----------
  speed(e) { return e.rootT > 0 ? 0 : e.k.spd * (e.slowT > 0 ? 0.5 : 1) * (e.frenzyT > 0 ? 1.2 : 1) * TICK; }
  stepToward(e, x, z) {
    const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz); if (d < 1e-4 || e.rootT > 0) return;
    const s = Math.min(this.speed(e), d); e.mvx = dx / d * s; e.mvz = dz / d * s; e.face = Math.atan2(dx, dz);
  }
  follow(e, gx, gz, rect, tol = 0.3) {
    const key = rect ? `r${rect.x0},${rect.y0}` : `${Math.round(gx * 4)},${Math.round(gz * 4)}`;
    if (e.pkey !== key) { e.pkey = key; e.path = null; e.rep = 0; }
    if (!e.path) { e.path = this.findPath(e.x, e.z, gx, gz, rect); e.pi = 0; e.stk = 0; e.lx = e.x; e.lz = e.z; }
    if (e.pi >= e.path.length) return true;
    const wp = e.path[e.pi], last = e.pi === e.path.length - 1;
    const d = Math.hypot(wp[0] - e.x, wp[1] - e.z);
    if (d < (last ? tol : 0.4)) { e.pi++; return e.pi >= e.path.length; }
    this.stepToward(e, wp[0], wp[1]);
    e.stk += TICK;
    if (e.stk >= 0.6) {
      const moved = Math.hypot(e.x - e.lx, e.z - e.lz);
      if (moved < e.k.spd * 0.6 * 0.25 && !(e.rootT > 0)) { e.rep++; if (e.rep > 4 || (last && d < 1.2)) return true; e.path = null; }
      e.stk = 0; e.lx = e.x; e.lz = e.z;
    }
    return false;
  }
  // Walk next to a footprint rect; true when adjacent. Gives up (returns -1) when unreachable.
  approach(e, f) {
    const g = this.rectGap(e, f);
    if (g <= ADJ) { e.apT = 0; return true; }
    if (this.follow(e, f.x0 + (f.x1 - f.x0 + 1) / 2, f.y0 + (f.y1 - f.y0 + 1) / 2, f, 0.3)) {
      e.apT = (e.apT || 0) + 1;
      if (e.apT > 40 || g > 2.5) { e.apT = 0; return -1; }
      this.stepToward(e, clamp(e.x, f.x0, f.x1 + 1), clamp(e.z, f.y0, f.y1 + 1));
    }
    return false;
  }
  chase(e, t) {
    if (t.k.b) return this.follow(e, t.x, t.z, t.f, 0.3);
    if (Math.hypot(t.x - e.x, t.z - e.z) < 8 && this.los(e.x, e.z, t.x, t.z)) { e.pkey = null; e.path = null; this.stepToward(e, t.x, t.z); return false; }
    return this.follow(e, Math.floor(t.x) + .5, Math.floor(t.z) + .5, null, 0.3);
  }

  // ---------- per-tick updates ----------
  updUnit(e) {
    const dt = TICK, k = e.k;
    if (e.st === 'd') { e.resp -= dt; if (e.resp <= 0) this.respawnHero(e); return; }
    if (e.slowT > 0) e.slowT -= dt; if (e.rootT > 0) e.rootT -= dt; if (e.rallyT > 0) e.rallyT -= dt; if (e.frenzyT > 0) e.frenzyT -= dt;
    if (e.cd > 0) e.cd -= dt;
    if (k.summon && (e.life -= dt) <= 0) { e.hp = 0; return; }
    if (k.hero) { e.mana = Math.min(heroMaxMana(k, e.lvl), e.mana + 0.9 * dt); e.cds[0] = Math.max(0, e.cds[0] - dt); e.cds[1] = Math.max(0, e.cds[1] - dt); e.hp = Math.min(heroMaxHp(k, e.lvl), e.hp + 0.5 * dt); }
    if (e.castT > 0) { e.castT -= dt; e.st = 's'; return; }
    e.st = 'i';
    const o = e.ord, camp = k.creep && this.camps[e.camp];
    if (!o) {
      e.tg = 0;
      if (camp && e.hp < k.hp) e.hp = Math.min(k.hp, e.hp + 4 * dt);
      if (!k.worker && (e.acqT -= dt) <= 0) {
        e.acqT = 0.4; const t = this.acquire(e, k.creep ? 5 : Math.max(ACQ, k.range + 1));
        if (t) e.ord = camp ? { k: 'attack', t: t.id, auto: 1, hx: camp.x, hz: camp.z, leash: 10 } : { k: 'attack', t: t.id, auto: 1, hx: e.x, hz: e.z };
      }
      return;
    }
    switch (o.k) {
      case 'move': if (o.ret) e.hp = Math.min(this.maxHp(e), e.hp + 60 * dt); if (this.follow(e, o.x, o.z, null, 0.3)) e.ord = null; break;
      case 'cast': {
        const A = ABIL[o.ab]; if (!A) { e.ord = null; break; }
        if (Math.hypot(o.x - e.x, o.z - e.z) <= A.range + 0.3) { e.ord = null; e.path = null; e.face = Math.atan2(o.x - e.x, o.z - e.z); this.cast(e, o.ab, o.x, o.z); }
        else this.follow(e, o.x, o.z, null, A.range * 0.8);
        break;
      }
      case 'amove': {
        if ((e.acqT -= dt) <= 0) { e.acqT = 0.4; const t = this.acquire(e, Math.max(ACQ, k.range + 1)); if (t) { e.ord = { k: 'attack', t: t.id, then: o }; break; } }
        if (this.follow(e, o.x, o.z, null, 0.7)) e.ord = null; break;
      }
      case 'attack': this.updAttack(e, o); break;
      case 'gather': this.updGather(e, o); break;
      case 'build': this.updBuild(e, o); break;
      default: e.ord = null;
    }
  }
  updAttack(e, o) {
    const t = this.ents.get(o.t);
    if (!this.alive(t)) { e.ord = o.then || null; e.tg = 0; e.path = null; e.pkey = null; return; }
    if (o.auto && Math.hypot(e.x - o.hx, e.z - o.hz) > (o.leash || 14)) { this.setOrder(e, { k: 'move', x: o.hx, z: o.hz, ret: o.leash ? 1 : 0 }); return; }
    if (this.gap(e, t) <= (t.k.b ? Math.max(e.k.range, ADJ - 0.1) : e.k.range + 0.08)) { e.path = null; e.pkey = null; this.doAttack(e, t); }
    else this.chase(e, t);
  }
  doAttack(e, t) {
    const k = e.k;
    if (k.u) { e.face = Math.atan2(t.x - e.x, t.z - e.z); e.st = 'a'; }
    e.tg = t.id;
    if (e.cd > 0) return;
    e.ac = (e.ac + 1) & 63; e.cd = k.cd * (e.slowT > 0 ? 1.3 : 1) / (e.frenzyT > 0 ? 1.6 : 1);
    const P = this.players[e.o], up = P && upgradable(k) ? P.up.w * 2 : 0;
    const dmg = ((k.hero ? k.dmg + 3 * (e.lvl - 1) : k.dmg) + up) * (e.rallyT > 0 ? 1.25 : 1) * (0.9 + Math.random() * 0.2);
    const delay = k.proj ? Math.hypot(t.x - e.x, t.z - e.z) / 14 + 0.05 : 0.3;
    this.pending.push({ at: this.time + delay, t: t.id, d: dmg, src: e.id });
  }
  damage(t, d, src) {
    if (!this.alive(t)) return;
    const a = this.armor(t); t.hp -= d * (1 - a * 0.06 / (1 + a * 0.06));
    const s = this.ents.get(src); if (s) t.lastO = s.o;
    if (!this.alive(s) || !this.isEnemy(t, s)) return;
    if (t.k.creep) {
      const camp = this.camps[t.camp];
      for (const c of this.ents.values()) if (c.k.creep && c.camp === t.camp && this.alive(c) && (!c.ord || c.ord.k !== 'attack') && !(c.ord && c.ord.ret) && camp)
        c.ord = { k: 'attack', t: s.id, auto: 1, hx: camp.x, hz: camp.z, leash: 10 };
    } else if (t.k.u && !t.ord && !t.k.worker) t.ord = { k: 'attack', t: s.id, auto: 1, hx: t.x, hz: t.z };
  }
  nearestDrop(e) {
    let best = null, bd = 1e9;
    for (const h of this.ents.values()) if (h.o === e.o && h.k.drop && h.bp >= 1) { const d = Math.hypot(h.x - e.x, h.z - e.z); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  nearestMine(x, z, maxR) {
    let best = null, bd = maxR;
    for (const m of this.ents.values()) if (m.k.neutral && m.gold > 0) { const d = Math.hypot(m.x - x, m.z - z); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  exposed(t) { const w = this.w, x = t % w, y = (t / w) | 0; return this.walk(x + 1, y) || this.walk(x - 1, y) || this.walk(x, y + 1) || this.walk(x, y - 1); }
  nearestTree(x, z, maxR, e) {
    let best = -1, bd = maxR;
    for (const t of this.tree.keys()) {
      if (e && e.bad && e.bad.has(t)) continue;
      const tx = t % this.w + .5, tz = ((t / this.w) | 0) + .5;
      if (Math.abs(tx - x) > bd || Math.abs(tz - z) > bd) continue;
      const d = Math.hypot(tx - x, tz - z); if (d < bd && this.exposed(t)) { bd = d; best = t; }
    }
    return best;
  }
  removeTree(t) { this.tree.delete(t); this.blk[t] = 0; this.removedTrees.push(t); }
  updGather(e, o) {
    if (!e.k.worker) { e.ord = null; return; }
    if (o.ph === 'back') {
      if (!e.carry) { o.ph = 'to'; return; }
      const h = this.nearestDrop(e); if (!h) { e.ord = null; return; }
      const ar = this.approach(e, h.f);
      if (ar === true) {
        const P = this.players[e.o]; if (e.ct === 'g') P.g += e.carry; else P.l += e.carry;
        this.fxAdd('dep', e.x, e.z, e.o, e.ct === 'g' ? e.carry : -e.carry);
        e.carry = 0; e.ct = null; o.ph = 'to'; e.pkey = null;
        if (!o.m && o.tr < 0 && o.r === 'g') o.m = (this.nearestMine(e.x, e.z, 18) || {}).id || 0;
      } else if (ar === -1) e.ord = null;
      return;
    }
    if (o.r === 'g') {
      let m = this.ents.get(o.m);
      if (!m || !m.k.neutral || m.gold <= 0) { m = this.nearestMine(e.x, e.z, 18); if (!m) { e.ord = null; return; } o.m = m.id; e.pkey = null; }
      if (o.ph === 'work') {
        e.st = 'g'; e.face = Math.atan2(m.x - e.x, m.z - e.z);
        if ((o.wt -= TICK) <= 0) { const take = Math.min(10, m.gold); m.gold -= take; if (m.gold <= 0) m.hp = 0; e.carry = take; e.ct = 'g'; o.ph = 'back'; e.pkey = null; }
        return;
      }
      const ar = this.approach(e, m.f);
      if (ar === true) { o.ph = 'work'; o.wt = 1.4; e.path = null; e.pkey = null; }
      else if (ar === -1) e.ord = null;
    } else {
      let t = o.tr;
      if (!this.tree.has(t)) { t = this.nearestTree(e.x, e.z, 12, e); if (t < 0) { e.ord = null; return; } o.tr = t; e.pkey = null; }
      const f = { x0: t % this.w, y0: (t / this.w) | 0 }; f.x1 = f.x0; f.y1 = f.y0;
      if (o.ph === 'work') {
        e.st = 'g'; e.face = Math.atan2(f.x0 + .5 - e.x, f.y0 + .5 - e.z);
        if ((o.wt -= TICK) <= 0) {
          const left = this.tree.get(t) - 10; if (left <= 0) this.removeTree(t); else this.tree.set(t, left);
          e.carry = 10; e.ct = 'l'; o.ph = 'back'; e.pkey = null;
        }
        return;
      }
      const ar = this.approach(e, f);
      if (ar === true) { o.ph = 'work'; o.wt = 3.4; e.path = null; e.pkey = null; }
      else if (ar === -1) { (e.bad ||= new Set()).add(t); if (e.bad.size > 30) e.bad.clear(); o.tr = -1; }
    }
  }
  updBuild(e, o) {
    const k = KI[o.kind];
    if (o.bid) {
      const b = this.ents.get(o.bid); if (!b || b.bp >= 1) { e.ord = null; return; }
      const ar = this.approach(e, b.f);
      if (ar === true) { e.st = 'b'; e.face = Math.atan2(b.x - e.x, b.z - e.z); } else if (ar === -1) e.ord = null;
      return;
    }
    const f = footprint(k.size, o.tx, o.ty);
    const ar = this.approach(e, f);
    if (ar === true) {
      if (!this.areaFree(f, false)) { this.refund(e.o, k); this.fxAdd('err', e.x, e.z, e.o, 1); e.ord = null; return; }
      const b = this.placeBuilding(k.id, e.o, o.tx, o.ty, false); o.bid = b.id; e.path = null; e.pkey = null;
      return;
    }
    if (ar === -1) { this.refund(e.o, k); this.fxAdd('err', e.x, e.z, e.o, 1); e.ord = null; }
  }
  respawnHero(e) {
    const h = this.nearestDrop(e); if (!h) { e.resp = 5; return; }
    const p = this.freeSpotNear(h.f, null); e.x = p[0]; e.z = p[1];
    e.hp = heroMaxHp(e.k, e.lvl); e.mana = heroMaxMana(e.k, e.lvl); e.st = 'i'; e.ord = null; e.path = null; e.pkey = null;
    this.fxAdd('lvl', e.x, e.z, -1, 0);
  }
  updBuilding(b) {
    const dt = TICK, k = b.k;
    if (k.neutral) return;
    if (b.bp < 1) {
      b.st = 'c'; b.bp = Math.min(1, b.bp + dt / k.bt); b.hp = Math.min(k.hp, b.hp + k.hp * 0.9 * dt / k.bt);
      if (b.bp >= 1) { b.st = 'i'; this.fxAdd('done', b.x, b.z, b.o, k.i); }
      return;
    }
    if (b.q.length) {
      b.st = 't'; const uk = KI[b.q[0]]; b.qt += dt;
      if (b.qt >= uk.bt) {
        b.q.shift(); b.qt = 0;
        if (uk.research) { const P = this.players[b.o]; P.up[uk.research] = Math.max(P.up[uk.research], uk.lvl); this.fxAdd('upg', b.x, b.z, b.o, uk.i); }
        else {
          const u = this.spawnNear(b, uk.id, b.o);
          if (b.rally) u.ord = { k: 'move', x: b.rally.x, z: b.rally.z };
          this.fxAdd('trained', u.x, u.z, b.o, uk.i);
        }
      }
    } else b.st = 'i';
    if (k.dmg) { if (b.cd > 0) b.cd -= dt; else { const t = this.acquire(b, k.range); if (t) this.doAttack(b, t); else b.tg = 0; } }
  }
  physics() {
    const us = [];
    for (const e of this.ents.values()) if (e.k.u && e.st !== 'd') us.push(e);
    for (const e of us) { e.moving = !!(e.mvx || e.mvz); e.x += e.mvx; e.z += e.mvz; e.mvx = e.mvz = 0; }
    const ghost = e => e.k.worker && e.ord && e.ord.k === 'gather';
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j], dx = b.x - a.x, dz = b.z - a.z, min = a.k.r + b.k.r;
        if (dx > min || dx < -min || dz > min || dz < -min) continue;
        const d2 = dx * dx + dz * dz; if (d2 >= min * min || (ghost(a) && ghost(b))) continue;
        let d = Math.sqrt(d2), nx, nz;
        if (d < 1e-4) { const r = Math.random() * 6.283; nx = Math.cos(r); nz = Math.sin(r); d = 0; } else { nx = dx / d; nz = dz / d; }
        let wa = 0.5, wb = 0.5;
        if (a.moving && !b.moving) { wa = 0.15; wb = 0.85; } else if (!a.moving && b.moving) { wa = 0.85; wb = 0.15; }
        const p = (min - d) * 0.6;
        a.x -= nx * p * wa; a.z -= nz * p * wa; b.x += nx * p * wb; b.z += nz * p * wb;
      }
    }
    for (const e of us) this.collideTiles(e);
  }
  collideTiles(e) {
    const r = e.k.r;
    e.x = clamp(e.x, r, this.w - r); e.z = clamp(e.z, r, this.h - r);
    const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r), z0 = Math.floor(e.z - r), z1 = Math.floor(e.z + r);
    for (let ty = z0; ty <= z1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (this.walk(tx, ty)) continue;
      const cx = clamp(e.x, tx, tx + 1), cz = clamp(e.z, ty, ty + 1);
      const dx = e.x - cx, dz = e.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) {
        const opts = [[tx - r - e.x, 0], [tx + 1 + r - e.x, 0], [0, ty - r - e.z], [0, ty + 1 + r - e.z]];
        opts.sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]));
        e.x += opts[0][0]; e.z += opts[0][1]; continue;
      }
      const d = Math.sqrt(d2); e.x += dx / d * (r - d); e.z += dz / d * (r - d);
    }
  }
  giveXp(h, v) {
    h.xp += v;
    while (h.lvl < 5 && h.xp >= HERO_XP[h.lvl]) { h.lvl++; h.hp += 80; h.mana += 25; this.fxAdd('lvl', h.x, h.z, -1, h.lvl); }
  }
  reap() {
    for (const e of this.ents.values()) {
      if (e.hp > 0 || (e.st === 'd' && this.players[e.o] && this.players[e.o].alive)) continue;
      const val = e.k.xp ?? (e.k.b && !e.k.neutral ? 25 : 0);
      if (val) for (const h of this.ents.values()) if (h.k.hero && h.st !== 'd' && h.hp > 0 && this.isEnemy(h, e) && Math.hypot(h.x - e.x, h.z - e.z) < 12) this.giveXp(h, val);
      if (e.k.bounty && e.lastO >= 0 && e.lastO < 4) { this.players[e.lastO].g += e.k.bounty; this.fxAdd('bounty', e.x, e.z, e.lastO, e.k.bounty); }
      if (e.k.hero && this.players[e.o] && this.players[e.o].alive) { e.st = 'd'; e.resp = 15; e.hp = 0; e.ord = null; e.path = null; continue; }
      if (e.k.b) this.freeFoot(e);
      this.ents.delete(e.id);
    }
  }
  calcFood() {
    for (const P of this.players) { P.used = 0; P.cap = 0; }
    for (const e of this.ents.values()) {
      if (e.o > 3) continue; const P = this.players[e.o];
      if (e.k.u) P.used += e.k.food || 0;
      else if (e.q) { if (e.bp >= 1 && e.k.food) P.cap += e.k.food; for (const q of e.q) P.used += KI[q].food || 0; }
    }
    for (const P of this.players) P.cap = Math.min(P.cap, 100);
  }
  checkEnd() {
    const has = new Set();
    for (const e of this.ents.values()) if (e.k.b && !e.k.neutral && e.o < 4) has.add(e.o);
    for (const P of this.players) if (P.on && P.alive && !has.has(P.slot)) {
      P.alive = false; this.fxAdd('elim', 0, 0, -1, P.slot);
      for (const e of this.ents.values()) if (e.o === P.slot) { e.hp = 0; if (e.st === 'd') e.st = 'i'; }
    }
    const teams = new Set(this.players.filter(p => p.on && p.alive).map(p => p.team));
    if (teams.size <= 1 && !this.over) this.over = { team: teams.size ? [...teams][0] : -1, t: this.time };
  }
  step() {
    if (this.over) return;
    this.time += TICK; this.tickN++;
    for (const P of this.players) if (P.ai && P.alive && (this.tickN + P.slot * 5) % 20 === 0) P.ai.think();
    for (const e of this.ents.values()) { if (e.k.u) this.updUnit(e); else this.updBuilding(e); }
    this.physics();
    if (this.pending.length) {
      const keep = [];
      for (const p of this.pending) { if (p.at <= this.time) this.damage(this.ents.get(p.t), p.d, p.src); else keep.push(p); }
      this.pending = keep;
    }
    this.reap();
    this.calcFood();
    if (this.tickN % 20 === 0) this.checkEnd();
    if (this.fx.length && this.time - this.fx[0].t > 1.5) this.fx = this.fx.filter(f => this.time - f.t <= 1.5);
  }
  snapshot() {
    const ents = [], hs = {}, q = {};
    for (const e of this.ents.values()) {
      let ex = 0;
      if (e.k.b) {
        if (e.k.neutral) ex = Math.min(63, Math.ceil((e.gold || 0) / 100));
        else if (e.bp < 1) ex = Math.round(e.bp * 63);
        else if (e.q.length) ex = Math.round(e.qt / KI[e.q[0]].bt * 63);
        if (e.q && e.q.length) q[e.id] = [Math.round(e.qt / KI[e.q[0]].bt * 100), ...e.q.map(id => KI[id].i)];
      } else if (e.k.hero) { ex = e.lvl; hs[e.id] = [e.mana | 0, e.lvl, Math.max(0, Math.ceil(e.cds[0] * 10)), e.xp, Math.ceil(e.resp), Math.max(0, Math.ceil(e.cds[1] * 10)), (e.rallyT > 0 ? 1 : 0) | (e.frenzyT > 0 ? 2 : 0)]; }
      else if (e.carry) ex = e.ct === 'g' ? 1 : 2;
      ents.push({ id: e.id, k: e.k.i, o: e.o, x: e.x, z: e.z, hp: Math.max(0, Math.ceil(e.hp)), face: e.face, st: e.st, ac: e.ac, tg: e.tg || 0, ex });
    }
    return { t: this.time, r: this.players.map(p => [p.g | 0, p.l | 0, p.used, p.cap, p.on ? (p.alive ? 1 : 2) : 0, p.team, p.up.w, p.up.a, p.fac]),
      hs, q, tr: this.removedTrees, fx: this.fx, ov: this.over, ents };
  }
}

// ---------- Simple computer opponent ----------
class AI {
  constructor(sim, P) { this.s = sim; this.P = P; this.wave = 0; this.next = 190 + Math.random() * 50; }
  cmd(c) { this.s.command(this.P.slot, c); }
  site(kind, near) {
    const k = KI[kind];
    for (let r = 4; r < 13; r++) for (let a = 0; a < 18; a++) {
      const ang = a / 18 * 6.283 + r * 0.7, tx = Math.round(near.x + Math.cos(ang) * r), ty = Math.round(near.z + Math.sin(ang) * r);
      if (this.s.areaRoomy(footprint(k.size, tx, ty))) return [tx, ty];
    }
    return null;
  }
  heroAI(h) {
    const s = this.s; if (h.st === 'd') return;
    h.k.abil.forEach((id, i) => {
      const A = ABIL[id]; if (h.lvl < (A.lvl || 1) || h.mana < A.mana || h.cds[i] > 0) return;
      let foes = 0, hurt = 0, target = null;
      for (const t of s.ents.values()) {
        if (!t.k.u || !s.alive(t)) continue; const d = Math.hypot(t.x - h.x, t.z - h.z);
        if (s.isEnemy(h, t)) { if (d < (A.radius || 3)) foes++; if (A.tgt === 'point' && d < A.range + 1 && (!target || t.k.hero)) target = t; }
        else if (t.o === h.o && d < (A.radius || 4) && t.hp < s.maxHp(t) * 0.6) hurt++;
      }
      const fighting = h.ord && h.ord.k === 'attack';
      const go = A.tgt === 'point' ? !!target : id === 'mend' ? hurt >= 2 || h.hp < s.maxHp(h) * 0.5 : (id === 'rally' || id === 'frenzy' || id === 'wolves') ? fighting : foes >= 2;
      if (go) this.cmd({ k: 'c', u: [h.id], ab: id, x: target ? target.x : h.x, z: target ? target.z : h.z });
    });
  }
  think() {
    const s = this.s, P = this.P, F = P.F, my = [];
    for (const e of s.ents.values()) if (e.o === P.slot) my.push(e);
    const has = id => my.filter(e => e.k.id === id);
    const workers = my.filter(e => e.k.worker), hall = has(F.hall).find(e => e.bp >= 1) || has(F.hall)[0];
    const army = my.filter(e => e.k.u && !e.k.worker && e.st !== 'd' && !e.k.summon);
    const building = id => my.some(e => e.k.id === id && e.bp < 1) || workers.some(w => w.ord && w.ord.k === 'build' && w.ord.kind === id);
    const enemyB = [...s.ents.values()].filter(e => e.k.b && !e.k.neutral && e.o < 4 && s.isEnemy(e, { o: P.slot }));
    for (const h of army) if (h.k.hero) this.heroAI(h);
    if (!hall) { const t = enemyB[0]; if (t) this.cmd({ k: 'a', u: army.map(e => e.id), x: t.x, z: t.z }); return; }
    // economy
    let lum = workers.filter(w => w.ord && w.ord.k === 'gather' && w.ord.r === 'l').length;
    const mine = s.nearestMine(hall.x, hall.z, 30);
    for (const w of workers) if (!w.ord) {
      if (lum < workers.length * 0.25 && P.l < 500) { const t = s.nearestTree(hall.x, hall.z, 16, w); if (t >= 0) { this.cmd({ k: 'g', u: [w.id], tree: t }); lum++; continue; } }
      if (mine) this.cmd({ k: 'g', u: [w.id], t: mine.id });
    }
    if (workers.length < 12 && hall.bp >= 1 && !hall.q.length) this.cmd({ k: 'r', b: hall.id, kind: F.worker });
    const builder = () => workers.find(w => w.ord && w.ord.k === 'gather' && !w.carry) || workers.find(w => !w.ord);
    const tryBuild = kind => {
      const k = KI[kind]; if (P.g < k.cost[0] || P.l < k.cost[1]) return;
      const w = builder(), p = w && this.site(kind, hall); if (p) this.cmd({ k: 'b', u: [w.id], kind, x: p[0], z: p[1] });
    };
    if (P.cap - P.used <= 4 && P.cap < 100 && !building(F.farm)) tryBuild(F.farm);
    else if (!has(F.barracks).length && !building(F.barracks)) tryBuild(F.barracks);
    else if (s.time > 240 && has(F.tower).length < 1 && !building(F.tower)) tryBuild(F.tower);
    else if (s.time > 280 && has(F.forge).length < 1 && !building(F.forge)) tryBuild(F.forge);
    else if (P.g > 650 && has(F.barracks).length < 3 && !building(F.barracks)) tryBuild(F.barracks);
    for (const b of has(F.forge)) if (b.bp >= 1 && !b.q.length && P.g > 260) {
      const k = ['upw1', 'upa1', 'upw2', 'upa2'].map(id => KI[id]).find(k => s.canResearch(P, k));
      if (k) this.cmd({ k: 'r', b: b.id, kind: k.id });
    }
    for (const b of has(F.barracks)) if (b.bp >= 1 && b.q.length < 2) {
      const f = army.filter(e => e.k.role === 'melee').length, a = army.filter(e => e.k.role === 'ranged').length;
      this.cmd({ k: 'r', b: b.id, kind: f <= a * 1.4 ? F.melee : F.ranged });
    }
    // defend
    let threat = null;
    for (const t of s.ents.values()) if (t.k.u && s.alive(t) && t.o < 4 && s.isEnemy(t, hall) && Math.hypot(t.x - hall.x, t.z - hall.z) < 13) { threat = t; break; }
    if (threat) { const idle = army.filter(e => !e.ord || e.ord.k === 'move'); if (idle.length) this.cmd({ k: 'a', u: idle.map(e => e.id), x: threat.x, z: threat.z }); return; }
    // early hero creeping
    const hero = army.find(e => e.k.hero);
    if (hero && !hero.ord && s.time > 90 && s.time < this.next && army.length >= 3) {
      let best = null, bd = 22;
      for (const c of s.ents.values()) if (c.k.creep && s.alive(c)) { const d = Math.hypot(c.x - hall.x, c.z - hall.z); if (d < bd && c.k.id !== 'stonehide') { bd = d; best = c; } }
      if (best) this.cmd({ k: 'a', u: army.map(e => e.id), x: best.x, z: best.z });
    }
    // attack waves
    if (s.time > this.next && army.length >= 5 + this.wave * 2 && enemyB.length) {
      enemyB.sort((a, b) => Math.hypot(a.x - hall.x, a.z - hall.z) - Math.hypot(b.x - hall.x, b.z - hall.z));
      const t = enemyB[0]; this.cmd({ k: 'a', u: army.map(e => e.id), x: t.x, z: t.z });
      this.wave++; this.next = s.time + 70;
    }
  }
}
