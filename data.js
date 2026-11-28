// Shared game data: factions, kinds, abilities, tiles, encoding helpers, map format, default map.
export const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64I = {};
for (let i = 0; i < 64; i++) B64I[B64[i]] = i;
export const enc1 = n => B64[n & 63];
export const enc2 = n => B64[(n >> 6) & 63] + B64[n & 63];
export const dec1 = (s, i) => B64I[s[i]] ?? 0;
export const dec2 = (s, i) => ((B64I[s[i]] ?? 0) << 6) | (B64I[s[i + 1]] ?? 0);

export const TILE = { GRASS: 0, DIRT: 1, ROAD: 2, WATER: 3, ROCK: 4 };
export const TILES = [
  { name: 'Grass', col: '#4f7a2c', h: 0, walk: true },
  { name: 'Dirt', col: '#7a5b36', h: 0, walk: true },
  { name: 'Cobble', col: '#8a8476', h: 0.03, walk: true },
  { name: 'Water', col: '#1d4a5a', h: -0.9, walk: false },
  { name: 'Rock', col: '#6b665c', h: 1.7, walk: false },
];

// owners: 0-3 players, 4 = neutral passive (gold mines), 5 = neutral hostile (creeps)
export const TEAM_COLORS = ['#d8402f', '#2f6fd8', '#22a59a', '#8e4fd1', '#c9b26b', '#8c8c8c'];
export const SLOT_NAMES = ['Red', 'Blue', 'Teal', 'Violet'];
export const CREEP = 5, NEUTRAL = 4;

export const FACTIONS = [
  { id: 'crown', name: 'Ashvale Crown', hall: 'hall', barracks: 'barracks', farm: 'farm', tower: 'tower', forge: 'forge', worker: 'worker', melee: 'footman', ranged: 'archer', heroes: ['warden', 'sage'] },
  { id: 'thorn', name: 'Thornwild Clans', hall: 'lodge', barracks: 'warcamp', farm: 'burrow', tower: 'spire', forge: 'bonecraft', worker: 'gatherer', melee: 'brute', ranged: 'spearman', heroes: ['reaver', 'seer'] },
];
FACTIONS.forEach(f => { f.build = [f.hall, f.barracks, f.farm, f.tower, f.forge]; });
export const HEROES = ['warden', 'sage', 'reaver', 'seer'];
export const heroFac = id => Math.max(0, FACTIONS.findIndex(f => f.heroes.includes(id)));
export const randomHero = () => HEROES[Math.floor(Math.random() * HEROES.length)];

// b: building, u: unit. Costs are [gold, lumber]. bt = build/train seconds. role drives UI and AI.
export const KINDS = [
  // ---- Ashvale Crown ----
  { id: 'hall', role: 'hall', name: 'Town Hall', b: 1, size: 3, hp: 1500, armor: 5, cost: [300, 150], bt: 45, food: 10, trains: ['worker'], drop: 1, sight: 10, desc: 'Trains workers. Workers drop gold and lumber here. +10 food.' },
  { id: 'barracks', role: 'barracks', name: 'Barracks', b: 1, size: 3, hp: 1000, armor: 5, cost: [160, 60], bt: 28, trains: ['footman', 'archer'], sight: 7, desc: 'Trains Footmen and Archers.' },
  { id: 'farm', role: 'farm', name: 'Farm', b: 1, size: 2, hp: 500, armor: 3, cost: [80, 20], bt: 16, food: 6, sight: 6, desc: 'Raises your food limit by 6.' },
  { id: 'tower', role: 'tower', name: 'Guard Tower', b: 1, size: 2, hp: 550, armor: 5, cost: [70, 80], bt: 22, dmg: 14, range: 7, cd: 1.1, proj: 1, sight: 10, desc: 'Shoots nearby enemies.' },
  { id: 'forge', role: 'forge', name: 'Forge', b: 1, size: 2, hp: 650, armor: 5, cost: [140, 80], bt: 25, research: 1, sight: 6, desc: 'Researches weapon and armor upgrades for soldiers.' },
  { id: 'worker', role: 'worker', worker: 1, name: 'Worker', u: 1, r: 0.33, hp: 220, armor: 0, spd: 2.7, dmg: 5, range: 0.45, cd: 1.3, cost: [75, 0], food: 1, bt: 10, sight: 7, xp: 15, desc: 'Gathers gold and lumber, and builds.' },
  { id: 'footman', role: 'melee', name: 'Footman', u: 1, r: 0.4, hp: 420, armor: 2, spd: 2.6, dmg: 12, range: 0.45, cd: 1.2, cost: [135, 0], food: 2, bt: 14, sight: 7, xp: 30, desc: 'Sturdy melee soldier.' },
  { id: 'archer', role: 'ranged', name: 'Archer', u: 1, r: 0.36, hp: 300, armor: 0, spd: 2.8, dmg: 16, range: 5.5, cd: 1.5, proj: 1, cost: [130, 10], food: 2, bt: 15, sight: 8, xp: 30, desc: 'Ranged attacker.' },
  // ---- Thornwild Clans ----
  { id: 'lodge', role: 'hall', name: 'Great Lodge', b: 1, size: 3, hp: 1600, armor: 4, cost: [300, 150], bt: 45, food: 10, trains: ['gatherer'], drop: 1, sight: 10, desc: 'Trains gatherers. Resources are dropped here. +10 food.' },
  { id: 'warcamp', role: 'barracks', name: 'War Camp', b: 1, size: 3, hp: 1100, armor: 4, cost: [170, 50], bt: 28, trains: ['brute', 'spearman'], sight: 7, desc: 'Trains Brutes and Spearthrowers.' },
  { id: 'burrow', role: 'farm', name: 'Burrow', b: 1, size: 2, hp: 550, armor: 3, cost: [90, 20], bt: 16, food: 7, sight: 6, desc: 'Raises your food limit by 7.' },
  { id: 'spire', role: 'tower', name: 'Thorn Spire', b: 1, size: 2, hp: 520, armor: 4, cost: [80, 70], bt: 22, dmg: 16, range: 6.5, cd: 1.3, proj: 1, sight: 10, desc: 'Hurls thorns at nearby enemies.' },
  { id: 'bonecraft', role: 'forge', name: 'Bonecraft Hut', b: 1, size: 2, hp: 650, armor: 4, cost: [140, 80], bt: 25, research: 1, sight: 6, desc: 'Researches weapon and armor upgrades for warriors.' },
  { id: 'gatherer', role: 'worker', worker: 1, name: 'Gatherer', u: 1, r: 0.34, hp: 240, armor: 0, spd: 2.7, dmg: 6, range: 0.45, cd: 1.3, cost: [75, 0], food: 1, bt: 10, sight: 7, xp: 15, desc: 'Gathers gold and lumber, and builds.' },
  { id: 'brute', role: 'melee', name: 'Brute', u: 1, r: 0.44, hp: 500, armor: 1, spd: 2.6, dmg: 13, range: 0.45, cd: 1.3, cost: [140, 0], food: 2, bt: 15, sight: 7, xp: 30, desc: 'Tough melee warrior with a heavy club.' },
  { id: 'spearman', role: 'ranged', name: 'Spearthrower', u: 1, r: 0.38, hp: 320, armor: 0, spd: 2.7, dmg: 19, range: 5, cd: 1.7, proj: 1, cost: [135, 20], food: 2, bt: 16, sight: 8, xp: 30, desc: 'Throws spears from range.' },
  // ---- neutral ----
  { id: 'mine', role: 'mine', name: 'Gold Mine', b: 1, size: 3, hp: 2000, armor: 9, neutral: 1, sight: 0, desc: 'Send workers here to mine gold.' },
  // ---- heroes ----
  { id: 'warden', role: 'hero', hero: 1, name: 'Warden', u: 1, r: 0.5, hp: 650, mana: 200, armor: 3, spd: 2.9, dmg: 24, range: 0.5, cd: 1.5, food: 0, sight: 9, xp: 100, abil: ['clap', 'rally'], desc: 'Armored champion of the Crown.' },
  { id: 'sage', role: 'hero', hero: 1, name: 'Lumen Sage', u: 1, r: 0.45, hp: 520, mana: 280, armor: 1, spd: 2.9, dmg: 20, range: 5.5, cd: 1.6, proj: 1, food: 0, sight: 9, xp: 100, abil: ['mend', 'sunburst'], desc: 'Healer and caster of the Crown.' },
  { id: 'reaver', role: 'hero', hero: 1, name: 'Bloodreaver', u: 1, r: 0.5, hp: 610, mana: 180, armor: 2, spd: 3.1, dmg: 26, range: 0.5, cd: 1.35, food: 0, sight: 9, xp: 100, abil: ['whirl', 'frenzy'], desc: 'Axe-wielding warlord of the clans.' },
  { id: 'seer', role: 'hero', hero: 1, name: 'Thornseer', u: 1, r: 0.45, hp: 500, mana: 280, armor: 1, spd: 2.9, dmg: 19, range: 5.5, cd: 1.6, proj: 1, food: 0, sight: 9, xp: 100, abil: ['snare', 'wolves'], desc: 'Shaman who commands brambles and spirits.' },
  // ---- creeps and summons ----
  { id: 'ashwolf', role: 'creep', creep: 1, name: 'Ashwolf', u: 1, r: 0.4, hp: 300, armor: 1, spd: 3.2, dmg: 11, range: 0.45, cd: 1.1, sight: 6, xp: 40, bounty: 14 },
  { id: 'hexer', role: 'creep', creep: 1, name: 'Hollow Hexer', u: 1, r: 0.36, hp: 260, armor: 0, spd: 2.6, dmg: 15, range: 5, cd: 1.7, proj: 1, sight: 6, xp: 50, bounty: 18 },
  { id: 'stonehide', role: 'creep', creep: 1, name: 'Stonehide', u: 1, r: 0.62, hp: 760, armor: 3, spd: 2.3, dmg: 26, range: 0.5, cd: 1.8, sight: 6, xp: 90, bounty: 32 },
  { id: 'spiritwolf', role: 'summon', summon: 1, name: 'Spirit Wolf', u: 1, r: 0.4, hp: 320, armor: 1, spd: 3.3, dmg: 13, range: 0.45, cd: 1.1, food: 0, sight: 7, xp: 20, desc: 'Summoned. Fades after a while.' },
  // ---- research (never spawned) ----
  { id: 'upw1', research: 'w', lvl: 1, name: 'Weapons I', cost: [100, 50], bt: 30, desc: '+2 attack for your soldiers.' },
  { id: 'upw2', research: 'w', lvl: 2, name: 'Weapons II', cost: [175, 100], bt: 40, desc: '+2 more attack for your soldiers.' },
  { id: 'upa1', research: 'a', lvl: 1, name: 'Armor I', cost: [100, 50], bt: 30, desc: '+2 armor for your soldiers.' },
  { id: 'upa2', research: 'a', lvl: 2, name: 'Armor II', cost: [175, 100], bt: 40, desc: '+2 more armor for your soldiers.' },
];
export const KI = {};
KINDS.forEach((k, i) => { k.i = i; KI[k.id] = k; });
export const upgradable = k => k.role === 'melee' || k.role === 'ranged';

export const ABIL = {
  clap: { name: 'Stormclap', tgt: 'none', mana: 70, cd: 8, radius: 3.2, dmg: 70, per: 15, icon: 'clap', desc: 'Damages nearby enemies and slows them for 3 s.' },
  rally: { name: 'Rallying Cry', tgt: 'none', lvl: 3, mana: 60, cd: 20, radius: 7, dur: 10, icon: 'rally2', desc: 'Nearby allies deal 25% more damage and gain 3 armor for 10 s.' },
  mend: { name: 'Mend', tgt: 'none', mana: 60, cd: 6, radius: 4.5, heal: 150, per: 35, icon: 'mend', desc: 'Heals the Sage and nearby allied units.' },
  sunburst: { name: 'Sunburst', tgt: 'point', lvl: 3, mana: 90, cd: 10, range: 8, radius: 2.6, dmg: 130, per: 25, icon: 'sun', desc: 'Calls down light on a spot, damaging enemies there.' },
  whirl: { name: 'Whirling Axes', tgt: 'none', mana: 65, cd: 7, radius: 3, dmg: 85, per: 18, icon: 'whirl', desc: 'Spins and strikes every enemy nearby.' },
  frenzy: { name: 'Frenzy', tgt: 'none', lvl: 3, mana: 50, cd: 18, dur: 8, icon: 'frenzy', desc: '60% faster attacks and 20% faster movement for 8 s.' },
  snare: { name: 'Bramble Snare', tgt: 'point', mana: 70, cd: 9, range: 8, radius: 2.6, dmg: 40, per: 10, dur: 3, icon: 'snare', desc: 'Roots enemies in an area in place for 3 s.' },
  wolves: { name: 'Spirit Wolves', tgt: 'none', lvl: 3, mana: 100, cd: 30, dur: 35, icon: 'wolves', desc: 'Summons two spirit wolves for 35 s.' },
};
export const HERO_XP = [0, 100, 250, 450, 700];
export const heroMaxHp = (k, lvl) => k.hp + 80 * ((lvl || 1) - 1);
export const heroMaxMana = (k, lvl) => (k.mana || 0) + 25 * ((lvl || 1) - 1);
export const CAMPS = [null, ['ashwolf', 'ashwolf'], ['ashwolf', 'hexer', 'ashwolf'], ['stonehide', 'hexer', 'hexer']];

// ---------- Map format ----------
// { name, w, h, tiles: Uint8Array, trees: Set<tileIndex>, mines: [[x,y]], starts: [[x,y]], camps: [[x,y,level]] }
export function blankMap(size = 48, name = 'Untitled') {
  const w = size, h = size, tiles = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) tiles[y * w + x] = TILE.ROCK;
  return { name, w, h, tiles, trees: new Set(), mines: [], starts: [], camps: [] };
}
export function cloneMap(m) {
  return { name: m.name, w: m.w, h: m.h, tiles: new Uint8Array(m.tiles), trees: new Set(m.trees),
    mines: m.mines.map(a => [...a]), starts: m.starts.map(a => [...a]), camps: (m.camps || []).map(a => [...a]) };
}
const cleanName = s => String(s || 'Untitled').replace(/[|\u0000-\u001f]/g, '').slice(0, 32) || 'Untitled';

export function encodeMap(m) {
  let rle = '';
  for (let i = 0; i < m.tiles.length;) {
    const t = m.tiles[i]; let n = 1;
    while (i + n < m.tiles.length && m.tiles[i + n] === t && n < 64) n++;
    rle += t + B64[n - 1]; i += n;
  }
  const trees = [...m.trees].sort((a, b) => a - b).map(enc2).join('');
  const pts = a => a.map(([x, y]) => enc1(x) + enc1(y)).join('');
  const camps = (m.camps || []).map(([x, y, l]) => enc1(x) + enc1(y) + Math.max(1, Math.min(3, l))).join('');
  return ['A2', cleanName(m.name), m.w, m.h, rle, trees, pts(m.mines), pts(m.starts), camps].join('|');
}
// Untrusted input: validate everything, return null on failure. Accepts A1 (no camps) and A2.
export function decodeMap(code) {
  try {
    const p = String(code).trim().split('|');
    if (!((p[0] === 'A1' && p.length === 8) || (p[0] === 'A2' && p.length === 9))) return null;
    const w = +p[2], h = +p[3];
    if (![32, 48, 64].includes(w) || w !== h) return null;
    const tiles = new Uint8Array(w * h);
    let i = 0;
    for (let j = 0; j + 1 < p[4].length; j += 2) {
      const t = +p[4][j], n = dec1(p[4], j + 1) + 1;
      if (!(t >= 0 && t <= 4)) return null;
      for (let k = 0; k < n && i < tiles.length; k++) tiles[i++] = t;
    }
    if (i !== tiles.length) return null;
    const trees = new Set();
    for (let j = 0; j + 1 < p[5].length; j += 2) { const t = dec2(p[5], j); if (t < w * h && TILES[tiles[t]].walk) trees.add(t); }
    const pts = s => { const a = []; for (let j = 0; j + 1 < s.length; j += 2) a.push([dec1(s, j) % w, dec1(s, j + 1) % h]); return a; };
    const camps = [];
    if (p[8]) for (let j = 0; j + 2 < p[8].length + 0 && camps.length < 24; j += 3) { const l = +p[8][j + 2]; if (l >= 1 && l <= 3) camps.push([dec1(p[8], j) % w, dec1(p[8], j + 1) % h, l]); }
    return { name: cleanName(p[1]), w, h, tiles, trees, mines: pts(p[6]).slice(0, 16), starts: pts(p[7]).slice(0, 4), camps };
  } catch { return null; }
}

// Tiles covered by a building of `size` placed at tile (tx,ty).
export function footprint(size, tx, ty) {
  const x0 = tx - Math.floor(size / 2), y0 = ty - Math.floor(size / 2);
  return { x0, y0, x1: x0 + size - 1, y1: y0 + size - 1, cx: x0 + size / 2, cz: y0 + size / 2 };
}
export function validateMap(m) {
  const issues = [];
  if (m.starts.length < 2) issues.push('Place at least 2 start locations.');
  if (m.mines.length < 1) issues.push('Place at least 1 gold mine.');
  return issues;
}

// ---------- Default map: "Ashvale Crossing" (64x64, 4 players) ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function noise(w, h, cell, r) {
  const gw = Math.ceil(w / cell) + 2, g = Array.from({ length: gw * gw }, r);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const s = v => v * v * (3 - 2 * v), a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return (a + (b - a) * s(tx)) + ((c + (d - c) * s(tx)) - (a + (b - a) * s(tx))) * s(ty);
  };
}
export function defaultMap() {
  const m = blankMap(64, 'Ashvale Crossing'), { w, h, tiles } = m, r = rng(11);
  const n1 = noise(w, h, 7, r), n2 = noise(w, h, 5, r), n3 = noise(w, h, 9, r);
  m.starts = [[11, 11], [52, 11], [11, 52], [52, 52]];
  m.mines = [[19, 5], [44, 5], [19, 58], [44, 58], [32, 32], [5, 32], [58, 32], [32, 9], [32, 54]];
  m.camps = [[9, 32, 2], [54, 32, 2], [32, 13, 2], [32, 50, 2], [32, 36, 3], [19, 19, 1], [44, 19, 1], [19, 44, 1], [44, 44, 1]];
  const ponds = [[32, 21], [32, 43], [21, 32], [43, 32]];
  const roads = [[11, 11, 32, 32], [52, 11, 32, 32], [11, 52, 32, 32], [52, 52, 32, 32], [11, 11, 52, 11], [11, 52, 52, 52], [11, 11, 11, 52], [52, 11, 52, 52]];
  const segDist = (x, y, [ax, ay, bx, by]) => {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  };
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x, rd = Math.min(...roads.map(s => segDist(x, y, s)));
    const nearStart = Math.min(...m.starts.map(([sx, sy]) => Math.hypot(x - sx, y - sy)));
    const nearMine = Math.min(...m.mines.map(([sx, sy]) => Math.max(Math.abs(x - sx), Math.abs(y - sy))));
    const nearCamp = Math.min(...m.camps.map(([sx, sy]) => Math.hypot(x - sx, y - sy)));
    const pond = Math.min(...ponds.map(([px, py]) => Math.hypot(x - px, y - py)));
    if (n2(x, y) > 0.62) tiles[i] = 1;
    if (rd < 1.3) tiles[i] = 2;
    if (pond < 2.8) { tiles[i] = 3; continue; }
    const clear = nearStart < 8.5 || nearMine < 3 || rd < 2.6 || pond < 4 || nearCamp < 2.6;
    if (!clear && n3(x, y) > 0.74) { tiles[i] = 4; continue; }
    if (!clear && (n1(x, y) > 0.5 || r() < 0.04)) m.trees.add(i);
    if (nearStart > 4 && nearStart < 9 && rd > 2.6 && nearMine >= 3 && (x < 6 || y < 6 || x > w - 7 || y > h - 7)) m.trees.add(i);
  }
  return m;
}
