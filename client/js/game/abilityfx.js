/* =====================================================================
   ABILITY VISUALS — everything the eight tank powers put on the screen:
   cover walls, bunker domes, black holes, guided shells, suicide cars and
   the freeze cage. The server owns the real thing (see abrun.js); this
   file only draws it, and smooths the streamed positions between updates.
   ===================================================================== */
import * as THREE from '../three.js';
import { lerp, lerpAngle } from '../../shared/math.js';

const TEAM_HEX = { blue: 0x62a2ff, red: 0xff6250, '': 0xdddddd };
const M = (c, o) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, ...o });

/* ---------------- one cover wall ---------------- */
function makeWall(len, team) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 2.1, 0.8), M(0x8b8d84, { roughness: 0.9 }));
  body.position.y = 1.05; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.25, 0.22, 1.05), M(0x6d7069));
  cap.position.y = 2.16; g.add(cap);
  for (const sx of [-1, 1]) {                                   // feet, so it does not look like it floats
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.5), M(0x62655f));
    f.position.set(sx * (len / 2 - 0.4), 0.25, 0); g.add(f);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.18, 0.86), new THREE.MeshBasicMaterial({ color: TEAM_HEX[team] || TEAM_HEX[''] }));
  stripe.position.y = 1.75; g.add(stripe);
  g.userData = { body, stripe, len };
  return g;
}

/* ---------------- bunker dome ---------------- */
function makeDome(r, team) {
  const g = new THREE.Group(), col = TEAM_HEX[team] || TEAM_HEX[''];
  const skin = new THREE.Mesh(new THREE.SphereGeometry(r, 26, 14),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  const wire = new THREE.Mesh(new THREE.SphereGeometry(r * 1.002, 18, 10),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, wireframe: true, depthWrite: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.35, r, 56),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.14;
  g.add(skin, wire, ring);
  g.userData = { skin, wire, ring, r };
  return g;
}

/* ---------------- black hole ---------------- */
function makeHole(r) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: 0x120a22, transparent: true, opacity: 0.55, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.13; g.add(disc);
  const swirl = [];
  for (let i = 0; i < 3; i++) {
    const rr = r * (0.35 + i * 0.28);
    const s = new THREE.Mesh(new THREE.RingGeometry(rr - 0.3, rr, 40, 1, 0, Math.PI * 1.45),
      new THREE.MeshBasicMaterial({ color: i === 2 ? 0x8a5bff : 0xc9a4ff, transparent: true, opacity: 0.75 - i * 0.18, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.y = 0.2 + i * 0.05; g.add(s); swirl.push(s);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0x1a0b30 }));
  core.position.y = 1.5; g.add(core);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0x9a6bff, transparent: true, opacity: 0.35, depthWrite: false }));
  halo.position.y = 1.5; g.add(halo);
  g.userData = { swirl, core, halo, r };
  return g;
}

/* ---------------- guided shell ---------------- */
function makeMissile() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.5, 10), M(0xdfe4ea));
  b.rotation.x = Math.PI / 2; g.add(b);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.7, 10), M(0xff6250)); tip.rotation.x = Math.PI / 2; tip.position.z = 1.1; g.add(tip);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.45), M(0xb8bec7)); f.position.z = -0.6; f.rotation.z = i * Math.PI / 2; f.position.y = 0; g.add(f); }
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: 0.85, depthWrite: false }));
  fire.rotation.x = -Math.PI / 2; fire.position.z = -1.2; g.add(fire);
  g.userData = { fire };
  return g;
}

/* ---------------- suicide car ---------------- */
function makeDrone(team) {
  const g = new THREE.Group(), col = TEAM_HEX[team] || TEAM_HEX[''];
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 2.1), M(0x555a60)); body.position.y = 0.55; body.castShadow = true; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 1.0), M(0x3f444a)); top.position.set(0, 1.0, -0.15); g.add(top);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.8), M(0xb04a2a)); crate.position.set(0, 1.05, 0.55); g.add(crate);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10), M(0x1f2124));
    w.rotation.z = Math.PI / 2; w.position.set(sx * 0.66, 0.3, sz * 0.72); g.add(w);
  }
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), new THREE.MeshBasicMaterial({ color: col }));
  light.position.set(0, 1.42, 0.55); g.add(light);
  g.userData = { light, col };
  return g;
}

/* ---------------- freeze cage (added to a tank) ---------------- */
export function makeCage() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.75, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, bar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 3.3, 5), m);
    bar.position.set(Math.sin(a) * 2.6, 1.65, Math.cos(a) * 2.6); g.add(bar);
  }
  for (const y of [0.15, 1.65, 3.2]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.075, 5, 22), m); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r);
  }
  const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(3.0, 0), new THREE.MeshBasicMaterial({ color: 0xcdf0ff, transparent: true, opacity: 0.16, depthWrite: false }));
  ice.position.y = 1.5; g.add(ice);
  g.userData = { m };
  return g;
}

/* ---------------- the ghost you see while choosing where to put it ---------------- */
function makeGhost() {
  const g = new THREE.Group();
  const lineG = new THREE.Group(); g.add(lineG);          // a wrapper so we can turn it with one angle
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1), new THREE.MeshBasicMaterial({ color: 0xc9a4ff, transparent: true, opacity: 0.5, depthWrite: false }));
  line.rotation.x = -Math.PI / 2; lineG.add(line);
  const spot = new THREE.Group(); g.add(spot);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xc9a4ff, transparent: true, opacity: 0.9, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xc9a4ff, transparent: true, opacity: 0.14, depthWrite: false }));
  ring.rotation.x = fill.rotation.x = -Math.PI / 2; fill.position.y = -0.01; spot.add(fill, ring);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 2.1, 0.8), new THREE.MeshBasicMaterial({ color: 0xc9a4ff, transparent: true, opacity: 0.3, depthWrite: false }));
  bar.position.y = 1.05; spot.add(bar);
  const tipG = new THREE.Group(); g.add(tipG);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 3), new THREE.MeshBasicMaterial({ color: 0xc9a4ff, transparent: true, opacity: 0.85, depthWrite: false }));
  tip.rotation.x = Math.PI / 2; tipG.add(tip);
  g.userData = { line, lineG, spot, ring, fill, bar, tip, tipG };
  g.visible = false;
  return g;
}

/* =====================================================================
   The manager: keeps the meshes in step with what the server sent.
   ===================================================================== */
export class AbilityFx {
  constructor(scene, groundY) {
    this.S = scene; this.gy = groundY; this.walls = new Map(); this.domes = new Map(); this.holes = new Map(); this.ms = new Map(); this.dr = new Map(); this.t = 0;
    this.ghost = makeGhost(); scene.add(this.ghost);
  }
  /** Show where the power would land. `p` = null hides it.
      p: { kind:'ground'|'dir', ab, x, z, a, r, len, fromX, fromZ } */
  showGhost(p) {
    const g = this.ghost, u = g.userData;
    if (!p) { g.visible = false; return; }
    g.visible = true;
    const y = this.gy(p.x, p.z) + 0.12;
    const d = Math.hypot(p.x - p.fromX, p.z - p.fromZ);
    // the dotted line from the tank out to the spot
    u.lineG.visible = true;
    u.line.scale.set(1, Math.max(0.1, d), 1);
    u.lineG.position.set((p.x + p.fromX) / 2, this.gy(p.fromX, p.fromZ) + 0.1, (p.z + p.fromZ) / 2);
    u.lineG.rotation.y = p.a;
    const pulse = 0.75 + 0.25 * Math.sin(this.t * 7);
    if (p.kind === 'ground') {
      u.spot.visible = true; u.tipG.visible = false;
      u.spot.position.set(p.x, y, p.z);
      u.spot.rotation.y = p.a;
      const r = p.r || 2.5;
      u.ring.scale.setScalar(r); u.fill.scale.setScalar(r);
      u.ring.material.opacity = 0.9 * pulse;
      u.bar.visible = !!p.len;
      if (p.len) u.bar.scale.set(p.len, 1, 1);
    } else {                                   // a direction: an arrow in front of the tank
      u.spot.visible = false; u.tipG.visible = true;
      u.tipG.position.set(p.x, this.gy(p.x, p.z) + 0.9, p.z);
      u.tipG.rotation.y = p.a;
      u.tip.material.opacity = 0.85 * pulse;
    }
  }

  clear() {
    for (const M2 of [this.walls, this.domes, this.holes, this.ms, this.dr]) { for (const o of M2.values()) this.S.remove(o.g); M2.clear(); }
    this.showGhost(null);
  }
  /** Walls, domes and holes, from the server's 'fx' message. */
  setFx(msg) {
    this.sync(this.walls, msg.w || [], (w) => makeWall(w.len, w.tm), (o, w) => {
      o.g.position.set(w.x, this.gy(w.x, w.z), w.z); o.g.rotation.y = w.a;
      const k = Math.max(0, Math.min(1, w.hp / w.mhp));            // a battered wall goes darker
      if (o.hp === undefined || Math.abs(o.hp - k) > 0.06) {
        o.hp = k; const g = Math.round(0x8b * (0.45 + 0.55 * k)), g2 = Math.round(0x84 * (0.45 + 0.55 * k));
        o.g.userData.body.material.color.setHex((g << 16) | (Math.round(0x8d * (0.45 + 0.55 * k)) << 8) | g2);
      }
    });
    this.sync(this.domes, msg.d || [], (d) => makeDome(d.r, d.tm), (o, d) => o.g.position.set(d.x, this.gy(d.x, d.z), d.z));
    this.sync(this.holes, msg.h || [], (h) => makeHole(h.r), (o, h) => { o.g.position.set(h.x, this.gy(h.x, h.z), h.z); o.r = h.r; });
  }
  sync(map, list, make, place) {
    const seen = new Set();
    for (const it of list) {
      seen.add(it.id);
      let o = map.get(it.id);
      if (!o) { o = { g: make(it), born: this.t }; this.S.add(o.g); map.set(it.id, o); o.fresh = true; }
      place(o, it);
    }
    for (const [id, o] of map) if (!seen.has(id)) { this.S.remove(o.g); map.delete(id); }
  }
  /** Guided shells and suicide cars, from the streamed 'ae' message. */
  setEntities(msg) {
    // rows: missile [id, x, z, angle, owner] · car [id, x, z, angle, hp%, owner, isRed]
    this.syncMoving(this.ms, msg.m || [], () => makeMissile(), 4);
    this.syncMoving(this.dr, msg.d || [], (row) => makeDrone(row[6] ? 'red' : 'blue'), 5);
  }
  syncMoving(map, rows, make, ownerAt) {
    const seen = new Set();
    for (const row of rows) {
      const [id, x, z, a] = row; seen.add(id);
      let o = map.get(id);
      if (!o) { o = { g: make(row), x, z, a }; this.S.add(o.g); map.set(id, o); }
      o.tx = x; o.tz = z; o.ta = a; o.owner = row[ownerAt];
      if (ownerAt === 5) o.hpPct = row[4];
    }
    for (const [id, o] of map) if (!seen.has(id)) { this.S.remove(o.g); map.delete(id); }
  }
  /** Where one of my guided shells is right now (for the camera to ride it). */
  myMissile(myId) { for (const o of this.ms.values()) if (o.owner === myId) return o; return null; }

  frame(dt, t) {
    this.t = t;
    const f = 1 - Math.exp(-dt * 14);
    for (const o of this.ms.values()) {
      o.x = lerp(o.x, o.tx ?? o.x, f); o.z = lerp(o.z, o.tz ?? o.z, f); o.a = lerpAngle(o.a, o.ta ?? o.a, f);
      o.g.position.set(o.x, this.gy(o.x, o.z) + 1.8, o.z); o.g.rotation.y = o.a;
      o.g.userData.fire.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    }
    for (const o of this.dr.values()) {
      o.x = lerp(o.x, o.tx ?? o.x, f); o.z = lerp(o.z, o.tz ?? o.z, f); o.a = lerpAngle(o.a, o.ta ?? o.a, f);
      o.g.position.set(o.x, this.gy(o.x, o.z), o.z); o.g.rotation.y = o.a;
      o.g.userData.light.visible = Math.sin(t * 16) > 0;          // blinking, so you notice it coming
    }
    for (const o of this.domes.values()) {
      const u = o.g.userData;
      u.wire.rotation.y = t * 0.25;
      u.skin.material.opacity = 0.1 + 0.04 * Math.sin(t * 3);
      const pop = Math.min(1, (t - o.born) * 6); o.g.scale.setScalar(0.3 + 0.7 * pop);
    }
    for (const o of this.holes.values()) {
      const u = o.g.userData;
      u.swirl.forEach((s, i) => { s.rotation.z -= dt * (2.2 + i * 1.1); });
      u.halo.scale.setScalar(1 + 0.12 * Math.sin(t * 8));
      u.core.rotation.y += dt * 2;
      const pop = Math.min(1, (t - o.born) * 5); o.g.scale.setScalar(0.25 + 0.75 * pop);
    }
    for (const o of this.walls.values()) { const pop = Math.min(1, (t - o.born) * 7); o.g.scale.y = 0.15 + 0.85 * pop; }
  }
  /** Minimap dots for the things players should be able to see coming. */
  marks(out) {
    for (const o of this.dr.values()) out.push({ x: o.x, z: o.z, col: '#ff9a3a', r: 0.05 });
    for (const o of this.holes.values()) out.push({ x: o.g.position.x, z: o.g.position.z, col: '#a97bff', r: 0.05 });
    for (const o of this.domes.values()) out.push({ x: o.g.position.x, z: o.g.position.z, col: '#8fe8ff', r: 0.04 });
  }
}
