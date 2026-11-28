// Light and particle effects for Ashvale: glowing sprites, smoke, ground light pools,
// a pool of moving point lights, sun shafts, drifting dust and forest fireflies.
// Everything is drawn with a handful of instanced draw calls, refilled every frame.
import * as THREE from 'three/webgpu';
import { instancedDynamicBufferAttribute, uv, float, vec3, color, pow, smoothstep, sin, time } from 'three/tsl';

const PI = Math.PI;
const rnd = (a, b) => a + Math.random() * (b - a);
const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpC = new THREE.Color();
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vN = new THREE.Vector3();
// Sun shafts lean this way (slightly across the view so they read as diagonal beams).
const SHAFT_DIR = new THREE.Vector3(0.62, -0.76, -0.2).normalize();

// Tileable value-noise texture used for drifting cloud shadows.
export function makeCloudTex() {
  const N = 128, d = new Uint8Array(N * N * 4), sm = t => t * t * (3 - 2 * t);
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const octs = [[4, 0.5], [8, 0.3], [16, 0.2]].map(([p, a]) => [p, a, Float32Array.from({ length: p * p }, rand)]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const [p, a, g] of octs) {
      const fx = x / N * p, fy = y / N * p, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const G = (i, j) => g[(j % p) * p + (i % p)];
      v += a * ((G(ix, iy) * (1 - tx) + G(ix + 1, iy) * tx) * (1 - ty) + (G(ix, iy + 1) * (1 - tx) + G(ix + 1, iy + 1) * tx) * ty);
    }
    const o = (y * N + x) * 4; d[o] = d[o + 1] = d[o + 2] = Math.round(v * 255); d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}

// Camera-facing soft sprites: additive for light, alpha-blended for smoke.
class Sprites {
  constructor(scene, max, additive, fogF) {
    this.max = max; this.n = 0;
    const mk = () => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.pa = mk(); this.ca = mk();
    const P = instancedDynamicBufferAttribute(this.pa), C = instancedDynamicBufferAttribute(this.ca);
    const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    m.positionNode = P.xyz; m.scaleNode = P.w;
    const f = float(1).sub(uv().sub(0.5).length().mul(2)).clamp(0, 1);
    if (additive) { m.colorNode = C.rgb.mul(fogF); m.opacityNode = pow(f, 2.2).add(pow(f, 10).mul(C.w)); }
    else { m.colorNode = C.rgb.mul(fogF.mul(0.6).add(0.4)); m.opacityNode = smoothstep(0, 0.85, f).mul(C.w); }
    this.mesh = new THREE.Sprite(m); this.mesh.count = 2; this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  add(x, y, z, s, r, g, b, w) {
    if (this.n >= this.max) return;
    const i = 4 * this.n++, p = this.pa.array, c = this.ca.array;
    p[i] = x; p[i + 1] = y; p[i + 2] = z; p[i + 3] = s; c[i] = r; c[i + 1] = g; c[i + 2] = b; c[i + 3] = w;
  }
  end() {
    const p = this.pa.array; for (let i = this.n; i < 2; i++) p[i * 4 + 3] = 0;
    this.mesh.count = Math.max(2, this.n); this.pa.needsUpdate = true; this.ca.needsUpdate = true;
  }
}

// Flat additive discs on the ground: light spilling from windows, fires, auras and spells.
class Pools {
  constructor(scene, max, fogF) {
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const f = float(1).sub(uv().sub(0.5).length().mul(2)).clamp(0, 1);
    m.colorNode = vec3(1).mul(fogF); m.opacityNode = pow(f, 1.7);
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-PI / 2), m, max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.mesh.setColorAt(0, tmpC.set(1, 1, 1));
    scene.add(this.mesh); this.max = max; this.n = 0;
  }
  begin() { this.n = 0; }
  add(x, y, z, rad, r, g, b) {
    if (this.n >= this.max) return;
    tmpM.compose(tmpV.set(x, y, z), tmpQ.identity(), tmpS.set(rad, 1, rad)); this.mesh.setMatrixAt(this.n, tmpM);
    this.mesh.setColorAt(this.n++, tmpC.setRGB(r, g, b));
  }
  end() {
    const m = this.mesh; m.count = this.n; m.visible = this.n > 0;
    if (this.n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
}

// A fixed set of point lights handed each frame to the strongest light sources near the camera.
class Lights {
  constructor(scene, n) {
    this.L = Array.from({ length: n }, () => { const l = new THREE.PointLight(0xffffff, 0, 8, 2); scene.add(l); return l; });
    this.req = []; this.scene = scene; this.on = true;
  }
  // Turning the lights off removes them from the scene so materials stop paying for them.
  enable(on) {
    if (on === this.on) return; this.on = on;
    for (const l of this.L) on ? this.scene.add(l) : this.scene.remove(l);
  }
  begin() { this.req.length = 0; }
  add(x, y, z, r, g, b, I, dist) { if (I > 0.05) this.req.push([x, y, z, r, g, b, I, dist, 0]); }
  end(cx, cz) {
    for (const q of this.req) q[8] = q[6] / (1 + ((q[0] - cx) ** 2 + (q[2] - cz) ** 2) / 250);
    this.req.sort((a, b) => b[8] - a[8]);
    this.L.forEach((l, i) => {
      const q = this.req[i]; if (!q) { l.intensity = 0; return; }
      l.position.set(q[0], q[1], q[2]); l.color.setRGB(q[3], q[4], q[5]); l.intensity = q[6]; l.distance = q[7];
    });
  }
}

// Soft beams of sunlight that slowly fade in and out around the camera.
class Shafts {
  constructor(scene, n, fogF) {
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const u = uv(), edge = pow(sin(u.x.mul(PI)), 3), along = smoothstep(0, 0.45, u.y).mul(float(1).sub(smoothstep(0.55, 1, u.y)));
    const shimmer = sin(u.y.mul(7).sub(time.mul(0.6)).add(u.x.mul(2.5))).mul(0.3).add(0.7);
    m.colorNode = color('#ffe2a6').mul(fogF); m.opacityNode = edge.mul(along).mul(shimmer);
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m, n);
    this.mesh.count = n; this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.setColorAt(0, tmpC.set(0, 0, 0));
    scene.add(this.mesh); this.n = n; this.s = Array.from({ length: n }, () => ({ t: 1, dur: 0, x: 1e9, z: 1e9 }));
  }
  update(dt, cx, cz, camPos, R) {
    const ms = this.mesh;
    for (let i = 0; i < this.n; i++) {
      const s = this.s[i]; s.t += dt;
      if (s.t >= s.dur || Math.abs(s.x - cx) > R * 1.3 || Math.abs(s.z - cz) > R) {
        Object.assign(s, { t: s.dur ? 0 : rnd(0, 8), dur: rnd(9, 18), x: cx + rnd(-R, R), z: cz + rnd(-R * 0.75, R * 0.6), w: rnd(1.2, 3.4), L: rnd(13, 22), a: rnd(0.05, 0.11) });
      }
      const env = Math.max(0, Math.sin(PI * s.t / s.dur)) * s.a;
      vA.copy(SHAFT_DIR).multiplyScalar(-s.L / 2).add(tmpV.set(s.x, 0, s.z));
      vB.copy(SHAFT_DIR).negate();
      vC.subVectors(camPos, vA).cross(vB).normalize();
      vN.crossVectors(vC, vB).normalize();
      tmpM.makeBasis(vC, vB, vN).scale(tmpS.set(s.w, s.L, 1)).setPosition(vA);
      ms.setMatrixAt(i, tmpM); ms.setColorAt(i, tmpC.setRGB(env, env, env));
    }
    ms.instanceMatrix.needsUpdate = true; ms.instanceColor.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, fogF, heightAt) {
    this.glow = new Sprites(scene, 2600, true, fogF);
    this.smoke = new Sprites(scene, 700, false, fogF);
    this.pools = new Pools(scene, 260, fogF);
    this.lights = new Lights(scene, 6);
    this.shafts = new Shafts(scene, 7, fogF);
    this.h = heightAt; this.P = []; this.F = []; this.motes = []; this.flies = []; this.clock = 0;
    this.trees = []; this.treeGone = () => false;
  }
  clear() { this.P.length = 0; this.F.length = 0; }
  begin() { this.glow.begin(); this.smoke.begin(); this.pools.begin(); this.lights.begin(); }
  // particle: x y z vx vy vz life s0 s1 c[3] w(core) g(gravity) drag | smoke: a(alpha) | fade:'in'
  add(p) { if (this.P.length < 3400) { p.t = 0; this.P.push(p); } }
  spark(x, y, z, n, c, sp, size, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2, u = Math.random() * sp;
      this.add({ x, y, z, vx: Math.cos(a) * u, vy: (o.vy ?? 1) + Math.random() * sp * (o.up ?? 1), vz: Math.sin(a) * u, life: (o.life || 0.6) * rnd(0.6, 1.3),
        s0: size * rnd(0.7, 1.3), s1: o.s1 ?? 0, c, w: o.w ?? 0.6, g: o.g ?? 5, drag: o.drag ?? 1.5, fade: o.fade });
    }
  }
  puff(x, y, z, n, c, a, s0, s1, life, sp = 0.6, vy = 0.6) {
    for (let i = 0; i < n; i++) this.add({ smoke: 1, x: x + rnd(-.3, .3), y, z: z + rnd(-.3, .3), vx: rnd(-sp, sp), vy: vy * rnd(0.6, 1.4), vz: rnd(-sp, sp), life: life * rnd(0.7, 1.3), s0: s0 * rnd(0.8, 1.2), s1: s1 * rnd(0.8, 1.2), c, a, g: 0, drag: 0.8 });
  }
  // A short burst of light: point light, optional ground glow and optional bright sprite.
  flash(x, y, z, c, I, dur, dist = 7, pool = 0, sprite = 0) { this.F.push({ x, y, z, c, I, dur, dist, pool, sprite, t: 0 }); }
  update(dt, cam) {
    this.clock += dt;
    let j = 0;
    for (const f of this.F) {
      if ((f.t += dt) >= f.dur) continue; this.F[j++] = f;
      const k = 1 - f.t / f.dur, e = k * k;
      this.lights.add(f.x, f.y, f.z, f.c[0], f.c[1], f.c[2], f.I * e, f.dist);
      if (f.pool) this.pools.add(f.x, this.h(f.x, f.z) + 0.05, f.z, f.pool * (0.75 + 0.25 * k), f.c[0] * e * 0.5, f.c[1] * e * 0.5, f.c[2] * e * 0.5);
      if (f.sprite) this.glow.add(f.x, f.y, f.z, f.sprite * (0.6 + 0.4 * k), f.c[0] * e * 1.8, f.c[1] * e * 1.8, f.c[2] * e * 1.8, 1);
    }
    this.F.length = j;
    const P = this.P; j = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; if ((p.t += dt) >= p.life) continue; P[j++] = p;
      const k = p.t / p.life, dr = Math.max(0, 1 - p.drag * dt);
      p.vy -= p.g * dt; p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.g > 0) { const gy = this.h(p.x, p.z) + 0.03; if (p.y < gy) { p.y = gy; p.vy *= -0.35; p.vx *= 0.5; p.vz *= 0.5; } }
      const s = p.s0 + (p.s1 - p.s0) * k;
      if (p.smoke) this.smoke.add(p.x, p.y, p.z, s, p.c[0], p.c[1], p.c[2], p.a * Math.min(1, k * 6) * (1 - k));
      else { const f = p.fade === 'in' ? Math.sin(k * PI) : 1 - k; this.glow.add(p.x, p.y, p.z, s, p.c[0] * f, p.c[1] * f, p.c[2] * f, p.w); }
    }
    P.length = j;
    const R = Math.max(14, cam.d * 0.62);
    this.ambient(dt, cam, R);
    this.shafts.update(dt, cam.x, cam.z, cam.pos, R);
    this.glow.end(); this.smoke.end(); this.pools.end(); this.lights.end(cam.x, cam.z);
  }
  // Dust drifting in the sunlight, and fireflies flickering around trees.
  ambient(dt, cam, R) {
    const M = this.motes, now = this.clock;
    while (M.length < 90) M.push({ x: cam.x + rnd(-R, R), z: cam.z + rnd(-R * 0.7, R * 0.7), y: rnd(0.4, 5), ph: Math.random() * 9, s: rnd(0.035, 0.07) });
    for (const m of M) {
      m.x += (Math.sin(now * 0.3 + m.ph) * 0.25 + 0.12) * dt; m.y += Math.sin(now * 0.5 + m.ph * 2) * 0.12 * dt; m.z += Math.cos(now * 0.27 + m.ph) * 0.2 * dt;
      if (Math.abs(m.x - cam.x) > R) m.x = cam.x - Math.sign(m.x - cam.x) * R * 0.98;
      if (Math.abs(m.z - cam.z) > R * 0.7) m.z = cam.z - Math.sign(m.z - cam.z) * R * 0.69;
      const b = 0.2 + 0.16 * Math.sin(now * 1.7 + m.ph * 3);
      this.glow.add(m.x, m.y, m.z, m.s * 2.4, b, 0.9 * b, 0.68 * b, 0.4);
    }
    const T = this.trees; if (!T.length) return;
    while (this.flies.length < 26) this.flies.push({ ok: false });
    for (const f of this.flies) {
      if (!f.ok || Math.abs(f.hx - cam.x) > R || Math.abs(f.hz - cam.z) > R * 0.75 || this.treeGone(f.tree)) {
        f.ok = false;
        for (let k = 0; k < 12 && !f.ok; k++) {
          const t = T[(Math.random() * T.length) | 0];
          if (Math.abs(t[0] - cam.x) < R && Math.abs(t[1] - cam.z) < R * 0.75 && !this.treeGone(t[2])) Object.assign(f, { ok: true, hx: t[0], hz: t[1], tree: t[2], ph: Math.random() * 20, sp: rnd(0.35, 0.8) });
        }
        if (!f.ok) continue;
      }
      const tt = now * f.sp + f.ph, x = f.hx + Math.sin(tt) * 1.3 + Math.sin(tt * 2.3) * 0.4, z = f.hz + Math.cos(tt * 0.8) * 1.3, y = this.h(x, z) + 0.9 + Math.sin(tt * 1.7) * 0.6;
      const b = Math.max(0, Math.sin(now * 2.2 + f.ph * 3)) ** 3 * 1.6 + 0.08;
      this.glow.add(x, y, z, 0.17, 0.9 * b, 1.5 * b, 0.35 * b, 1);
    }
  }
}
