import { FIELDS, PHYSICS, ROUND, SCORING, clamp, scoreDistance } from './discs.js';

/**
 * Frisbee aim / charge / flight physics.
 * Field space: x = forward meters, y = lateral meters, z = height meters.
 */
export class FrisbeePhysics {
  constructor(disc, field) {
    this.applyDisc(disc);
    this.applyField(field);
    this.resetRound();
  }

  applyDisc(disc) {
    this.disc = disc;
  }

  applyField(field) {
    this.field = field;
  }

  resetRound() {
    this.aimYaw = 0;
    this.aimLoft = 0.28;
    this.charge = 0;
    this.charging = false;
    this.flying = false;
    this.discState = null;
    this.throws = [];
    this.throwsLeft = ROUND.throws;
    this.score = 0;
    this.lastResult = null;
    this.windPhase = Math.random() * Math.PI * 2;
    this.windDir = Math.random() > 0.5 ? 1 : -1;
    this.pendingLanded = false;
  }

  setAim(yaw, loft) {
    if (this.flying) return;
    this.aimYaw = clamp(yaw, -1, 1);
    this.aimLoft = clamp(loft, 0.05, 0.85);
  }

  nudgeAim(dyaw, dloft) {
    this.setAim(this.aimYaw + dyaw, this.aimLoft + dloft);
  }

  startCharge() {
    if (this.flying || this.throwsLeft <= 0) return false;
    this.charging = true;
    return true;
  }

  /**
   * @param {number} amount 0–1 incremental power
   */
  addCharge(amount = 0.12) {
    if (this.flying || this.throwsLeft <= 0) return;
    this.charging = true;
    this.charge = clamp(this.charge + amount, 0, ROUND.maxCharge);
  }

  cancelCharge() {
    this.charging = false;
    this.charge = 0;
  }

  currentWind() {
    const base = this.field.wind * this.windDir;
    const gust = Math.sin(this.windPhase) * this.field.wind * 0.4;
    return base + gust;
  }

  /**
   * Release the disc if power is enough.
   * @param {number} [velocity]
   */
  throwDisc(velocity = 1) {
    if (this.flying || this.throwsLeft <= 0) return null;
    if (this.charge < ROUND.minThrowPower) {
      this.cancelCharge();
      return null;
    }

    const power = clamp(this.charge * clamp(velocity, 0.55, 1.3), 0.2, 1);
    const speed = PHYSICS.baseSpeed * power * this.disc.glide;
    const yaw = this.aimYaw * 0.55;
    const loft = 0.15 + this.aimLoft * 0.9;
    const spin = 0.55 + power * 0.45;

    this.discState = {
      x: 0,
      y: 0,
      z: 1.1,
      vx: Math.cos(yaw) * speed * Math.cos(loft * 0.7),
      vy: Math.sin(yaw) * speed * 0.85,
      vz: Math.sin(loft) * speed * 0.55 + 1.2,
      spin,
      bank: this.aimYaw,
      power,
      age: 0,
      hoopsHit: [],
      trail: [{ x: 0, y: 0, z: 1.1 }],
    };

    this.flying = true;
    this.charging = false;
    this.charge = 0;
    this.throwsLeft -= 1;
    this.pendingLanded = false;
    return this.discState;
  }

  /**
   * @param {number} dt seconds
   */
  update(dt) {
    this.windPhase += dt * 1.5;

    if (!this.flying || !this.discState) {
      if (this.charging) {
        this.charge = clamp(this.charge + ROUND.chargeRate * dt, 0, ROUND.maxCharge);
      }
      return this.snapshot();
    }

    const d = this.discState;
    d.age += dt;

    const wind = this.currentWind() * PHYSICS.windScale;
    const lift = d.spin * PHYSICS.loftLift * this.disc.lift * (0.4 + Math.min(1, d.z / 3));
    const curve = d.bank * PHYSICS.bankCurve * this.disc.curve * (d.spin * 0.7 + 0.3);

    d.vx += (-d.vx * PHYSICS.drag + wind * 0.15) * dt;
    d.vy += (curve + wind - d.vy * PHYSICS.drag * 0.85) * dt;
    d.vz += (-PHYSICS.gravity + lift) * dt;

    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;
    d.spin = Math.max(0.05, d.spin - PHYSICS.spinDecay * dt);
    d.bank *= 1 - 0.08 * dt;

    if (d.trail.length > 48) d.trail.shift();
    d.trail.push({ x: d.x, y: d.y, z: d.z });

    this._checkHoops(d);

    if (d.z <= 0.05 || d.age > 8) {
      d.z = 0;
      this._land(d);
    }

    return this.snapshot();
  }

  _checkHoops(d) {
    if (this.field.mode !== 'hoops' || !this.field.hoops) return;
    for (let i = 0; i < this.field.hoops.length; i++) {
      if (d.hoopsHit.includes(i)) continue;
      const h = this.field.hoops[i];
      if (d.x < h.x - 0.8 || d.x > h.x + 0.8) continue;
      const dy = d.y - h.y;
      const dz = d.z - 1.6;
      if (Math.hypot(dy, dz) <= h.radius) {
        d.hoopsHit.push(i);
      }
    }
  }

  _land(d) {
    if (this.pendingLanded) return;
    this.pendingLanded = true;
    this.flying = false;

    const distM = Math.hypot(d.x, d.y);
    const distScore = scoreDistance(distM);
    const hoopPts = (d.hoopsHit?.length || 0) * SCORING.hoopBonus;
    const points = distScore.points + hoopPts;
    let label = distScore.label;
    if (hoopPts > 0) {
      label = `${distScore.label} · 穿环×${d.hoopsHit.length}`;
    }

    const result = {
      points,
      label,
      distM,
      hoops: d.hoopsHit?.length || 0,
      x: d.x,
      y: d.y,
    };

    this.score += points;
    this.lastResult = result;
    this.throws.push(result);
    d.landed = true;
    d.result = result;
  }

  snapshot() {
    const d = this.discState;
    return {
      aimYaw: this.aimYaw,
      aimLoft: this.aimLoft,
      charge: this.charge,
      charging: this.charging,
      flying: this.flying,
      throwsLeft: this.throwsLeft,
      score: this.score,
      throws: this.throws,
      lastResult: this.lastResult,
      wind: this.currentWind(),
      roundOver: this.throwsLeft <= 0 && !this.flying,
      disc: d
        ? {
            x: d.x,
            y: d.y,
            z: d.z,
            spin: d.spin,
            bank: d.bank,
            trail: d.trail,
            hoopsHit: d.hoopsHit,
            landed: !!d.landed,
            result: d.result || null,
            age: d.age,
          }
        : null,
      pendingResult: d && d.landed ? d.result : null,
      fieldMax: this.field.maxDistance || 55,
      hoops: this.field.hoops || [],
      mode: this.field.mode,
    };
  }
}

export { ROUND, SCORING, FIELDS, clamp, scoreDistance };
