// Ashvale audio: everything is synthesized with the Web Audio API (no audio files).
// Music: a 16th-note sequencer with calm layers (pad, lute, flute) and battle layers
// (drums, bass ostinato, brass) whose volume follows combat intensity. One theme per faction.
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// Minimum seconds between two plays of the same effect (keeps big battles readable).
const RATE = { hitMetal: .03, hitFlesh: .03, hitBuilding: .05, swing: .06, bow: .05, throw: .06, magic: .06, tower: .07, chop: .12, mine: .12, hammer: .1,
  paint: .06, select: .05, ui: .03, coins: .08, depGold: .09, depWood: .09, dieHuman: .05, dieBeast: .06, ack: .05, ackAtk: .05, ackWork: .05, error: .2, alarm: 1 };

export class AudioEngine {
  constructor() { this.ctx = null; this.vol = { music: 0.5, sfx: 0.8 }; this.muted = false; this.last = {}; this.ends = []; this.count = {}; }
  // Create the graph. Browsers only start audio after a user gesture, so main.js calls unlock() from pointer/key handlers.
  init(ctx) {
    if (this.ctx) return true;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = ctx || (C ? new C({ latencyHint: 'interactive' }) : null);
    } catch { this.ctx = null; }
    if (!this.ctx) return false;
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(c.destination);
    this.musicBus = c.createGain(); this.sfxBus = c.createGain(); this.musicBus.connect(this.master); this.sfxBus.connect(this.master);
    // simple generated reverb
    const len = Math.floor(c.sampleRate * 2.4), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revOut = c.createGain(); this.revOut.gain.value = 0.32; this.rev.connect(this.revOut).connect(this.master);
    this.musicRev = c.createGain(); this.musicRev.gain.value = 0.55; this.musicBus.connect(this.musicRev).connect(this.rev);
    this.sfxRev = c.createGain(); this.sfxRev.gain.value = 1; this.sfxRev.connect(this.rev);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.music = new Music(this);
    this.applyVol();
    return true;
  }
  unlock() {
    if (!this.ctx && !this.init()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  set(o) { Object.assign(this.vol, o.vol || {}); if ('muted' in o) this.muted = !!o.muted; this.applyVol(); }
  applyVol() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.75, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 1.4, t, 0.05);
  }

  // ---------- voices ----------
  out(pan, dest) {
    const c = this.ctx; let node = dest || this.sfxBus;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(node); node = p; }
    return node;
  }
  env(g, t, peak, a, dur) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  osc(type, f, t, dur, o = {}) {
    const c = this.ctx, os = c.createOscillator(), g = c.createGain();
    os.type = type; os.frequency.setValueAtTime(f, t);
    if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + (o.slide || dur));
    if (o.det) os.detune.value = o.det;
    let n = os;
    if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lp1) fl.frequency.exponentialRampToValueAtTime(o.lp1, t + dur); fl.Q.value = o.q || 0.7; n.connect(fl); n = fl; }
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibD || 6; l.connect(lg).connect(os.detune); l.start(t); l.stop(t + dur + 0.1); }
    this.env(g, t, o.g ?? 0.2, o.a ?? 0.005, dur);
    n.connect(g).connect(this.out(o.pan, o.dest));
    if (o.rev) { const s = c.createGain(); s.gain.value = o.rev; g.connect(s).connect(this.sfxRev); }
    os.start(t); os.stop(t + dur + 0.05);
    if (!o.dest) this.ends.push(t + dur);
    return os;
  }
  noise(t, dur, o = {}) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q ?? 1;
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    this.env(g, t, o.g ?? 0.2, o.a ?? 0.003, dur);
    s.connect(f).connect(g).connect(this.out(o.pan, o.dest));
    if (o.rev) { const r = c.createGain(); r.gain.value = o.rev; g.connect(r).connect(this.sfxRev); }
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    if (!o.dest) this.ends.push(t + dur);
  }

  // Play a named effect. p: { pan: -1..1, g: volume scale, force: ignore limits }
  play(name, p = {}) {
    if (!this.ready || this.muted || this.vol.sfx <= 0) return false;
    const fn = SFX[name]; if (!fn) return false;
    const now = this.ctx.currentTime;
    const r = RATE[name]; if (r && !p.force && now - (this.last[name] || -9) < r) return false;
    this.ends = this.ends.filter(e => e > now);
    if (this.ends.length > 40 && !p.force) return false;
    this.last[name] = now; this.count[name] = (this.count[name] || 0) + 1;
    fn(this, now + 0.005, p.pan || 0, (p.g ?? 1) * (BOOST[name] || 1));
    return true;
  }
}

// Level trims from offline measurements (frequent combat sounds stay quieter than events).
const BOOST = { ui: 1.8, select: 1.8, selectBuilding: 1.8, ack: 1.6, ackAtk: 1.8, ackWork: 1.6, swing: 2.6, throw: 2.6, bow: 2, tower: 1.6, magic: 1.5,
  chop: 1.8, mine: 1.8, hammer: 1.8, paint: 2, hitMetal: 1.4, hitFlesh: 1.3, hitBuilding: 1.4, depGold: 1.6, depWood: 2, dieHuman: 1.4, dieBeast: 1.6, whirl: 1.6, snare: 1.5, bird: 1.3 };

// ---------- sound effects ----------
const SFX = {
  ui: (a, t, pan, g) => { a.osc('triangle', 880, t, .06, { g: .1 * g, pan }); a.osc('sine', 1320, t + .015, .05, { g: .05 * g, pan }); },
  select: (a, t, pan, g) => { a.osc('triangle', 520, t, .08, { g: .13 * g, pan }); a.osc('sine', 780, t + .03, .07, { g: .06 * g, pan }); },
  selectHero: (a, t, pan, g) => { a.osc('sawtooth', 196, t, .22, { g: .12 * g, lp: 900, pan }); a.osc('triangle', 294, t + .05, .22, { g: .1 * g, pan }); a.osc('sine', 392, t + .1, .25, { g: .07 * g, pan, rev: .3 }); },
  selectBuilding: (a, t, pan, g) => { a.noise(t, .05, { f: 700, q: 4, g: .2 * g, pan }); a.osc('triangle', 240, t, .1, { g: .1 * g, pan }); },
  ack: (a, t, pan, g) => { a.osc('triangle', 660, t, .07, { g: .12 * g, pan }); a.osc('triangle', 880, t + .07, .09, { g: .1 * g, pan }); },
  ackAtk: (a, t, pan, g) => { a.osc('sawtooth', 330, t, .14, { f1: 210, g: .14 * g, lp: 1100, pan }); a.noise(t, .08, { f: 1600, g: .08 * g, pan }); },
  ackWork: (a, t, pan, g) => { a.osc('triangle', 523, t, .06, { g: .11 * g, pan }); a.osc('triangle', 659, t + .06, .08, { g: .1 * g, pan }); a.noise(t + .02, .03, { f: 1200, q: 5, g: .08 * g, pan }); },
  error: (a, t, pan, g) => { a.osc('square', 196, t, .11, { g: .09 * g, lp: 800 }); a.osc('square', 165, t + .14, .14, { g: .09 * g, lp: 800 }); },
  coins: (a, t, pan, g) => { for (let i = 0; i < 4; i++) { const f = 2100 + Math.random() * 900; a.osc('sine', f, t + i * .045, .12, { g: .06 * g, pan }); a.osc('triangle', f * 1.5, t + i * .045, .06, { g: .025 * g, pan }); } },
  depGold: (a, t, pan, g) => { a.osc('sine', 2400, t, .1, { g: .05 * g, pan }); a.osc('sine', 3100, t + .05, .12, { g: .04 * g, pan }); },
  depWood: (a, t, pan, g) => { a.noise(t, .06, { f: 650, q: 3, g: .14 * g, pan }); a.osc('triangle', 190, t, .07, { g: .07 * g, pan }); },
  swing: (a, t, pan, g) => a.noise(t, .13, { f: 1900, f1: 700, q: 1.5, g: .045 * g, pan }),
  hitMetal: (a, t, pan, g) => { const f = 1300 + Math.random() * 400; a.osc('square', f, t, .07, { g: .045 * g, lp: 3200, pan }); a.osc('sine', f * 2.1, t, .16, { g: .03 * g, pan }); a.noise(t, .04, { type: 'highpass', f: 3000, g: .07 * g, pan }); },
  hitFlesh: (a, t, pan, g) => { a.noise(t, .07, { type: 'lowpass', f: 900, g: .16 * g, pan }); a.osc('sine', 120, t, .09, { f1: 60, g: .14 * g, pan }); },
  hitBuilding: (a, t, pan, g) => { a.noise(t, .1, { f: 420, q: 2, g: .16 * g, pan }); a.osc('triangle', 95, t, .13, { f1: 55, g: .12 * g, pan }); },
  bow: (a, t, pan, g) => { a.osc('triangle', 520, t, .05, { f1: 260, g: .05 * g, pan }); a.noise(t + .01, .15, { f: 2600, f1: 900, q: 2, g: .06 * g, pan }); },
  throw: (a, t, pan, g) => a.noise(t, .2, { f: 950, f1: 380, q: 1.4, g: .08 * g, pan }),
  magic: (a, t, pan, g) => { a.osc('sine', 880, t, .18, { f1: 1500, g: .05 * g, pan, rev: .4 }); a.osc('triangle', 1320, t, .16, { f1: 2250, g: .025 * g, pan }); },
  tower: (a, t, pan, g) => { a.osc('square', 150, t, .06, { g: .06 * g, lp: 600, pan }); a.noise(t + .01, .17, { f: 1300, f1: 500, q: 2, g: .08 * g, pan }); },
  dieHuman: (a, t, pan, g) => { a.osc('sawtooth', 260, t, .34, { f1: 90, g: .07 * g, lp: 900, pan }); a.noise(t, .2, { type: 'lowpass', f: 650, g: .12 * g, pan }); },
  dieBeast: (a, t, pan, g) => { a.osc('sawtooth', 720, t, .28, { f1: 280, g: .06 * g, lp: 1500, pan }); a.noise(t, .12, { type: 'lowpass', f: 900, g: .08 * g, pan }); },
  dieStone: (a, t, pan, g) => { a.noise(t, .45, { type: 'lowpass', f: 420, g: .25 * g, pan }); a.osc('sine', 62, t, .45, { f1: 34, g: .22 * g, pan }); },
  collapse: (a, t, pan, g) => {
    a.noise(t, 1.3, { type: 'lowpass', f: 900, f1: 140, g: .36 * g, pan, rev: .4 }); a.osc('sine', 58, t, 1.1, { f1: 30, g: .3 * g, pan });
    for (let i = 0; i < 6; i++) a.noise(t + Math.random() * .9, .05, { f: 1500 + Math.random() * 1500, q: 3, g: .1 * g, pan });
  },
  place: (a, t, pan, g) => { for (let i = 0; i < 3; i++) { a.noise(t + i * .17, .04, { f: 1100, q: 3, g: .18 * g, pan }); a.osc('triangle', 300, t + i * .17, .05, { g: .06 * g, pan }); } },
  done: (a, t, pan, g) => [659, 880, 1319].forEach((f, i) => { a.osc('triangle', f, t + i * .09, .45, { g: .09 * g, pan, rev: .4 }); a.osc('sine', f * 2, t + i * .09, .3, { g: .03 * g, pan }); }),
  ready: (a, t, pan, g) => { a.osc('sawtooth', 392, t, .22, { g: .06 * g, lp: 1500, pan }); a.osc('sawtooth', 587, t + .11, .3, { g: .06 * g, lp: 1500, pan, rev: .25 }); },
  readyHero: (a, t, pan, g) => [294, 440, 587].forEach((f, i) => a.osc('sawtooth', f, t + i * .12, .45, { g: .07 * g, lp: 1400, pan, rev: .35 })),
  chop: (a, t, pan, g) => { a.noise(t, .05, { f: 850, q: 3, g: .1 * g, pan }); a.osc('triangle', 210, t, .05, { f1: 150, g: .05 * g, pan }); },
  mine: (a, t, pan, g) => { a.osc('square', 2000 + Math.random() * 300, t, .04, { g: .025 * g, lp: 4000, pan }); a.osc('sine', 3100, t, .12, { g: .025 * g, pan }); },
  hammer: (a, t, pan, g) => { a.noise(t, .03, { f: 1400, q: 3, g: .1 * g, pan }); a.osc('triangle', 420, t, .04, { g: .04 * g, pan }); },
  clap: (a, t, pan, g) => { a.noise(t, .9, { type: 'lowpass', f: 1400, f1: 180, g: .4 * g, pan, rev: .5 }); a.osc('sine', 85, t, .7, { f1: 34, g: .35 * g, pan }); a.noise(t, .12, { type: 'highpass', f: 3000, g: .14 * g, pan }); },
  whirl: (a, t, pan, g) => { for (let i = 0; i < 3; i++) a.noise(t + i * .1, .13, { f: 1400, f1: 2600, q: 2, g: .12 * g, pan: clamp(pan + (i - 1) * .4, -1, 1) }); },
  rally: (a, t, pan, g) => [294, 440, 587].forEach((f, i) => { a.osc('sawtooth', f, t + i * .15, .55 + i * .1, { g: .07 * g, lp: 1700, pan, rev: .5, vib: 5, vibD: 8 }); }),
  mend: (a, t, pan, g) => [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => a.osc('sine', f, t + i * .06, .55, { g: .045 * g, pan, rev: .6 })),
  frenzy: (a, t, pan, g) => { a.osc('sawtooth', 90, t, .5, { f1: 150, g: .13 * g, lp: 650, pan }); a.noise(t, .5, { f: 320, q: 2, g: .12 * g, pan }); },
  sun: (a, t, pan, g) => { a.osc('sine', 1760, t, .6, { f1: 880, g: .07 * g, pan, rev: .6 }); a.noise(t, .5, { type: 'highpass', f: 2500, g: .07 * g, pan }); a.osc('sine', 120, t + .05, .5, { f1: 48, g: .25 * g, pan }); },
  snare: (a, t, pan, g) => { for (let i = 0; i < 9; i++) a.noise(t + Math.random() * .5, .04, { f: 1200 + Math.random() * 1800, q: 4, g: .09 * g, pan }); a.osc('triangle', 200, t, .4, { f1: 110, g: .06 * g, pan }); },
  wolves: (a, t, pan, g) => { for (const d of [0, 14]) { const o = a.osc('sine', 480, t, 1.1, { g: .07 * g, pan, rev: .6, det: d }); o.frequency.exponentialRampToValueAtTime(820, t + .45); o.frequency.exponentialRampToValueAtTime(560, t + 1.05); } },
  lvl: (a, t, pan, g) => [523, 659, 784, 1047].forEach((f, i) => { a.osc('triangle', f, t + i * .1, i === 3 ? .7 : .2, { g: .1 * g, pan, rev: .4 }); a.osc('sine', f * 2, t + i * .1, .15, { g: .03 * g, pan }); }),
  upg: (a, t, pan, g) => { SFX.hitMetal(a, t, pan, g * 1.4); SFX.hitMetal(a, t + .18, pan, g * 1.2); SFX.done(a, t + .35, pan, g); },
  bounty: (a, t, pan, g) => SFX.coins(a, t, pan, g * 1.2),
  gong: (a, t, pan, g) => { a.osc('sine', 110, t, 2.6, { g: .22 * g, rev: .7 }); a.osc('sine', 163, t, 2.0, { g: .09 * g }); a.osc('sine', 209, t, 1.5, { g: .06 * g }); a.noise(t, .1, { type: 'lowpass', f: 600, g: .15 * g }); },
  chat: (a, t, pan, g) => { a.osc('sine', 1047, t, .1, { g: .07 * g }); a.osc('sine', 1319, t + .08, .13, { g: .06 * g }); },
  alarm: (a, t, pan, g) => { for (let k = 0; k < 2; k++) { a.osc('sawtooth', 466, t + k * .45, .2, { g: .08 * g, lp: 1300 }); a.osc('sawtooth', 349, t + k * .45 + .21, .22, { g: .08 * g, lp: 1300 }); } },
  join: (a, t, pan, g) => { a.osc('triangle', 784, t, .15, { g: .08 * g, rev: .3 }); a.osc('triangle', 1175, t + .1, .25, { g: .07 * g, rev: .3 }); },
  start: (a, t, pan, g) => { [220, 330, 440].forEach((f, i) => a.osc('sawtooth', f, t + i * .18, .5 + i * .15, { g: .07 * g, lp: 1400, rev: .5, vib: 5 })); a.noise(t, .3, { type: 'lowpass', f: 300, g: .25 * g }); a.osc('sine', 70, t, .35, { f1: 40, g: .25 * g }); },
  victory: (a, t, pan, g) => {
    [[392, 0], [523, .18], [659, .36], [784, .54], [659, .9], [784, 1.05], [1047, 1.25]].forEach(([f, d], i) => {
      a.osc('sawtooth', f, t + d, i === 6 ? 1.6 : .35, { g: .08 * g, lp: 2000, rev: .5, vib: i === 6 ? 5 : 0 }); a.osc('triangle', f / 2, t + d, i === 6 ? 1.6 : .35, { g: .05 * g });
    });
    for (const d of [0, .54, 1.25]) { a.noise(t + d, .25, { type: 'lowpass', f: 350, g: .28 * g }); a.osc('sine', 75, t + d, .3, { f1: 42, g: .25 * g }); }
  },
  defeat: (a, t, pan, g) => {
    [[440, 0], [415, .45], [349, .9], [294, 1.4]].forEach(([f, d], i) => a.osc('sawtooth', f, t + d, i === 3 ? 2.2 : .5, { g: .07 * g, lp: 900, rev: .6 }));
    SFX.gong(a, t + 1.4, 0, g * .8);
  },
  paint: (a, t, pan, g) => a.noise(t, .04, { f: 2400, q: 1, g: .03 * g, pan }),
  thump: (a, t, pan, g) => { a.osc('sine', 130, t, .2, { f1: 60, g: .2 * g, pan }); a.noise(t, .06, { type: 'lowpass', f: 500, g: .12 * g, pan }); },
  bird: (a, t, pan, g) => { const b = 2600 + Math.random() * 1200; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) a.osc('sine', b, t + i * .13, .09, { f1: b * 1.35, g: .022 * g, pan, rev: .4 }); },
};

// ---------- music ----------
const THEMES = [
  { // Ashvale Crown: D Dorian, lute and flute
    bars: [[50, 'm'], [48, 'M'], [46, 'M'], [48, 'M'], [50, 'm'], [53, 'M'], [48, 'M'], [45, 'M']],
    lead: 'flute', tomsCalm: false,
    mel: [[0, 0, 4, 69], [0, 4, 4, 74], [0, 8, 2, 72], [0, 10, 2, 69], [0, 12, 4, 67], [1, 0, 6, 64], [1, 6, 2, 67], [1, 8, 4, 69], [1, 12, 4, 72],
      [2, 0, 6, 74], [2, 6, 2, 72], [2, 8, 4, 70], [2, 12, 4, 69], [3, 0, 8, 67], [3, 8, 4, 64], [3, 12, 4, 67],
      [4, 0, 4, 69], [4, 4, 4, 74], [4, 8, 4, 76], [4, 12, 4, 77], [5, 0, 4, 76], [5, 4, 4, 74], [5, 8, 4, 72], [5, 12, 4, 69],
      [6, 0, 4, 67], [6, 4, 2, 69], [6, 6, 2, 72], [6, 8, 4, 76], [6, 12, 4, 74], [7, 0, 8, 73], [7, 8, 4, 76], [7, 12, 4, 69]],
  },
  { // Thornwild Clans: E Phrygian, reed and frame drums
    bars: [[52, 'm'], [53, 'M'], [52, 'm'], [50, 'm'], [52, 'm'], [48, 'M'], [53, 'M'], [52, 'm']],
    lead: 'reed', tomsCalm: true,
    mel: [[0, 0, 4, 76], [0, 4, 2, 74], [0, 6, 2, 72], [0, 8, 8, 71], [1, 0, 4, 69], [1, 4, 4, 72], [1, 8, 4, 71], [1, 12, 4, 69],
      [2, 0, 6, 67], [2, 6, 2, 69], [2, 8, 8, 71], [3, 0, 4, 69], [3, 4, 4, 65], [3, 8, 8, 62],
      [4, 0, 4, 64], [4, 4, 4, 67], [4, 8, 4, 71], [4, 12, 4, 76], [5, 0, 4, 76], [5, 4, 4, 74], [5, 8, 8, 72],
      [6, 0, 4, 69], [6, 4, 4, 72], [6, 8, 4, 77], [6, 12, 4, 76], [7, 0, 12, 76], [7, 12, 4, 71]],
  },
];
const chordTones = (root, q) => [root, root + (q === 'm' ? 3 : 4), root + 7];

class Music {
  constructor(a) {
    this.a = a; const c = a.ctx;
    this.bpm = 96; this.step = 0; this.nextT = 0; this.mode = 'off'; this.theme = THEMES[0]; this.int = 0; this.target = 0; this.timer = 0; this.cycle = 0;
    this.layers = {};
    for (const k of ['pad', 'harp', 'lead', 'bass', 'drums', 'brass', 'toms']) { const g = c.createGain(); g.gain.value = 0; g.connect(a.musicBus); this.layers[k] = g; }
    this.bird = 4;
  }
  // mode: 'title' | 'game' | 'editor' | 'off'; fac picks the theme.
  start(mode, fac = 0) {
    const a = this.a; if (!a.ctx) return;
    const newTheme = THEMES[fac] || THEMES[0];
    if (this.mode === mode && this.theme === newTheme && this.timer) return;
    this.mode = mode; this.theme = newTheme;
    if (mode === 'off') { this.fadeAll(0, 1.2); return; }
    if (!this.timer) { this.step = 0; this.cycle = 0; this.nextT = a.ctx.currentTime + 0.15; this.timer = setInterval(() => this.tick(), 25); }
    this.target = mode === 'title' ? 0.15 : 0; this.int = this.target; this.mix(true);
  }
  stop(fade = 1.5) { this.fadeAll(0, fade); setTimeout(() => { if (this.mode === 'off') { clearInterval(this.timer); this.timer = 0; } }, fade * 1000 + 100); this.mode = 'off'; }
  fadeAll(v, s) { const t = this.a.ctx.currentTime; for (const g of Object.values(this.layers)) g.gain.setTargetAtTime(v, t, s / 3); }
  setIntensity(v) { this.target = clamp(v, 0, 1); }
  mix(now) {
    if (this.mode === 'off') return;
    this.int += (this.target - this.int) * (now ? 1 : 0.15);
    const i = this.int, t = this.a.ctx.currentTime, ed = this.mode === 'editor', L = this.layers, set = (k, v) => L[k].gain.setTargetAtTime(v, t, now ? 0.05 : 0.6);
    set('pad', 0.9); set('harp', ed ? 0.55 : 0.75 * (1 - i * 0.35)); set('lead', ed ? 0.28 : 0.55 * (1 - i * 0.5));
    set('bass', Math.max(0, i - 0.05) * 0.75); set('drums', Math.max(0, i - 0.12) * 0.8); set('brass', Math.max(0, i - 0.5) * 0.6);
    set('toms', this.theme.tomsCalm && !ed ? 0.35 + i * 0.4 : i * 0.5);
  }
  tick() {
    const a = this.a; if (!a.ready || this.mode === 'off') return;
    const c = a.ctx;
    if (this.nextT < c.currentTime - 0.3) this.nextT = c.currentTime + 0.05;   // resync after a pause
    const sd = 60 / this.bpm / 4;
    while (this.nextT < c.currentTime + 0.12) { this.note(this.step, this.nextT, sd); this.nextT += sd; this.step++; }
    if ((this.step & 7) === 0) this.mix(false);
  }
  note(step, t, sd) {
    const a = this.a, th = this.theme, s = step % 16, bar = Math.floor(step / 16) % 8, [root, q] = th.bars[bar], ch = chordTones(root, q), L = this.layers;
    if (s === 0 && bar === 0 && step > 0) this.cycle++;
    // pad: a sustained chord each bar
    if (s === 0) for (const [k, n] of [[0, ch[0]], [1, ch[1]], [2, ch[2]], [3, ch[0] + 12]]) {
      a.osc(k % 2 ? 'triangle' : 'sawtooth', mtof(n), t, sd * 16 + 0.6, { g: 0.05, a: 0.5, lp: 700, det: (k - 1.5) * 6, dest: L.pad });
    }
    // lute arpeggio on eighths
    if (s % 2 === 0) {
      const pat = [0, 1, 2, 1, 3, 2, 1, 2], tones = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24], n = tones[pat[s / 2]];
      a.osc('triangle', mtof(n), t, 0.55, { g: 0.09, a: 0.003, lp: 2400, lp1: 600, dest: L.harp });
      a.osc('sine', mtof(n + 12), t, 0.25, { g: 0.025, dest: L.harp });
    }
    // lead melody on every other 8-bar cycle
    if (this.cycle % 2 === 1) for (const [b, st, len, m] of th.mel) if (b === bar && st === s) {
      if (th.lead === 'flute') { a.osc('sine', mtof(m), t, sd * len + 0.15, { g: 0.11, a: 0.06, vib: 5, vibD: 9, dest: L.lead }); a.osc('triangle', mtof(m + 12), t, sd * len, { g: 0.018, a: 0.08, dest: L.lead }); }
      else { a.osc('square', mtof(m), t, sd * len + 0.1, { g: 0.05, a: 0.04, lp: 1300, vib: 5.5, vibD: 12, dest: L.lead }); a.osc('sine', mtof(m - 12), t, sd * len, { g: 0.04, a: 0.05, dest: L.lead }); }
    }
    // battle layers
    if (s % 2 === 0 && [1, 0, 1, 1, 0, 1, 1, 1][s / 2]) a.osc('sawtooth', mtof(root - 12), t, sd * 1.6, { g: 0.12, a: 0.004, lp: 520, lp1: 160, q: 4, dest: L.bass });
    if (s === 0 || s === 8 || (s === 10 && bar % 2)) { a.osc('sine', 110, t, 0.28, { f1: 42, slide: 0.12, g: 0.5, dest: L.drums }); a.noise(t, 0.04, { type: 'lowpass', f: 900, g: 0.12, dest: L.drums }); }
    if (s === 4 || s === 12) { a.noise(t, 0.16, { f: 1700, q: 0.8, g: 0.22, dest: L.drums }); a.osc('triangle', 185, t, 0.09, { g: 0.12, dest: L.drums }); }
    if (s % 2 === 1) a.noise(t, 0.03, { type: 'highpass', f: 7500, g: 0.05, dest: L.drums });
    if (s === 0) for (const n of ch) a.osc('sawtooth', mtof(n + 12), t, 0.45, { g: 0.06, a: 0.02, lp: 2600, lp1: 500, dest: L.brass });
    // frame drums / toms
    const tom = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0][s];
    if (tom) a.osc('sine', s > 12 ? 130 : 95, t, 0.22, { f1: 60, slide: 0.18, g: 0.32, dest: L.toms });
    // birds in calm moments
    if (s === 0 && this.mode !== 'off' && this.int < 0.3 && --this.bird <= 0) { this.bird = 2 + Math.random() * 5 | 0; a.play('bird', { pan: Math.random() * 1.6 - 0.8, g: 1 }); }
  }
}
export const audio = new AudioEngine();
export { SFX, THEMES };
