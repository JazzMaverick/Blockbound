// Three.js WebGPU renderer for Ashvale (falls back to WebGL 2 automatically).
import * as THREE from 'three/webgpu';
import { pass, time, positionWorld, positionLocal, positionGeometry, sin, mix, color, texture, uniform, float, vec2, vec3, vec4, screenUV, smoothstep, pow, step } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { KINDS, KI, TILES, TEAM_COLORS, footprint, heroMaxHp } from './data.js';
import { FX, makeCloudTex } from './fx.js';
const CREEP = 5, NEUTRAL = 4;
const hitName = k => k.b ? 'hitBuilding' : (k.armor >= 2 || k.hero || k.id === 'stonehide') ? 'hitMetal' : 'hitFlesh';
const shotName = k => k.role === 'tower' ? 'tower' : k.id === 'spearman' ? 'throw' : (k.id === 'hexer' || k.id === 'sage' || k.id === 'seer') ? 'magic' : 'bow';
const dieName = k => k.b ? 'collapse' : (k.id === 'ashwolf' || k.id === 'spiritwolf') ? 'dieBeast' : k.id === 'stonehide' ? 'dieStone' : 'dieHuman';

const PI = Math.PI;
const tmpM = new THREE.Matrix4(), tmpA = new THREE.Matrix4(), tmpB = new THREE.Matrix4(), tmpP = new THREE.Matrix4(), tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
// Ranged attacks that fly as glowing bolts: core colour (HDR) and light colour.
const PROJ = {
  tower: { c: [3.4, 1.5, 0.45], L: [1, 0.5, 0.15], s: 0.34 },
  spire: { c: [1.3, 3.2, 0.5], L: [0.45, 1, 0.2], s: 0.3 },
  sage: { c: [3.2, 2.8, 1.4], L: [1, 0.88, 0.5], s: 0.3 },
  seer: { c: [1.1, 3.2, 1.5], L: [0.4, 1, 0.55], s: 0.3 },
  hexer: { c: [2.3, 0.8, 3.4], L: [0.7, 0.3, 1], s: 0.27 },
};
// Weapon trails for heroes; everyone else gets a faint grey streak.
const TRAIL = { warden: [1.2, 1.5, 2.1], reaver: [2.2, 0.8, 0.35] };
// Chimneys and smoke holes (model space) that puff smoke on finished buildings.
const CHIMNEY = { forge: [0.55, 2.2, -0.4], barracks: [-1.0, 2.65, -0.5], lodge: [0, 3.9, 0] };
const lerpAng = (a, b, t) => { let d = (b - a) % (2 * PI); if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI; return a + d * t; };

// part: [geo, size, pos, color|'team', anim, extra]   anim: legL legR swing bob | vis: G L | glow
const T = 'team';
const MODELS = {
  worker: { h: 1.2, parts: [
    ['box', [.12, .32, .13], [-.08, .16, 0], '#5b4632', 'legL'], ['box', [.12, .32, .13], [.08, .16, 0], '#5b4632', 'legR'],
    ['box', [.34, .36, .24], [0, .5, 0], '#a48352'], ['box', [.36, .07, .26], [0, .43, 0], T],
    ['box', [.24, .24, .24], [0, .82, 0], '#e2b48c'], ['cone', [.38, .2, .38], [0, 1.02, 0], '#7a5a2c'],
    ['box', [.09, .3, .1], [.22, .52, 0], '#e2b48c', 'swing'], ['box', [.05, .05, .42], [.23, .4, .18], '#6b4a2a', 'swing'],
    ['box', [.18, .08, .08], [.23, .4, .38], '#a0a4aa', 'swing'],
    ['box', [.26, .26, .2], [0, .55, -.2], '#e0b43a', null, 'G'], ['box', [.34, .13, .13], [0, .62, -.2], '#7b5530', null, 'L'],
  ] },
  footman: { h: 1.35, parts: [
    ['box', [.14, .36, .15], [-.1, .18, 0], '#4a4a50', 'legL'], ['box', [.14, .36, .15], [.1, .18, 0], '#4a4a50', 'legR'],
    ['box', [.42, .42, .3], [0, .58, 0], '#8d9096'], ['box', [.3, .34, .32], [0, .56, 0], T],
    ['box', [.26, .26, .26], [0, .94, 0], '#e0b089'], ['box', [.32, .16, .32], [0, 1.06, 0], '#a7abb2'],
    ['box', [.08, .44, .38], [-.28, .58, .06], T],
    ['box', [.1, .32, .12], [.27, .6, 0], '#8d9096', 'swing'], ['box', [.05, .06, .62], [.27, .48, .32], '#dfe3e8', 'swing'],
  ] },
  archer: { h: 1.3, parts: [
    ['box', [.13, .34, .14], [-.09, .17, 0], '#4b3b2a', 'legL'], ['box', [.13, .34, .14], [.09, .17, 0], '#4b3b2a', 'legR'],
    ['box', [.36, .38, .26], [0, .55, 0], '#3f5a35'], ['box', [.36, .5, .06], [0, .58, -.16], T],
    ['box', [.24, .24, .24], [0, .88, 0], '#e0b089'], ['cone', [.36, .3, .36], [0, 1.06, 0], '#3f5a35'],
    ['box', [.05, .74, .08], [-.25, .62, .14], '#7a5530', 'swing'], ['box', [.09, .3, .1], [.22, .56, 0], '#3f5a35', 'swing'],
  ] },
  hero: { h: 1.9, s: 1.25, parts: [
    ['box', [.17, .42, .18], [-.12, .21, 0], '#5a5560', 'legL'], ['box', [.17, .42, .18], [.12, .21, 0], '#5a5560', 'legR'],
    ['box', [.5, .5, .34], [0, .7, 0], '#c8a64a'], ['box', [.48, .72, .06], [0, .7, -.21], T],
    ['box', [.2, .14, .3], [-.33, .92, 0], '#d8b856'], ['box', [.2, .14, .3], [.33, .92, 0], '#d8b856'],
    ['box', [.28, .28, .28], [0, 1.1, 0], '#e0b089'], ['box', [.33, .2, .33], [0, 1.24, 0], '#d8b856'], ['box', [.06, .16, .3], [0, 1.4, 0], T],
    ['box', [.12, .1, .06], [0, .78, .18], '#7fe0ff', null, null, 'glow'],
    ['box', [.12, .36, .14], [.35, .72, 0], '#c8a64a', 'swing'], ['box', [.06, .06, .7], [.35, .6, .34], '#5a3e22', 'swing'],
    ['box', [.3, .22, .22], [.35, .6, .7], '#b9bec6', 'swing'],
  ] },
  hall: { h: 3.6, parts: [
    ['box', [2.7, 1.0, 2.7], [0, .5, 0], '#8f8676'], ['box', [2.1, 1.0, 2.1], [0, 1.5, 0], '#b89c74'],
    ['box', [2.2, .12, 2.2], [0, 1.96, 0], '#5d4128'], ['pyr', [3.1, 1.5, 3.1], [0, 2.75, 0], T],
    ['box', [.6, .78, .08], [0, .39, 1.36], '#3a2618'], ['box', [.7, 2.4, .7], [.98, 1.2, -.98], '#8f8676'], ['pyr', [1.0, .9, 1.0], [.98, 2.85, -.98], T],
    ['box', [.24, .26, .06], [-.55, 1.5, 1.06], '#ffcf7a', null, null, 'glow'], ['box', [.24, .26, .06], [.55, 1.5, 1.06], '#ffcf7a', null, null, 'glow'],
  ] },
  barracks: { h: 2.6, parts: [
    ['box', [2.8, 1.3, 2.2], [0, .65, 0], '#8a7f70'], ['ridge', [2.95, 1.6, 1.6], [0, 1.3, 0], T],
    ['box', [.8, .9, .08], [0, .45, 1.11], '#3a2618'], ['box', [.34, .34, .05], [-.9, .85, 1.12], T], ['box', [.34, .34, .05], [.9, .85, 1.12], T],
    ['box', [.3, .7, .3], [-1.0, 2.2, -.5], '#6d655a'],
  ] },
  farm: { h: 1.5, parts: [
    ['box', [1.8, .08, .72], [0, .04, .55], '#b3b94a'], ['box', [1.3, .8, 1.0], [0, .4, -.35], '#d8cdb5'], ['ridge', [1.42, .95, .95], [0, .82, -.35], T],
    ['box', [.3, .4, .05], [0, .2, .16], '#5d4128'],
  ] },
  tower: { h: 4.1, parts: [
    ['cyl', [1.2, 2.6, 1.2], [0, 1.3, 0], '#8f8676'], ['cyl', [1.5, .4, 1.5], [0, 2.75, 0], '#7d7466'], ['cone', [1.6, 1.1, 1.6], [0, 3.5, 0], T],
    ['box', [.14, .38, .05], [0, 1.8, .6], '#ffcf7a', null, null, 'glow'],
  ] },
  mine: { h: 2.0, parts: [
    ['ico', [2.9, 1.6, 2.9], [0, .45, 0], '#7a6e5e'], ['box', [.18, 1.15, .18], [-.5, .58, 1.28], '#5d4128'], ['box', [.18, 1.15, .18], [.5, .58, 1.28], '#5d4128'],
    ['box', [1.25, .18, .22], [0, 1.15, 1.28], '#5d4128'], ['box', [.82, .95, .1], [0, .48, 1.22], '#17110c'],
    ['ico', [.45, .38, .45], [.95, .95, .5], '#ffd34d', null, null, 'glow'], ['ico', [.36, .3, .36], [-.85, 1.0, .1], '#ffd34d', null, null, 'glow'], ['ico', [.4, .34, .4], [.25, 1.3, -.35], '#ffd34d', null, null, 'glow'],
  ] },
};
const SK = '#7f9a5a', WD = '#6b4a2e', DW = '#4a3220', BN = '#e6dcc4', HD = '#a3845f';
Object.assign(MODELS, {
  forge: { h: 2.3, parts: [
    ['box', [1.7, 1.0, 1.5], [0, .5, 0], '#8f8676'], ['ridge', [1.8, 1.0, 1.0], [0, 1.05, 0], T], ['box', [.36, 1.1, .36], [.55, 1.55, -.4], '#6d655a'],
    ['box', [.55, .36, .06], [0, .34, .76], '#ff7a2a', null, null, 'glow'], ['box', [.42, .25, .22], [-.55, .12, .98], '#4a4a50'],
  ] },
  lodge: { h: 3.6, parts: [
    ['cyl', [2.8, 1.1, 2.8], [0, .55, 0], WD], ['cone', [3.5, 1.9, 3.5], [0, 2.05, 0], T], ['cyl', [.22, 1.0, .22], [0, 3.3, 0], DW],
    ['cone', [.22, .9, .22], [1.5, .55, .4], BN], ['cone', [.22, .9, .22], [-1.5, .55, .4], BN], ['cone', [.22, .9, .22], [.9, .55, -1.3], BN], ['cone', [.22, .9, .22], [-.9, .55, -1.3], BN],
    ['box', [.72, .8, .1], [0, .4, 1.42], '#2a1c12'], ['box', [.32, .2, .32], [.95, .14, 1.3], '#ff8a3a', null, null, 'glow'],
  ] },
  warcamp: { h: 2.5, parts: [
    ['box', [2.7, 1.2, 2.2], [0, .6, 0], '#5e4128'], ['ridge', [2.85, 1.5, 1.5], [0, 1.25, 0], T], ['box', [.8, .9, .08], [0, .45, 1.11], '#2a1c12'],
    ['cone', [.2, .9, .2], [-1.3, .45, 1.25], '#8a6a44'], ['cone', [.2, .9, .2], [-.75, .45, 1.28], '#8a6a44'], ['cone', [.2, .9, .2], [.75, .45, 1.28], '#8a6a44'], ['cone', [.2, .9, .2], [1.3, .45, 1.25], '#8a6a44'],
    ['box', [.3, 1.7, .3], [1.15, .85, -1.0], '#7a5a3a'], ['box', [.46, .42, .46], [1.15, 1.85, -1.0], T],
  ] },
  burrow: { h: 1.4, parts: [
    ['ico', [1.9, 1.15, 1.9], [0, .3, 0], '#7a6248'], ['box', [.5, .55, .1], [0, .28, .85], '#2a1c12'],
    ['box', [.06, 1.3, .06], [.62, .65, .5], DW], ['box', [.04, .42, .46], [.62, 1.06, .74], T],
  ] },
  spire: { h: 3.6, parts: [
    ['cyl', [.9, 2.4, .9], [0, 1.2, 0], WD], ['box', [1.0, .3, 1.0], [0, 2.2, 0], T], ['cyl', [1.4, .25, 1.4], [0, 2.5, 0], DW],
    ['cone', [.15, .6, .15], [.55, 2.9, .55], BN], ['cone', [.15, .6, .15], [-.55, 2.9, .55], BN], ['cone', [.15, .6, .15], [.55, 2.9, -.55], BN], ['cone', [.15, .6, .15], [-.55, 2.9, -.55], BN],
    ['ico', [.38, .38, .38], [0, 2.95, 0], '#9dff5a', null, null, 'glow'],
  ] },
  bonecraft: { h: 2.0, parts: [
    ['box', [1.6, .9, 1.4], [0, .45, 0], WD], ['ridge', [1.7, 1.0, 1.0], [0, .95, 0], T],
    ['cyl', [.12, .95, .12], [-.75, .6, .75], BN], ['cyl', [.12, .95, .12], [-.45, .6, .78], BN], ['cyl', [.46, .3, .46], [.55, .15, .9], '#7dff5a', null, null, 'glow'],
  ] },
  gatherer: { h: 1.15, parts: [
    ['box', [.12, .32, .13], [-.08, .16, 0], '#4a3a28', 'legL'], ['box', [.12, .32, .13], [.08, .16, 0], '#4a3a28', 'legR'],
    ['box', [.36, .36, .26], [0, .5, 0], HD], ['box', [.38, .07, .28], [0, .43, 0], T], ['box', [.26, .26, .26], [0, .82, 0], SK], ['box', [.1, .14, .1], [0, 1.02, -.04], '#2a2018'],
    ['box', [.09, .3, .1], [.22, .52, 0], SK, 'swing'], ['box', [.05, .05, .42], [.23, .4, .18], '#6b4a2a', 'swing'], ['box', [.05, .2, .14], [.23, .4, .38], '#a0a4aa', 'swing'],
    ['box', [.26, .26, .2], [0, .55, -.2], '#e0b43a', null, 'G'], ['box', [.34, .13, .13], [0, .62, -.2], '#7b5530', null, 'L'],
  ] },
  brute: { h: 1.5, s: 1.1, parts: [
    ['box', [.16, .38, .17], [-.12, .19, 0], '#4a3a28', 'legL'], ['box', [.16, .38, .17], [.12, .19, 0], '#4a3a28', 'legR'],
    ['box', [.5, .46, .34], [0, .62, 0], SK], ['box', [.52, .12, .36], [0, .42, 0], T], ['box', [.24, .14, .32], [-.34, .86, 0], T],
    ['box', [.3, .28, .3], [0, .98, .02], SK], ['box', [.04, .09, .04], [.08, .9, .17], BN], ['box', [.04, .09, .04], [-.08, .9, .17], BN],
    ['box', [.13, .34, .14], [.33, .62, 0], SK, 'swing'], ['box', [.15, .15, .7], [.33, .5, .36], '#5a3e22', 'swing'],
  ] },
  spearman: { h: 1.3, parts: [
    ['box', [.13, .34, .14], [-.09, .17, 0], '#4a3a28', 'legL'], ['box', [.13, .34, .14], [.09, .17, 0], '#4a3a28', 'legR'],
    ['box', [.36, .38, .26], [0, .55, 0], '#8a6a44'], ['box', [.36, .5, .06], [0, .58, -.16], T], ['box', [.24, .24, .24], [0, .88, 0], SK], ['box', [.27, .06, .27], [0, .96, 0], T],
    ['box', [.09, .3, .1], [.22, .56, 0], SK, 'swing'], ['box', [.04, .04, .9], [.22, .62, .2], '#6b4a2a', 'swing'], ['box', [.07, .07, .16], [.22, .62, .7], '#c0c4c8', 'swing'],
  ] },
  sage: { h: 1.85, s: 1.2, parts: [
    ['cone', [.62, .92, .62], [0, .46, 0], '#e8e2d2'], ['box', [.4, .4, .3], [0, .96, 0], '#d8cfb8'], ['box', [.46, .12, .34], [0, 1.12, 0], T],
    ['box', [.26, .26, .26], [0, 1.3, 0], '#e0b089'], ['box', [.3, .06, .3], [0, 1.44, 0], '#d8b856'],
    ['box', [.05, 1.3, .05], [.3, .78, .1], '#5a3e22', 'swing'], ['ico', [.22, .22, .22], [.3, 1.46, .1], '#ffe27a', 'swing', null, 'glow'],
  ] },
  reaver: { h: 1.95, s: 1.25, parts: [
    ['box', [.17, .42, .18], [-.12, .21, 0], '#3a2e24', 'legL'], ['box', [.17, .42, .18], [.12, .21, 0], '#3a2e24', 'legR'],
    ['box', [.52, .5, .36], [0, .7, 0], SK], ['box', [.54, .1, .38], [0, .82, 0], T], ['box', [.22, .16, .3], [-.34, .95, 0], BN], ['box', [.22, .16, .3], [.34, .95, 0], BN],
    ['box', [.3, .3, .3], [0, 1.12, 0], SK], ['box', [.06, .16, .3], [0, 1.33, 0], T], ['box', [.2, .05, .04], [0, 1.14, .16], '#ff3a2a', null, null, 'glow'],
    ['box', [.13, .36, .14], [.36, .72, 0], SK, 'swing'], ['box', [.06, .06, .6], [.36, .6, .3], '#5a3e22', 'swing'], ['box', [.06, .3, .26], [.36, .6, .58], '#c0c4c8', 'swing'],
    ['box', [.06, .5, .06], [-.38, .55, .14], '#5a3e22'], ['box', [.06, .26, .24], [-.38, .78, .26], '#c0c4c8'],
  ] },
  seer: { h: 1.8, s: 1.2, parts: [
    ['cone', [.6, .9, .6], [0, .45, 0], '#5a4a3a'], ['box', [.4, .4, .3], [0, .95, 0], '#6b5a42'], ['box', [.46, .12, .34], [0, 1.12, 0], T],
    ['box', [.26, .26, .26], [0, 1.3, 0], SK], ['cone', [.38, .32, .38], [0, 1.5, 0], '#4a3a2a'],
    ['box', [.05, 1.3, .05], [.3, .76, .1], '#5a3e22', 'swing'], ['ico', [.22, .22, .22], [.3, 1.45, .1], '#7dff5a', 'swing', null, 'glow'],
  ] },
  ashwolf: { h: 0.95, parts: [
    ['box', [.1, .34, .1], [-.12, .17, .28], '#4a4846', 'legL'], ['box', [.1, .34, .1], [.12, .17, .28], '#4a4846', 'legR'],
    ['box', [.1, .34, .1], [-.12, .17, -.28], '#4a4846', 'legR'], ['box', [.1, .34, .1], [.12, .17, -.28], '#4a4846', 'legL'],
    ['box', [.34, .32, .8], [0, .5, 0], '#5d5a58'], ['box', [.26, .26, .32], [0, .64, .5], '#6a6664'], ['box', [.14, .12, .2], [0, .58, .72], '#4a4846'],
    ['box', [.08, .08, .36], [0, .6, -.52], '#4a4846'], ['box', [.17, .04, .03], [0, .68, .67], '#ffae3a', null, null, 'glow'],
  ] },
  spiritwolf: { h: 0.95, parts: [
    ['box', [.1, .34, .1], [-.12, .17, .28], '#5fb8e8', 'legL'], ['box', [.1, .34, .1], [.12, .17, .28], '#5fb8e8', 'legR'],
    ['box', [.1, .34, .1], [-.12, .17, -.28], '#5fb8e8', 'legR'], ['box', [.1, .34, .1], [.12, .17, -.28], '#5fb8e8', 'legL'],
    ['box', [.34, .32, .8], [0, .5, 0], '#8fdcff'], ['box', [.26, .26, .32], [0, .64, .5], '#a6e6ff'], ['box', [.08, .08, .36], [0, .6, -.52], T],
    ['box', [.17, .04, .03], [0, .68, .67], '#d8fbff', null, null, 'glow'],
  ] },
  hexer: { h: 1.3, parts: [
    ['cone', [.55, .8, .55], [0, .4, 0], '#3e2f4a'], ['box', [.32, .32, .24], [0, .9, 0], '#4a3a58'], ['box', [.24, .24, .24], [0, 1.12, 0], '#8a8f7a'],
    ['cone', [.34, .3, .34], [0, 1.3, 0], '#2e2238'], ['box', [.05, 1.1, .05], [.26, .65, .1], '#3a2a1a', 'swing'], ['ico', [.18, .18, .18], [.26, 1.22, .1], '#c07aff', 'swing', null, 'glow'],
  ] },
  stonehide: { h: 1.95, parts: [
    ['box', [.22, .5, .24], [-.2, .25, 0], '#5a5048', 'legL'], ['box', [.22, .5, .24], [.2, .25, 0], '#5a5048', 'legR'],
    ['box', [.8, .7, .55], [0, .92, 0], '#7a6e60'], ['ico', [.42, .38, .42], [-.45, 1.34, 0], '#8c857a'], ['ico', [.42, .38, .42], [.45, 1.34, 0], '#8c857a'],
    ['box', [.34, .3, .34], [0, 1.36, .24], '#6e6356'], ['box', [.16, .04, .03], [0, 1.4, .42], '#ff5a3a', null, null, 'glow'],
    ['box', [.2, .6, .22], [.52, .85, .1], '#7a6e60', 'swing'], ['box', [.3, .3, .3], [.52, .5, .22], '#5a5048', 'swing'], ['box', [.2, .6, .22], [-.52, .85, .1], '#7a6e60'],
  ] },
});
MODELS.warden = MODELS.hero; delete MODELS.hero;
const CAP = { worker: 200, footman: 160, archer: 160, gatherer: 200, brute: 160, spearman: 160, warden: 6, sage: 6, reaver: 6, seer: 6, hall: 24, barracks: 32, farm: 72, tower: 40, forge: 16,
  lodge: 24, warcamp: 32, burrow: 72, spire: 40, bonecraft: 16, mine: 24, ashwolf: 40, hexer: 40, stonehide: 16, spiritwolf: 16 };

function geo(kind) {
  switch (kind) {
    case 'cone': return new THREE.ConeGeometry(.5, 1, 8).translate(0, 0, 0);
    case 'pyr': return new THREE.ConeGeometry(.707, 1, 4).rotateY(PI / 4);
    case 'cyl': return new THREE.CylinderGeometry(.5, .5, 1, 10);
    case 'ico': return new THREE.IcosahedronGeometry(.5, 0);
    case 'ridge': return new THREE.BoxGeometry(1, .7071, .7071).rotateX(PI / 4);
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

export class View {
  constructor(canvas, overlay) {
    this.canvas = canvas; this.ov = overlay; this.ctx = overlay.getContext('2d');
    this.ents = new Map(); this.sel = new Set(); this.hover = 0; this.mySlot = 0; this.teams = [1, 2, 3, 4];
    this.cam = { x: 32, z: 40, d: 30, tx: 32, tz: 40, td: 30, pitch: 0.98 };
    this.snapInt = 0.05; this.clock = 0; this.fxMax = 0; this.trSeen = 0; this.removed = new Set();
    this.floaters = []; this.parts = []; this.arrows = []; this.rings = []; this.markers = []; this.showAllBars = false;
    this.onFx = () => {}; this.onSound = () => {}; this.onAlert = () => {};
    this.quiet = false; this.combat = 0; this.appliedOnce = false; this.pings = [];
    this.opts = { shadows: true, bloom: true, scale: 1 };
    this.fogOn = false; this.fogT = 0; this.vis = null; this.explored = null;
  }
  async init(opts = {}) {
    Object.assign(this.opts, opts);
    const r = this.renderer = new THREE.WebGPURenderer({ canvas: this.canvas, antialias: true, forceWebGL: !!opts.forceWebGL });
    await r.init();
    this.backend = r.backend && r.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color('#2b3636');
    sc.fog = new THREE.Fog('#2b3636', 40, 90);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 220);
    sc.add(new THREE.HemisphereLight('#cfe0ff', '#4a3b28', 1.05));
    const sun = this.sun = new THREE.DirectionalLight('#ffe9c4', 2.6);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const S = sun.shadow.camera; S.left = -28; S.right = 28; S.top = 28; S.bottom = -28; S.near = 1; S.far = 90;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    sc.add(sun, sun.target);
    this.geos = { box: geo('box'), cone: geo('cone'), pyr: geo('pyr'), cyl: geo('cyl'), ico: geo('ico'), ridge: geo('ridge') };
    // Fog of war: one small texture (a texel per tile) sampled by every world material.
    this.fogTex = this.makeFogTex(1, 1); this.fogTex.image.data.fill(255); this.fogTex.needsUpdate = true;
    this.fogSize = uniform(new THREE.Vector2(64, 64)); this.fogU = uniform(0);
    this.fogNode = texture(this.fogTex, positionWorld.xz.div(this.fogSize));
    // Outside the map the fog texture would smear its edge outward, so use a flat 'explored' dimming there.
    const fp = positionWorld.xz.div(this.fogSize), inside = step(0, fp.x).mul(step(fp.x, 1)).mul(step(0, fp.y)).mul(step(fp.y, 1));
    this.fogF = mix(float(1), mix(float(0.36), this.fogNode.r, inside), this.fogU);
    // Cloud shadows: two layers of tiling noise drifting at different speeds.
    this.cloudTex = makeCloudTex();
    const cw = positionWorld.xz;
    const n1 = texture(this.cloudTex, cw.mul(0.011).add(time.mul(vec2(0.0042, 0.0026)))).r, n2 = texture(this.cloudTex, cw.mul(0.029).sub(time.mul(vec2(0.0021, 0.0034)))).r;
    this.cloudF = mix(float(0.7), float(1), smoothstep(0.36, 0.6, n1.mul(0.65).add(n2.mul(0.35))));
    this.envF = this.fogF.mul(this.cloudF);
    this.tcols = TEAM_COLORS.map(c => new THREE.Color(c));
    this.buildModels();
    this.buildFx();
    this.setupPost();
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  makeFogTex(w, h) {
    const t = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace;
    return t;
  }
  mat(c, o = {}) {
    const m = new THREE.MeshStandardNodeMaterial({ roughness: o.rough ?? 0.75, metalness: o.metal ?? 0.05, flatShading: !!o.flat, vertexColors: !!o.vc, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
    m.colorNode = (o.colorNode || color(c)).mul(o.noCloud ? this.fogF : this.envF);
    if (o.glow) m.emissiveNode = color(c).mul(o.glow).mul(this.fogF);
    return m;
  }
  setFog(on, mySlot, teams) {
    this.fogOn = !!on && mySlot >= 0; this.fogU.value = this.fogOn ? 1 : 0; this.fogT = 0;
    this.myTeam = mySlot >= 0 ? teams[mySlot] : -1;
  }
  visAt(x, z) { if (!this.fogOn || !this.vis) return true; const m = this.map, tx = Math.floor(x), tz = Math.floor(z); return tx >= 0 && tz >= 0 && tx < m.w && tz < m.h && this.vis[tz * m.w + tx] === 1; }
  ally(e) { return e.o < 4 && this.teams[e.o] === this.myTeam; }
  updateFog() {
    const m = this.map; if (!m) return;
    const W = m.w, H = m.h, vis = this.vis, ex = this.explored; vis.fill(0);
    for (const e of this.ents.values()) {
      if (e.st === 'd' || !this.ally(e)) continue;
      const k = KINDS[e.k], r = (k.sight || 6) * (k.b && e.st === 'c' ? 0.6 : 1), cx = Math.floor(e.x), cz = Math.floor(e.z), R = Math.ceil(r);
      for (let y = Math.max(0, cz - R); y <= Math.min(H - 1, cz + R); y++) for (let x = Math.max(0, cx - R); x <= Math.min(W - 1, cx + R); x++) {
        const dx = x + .5 - e.x, dz = y + .5 - e.z; if (dx * dx + dz * dz <= r * r) { vis[y * W + x] = 1; ex[y * W + x] = 1; }
      }
    }
    const d = this.fogTex.image.data;
    for (let i = 0; i < W * H; i++) { const v = vis[i] ? 255 : ex[i] ? 105 : 22; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    this.fogTex.needsUpdate = true;
    for (const e of this.ents.values()) { e.vis = this.ally(e) || this.visAt(e.x, e.z) || (KINDS[e.k].b && this.visAt(e.x + .9, e.z + .9)); if (e.vis && KINDS[e.k].b) e.seen = true; }
  }
  shown(e) { return !this.fogOn || e.vis || (KINDS[e.k].b && e.seen); }
  setupPost() {
    this.post = null;
    try {
      const p = new THREE.RenderPipeline(this.renderer), sp = pass(this.scene, this.camera), col = sp.getTextureNode('output');
      const lit = this.opts.bloom ? col.add(bloom(col, 0.62, 0.42, 0.86)) : col;
      // Gentle vignette and a slightly warm grade pull the eye to the middle of the battlefield.
      const vig = float(1).sub(smoothstep(0.38, 0.95, screenUV.sub(0.5).mul(vec2(1.15, 1)).length()).mul(0.3));
      p.outputNode = vec4(lit.rgb.mul(vec3(1.03, 1.0, 0.96)).mul(vig), lit.a);
      this.post = p;
    } catch (e) { console.warn('post effects off', e); this.post = null; }
  }
  setQuality(o) {
    Object.assign(this.opts, o);
    this.sun.castShadow = !!this.opts.shadows;
    this.fx.lights.enable(!!this.opts.bloom);
    this.setupPost(); this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, 2) * (this.opts.scale || 1);
    this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.ov.width = w * dpr; this.ov.height = h * dpr; this.ov.style.width = w + 'px'; this.ov.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.W = w; this.H = h;
  }

  // ---------- map / terrain ----------
  setMap(map) {
    this.map = map; const W = map.w, H = map.h;
    if (this.terrain) { this.scene.remove(this.terrain, this.water, this.outer, this.rockMesh); this.terrain.geometry.dispose(); this.terrain.material.dispose(); this.water.material.dispose(); }
    const vw = W + 1, n = vw * (H + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = y * vw + x, b = a + 1, c = a + vw, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setIndex(idx);
    this.hv = new Float32Array(n);
    this.terrain = new THREE.Mesh(g, this.mat('#ffffff', { vc: true, rough: 0.96, metal: 0 }));
    this.terrain.receiveShadow = true;
    const wm = new THREE.MeshStandardNodeMaterial({ roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.86 });
    const px = positionWorld.x, pz = positionWorld.z;
    const w1 = sin(px.mul(1.7).add(time.mul(1.3))).mul(sin(pz.mul(1.25).sub(time.mul(0.9)))).mul(0.5).add(0.5);
    const w2 = sin(px.add(pz).mul(0.9).add(time.mul(0.7))).mul(0.5).add(0.5), w3 = texture(this.cloudTex, positionWorld.xz.mul(0.06).add(time.mul(vec2(0.01, 0.006)))).r;
    wm.colorNode = mix(color('#1a5164'), color('#3b8ea3'), w1.mul(0.45).add(w2.mul(0.25)).add(w3.mul(0.3))).mul(this.envF);
    // Sun glints dancing on the surface (bright enough to bloom), dimmed under cloud shadow.
    const g1 = texture(this.cloudTex, positionWorld.xz.mul(0.21).add(time.mul(vec2(0.021, 0.013)))).r, g2 = texture(this.cloudTex, positionWorld.xz.mul(0.29).sub(time.mul(vec2(0.017, 0.026)))).r;
    wm.emissiveNode = color('#fff0c8').mul(smoothstep(0.47, 0.6, g1.mul(g2)).mul(2.0)).mul(this.fogF.mul(this.cloudF.sub(0.6).mul(2.5)));
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-PI / 2), wm); this.water.position.set(W / 2, -0.32, H / 2);
    this.outer = new THREE.Mesh(new THREE.PlaneGeometry(W * 4, H * 4).rotateX(-PI / 2), this.outerMat ||= this.mat('#33402a', { rough: 1 }));
    this.outer.position.set(W / 2, -0.4, H / 2);
    this.scene.add(this.terrain, this.water, this.outer);
    this.removed = new Set(); this.trSeen = 0;
    const old = this.fogTex; this.fogTex = this.makeFogTex(W, H); this.fogNode.value = this.fogTex; old.dispose();
    this.fogSize.value.set(W, H); this.vis = new Uint8Array(W * H); this.explored = new Uint8Array(W * H); this.fogTex.image.data.fill(255); this.fogTex.needsUpdate = true;
    this.refreshTerrain(); this.setTrees(map.trees); this.rebuildBlk();
  }
  refreshTerrain() {
    const m = this.map, W = m.w, H = m.h, vw = W + 1, pos = this.terrain.geometry.attributes.position, col = this.terrain.geometry.attributes.color;
    const tc = TILES.map(t => new THREE.Color(t.col));
    const rand = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
      let hs = 0, n = 0, r = 0, gg = 0, b = 0, allWalk = true;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const tx = Math.min(W - 1, Math.max(0, x + dx)), ty = Math.min(H - 1, Math.max(0, y + dy)), t = m.tiles[ty * W + tx];
        hs += TILES[t].h; r += tc[t].r; gg += tc[t].g; b += tc[t].b; n++; if (!TILES[t].walk) allWalk = false;
      }
      const v = y * vw + x, nz = rand(x, y), h = hs / n + (allWalk ? (nz - 0.5) * 0.05 : (nz - 0.5) * 0.35);
      this.hv[v] = h; pos.setXYZ(v, x, h, y);
      const k = 0.88 + nz * 0.24; col.setXYZ(v, r / n * k, gg / n * k, b / n * k);
    }
    pos.needsUpdate = true; col.needsUpdate = true; this.terrain.geometry.computeVertexNormals();
    this.terrain.geometry.computeBoundingSphere();
    this.buildRocks();
    this.buildGrass();
    this.miniBase = null;
  }
  heightAt(x, z) {
    const m = this.map; if (!m) return 0;
    const W = m.w, vw = W + 1; x = Math.max(0, Math.min(W - 0.001, x)); z = Math.max(0, Math.min(m.h - 0.001, z));
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, hv = this.hv;
    const a = hv[iz * vw + ix], b = hv[iz * vw + ix + 1], c = hv[(iz + 1) * vw + ix], d = hv[(iz + 1) * vw + ix + 1];
    return Math.max(-0.3, (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz);
  }
  buildRocks() {
    if (this.rockMesh) { this.scene.remove(this.rockMesh); this.rockMesh.dispose(); }
    const m = this.map, list = [];
    for (let i = 0; i < m.tiles.length; i++) if (m.tiles[i] === 4) { const s = Math.sin(i * 12.9898) * 43758.5; if (s - Math.floor(s) < 0.35) list.push(i); }
    const mesh = this.rockMesh = new THREE.InstancedMesh(this.geos.ico, this.rockMat ||= this.mat('#77716a', { rough: 0.9, flat: true }), Math.max(1, list.length));
    list.forEach((i, j) => {
      const x = i % m.w + .5, z = ((i / m.w) | 0) + .5, r = (Math.sin(i * 7.7) + 1) / 2, s = 0.7 + r * 0.9;
      tmpM.compose(tmpV.set(x, this.heightAt(x, z) + 0.1, z), tmpQ.setFromAxisAngle(UP, r * 6), tmpS.set(s, s * 0.8, s)); mesh.setMatrixAt(j, tmpM);
    });
    mesh.count = list.length; mesh.castShadow = true; mesh.receiveShadow = true; this.scene.add(mesh);
  }
  // Tufts of grass on grass tiles, swaying in a wind that rolls across the map.
  buildGrass() {
    const m = this.map, W = m.w;
    if (!this.grass) {
      const P = [], N = [];
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * PI * 2 + hash(i) * 0.6, r = 0.05 + hash(i + 9) * 0.07, bx = Math.cos(a) * r, bz = Math.sin(a) * r, ht = 0.2 + hash(i + 3) * 0.17;
        const sx = -Math.sin(a) * 0.035, sz = Math.cos(a) * 0.035;
        P.push(bx - sx, 0, bz - sz, bx + sx, 0, bz + sz, bx + Math.cos(a) * 0.07, ht, bz + Math.sin(a) * 0.07);
        N.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      const gm = this.mat('#ffffff', { rough: 1 }); gm.side = THREE.DoubleSide;
      gm.colorNode = mix(float(0.62), float(1.18), positionGeometry.y.div(0.37).clamp(0, 1)).mul(this.envF);
      const wv = sin(time.mul(1.9).sub(positionLocal.x.mul(0.45)).sub(positionLocal.z.mul(0.3))).mul(0.5).add(0.5), bend = positionGeometry.y.mul(positionGeometry.y).mul(0.9);
      gm.positionNode = positionLocal.add(vec3(wv.mul(0.9).add(0.15).mul(bend), 0, wv.mul(0.35).mul(bend)));
      this.grass = new THREE.InstancedMesh(g, gm, 9000);
      this.grass.receiveShadow = true; this.grass.frustumCulled = false; this.grass.setColorAt(0, tmpC.set(1, 1, 1));
      this.scene.add(this.grass);
    }
    const gm = this.grass, cols = ['#5d8a32', '#6e9a3a', '#4f7c2c', '#82a845'].map(c => new THREE.Color(c));
    let n = 0;
    for (let i = 0; i < m.tiles.length && n < 9000; i++) {
      if (m.tiles[i] !== 0) continue;
      const tx = i % W, tz = (i / W) | 0;
      for (let j = 0; j < 2; j++) {
        const r1 = hash(i * 3 + j), r2 = hash(i * 7 + j * 13), r3 = hash(i * 11 + j * 5);
        const x = tx + 0.1 + r1 * 0.8, z = tz + 0.1 + r2 * 0.8, sc = 0.75 + r3 * 0.7;
        tmpM.compose(tmpV.set(x, this.heightAt(x, z) - 0.02, z), tmpQ.setFromAxisAngle(UP, r3 * 6.28), tmpS.set(sc, sc * (0.8 + r1 * 0.5), sc)); gm.setMatrixAt(n, tmpM);
        gm.setColorAt(n++, tmpC.copy(cols[(r1 * 4) | 0]).multiplyScalar(0.85 + r2 * 0.3));
      }
    }
    gm.count = n; gm.visible = n > 0; gm.instanceMatrix.needsUpdate = true; gm.instanceColor.needsUpdate = true;
  }
  setTrees(trees) {
    for (const k of ['trunk', 'can1', 'can2']) if (this[k]) { this.scene.remove(this[k]); this[k].dispose(); this[k].geometry !== this.geos.cyl && this[k].geometry.dispose(); }
    const list = [...trees], W = this.map.w, H = this.map.h, border = [];
    // A band of forest outside the playable area so the world doesn't end at a cliff.
    for (let z = -9; z < H + 9; z++) for (let x = -9; x < W + 9; x++) {
      if (x >= 0 && z >= 0 && x < W && z < H) continue;
      const d = Math.max(-x, -z, x - W + 1, z - H + 1), r = hash(x * 31 + z * 57 + 3);
      if (r < 0.62 - d * 0.035) border.push(x * 1000 + z);
    }
    const n = Math.max(1, list.length + border.length);
    this.treeIdx = new Map();
    if (!this.treeMats) {
      // Canopies sway with the same rolling wind as the grass; higher leaves move more.
      const can = this.mat('#ffffff', { rough: 0.9, flat: true }), lift = positionLocal.y.sub(0.4).max(0);
      can.positionNode = positionLocal.add(vec3(sin(time.mul(1.3).sub(positionLocal.x.mul(0.31)).sub(positionLocal.z.mul(0.17))).mul(0.045).mul(lift), 0, sin(time.mul(1.05).add(positionLocal.z.mul(0.29))).mul(0.03).mul(lift)));
      this.treeMats = { '#5b4129': this.mat('#5b4129', { rough: 0.9, flat: true }), '#ffffff': can };
    }
    const mk = (g, c) => { const m = new THREE.InstancedMesh(g, this.treeMats[c], n); m.castShadow = true; m.receiveShadow = true; m.count = list.length + border.length; this.scene.add(m); return m; };
    this.trunk = mk(this.geos.cyl, '#5b4129'); this.can1 = mk(new THREE.ConeGeometry(.5, 1, 7), '#ffffff'); this.can2 = mk(new THREE.ConeGeometry(.5, 1, 7), '#ffffff');
    const greens = ['#2f5d2a', '#386b2d', '#2a5230', '#3f6f33'].map(c => new THREE.Color(c));
    list.forEach((t, j) => {
      this.treeIdx.set(t, j);
      const r1 = (Math.sin(t * 91.3) + 1) / 2, r2 = (Math.sin(t * 17.1) + 1) / 2;
      const x = t % W + .5 + (r1 - .5) * .3, z = ((t / W) | 0) + .5 + (r2 - .5) * .3, y = this.heightAt(x, z), s = 0.85 + r1 * 0.4, rot = r2 * 6;
      tmpQ.setFromAxisAngle(UP, rot);
      tmpM.compose(tmpV.set(x, y + .35 * s, z), tmpQ, tmpS.set(.22 * s, .7 * s, .22 * s)); this.trunk.setMatrixAt(j, tmpM);
      tmpM.compose(tmpV.set(x, y + 1.05 * s, z), tmpQ, tmpS.set(1.25 * s, 1.1 * s, 1.25 * s)); this.can1.setMatrixAt(j, tmpM);
      tmpM.compose(tmpV.set(x, y + 1.7 * s, z), tmpQ, tmpS.set(.9 * s, .95 * s, .9 * s)); this.can2.setMatrixAt(j, tmpM);
      const g = greens[(t * 7) % 4]; this.can1.setColorAt(j, g); this.can2.setColorAt(j, tmpC.copy(g).multiplyScalar(1.12));
    });
    border.forEach((c, b) => {
      const j = list.length + b, bx = Math.round(c / 1000), bz = c - bx * 1000, r1 = hash(c * 1.7), r2 = hash(c * 2.3 + 1);
      const x = bx + .5 + (r1 - .5) * .6, z = bz + .5 + (r2 - .5) * .6, y = -0.4, s = 0.95 + r1 * 0.6;
      tmpQ.setFromAxisAngle(UP, r2 * 6);
      tmpM.compose(tmpV.set(x, y + .35 * s, z), tmpQ, tmpS.set(.22 * s, .7 * s, .22 * s)); this.trunk.setMatrixAt(j, tmpM);
      tmpM.compose(tmpV.set(x, y + 1.05 * s, z), tmpQ, tmpS.set(1.25 * s, 1.1 * s, 1.25 * s)); this.can1.setMatrixAt(j, tmpM);
      tmpM.compose(tmpV.set(x, y + 1.7 * s, z), tmpQ, tmpS.set(.9 * s, .95 * s, .9 * s)); this.can2.setMatrixAt(j, tmpM);
      const g = greens[(b * 7) % 4]; this.can1.setColorAt(j, tmpC.copy(g).multiplyScalar(0.85)); this.can2.setColorAt(j, tmpC.copy(g).multiplyScalar(0.95));
    });
    for (const k of ['trunk', 'can1', 'can2']) { this[k].instanceMatrix.needsUpdate = true; if (this[k].instanceColor) this[k].instanceColor.needsUpdate = true; this[k].frustumCulled = false; }
    if (this.fx) this.fx.trees = list.map(t => [t % W + .5, ((t / W) | 0) + .5, t]);
    this.miniBase = null;
  }
  hideTree(t) {
    const j = this.treeIdx && this.treeIdx.get(t); if (j === undefined) return;
    for (const k of ['trunk', 'can1', 'can2']) { this[k].setMatrixAt(j, ZERO); this[k].instanceMatrix.needsUpdate = true; }
    this.miniBase = null;
  }
  rebuildBlk() {
    const m = this.map; if (!m) return;
    const b = this.blk = new Uint8Array(m.w * m.h);
    for (let i = 0; i < b.length; i++) if (!TILES[m.tiles[i]].walk) b[i] = 1;
    for (const t of m.trees) if (!this.removed.has(t) && !b[t]) b[t] = 2;
    for (const e of this.ents.values()) { const k = KINDS[e.k]; if (!k.b) continue; const f = footprint(k.size, Math.floor(e.x), Math.floor(e.z)); for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) b[y * m.w + x] = 3; }
  }
  isTree(tx, ty) { const m = this.map; const i = ty * m.w + tx; return tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && this.blk[i] === 2 ? i : -1; }
  canPlace(kind, tx, ty) {
    const f = footprint(KI[kind].size, tx, ty), m = this.map, out = [];
    for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) out.push([x, y, x >= 0 && y >= 0 && x < m.w && y < m.h && this.blk[y * m.w + x] === 0]);
    return out;
  }

  // ---------- models ----------
  buildModels() {
    const mats = new Map();
    this.km = KINDS.map(k => {
      const M = MODELS[k.id], cap = CAP[k.id]; if (!M) return null;
      const tipI = M.parts.reduce((a, q, i) => q[4] === 'swing' ? i : a, -1);
      const meshes = M.parts.map((p, pi) => {
        const [g, size, pos, c, anim, vis, glow] = p, flat = g === 'ico' || g === 'cone', key = `${c}|${flat}|${!!glow}`;
        if (!mats.has(key)) mats.set(key, this.mat(c === T ? '#ffffff' : c, { flat, metal: c === '#c8a64a' || c === '#d8b856' ? 0.35 : 0.05, glow: glow ? 2.4 : 0 }));
        const mesh = new THREE.InstancedMesh(this.geos[g], mats.get(key), cap);
        mesh.castShadow = true; mesh.receiveShadow = !!k.b; mesh.frustumCulled = false; mesh.count = 0;
        mesh.setColorAt(0, tmpC.set(1, 1, 1));
        this.scene.add(mesh);
        const B = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion(), new THREE.Vector3(...size));
        let pivot = null;
        if (anim === 'legL' || anim === 'legR') pivot = new THREE.Vector3(pos[0], pos[1] + size[1] / 2, pos[2]);
        if (anim === 'swing') pivot = new THREE.Vector3(pos[0], (M.parts.find(q => q[4] === 'swing')[2][1]) + .16, 0);
        const gc = glow ? new THREE.Color(c) : null, gs = Math.max(...size);
        return { mesh, B, anim, vis, team: c === T, glow: !!glow, tip: pi === tipI, gc: gc && [gc.r, gc.g, gc.b], gs, fire: !!gc && gs >= 0.3 && gc.r > 0.8 && gc.g < 0.35 };
      });
      return { meshes, model: M, cap };
    });
  }
  buildFx() {
    this.selMesh = new THREE.InstancedMesh(new THREE.RingGeometry(.86, 1, 40).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }), 128);
    this.selMesh.frustumCulled = false; this.selMesh.count = 0; this.selMesh.setColorAt(0, tmpC.set(1, 1, 1)); this.scene.add(this.selMesh);
    this.ghost = new THREE.InstancedMesh(new THREE.PlaneGeometry(.94, .94).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), 64);
    this.ghost.frustumCulled = false; this.ghost.count = 0; this.ghost.setColorAt(0, tmpC.set(1, 1, 1)); this.scene.add(this.ghost);
    this.pMesh = new THREE.InstancedMesh(this.geos.box, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 700);
    this.pMesh.frustumCulled = false; this.pMesh.count = 0; this.pMesh.setColorAt(0, tmpC.set(1, 1, 1)); this.scene.add(this.pMesh);
    this.aMesh = new THREE.InstancedMesh(this.geos.box, new THREE.MeshStandardMaterial({ color: '#d8c79a', emissive: '#ffcf7a', emissiveIntensity: 0.22 }), 96);
    this.aMesh.frustumCulled = false; this.aMesh.count = 0; this.scene.add(this.aMesh);
    this.ringMesh = new THREE.InstancedMesh(new THREE.RingGeometry(.8, 1, 48).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 24);
    this.ringMesh.frustumCulled = false; this.ringMesh.count = 0; this.ringMesh.setColorAt(0, tmpC.set(1, 1, 1)); this.scene.add(this.ringMesh);
    this.fx = new FX(this.scene, this.fogF, (x, z) => this.heightAt(x, z));
    this.fx.treeGone = t => this.removed.has(t);
    this.fx.lights.enable(!!this.opts.bloom);
  }

  // ---------- state from snapshots ----------
  reset() { this.appliedOnce = false; this.pings = []; this.combat = 0; if (this.explored) this.explored.fill(0); this.ents.clear(); this.sel.clear(); this.fxMax = 0; this.trSeen = 0; this.parts.length = 0; this.arrows.length = 0; this.fx.clear(); this.rings.length = 0; this.floaters.length = 0; this.last = null; }
  apply(s, opt = {}) {
    const now = this.clock, seen = new Set(); let bChanged = false;
    this.last = s;
    for (const d of s.ents) {
      let e = this.ents.get(d.id);
      if (!e || e.k !== d.k || e.o !== d.o) {
        if (e && KINDS[e.k].b) bChanged = true;
        e = { ...d, rx: d.x, rz: d.z, rf: d.face, vx: 0, vz: 0, ta: now, flash: 0, swingT: 0, walk: Math.random() * 6, spd: 0, born: now };
        e.vis = !this.fogOn || this.ally(e) || this.visAt(d.x, d.z); if (e.vis && KINDS[d.k].b) e.seen = true;
        if (!opt.silent && this.appliedOnce && e.vis) {
          const k = KINDS[d.k];
          if (k.b && d.st === 'c') this.sound('place', d.x, d.z);
          else if (k.u && !k.summon && !k.creep && d.o === this.mySlot) this.sound(k.hero ? 'readyHero' : 'ready', d.x, d.z);
        }
        this.ents.set(d.id, e); if (KINDS[d.k].b) bChanged = true;
      } else {
        const dt = Math.max(0.03, Math.min(0.5, now - e.ta));
        e.vx = (d.x - e.x) / dt; e.vz = (d.z - e.z) / dt;
        if (Math.hypot(e.vx, e.vz) > 9) { e.vx = e.vz = 0; e.rx = d.x; e.rz = d.z; }
        if (!opt.silent && (e.vis || !this.fogOn)) {
          if (d.hp < e.hp - 0.5) { this.sound(hitName(KINDS[e.k]), e.rx, e.rz); this.combat++; e.flash = 1; this.hitFx(e); }
          if (d.ac !== e.ac) { e.swingT = 0.0001; const k = KINDS[e.k]; this.sound(k.proj ? shotName(k) : 'swing', e.rx, e.rz); if (k.proj) { const t = this.ents.get(d.tg); if (t) this.shoot(e, t); } }
        } else if (!opt.silent && d.ac !== e.ac && KINDS[e.k].proj) { const t = this.ents.get(d.tg); if (t && (t.vis || this.ally(t))) this.shoot(e, t);
        }
        if (!opt.silent && d.hp < e.hp - 0.5 && e.o === this.mySlot) this.onAlert(e);
        Object.assign(e, { x: d.x, z: d.z, hp: d.hp, face: d.face, st: d.st, ac: d.ac, tg: d.tg, ex: d.ex, ta: now });
      }
      seen.add(d.id);
    }
    for (const [id, e] of this.ents) if (!seen.has(id)) {
      if (!opt.silent && (e.vis || !this.fogOn)) { this.deathFx(e); this.sound(dieName(KINDS[e.k]), e.rx, e.rz); }
      this.ents.delete(id); this.sel.delete(id); if (KINDS[e.k].b) bChanged = true;
    }
    for (let i = this.trSeen; i < s.tr.length; i++) { const t = s.tr[i]; if (!this.removed.has(t)) { this.removed.add(t); this.hideTree(t); bChanged = true; } }
    this.trSeen = s.tr.length; this.appliedOnce = true;
    if (bChanged) this.rebuildBlk();
    for (const f of s.fx) if (f.i > this.fxMax) {
      this.fxMax = f.i; if (opt.silent) continue;
      const y = this.heightAt(f.x, f.z), seen = this.visAt(f.x, f.z), mine = f.o === this.mySlot;
      const snd = { clap: 'clap', whirl: 'whirl', rally: 'rally', mend: 'mend', frenzy: 'frenzy', sun: 'sun', snare: 'snare', wolves: 'wolves', lvl: 'lvl', done: 'done' }[f.k];
      if (snd && seen) this.sound(snd, f.x, f.z, f.k === 'done' && !mine ? 0.5 : 1);
      if (mine && f.k === 'upg') this.sound('upg', f.x, f.z, 1.2);
      if (mine && f.k === 'bounty') this.sound('bounty', f.x, f.z, 1.2);
      if (mine && f.k === 'dep') this.sound(f.v > 0 ? 'depGold' : 'depWood', f.x, f.z);
      if (seen) this.spellFx(f, y);
      this.onFx(f);
    }
  }
  // Ability and event visuals: shock rings, light columns, motes and real light on the ground.
  spellFx(f, y) {
    const fx = this.fx, x = f.x, z = f.z;
    switch (f.k) {
      case 'clap': // Stormclap: blue-white shockwave with crackling arcs
        this.ring(x, z, [1.4, 2.6, 3.2], 3.4, 0.5); this.ring(x, z, [0.8, 1.4, 2], 2.2, 0.35);
        fx.flash(x, y + 1.2, z, [0.45, 0.7, 1], 30, 0.45, 9, 3.2, 0.9);
        for (let a = 0; a < 7; a++) {
          let px = x, pz = z; const ang = a / 7 * PI * 2 + rnd(-.3, .3);
          for (let i = 0; i < 7; i++) { px += Math.cos(ang) * 0.45 + rnd(-.2, .2); pz += Math.sin(ang) * 0.45 + rnd(-.2, .2); fx.add({ x: px, y: y + 0.2 + rnd(0, .3), z: pz, vx: 0, vy: 0, vz: 0, life: 0.22 + i * 0.02, s0: 0.26, s1: 0.05, c: [1.6, 2.4, 3.4], w: 1, g: 0, drag: 0 }); }
        }
        fx.spark(x, y + 0.3, z, 26, [1.6, 2.3, 3], 6, 0.14, { life: 0.5, g: 6 });
        break;
      case 'whirl': // Whirling Axes: a spinning ring of sparks
        this.ring(x, z, [3, 1.1, 0.6], 3.1, 0.4); fx.flash(x, y + 1, z, [1, 0.45, 0.2], 18, 0.35, 7, 2.8, 1.2);
        for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2; fx.add({ x: x + Math.cos(a) * 1.2, y: y + 0.8, z: z + Math.sin(a) * 1.2, vx: -Math.sin(a) * 7 + Math.cos(a) * 2, vy: rnd(0, 1), vz: Math.cos(a) * 7 + Math.sin(a) * 2, life: 0.35, s0: 0.22, s1: 0.02, c: [2.6, 1.3, 0.6], w: 1, g: 0, drag: 2.5 }); }
        break;
      case 'rally': // Rallying Cry: golden burst and rising motes
        this.ring(x, z, [1.5, 1.2, 0.45], 7, 0.7); fx.flash(x, y + 1.5, z, [1, 0.8, 0.35], 22, 0.6, 9, 4, 1.6);
        for (let i = 0; i < 36; i++) { const a = rnd(0, 6.3), r = rnd(0, 3.5); fx.add({ x: x + Math.cos(a) * r, y: y + 0.2, z: z + Math.sin(a) * r, vx: 0, vy: rnd(1.2, 2.6), vz: 0, life: rnd(0.8, 1.3), s0: 0.16, s1: 0.03, c: [3, 2.4, 0.9], w: 1, g: 0, drag: 0.3, fade: 'in' }); }
        break;
      case 'mend': // Mend: soft green-gold light rising from the healed
        this.ring(x, z, [1, 3, 1.2], 4.5, 0.7); fx.flash(x, y + 1.2, z, [0.55, 1, 0.55], 16, 0.8, 9, 4.6, 0);
        for (let i = 0; i < 46; i++) { const a = rnd(0, 6.3), r = rnd(0, 4.5); fx.add({ x: x + Math.cos(a) * r, y: y + 0.1, z: z + Math.sin(a) * r, vx: 0, vy: rnd(0.9, 2), vz: 0, life: rnd(0.9, 1.5), s0: 0.18, s1: 0.03, c: [1.3, 3, 1.4], w: 1, g: 0, drag: 0.2, fade: 'in' }); }
        break;
      case 'frenzy':
        fx.flash(x, y + 1, z, [1, 0.25, 0.1], 14, 0.5, 6, 2, 1);
        fx.spark(x, y + 1, z, 28, [3, 0.5, 0.25], 3, 0.18, { life: 0.6, g: -1, drag: 1 });
        break;
      case 'sun': // Sunburst: a pillar of light falls on the spot
        this.ring(x, z, [3.2, 2.8, 1.4], 2.8, 0.55); this.ring(x, z, [2, 1.6, 0.6], 3.6, 0.8);
        fx.flash(x, y + 2, z, [1, 0.9, 0.6], 50, 0.65, 11, 3, 2.2);
        for (let i = 0; i < 26; i++) fx.add({ x: x + rnd(-.25, .25), y: y + 9 - i * 0.34, z: z + rnd(-.25, .25), vx: 0, vy: -7, vz: 0, life: 0.3 + i * 0.012, s0: 0.9, s1: 0.4, c: [2.6, 2.3, 1.3], w: 1, g: 0, drag: 0 });
        fx.spark(x, y + 0.3, z, 40, [3.4, 3, 1.6], 4, 0.16, { life: 0.8, g: 3 });
        break;
      case 'snare': // Bramble Snare: glowing thorns burst from the ground
        this.ring(x, z, [0.9, 2.6, 0.5], 2.8, 0.9); fx.flash(x, y + 0.8, z, [0.45, 1, 0.25], 12, 0.9, 7, 3.2, 0);
        for (let i = 0; i < 30; i++) { const a = rnd(0, 6.3), r = rnd(0.2, 2.8); fx.add({ x: x + Math.cos(a) * r, y: y + 0.05, z: z + Math.sin(a) * r, vx: 0, vy: rnd(1.5, 3), vz: 0, life: rnd(0.4, 0.8), s0: 0.2, s1: 0.04, c: [0.8, 2.6, 0.5], w: 1, g: 4, drag: 0 }); }
        break;
      case 'wolves':
        fx.flash(x, y + 0.8, z, [0.4, 0.75, 1], 18, 0.6, 7, 2.6, 1.6);
        fx.spark(x, y + 0.5, z, 34, [1.1, 2.4, 3.4], 3, 0.16, { life: 0.7, g: 1 });
        break;
      case 'lvl': // Level up: golden column
        this.ring(x, z, [3, 2.5, 0.8], 1.6, 0.7); fx.flash(x, y + 1.5, z, [1, 0.82, 0.35], 20, 0.8, 7, 2, 1.4);
        for (let i = 0; i < 24; i++) { const a = rnd(0, 6.3); fx.add({ x: x + Math.cos(a) * 0.55, y: y + rnd(0, 0.6), z: z + Math.sin(a) * 0.55, vx: 0, vy: rnd(2.5, 4.5), vz: 0, life: rnd(0.6, 1), s0: 0.2, s1: 0.03, c: [3, 2.5, 0.9], w: 1, g: 0, drag: 0.5 }); }
        break;
      case 'done':
        this.debris(x, y + .4, z, 18, [0.9, 0.8, 0.6], 3, 0.12);
        fx.spark(x, y + 1, z, 18, [2.6, 2.2, 1.1], 2.5, 0.14, { life: 0.8, g: 2 });
        break;
      case 'bounty':
        fx.spark(x, y + 1, z, 14, [3, 2.4, 0.6], 1.5, 0.12, { life: 0.9, g: 3, vy: 2.5 });
        break;
    }
  }
  deathFx(e) {
    const k = KINDS[e.k], y = this.heightAt(e.rx, e.rz), tc = this.tcols[e.o] || this.tcols[4], fx = this.fx;
    if (k.b) {
      this.debris(e.rx, y + 1, e.rz, 40, [0.75, 0.7, 0.62], 5, 0.18);
      fx.puff(e.rx, y + 0.6, e.rz, 14, [0.42, 0.39, 0.35], 0.6, 0.9, 3.2, 2.2, 1.6, 0.8);
      fx.spark(e.rx, y + 1, e.rz, 30, [2.8, 1.2, 0.35], 4, 0.14, { life: 1.1, g: 4 });
      fx.flash(e.rx, y + 1.5, e.rz, [1, 0.55, 0.2], 26, 0.8, 10, k.size * 1.4, 2);
    } else {
      fx.spark(e.rx, y + 0.6, e.rz, 12, [tc.r * 2, tc.g * 2, tc.b * 2], 3, 0.14, { life: 0.6, g: 5 });
      this.debris(e.rx, y + 0.6, e.rz, 7, [0.6, 0.06, 0.04], 3, 0.07);
      fx.flash(e.rx, y + 0.8, e.rz, [tc.r, tc.g, tc.b], 3, 0.25, 4, 0, 0.7);
      if (k.hero) for (let i = 0; i < 20; i++) fx.add({ x: e.rx + rnd(-.3, .3), y: y + 0.4, z: e.rz + rnd(-.3, .3), vx: 0, vy: rnd(1.5, 3.5), vz: 0, life: rnd(0.8, 1.4), s0: 0.22, s1: 0.04, c: [tc.r * 2.5 + 0.5, tc.g * 2.5 + 0.5, tc.b * 2.5 + 0.5], w: 1, g: 0, drag: 0.4 });
    }
  }
  sound(name, x, z, g) { if (!this.quiet) this.onSound(name, x, z, g); }
  workSound(e) {
    if (e.st === 'b') return this.sound('hammer', e.rx, e.rz, 0.8);
    for (const m of this.ents.values()) if (KINDS[m.k].neutral && Math.abs(m.x - e.x) < 2.6 && Math.abs(m.z - e.z) < 2.6) return this.sound('mine', e.rx, e.rz, 0.8);
    this.sound('chop', e.rx, e.rz, 0.8);
  }
  ping(x, z) { this.pings.push({ x, z, t: this.clock }); }
  debris(x, y, z, n, c, sp, size) {
    for (let i = 0; i < n && this.parts.length < 700; i++) {
      const a = Math.random() * PI * 2, u = Math.random() * sp;
      this.parts.push({ x, y, z, vx: Math.cos(a) * u, vy: 1 + Math.random() * sp, vz: Math.sin(a) * u, life: 0.5 + Math.random() * 0.5, max: 1, s: size * (0.6 + Math.random()), c });
    }
  }
  ring(x, z, c, r, dur) { this.rings.push({ x, z, c, r, t: 0, dur }); }
  marker(x, z, attack) { this.rings.push({ x, z, c: attack ? [2.4, 0.4, 0.3] : [0.4, 2.2, 0.6], r: 0.7, t: 0, dur: 0.45, shrink: 1 }); }
  shoot(e, t) {
    const k = KINDS[e.k], M = MODELS[k.id], st = PROJ[k.id], d = Math.hypot(t.rx - e.rx, t.rz - e.rz);
    const sy = this.heightAt(e.rx, e.rz) + (k.b ? M.h * 0.8 : st ? M.h * (M.s || 1) * 0.78 : 1);
    this.arrows.push({ sx: e.rx, sy, sz: e.rz, tid: t.id, tx: t.rx, tz: t.rz, t: 0, dur: Math.max(0.12, d / (st ? 11 : 14)), st, len: k.id === 'spearman' ? 0.9 : 0.55 });
    if (st) this.fx.flash(e.rx, sy, e.rz, st.L, 4, 0.16, 4, 0, 0.8);
  }
  floater(x, z, text, col) { this.floaters.push({ x, z, y: this.heightAt(x, z) + 1.6, text, col, t: 0 }); }

  // ---------- camera ----------
  pan(dx, dz) { const m = this.map; this.cam.tx = Math.max(0, Math.min(m ? m.w : 64, this.cam.tx + dx)); this.cam.tz = Math.max(0, Math.min(m ? m.h + 6 : 70, this.cam.tz + dz)); }
  zoom(f) { this.cam.td = Math.max(14, Math.min(this.maxD || 46, this.cam.td * f)); }
  centerOn(x, z, snap) { this.cam.tx = x; this.cam.tz = z + 3; if (snap) { this.cam.x = this.cam.tx; this.cam.z = this.cam.tz; } }
  updCamera(dt) {
    const c = this.cam, k = Math.min(1, dt * 10);
    c.x += (c.tx - c.x) * k; c.z += (c.tz - c.z) * k; c.d += (c.td - c.d) * k;
    // Zooming in tilts the camera towards the horizon for a closer, more cinematic view.
    c.pitch = 0.8 + 0.18 * Math.max(0, Math.min(1, (c.d - 14) / ((this.maxD || 46) - 14)));
    const lookZ = c.z - 3;
    this.camera.position.set(c.x, Math.sin(c.pitch) * c.d, lookZ + Math.cos(c.pitch) * c.d);
    this.camera.lookAt(c.x, 0, lookZ);
    this.sun.position.set(c.x - 14, 30, lookZ + 12); this.sun.target.position.set(c.x, 0, lookZ);
    this.scene.fog.near = c.d + 12; this.scene.fog.far = c.d + 70;
  }

  // ---------- picking ----------
  ray(sx, sy) {
    tmpV.set(sx / this.W * 2 - 1, -(sy / this.H) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position, d = tmpV.sub(o).normalize();
    return { o: o.clone(), d: d.clone() };
  }
  pickGround(sx, sy) {
    const { o, d } = this.ray(sx, sy); if (d.y > -1e-4) return null;
    let y = 0, p = null;
    for (let i = 0; i < 3; i++) { const t = (y - o.y) / d.y; p = { x: o.x + d.x * t, z: o.z + d.z * t }; y = this.heightAt(p.x, p.z); }
    return p;
  }
  project(x, y, z) { tmpV.set(x, y, z).project(this.camera); return { x: (tmpV.x + 1) / 2 * this.W, y: (1 - tmpV.y) / 2 * this.H, z: tmpV.z }; }
  pickEnt(sx, sy, slop = 1) {
    let best = null, bd = 1e9; const g = this.pickGround(sx, sy);
    for (const e of this.ents.values()) {
      if (e.st === 'd' || (this.fogOn && !e.vis)) continue;
      const k = KINDS[e.k], M = MODELS[k.id], y = this.heightAt(e.rx, e.rz);
      if (k.b && g) { const h = k.size / 2; if (Math.abs(g.x - e.rx) < h && Math.abs(g.z - e.rz) < h) { const dd = Math.hypot(g.x - e.rx, g.z - e.rz); if (dd < bd) { bd = dd; best = e; } continue; } }
      const p = this.project(e.rx, y + M.h * 0.45, e.rz); if (p.z > 1) continue;
      const ppu = this.H / (2 * Math.tan(this.camera.fov * PI / 360) * this.camera.position.distanceTo(tmpV.set(e.rx, y, e.rz)));
      const rad = Math.max(16 * slop, (k.b ? k.size * 0.5 : k.r * 1.6 + 0.25) * ppu * slop);
      const dd = Math.hypot(p.x - sx, p.y - sy);
      if (dd < rad && dd / ppu < bd) { bd = dd / ppu; best = e; }
    }
    return best;
  }
  inRect(x0, y0, x1, y1) {
    const out = [], a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(y0, y1), d = Math.max(y0, y1);
    for (const e of this.ents.values()) {
      if (e.st === 'd' || (this.fogOn && !e.vis)) continue;
      const p = this.project(e.rx, this.heightAt(e.rx, e.rz) + 0.5, e.rz);
      if (p.x >= a && p.x <= b && p.y >= c && p.y <= d) out.push(e);
    }
    return out;
  }
  onScreen(e) { const p = this.project(e.rx, 0, e.rz); return p.x > 0 && p.x < this.W && p.y > 0 && p.y < this.H; }
  setGhost(tiles) {
    const g = this.ghost; g.count = Math.min(64, tiles.length);
    tiles.slice(0, 64).forEach(([x, y, ok], i) => {
      tmpM.makeTranslation(x + .5, this.heightAt(x + .5, y + .5) + 0.06, y + .5); g.setMatrixAt(i, tmpM);
      g.setColorAt(i, tmpC.set(ok ? '#4cd964' : '#ff4b3a'));
    });
    g.instanceMatrix.needsUpdate = true; if (g.instanceColor) g.instanceColor.needsUpdate = true;
  }

  // ---------- light & particle effects ----------
  // Halo, ground light and (for fires) embers for every glowing part of a model.
  glowPart(e, k, p, A, now, near) {
    const fx = this.fx, x = A[12], y = A[13], z = A[14], c = p.gc;
    let f = 0.85 + 0.15 * Math.sin(now * 2.2 + e.id), sz = p.gs * 2.6;
    if (p.gs < 0.2) { sz = p.gs * 2.2; f *= 0.7; }
    if (p.fire) f = 0.78 + 0.22 * Math.sin(now * 13 + e.id) * Math.sin(now * 7.1 + e.id * 2.3);
    fx.glow.add(x, y, z, sz, c[0] * f * 1.3, c[1] * f * 1.3, c[2] * f * 1.3, 0.5);
    if (k.b || k.neutral) fx.pools.add(x, this.heightAt(x, z) + 0.05, z, 1.4 + p.gs, c[0] * f * 0.2, c[1] * f * 0.2, c[2] * f * 0.2);
    if (!near) return;
    const dt = this.dt;
    if (p.fire) {
      if (Math.random() < 6 * dt) fx.add({ x: x + rnd(-.15, .15), y, z: z + .1, vx: rnd(-.2, .2), vy: rnd(0.8, 1.6), vz: rnd(-.2, .2), life: rnd(0.6, 1.2), s0: 0.09, s1: 0.02, c: [2.6, 0.9, 0.2], w: 1, g: -0.2, drag: 0.5 });
      fx.lights.add(x, y + 0.4, z + 0.5, 1, 0.5, 0.18, 1.8 * f, 5);
    } else if ((k.b || k.neutral) && p.gs >= 0.3 && Math.random() < 1.4 * dt) {
      fx.add({ x: x + rnd(-.25, .25), y: y + 0.1, z: z + rnd(-.25, .25), vx: 0, vy: rnd(0.3, 0.7), vz: 0, life: rnd(0.8, 1.4), s0: 0.1, s1: 0.02, c: [c[0] * 2.4, c[1] * 2.4, c[2] * 2.4], w: 1, g: 0, drag: 0, fade: 'in' });
    }
  }
  // Glowing streak behind a melee weapon while it swings.
  trail(e, k, A) {
    const hc = TRAIL[k.id], big = k.hero || k.id === 'stonehide' || k.id === 'brute';
    this.fx.add({ x: A[12], y: A[13], z: A[14], vx: 0, vy: 0, vz: 0, life: hc ? 0.24 : 0.15, s0: hc ? 0.36 : big ? 0.26 : 0.2, s1: 0.04,
      c: hc || (big ? [0.7, 0.62, 0.5] : [0.42, 0.4, 0.36]), w: 0.8, g: 0, drag: 0 });
  }
  // Hero auras, buff glows, spirit wolves, chimney smoke, burning buildings, gold glitter.
  entFx(e, k, M, y, s, now) {
    const fx = this.fx, dt = this.dt;
    if (k.hero) {
      const tc = this.tcols[e.o] || this.tcols[4], pu = 0.26 + 0.06 * Math.sin(now * 2.4 + e.id);
      fx.pools.add(e.rx, y + 0.05, e.rz, 1.5, tc.r * pu, tc.g * pu, tc.b * pu);
      const hs = this.last && this.last.hs && this.last.hs[e.id], b = hs ? hs[6] | 0 : 0;
      if (b & 1) {
        fx.pools.add(e.rx, y + 0.05, e.rz, 2.2, 0.45, 0.34, 0.08);
        if (Math.random() < 10 * dt) { const a = rnd(0, 6.3); fx.add({ x: e.rx + Math.cos(a) * 0.7, y: y + 0.2, z: e.rz + Math.sin(a) * 0.7, vx: 0, vy: rnd(1, 1.8), vz: 0, life: 0.9, s0: 0.14, s1: 0.03, c: [2.6, 2, 0.6], w: 1, g: 0, drag: 0 }); }
      }
      if (b & 2) {
        fx.pools.add(e.rx, y + 0.05, e.rz, 1.9, 0.6, 0.08, 0.03);
        if (Math.random() < 20 * dt) { const a = rnd(0, 6.3); fx.add({ x: e.rx + Math.cos(a) * 0.35, y: y + rnd(0.3, 1.4), z: e.rz + Math.sin(a) * 0.35, vx: 0, vy: rnd(0.8, 1.6), vz: 0, life: 0.45, s0: 0.36, s1: 0.05, c: [2.6, 0.45, 0.15], w: 0.8, g: 0, drag: 0 }); }
      }
    } else if (k.id === 'spiritwolf') {
      fx.pools.add(e.rx, y + 0.05, e.rz, 1.1, 0.1, 0.28, 0.42);
      fx.glow.add(e.rx, y + 0.5, e.rz, 1.3, 0.1, 0.26, 0.45, 0);
      if (Math.random() < 8 * dt) fx.add({ x: e.rx + rnd(-.3, .3), y: y + 0.5, z: e.rz + rnd(-.3, .3), vx: 0, vy: rnd(0.5, 1), vz: 0, life: 0.7, s0: 0.16, s1: 0.02, c: [0.8, 2, 3], w: 1, g: 0, drag: 0 });
    }
    if (!k.b) return;
    const ch = CHIMNEY[k.id];
    if (ch && Math.random() < 2.2 * dt) fx.puff(e.rx + ch[0] * s, y + ch[1] * s, e.rz + ch[2] * s, 1, [0.62, 0.6, 0.58], 0.32, 0.25, 1.4, 3, 0.12, 0.55);
    const hpR = e.hp / k.hp;
    if (hpR < 0.55) {
      const n = hpR < 0.25 ? 3 : hpR < 0.4 ? 2 : 1, fl = 0.8 + 0.2 * Math.sin(now * 17 + e.id) * Math.sin(now * 9 + e.id);
      for (let j = 0; j < n; j++) {
        // Flames sit on the roof (near the top and towards the front so they aren't hidden inside it).
        const ox = (hash(e.id * 3 + j) - 0.5) * k.size * 0.4, oz = 0.15 + hash(e.id * 5 + j * 7) * k.size * 0.25;
        const fx0 = e.rx + ox, fz0 = e.rz + oz, fy = y + M.h * s * (0.88 - Math.hypot(ox, oz) / (k.size * 1.2));
        if (Math.random() < 18 * dt) fx.add({ x: fx0 + rnd(-.2, .2), y: fy, z: fz0 + rnd(-.2, .2), vx: rnd(-.15, .15), vy: rnd(1.2, 2.2), vz: rnd(-.15, .15), life: rnd(0.35, 0.7), s0: rnd(0.55, 0.85), s1: 0.1, c: [2.4, 0.95, 0.25], w: 0.9, g: 0, drag: 0.6 });
        if (Math.random() < 3.5 * dt) fx.puff(fx0, fy + 0.6, fz0, 1, [0.16, 0.15, 0.14], 0.55, 0.5, 1.8, 2.5, 0.2, 0.9);
        if (Math.random() < 3 * dt) fx.add({ x: fx0, y: fy, z: fz0, vx: rnd(-.6, .6), vy: rnd(1.5, 2.8), vz: rnd(-.6, .6), life: rnd(0.8, 1.5), s0: 0.08, s1: 0.02, c: [2.8, 1.1, 0.3], w: 1, g: 0.6, drag: 0.4 });
      }
      fx.lights.add(e.rx, y + M.h * s + 0.8, e.rz + k.size * 0.6, 1, 0.48, 0.16, 2 + 2.5 * fl * n, 9);
      fx.pools.add(e.rx, y + 0.05, e.rz, k.size * 1.1 + 0.6, 0.45 * fl, 0.18 * fl, 0.05 * fl);
    }
  }
  // Sparks and a quick flash where a blow lands.
  hitFx(e) {
    const k = KINDS[e.k], y = this.heightAt(e.rx, e.rz) + (k.b ? 1.2 : 0.75 * (MODELS[k.id].s || 1));
    this.fx.spark(e.rx, y, e.rz, k.b ? 5 : 6, [2.2, 1.8, 1.1], 2.4, 0.1, { life: 0.35, w: 1, g: 7 });
    this.fx.flash(e.rx, y, e.rz, [1, 0.85, 0.6], 2.6, 0.14, 4, 0, 0.55);
    if (k.b) this.debris(e.rx, y, e.rz, 4, [0.6, 0.55, 0.48], 2, 0.08);
  }
  impact(a, x, y, z) {
    if (a.st) {
      const c = a.st.c;
      this.fx.spark(x, y, z, 12, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], 2.5, 0.16, { life: 0.5, w: 1, g: 4 });
      this.fx.flash(x, y + 0.3, z, a.st.L, 9, 0.3, 5, 1.4, 1.1);
    } else this.fx.spark(x, y, z, 4, [1.6, 1.3, 0.8], 1.6, 0.08, { life: 0.3, w: 1, g: 6 });
  }

  // ---------- frame ----------
  frame(dt) {
    this.clock += dt; this.dt = dt; const now = this.clock;
    this.updCamera(dt);
    this.fx.begin();
    const cx = this.cam.x, cz = this.cam.z - 3, nx = this.cam.d * 0.75 + 4, nz = this.cam.d * 0.6 + 4;
    if (this.fogOn && (this.fogT -= dt) <= 0) { this.fogT = 0.2; this.updateFog(); }
    const counts = new Array(KINDS.length).fill(0), selList = [];
    const tcols = this.tcols;
    for (const e of this.ents.values()) {
      const k = KINDS[e.k], km = this.km[e.k], M = km && km.model;
      const age = Math.min(now - e.ta, this.snapInt * 1.3);
      const px = e.x + e.vx * age, pz = e.z + e.vz * age, ox = e.rx, oz = e.rz, f = Math.min(1, dt * 14);
      e.rx += (px - e.rx) * f; e.rz += (pz - e.rz) * f;
      const sp = Math.hypot(e.rx - ox, e.rz - oz) / Math.max(dt, 1e-3);
      e.spd += (sp - e.spd) * Math.min(1, dt * 10);
      e.rf = lerpAng(e.rf, e.face, Math.min(1, dt * 12));
      if (e.st === 'd' || !km || !this.shown(e)) continue;
      const i = counts[e.k]++; if (i >= km.cap) continue;
      e.walk += e.spd * dt * 5.5;
      if (e.swingT > 0) { e.swingT += dt / 0.38; if (e.swingT >= 1) e.swingT = 0; }
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);
      const moving = e.spd > 0.4 ? 1 : 0;
      let swing = 0;
      if (e.swingT > 0) swing = -Math.sin(e.swingT * PI) * 1.7;
      else if (e.st === 'g' || e.st === 'b') {
        const ph = Math.abs(Math.sin(now * 5 + e.id)); swing = -ph * 1.4;
        if (e.wph > 0.2 && ph <= 0.2 && !this.quiet && this.onScreen(e)) this.workSound(e);
        e.wph = ph;
      }
      const leg = Math.sin(e.walk) * 0.65 * moving, bob = Math.abs(Math.sin(e.walk)) * 0.05 * moving;
      const y = this.heightAt(e.rx, e.rz), s = M.s || 1;
      const cons = k.b && e.st === 'c', grow = cons ? 0.25 + 0.75 * (e.ex / 63) : 1;
      tmpQ.setFromAxisAngle(UP, k.b ? 0 : e.rf);
      tmpM.compose(tmpV.set(e.rx, y + bob, e.rz), tmpQ, tmpS.set(s, s * grow, s));
      const fl = 1 + e.flash * 1.6, dim = cons ? 0.55 : 1;
      const near = Math.abs(e.rx - cx) < nx && Math.abs(e.rz - cz) < nz;
      for (const p of km.meshes) {
        if (p.vis && !((p.vis === 'G' && e.ex === 1 && k.worker) || (p.vis === 'L' && e.ex === 2 && k.worker))) { p.mesh.setMatrixAt(i, ZERO); continue; }
        let ang = 0;
        if (p.anim === 'legL') ang = leg; else if (p.anim === 'legR') ang = -leg; else if (p.anim === 'swing') ang = swing;
        if (ang) {
          const pv = p.anim === 'swing' ? tmpV.set(0, M.parts.find(q => q[4] === 'swing')[2][1] + .16, 0) : tmpV.set(0, p.B.elements[13] + p.B.elements[5] / 2, p.B.elements[14]);
          tmpA.makeTranslation(pv.x, pv.y, pv.z).multiply(tmpP.makeRotationX(ang)).multiply(tmpB.makeTranslation(-pv.x, -pv.y, -pv.z));
          tmpA.premultiply(tmpM).multiply(p.B); p.mesh.setMatrixAt(i, tmpA);
        } else { tmpA.multiplyMatrices(tmpM, p.B); p.mesh.setMatrixAt(i, tmpA); }
        if (p.team) tmpC.copy(tcols[e.o] || tcols[4]).multiplyScalar(fl * dim); else tmpC.setScalar(fl * dim);
        p.mesh.setColorAt(i, tmpC);
        if (p.glow && !cons) this.glowPart(e, k, p, tmpA.elements, now, near);
        if (p.tip && e.swingT > 0.12 && e.swingT < 0.85 && !k.proj && near) this.trail(e, k, tmpA.elements);
      }
      if (near && !cons) this.entFx(e, k, M, y, s, now);
      if ((this.sel.has(e.id) || this.hover === e.id) && (e.vis || !this.fogOn)) selList.push(e);
    }
    this.km.forEach((km, ki) => { if (!km) return; const n = Math.min(km.cap, counts[ki]); for (const p of km.meshes) { p.mesh.count = n; p.mesh.visible = n > 0; if (n) { p.mesh.instanceMatrix.needsUpdate = true; if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true; } } });
    // selection rings
    const sm = this.selMesh; sm.count = Math.min(128, selList.length);
    selList.slice(0, 128).forEach((e, i) => {
      const k = KINDS[e.k], r = k.b ? k.size * 0.78 : k.r * 1.5 + 0.1, y = this.heightAt(e.rx, e.rz) + 0.05;
      tmpM.compose(tmpV.set(e.rx, y, e.rz), tmpQ.identity(), tmpS.set(r, 1, r)); sm.setMatrixAt(i, tmpM);
      const own = e.o === this.mySlot, ally = e.o < 4 && this.teams[e.o] === this.teams[this.mySlot];
      tmpC.set(e.o === NEUTRAL ? '#ffd34d' : e.o === CREEP ? '#ff9a3a' : own ? '#5cff6a' : ally ? '#7fd0ff' : '#ff5040'); if (!this.sel.has(e.id)) tmpC.multiplyScalar(0.45);
      sm.setColorAt(i, tmpC);
    });
    sm.instanceMatrix.needsUpdate = true; if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    this.updParticles(dt);
    if (this.post) this.post.render(); else this.renderer.render(this.scene, this.camera);
    this.drawOverlay(dt);
  }
  updParticles(dt) {
    const pm = this.pMesh; let n = 0;
    this.parts = this.parts.filter(p => (p.life -= dt) > 0);
    for (const p of this.parts) {
      p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const gy = this.heightAt(p.x, p.z); if (p.y < gy) { p.y = gy; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const s = p.s * Math.min(1, p.life * 2);
      tmpM.compose(tmpV.set(p.x, p.y, p.z), tmpQ.identity(), tmpS.set(s, s, s)); pm.setMatrixAt(n, tmpM); pm.setColorAt(n, tmpC.setRGB(p.c[0], p.c[1], p.c[2])); n++;
    }
    pm.count = n; pm.instanceMatrix.needsUpdate = true; if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    const am = this.aMesh, fx = this.fx; n = 0;
    let j = 0;
    for (const a of this.arrows) {
      const t = this.ents.get(a.tid); if (t) { a.tx = t.rx; a.tz = t.rz; }
      a.t += dt / a.dur;
      const ty = this.heightAt(a.tx, a.tz) + 0.8;
      if (a.t >= 1) { this.impact(a, a.tx, ty, a.tz); continue; }
      this.arrows[j++] = a;
      const k = a.t, x = a.sx + (a.tx - a.sx) * k, z = a.sz + (a.tz - a.sz) * k;
      const arc = Math.sin(k * PI) * Math.hypot(a.tx - a.sx, a.tz - a.sz) * (a.st ? 0.05 : 0.12), y = a.sy + (ty - a.sy) * k + arc;
      if (a.st) { // glowing bolt: hot core, wide halo, sparkling trail, and a light that travels with it
        const c = a.st.c;
        fx.glow.add(x, y, z, a.st.s, c[0], c[1], c[2], 1);
        fx.glow.add(x, y, z, a.st.s * 3.2, c[0] * 0.22, c[1] * 0.22, c[2] * 0.22, 0);
        fx.add({ x, y, z, vx: rnd(-.3, .3), vy: rnd(-.3, .3), vz: rnd(-.3, .3), life: 0.3, s0: a.st.s * 0.9, s1: 0, c: [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5], w: 0.5, g: 0, drag: 1 });
        fx.lights.add(x, y, z, a.st.L[0], a.st.L[1], a.st.L[2], 5, 6);
      } else if (n < 96) {
        tmpQ.setFromAxisAngle(UP, Math.atan2(a.tx - a.sx, a.tz - a.sz));
        tmpM.compose(tmpV.set(x, y, z), tmpQ, tmpS.set(.05, .05, a.len)); am.setMatrixAt(n++, tmpM);
        fx.add({ x, y, z, vx: 0, vy: 0, vz: 0, life: 0.14, s0: 0.11, s1: 0.02, c: [0.4, 0.34, 0.24], w: 0.3, g: 0, drag: 0 });
      }
    }
    this.arrows.length = j;
    am.count = n; am.instanceMatrix.needsUpdate = true;
    const rm = this.ringMesh; n = 0;
    this.rings = this.rings.filter(r => (r.t += dt / r.dur) < 1);
    for (const r of this.rings) {
      const s = r.shrink ? r.r * (1 - r.t * 0.6) : r.r * (0.2 + r.t * 0.8), fade = 1 - r.t;
      tmpM.compose(tmpV.set(r.x, this.heightAt(r.x, r.z) + 0.08, r.z), tmpQ.identity(), tmpS.set(s, 1, s)); rm.setMatrixAt(n, tmpM);
      rm.setColorAt(n, tmpC.setRGB(r.c[0] * fade, r.c[1] * fade, r.c[2] * fade)); if (++n >= 24) break;
    }
    rm.count = n; rm.instanceMatrix.needsUpdate = true; if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
    fx.update(dt, { x: this.cam.x, z: this.cam.z - 3, d: this.cam.d, pos: this.camera.position });
  }
  drawOverlay(dt) {
    const c = this.ctx; c.clearRect(0, 0, this.W, this.H);
    const zoomK = Math.max(0.65, Math.min(1.3, 30 / this.cam.d));
    for (const e of this.ents.values()) {
      if (e.st === 'd' || (this.fogOn && !e.vis)) continue;
      const k = KINDS[e.k]; if (k.neutral && !this.sel.has(e.id) && this.hover !== e.id) continue;
      const max = k.hero ? heroMaxHp(k, e.ex || 1) : k.hp, hpR = Math.max(0, Math.min(1, e.hp / max));
      const show = this.sel.has(e.id) || this.hover === e.id || this.showAllBars || (hpR < 0.999 && !k.neutral) || (k.b && e.st === 'c');
      if (!show) continue;
      const M = MODELS[k.id], p = this.project(e.rx, this.heightAt(e.rx, e.rz) + M.h * (M.s || 1) + 0.25, e.rz);
      if (p.z > 1 || p.x < -50 || p.x > this.W + 50 || p.y < -20 || p.y > this.H + 20) continue;
      const w = (k.b ? 58 : k.hero ? 40 : 28) * zoomK, h = 4.5 * zoomK + 1;
      c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, h + 2);
      if (k.neutral) { c.fillStyle = '#e8c14a'; c.fillRect(p.x - w / 2, p.y, w * Math.min(1, e.ex / 60), h); continue; }
      c.fillStyle = hpR > 0.6 ? '#46d160' : hpR > 0.3 ? '#e8c14a' : '#e8483a'; c.fillRect(p.x - w / 2, p.y, w * hpR, h);
      if (k.b && (e.st === 'c' || e.st === 't') && (e.o === this.mySlot || e.st === 'c')) {
        c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(p.x - w / 2 - 1, p.y + h + 2, w + 2, 4);
        c.fillStyle = '#6fb6ff'; c.fillRect(p.x - w / 2, p.y + h + 3, w * e.ex / 63, 2.5);
      }
      if (k.hero) { c.font = `600 ${Math.round(11 * zoomK)}px "Alegreya Sans", sans-serif`; c.fillStyle = '#f2e3b3'; c.textAlign = 'center'; c.fillText('Lv ' + e.ex, p.x, p.y - 4); }
    }
    this.floaters = this.floaters.filter(f => (f.t += dt) < 1.1);
    c.textAlign = 'center'; c.font = '700 15px "Alegreya Sans", sans-serif';
    for (const f of this.floaters) {
      const p = this.project(f.x, f.y + f.t * 0.9, f.z); if (p.z > 1) continue;
      c.globalAlpha = Math.min(1, (1.1 - f.t) * 2.5); c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(f.text, p.x, p.y); c.fillStyle = f.col; c.fillText(f.text, p.x, p.y);
    }
    c.globalAlpha = 1;
    if (this.box) { const b = this.box; c.strokeStyle = '#7dff8a'; c.lineWidth = 1.5; c.fillStyle = 'rgba(125,255,138,.08)'; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    if (this.labels) for (const L of this.labels) { const p = this.project(L.x, this.heightAt(L.x, L.z) + 4.2, L.z); c.font = '700 20px Cinzel, serif'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(L.t, p.x, p.y); c.fillStyle = L.c; c.fillText(L.t, p.x, p.y); }
  }

  // ---------- minimap ----------
  drawMinimap(cv) {
    const m = this.map; if (!m) return;
    const ctx = cv.getContext('2d'), S = cv.width;
    if (!this.miniBase) {
      const b = this.miniBase = document.createElement('canvas'); b.width = m.w; b.height = m.h; const bc = b.getContext('2d'), img = bc.createImageData(m.w, m.h);
      const tc = TILES.map(t => [parseInt(t.col.slice(1, 3), 16), parseInt(t.col.slice(3, 5), 16), parseInt(t.col.slice(5, 7), 16)]);
      for (let i = 0; i < m.tiles.length; i++) {
        let c = tc[m.tiles[i]]; if (m.trees.has(i) && !this.removed.has(i)) c = [34, 70, 30];
        img.data.set([c[0], c[1], c[2], 255], i * 4);
      }
      bc.putImageData(img, 0, 0);
    }
    ctx.imageSmoothingEnabled = false; ctx.drawImage(this.miniBase, 0, 0, S, S);
    if (this.fogOn && this.vis) {
      const fc = this.miniFog ||= document.createElement('canvas'); if (fc.width !== m.w) { fc.width = m.w; fc.height = m.h; }
      const fx = fc.getContext('2d'), img = fx.createImageData(m.w, m.h);
      for (let i = 0; i < m.w * m.h; i++) img.data[i * 4 + 3] = this.vis[i] ? 0 : this.explored[i] ? 120 : 235;
      fx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(fc, 0, 0, S, S); ctx.imageSmoothingEnabled = false;
    }
    const k = S / m.w;
    for (const e of this.ents.values()) {
      if (e.st === 'd' || !this.shown(e)) continue; const K = KINDS[e.k];
      ctx.fillStyle = e.o === NEUTRAL ? '#ffd34d' : e.o === CREEP ? '#ff9a3a' : TEAM_COLORS[e.o];
      if (K.b) { const s = K.size * k; ctx.fillRect(e.rx * k - s / 2, e.rz * k - s / 2, s, s); }
      else { const s = Math.max(2, k * 0.9); ctx.fillRect(e.rx * k - s / 2, e.rz * k - s / 2, s, s); }
    }
    this.pings = this.pings.filter(p => this.clock - p.t < 3);
    for (const p of this.pings) { const a = (this.clock - p.t) / 3, r = 4 + a * 14; ctx.strokeStyle = `rgba(255,70,50,${1 - a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x * k, p.z * k, r, 0, 6.283); ctx.stroke(); }
    const pts = [[0, 0], [this.W, 0], [this.W, this.H], [0, this.H]].map(([x, y]) => this.pickGround(x, y) || this.pickGround(x, this.H * 0.12));
    if (pts.every(Boolean)) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x * k, p.z * k) : ctx.moveTo(p.x * k, p.z * k)); ctx.closePath(); ctx.stroke(); }
  }
}
