/* Touch controls built for thumbs (not an emulated mouse):
   - MOVE stick and AIM stick; the turret points where you push.
   - FIRE button: hold to keep firing whenever the gun is loaded.
   Multi-touch safe: each finger is tracked by its pointer id.

   The layout is the player's: every control can be dragged anywhere,
   resized, and made faint ("visibility"). A touch goes to the nearest
   stick. "Floating" sticks jump to where the thumb lands; fixed sticks
   stay at their home spot. Saved in settings.touchLayout. */
import { settings, saveSettings } from '../settings.js';

// Smaller by default so the buttons cover less of the screen — Settings → Touch layout
// lets every player make them bigger again.
export const TOUCH_DEFAULT = () => ({
  move: { x: 0.14, y: 0.75, s: 0.8 },
  aim:  { x: 0.88, y: 0.75, s: 0.8 },
  fire: { x: 0.70, y: 0.84, s: 0.8 },
  alpha: 0.75, float: true,
});
export function touchLayout() {
  const d = TOUCH_DEFAULT(), L = settings.touchLayout || {};
  const pick = (k) => ({ ...d[k], ...(L[k] || {}) });
  return { move: pick('move'), aim: pick('aim'), fire: pick('fire'), alpha: L.alpha ?? d.alpha, float: L.float ?? d.float };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class TouchControls {
  constructor(root, els) {
    this.root = root; this.els = els; // {moveBase, moveKnob, aimBase, aimKnob, fire}
    this.active = false; this.moveAngle = 0; this.moveMag = 0; this.aimAngle = 0; this.aimMag = 0; this.fire = false; this.everAimed = false;
    this.ptr = { move: null, aim: null, fire: null };
    this.R = 70; // stick radius in CSS px (before HUD scale and the player's size)
    this.editing = false; this.drag = null; this.sel = 'move';
    // Aim-and-release: push the aim stick far enough ("armed", a glowing ball appears), let go to fire.
    this.armed = false; this.firePending = 0; this.reloading = false; this.abPending = false; this.firePulse = false;
    this.ball = document.createElement('i'); this.ball.className = 'ready-ball'; els.aimKnob.appendChild(this.ball);
    this.hint = document.createElement('span'); this.hint.className = 'letgo'; els.aimBase.appendChild(this.hint);
    this.L = touchLayout();
    const down = (e) => this.down(e), move = (e) => this.move(e), up = (e) => this.up(e);
    root.addEventListener('pointerdown', down, { passive: false });
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    els.fire.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (this.editing) { this.startDrag('fire', e); return; }
      this.ptr.fire = e.pointerId; this.fire = true; this.firePulse = true;   // latched: a very quick tap still counts
      els.fire.classList.add('press'); this.onFire && this.onFire();
    }, { passive: false });
    window.addEventListener('resize', () => this.apply());
    this.apply();
  }
  scale() { return this.getScale ? this.getScale() : 1; }
  /** The special-power button: one tap = one use, picked up by the next input tick. */
  bindAbility(el) {
    if (!el || this._abBound) return; this._abBound = el;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.editing) return; this.abPending = true; el.classList.add('press'); this.onAbility && this.onAbility(); });
    const up = () => el.classList.remove('press');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  }
  takeAbility() { const v = this.abPending; this.abPending = false; return v; }
  takePulse() { const v = this.firePulse; this.firePulse = false; return v; }
  baseOf(z) { return z === 'move' ? this.els.moveBase : z === 'aim' ? this.els.aimBase : this.els.fire; }
  home(z) { const c = this.L[z]; return { x: c.x * window.innerWidth, y: c.y * window.innerHeight }; }
  // Put every control at its saved spot, size and visibility.
  apply() {
    const L = this.L;
    for (const z of ['move', 'aim', 'fire']) {
      const b = this.baseOf(z), h = this.home(z);
      b.style.setProperty('--sz', L[z].s);
      if (!b.classList.contains('live')) { b.style.left = h.x + 'px'; b.style.top = h.y + 'px'; }
    }
    this.root.style.setProperty('--ta', L.alpha);
  }
  save() { settings.touchLayout = JSON.parse(JSON.stringify(this.L)); saveSettings(); }
  reset() { this.L = TOUCH_DEFAULT(); this.apply(); this.save(); this.onEdit && this.onEdit(); }

  zoneOf(e) {
    const dist = (z) => { const h = this.home(z); return Math.hypot(e.clientX - h.x, e.clientY - h.y); };
    return dist('move') <= dist('aim') ? 'move' : 'aim';
  }
  place(base, x, y) { base.style.left = x + 'px'; base.style.top = y + 'px'; base.classList.add('live'); }
  down(e) {
    if (this.editing) {
      const st = e.target.closest('.stick');
      if (st) { e.preventDefault(); this.startDrag(st === this.els.moveBase ? 'move' : 'aim', e); }
      return;
    }
    if (e.pointerType === 'mouse') return;
    if (e.target.closest('.m-btn, .firebtn, .abilbtn, .no-stick')) return;
    e.preventDefault();
    this.active = true;
    const z = this.zoneOf(e);
    if (this.ptr[z] !== null) return;
    this.ptr[z] = e.pointerId;
    const s = this.baseOf(z);
    const r = this.root.getBoundingClientRect();
    if (this.L.float) { this['o_' + z] = { x: e.clientX, y: e.clientY }; this.place(s, e.clientX - r.left, e.clientY - r.top); }
    else { const h = this.home(z); this['o_' + z] = h; s.classList.add('live'); }
    this.move(e);
  }
  move(e) {
    if (this.drag && this.drag.id === e.pointerId) { e.preventDefault(); this.dragTo(e); return; }
    for (const z of ['move', 'aim']) {
      if (this.ptr[z] !== e.pointerId) continue;
      e.preventDefault();
      const sens = z === 'move' ? (settings.moveSens || 100) / 100 : (settings.aimSens || 100) / 100;   // higher = less thumb travel needed
      const o = this['o_' + z]; const R = this.R * this.scale() * this.L[z].s / sens;
      let dx = e.clientX - o.x, dy = e.clientY - o.y; const d = Math.hypot(dx, dy);
      const mag = Math.min(1, d / R); if (d > R) { dx *= R / d; dy *= R / d; }
      const knob = z === 'move' ? this.els.moveKnob : this.els.aimKnob;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const ang = Math.atan2(dx, dy); // screen right = +x, screen down = +z
      if (z === 'move') { this.moveAngle = ang; this.moveMag = mag < 0.15 ? 0 : mag; }
      else { this.aimAngle = ang; this.aimMag = mag; if (mag > 0.25) this.everAimed = true; this.setArmed(mag >= 0.6 && settings.releaseFire !== false); }
    }
  }
  up(e) {
    if (this.drag && this.drag.id === e.pointerId) { this.drag = null; this.save(); return; }
    if (this.ptr.fire === e.pointerId) { this.ptr.fire = null; this.fire = false; this.els.fire.classList.remove('press'); }
    for (const z of ['move', 'aim']) {
      if (this.ptr[z] !== e.pointerId) continue;
      this.ptr[z] = null;
      const knob = z === 'move' ? this.els.moveKnob : this.els.aimKnob; knob.style.transform = '';
      const base = this.baseOf(z); base.classList.remove('live');
      const h = this.home(z); base.style.left = h.x + 'px'; base.style.top = h.y + 'px';
      if (z === 'move') this.moveMag = 0;
      else { if (this.armed) this.firePending = performance.now() + 450; this.aimMag = 0; this.setArmed(false); }
    }
  }
  setArmed(on) {
    if (on === this.armed) return; this.armed = on;
    this.els.aimBase.classList.toggle('armed', on);
    if (on && navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
  }
  setReloading(r) { if (r !== this.reloading) { this.reloading = r; this.els.aimBase.classList.toggle('wait', r); } }
  /** A release-to-fire shot waiting to go out (kept briefly so a shot released during reload still fires). */
  takeFire(reload) {
    if (!this.firePending) return false;
    if (performance.now() > this.firePending) { this.firePending = 0; return false; }
    if (reload > 0) return false;
    this.firePending = 0; return true;
  }
  release() {
    this.ptr = { move: null, aim: null, fire: null }; this.moveMag = 0; this.aimMag = 0; this.fire = false; this.firePending = 0; this.setArmed(false);
    for (const z of ['move', 'aim']) { this.baseOf(z).classList.remove('live'); }
    this.els.moveKnob.style.transform = ''; this.els.aimKnob.style.transform = ''; this.els.fire.classList.remove('press');
    this.apply();
  }

  /* ---------------- layout editor ---------------- */
  setEditing(on) {
    this.release(); this.editing = on; this.drag = null;
    this.root.classList.toggle('editing', on);
    this.select(this.sel);
  }
  select(z) {
    this.sel = z;
    for (const k of ['move', 'aim', 'fire']) this.baseOf(k).classList.toggle('sel', this.editing && k === z);
    this.onEdit && this.onEdit();
  }
  startDrag(z, e) {
    const h = this.home(z);
    this.drag = { id: e.pointerId, z, dx: e.clientX - h.x, dy: e.clientY - h.y };
    this.select(z);
  }
  dragTo(e) {
    const { z, dx, dy } = this.drag, W = window.innerWidth, H = window.innerHeight;
    const half = (z === 'fire' ? 56 : 85) * this.scale() * this.L[z].s;
    const x = clamp(e.clientX - dx, half, W - half), y = clamp(e.clientY - dy, half, H - half);
    this.L[z].x = x / W; this.L[z].y = y / H; this.apply();
  }
  setSize(v) { this.L[this.sel].s = clamp(v, 0.6, 1.6); this.apply(); this.save(); }
  setAlpha(v) { this.L.alpha = clamp(v, 0.15, 1); this.apply(); this.save(); }
  setFloat(v) { this.L.float = !!v; this.save(); }
}
