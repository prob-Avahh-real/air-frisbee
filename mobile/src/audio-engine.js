/**
 * Charge hum + throw / land / hoop one-shots for the frisbee.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.humOsc = null;
    this.humGain = null;
    this.humFilter = null;
    this.noiseSrc = null;
    this.noiseGain = null;
    this.humBase = 180;
    this.running = false;
  }

  async ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.62;
    this.master.connect(this.ctx.destination);
    this._buildHum();
  }

  _buildHum() {
    this.humOsc = this.ctx.createOscillator();
    this.humFilter = this.ctx.createBiquadFilter();
    this.humGain = this.ctx.createGain();

    this.humOsc.type = 'sawtooth';
    this.humOsc.frequency.value = this.humBase;
    this.humFilter.type = 'bandpass';
    this.humFilter.frequency.value = 900;
    this.humFilter.Q.value = 1.1;
    this.humGain.gain.value = 0.0001;

    this.humOsc.connect(this.humFilter);
    this.humFilter.connect(this.humGain);
    this.humGain.connect(this.master);

    const noiseBuf = this._noiseBuffer(2);
    this.noiseSrc = this.ctx.createBufferSource();
    this.noiseSrc.buffer = noiseBuf;
    this.noiseSrc.loop = true;
    const np = this.ctx.createBiquadFilter();
    np.type = 'highpass';
    np.frequency.value = 1200;
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.0001;
    this.noiseSrc.connect(np);
    np.connect(this.noiseGain);
    this.noiseGain.connect(this.master);

    this.humOsc.start();
    this.noiseSrc.start();
    this.running = true;
  }

  setDiscProfile(disc) {
    this.humBase = disc.humBase ?? 180;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.62, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * Drive charge / flight tone from physics snapshot.
   * @param {{ charge: number, charging: boolean, flying: boolean, disc?: { spin: number, z: number } | null }} snap
   */
  sync(snap) {
    if (!this.ctx || !this.humGain || this.muted) return;
    const t = this.ctx.currentTime;

    if (snap.flying && snap.disc) {
      const spin = snap.disc.spin || 0;
      const z = snap.disc.z || 0;
      const freq = this.humBase + spin * 90 + z * 12;
      const vol = 0.05 + spin * 0.12;
      this.humOsc.frequency.setTargetAtTime(freq, t, 0.06);
      this.humFilter.frequency.setTargetAtTime(700 + spin * 1400, t, 0.08);
      this.humGain.gain.setTargetAtTime(vol, t, 0.05);
      this.noiseGain.gain.setTargetAtTime(0.02 + spin * 0.05, t, 0.06);
      return;
    }

    if (snap.charging || snap.charge > 0.02) {
      const c = snap.charge || 0;
      const freq = this.humBase * 0.7 + c * 160;
      const vol = 0.03 + c * 0.18;
      this.humOsc.frequency.setTargetAtTime(freq, t, 0.05);
      this.humFilter.frequency.setTargetAtTime(500 + c * 1800, t, 0.07);
      this.humGain.gain.setTargetAtTime(vol, t, 0.05);
      this.noiseGain.gain.setTargetAtTime(c * 0.035, t, 0.06);
      return;
    }

    this.humGain.gain.setTargetAtTime(0.0001, t, 0.08);
    this.noiseGain.gain.setTargetAtTime(0.0001, t, 0.08);
  }

  async throwWhoosh(velocity = 0.85) {
    await this.ensure();
    if (this.muted) return;
    const t = this.ctx.currentTime;
    const v = Math.min(1.3, Math.max(0.3, velocity));

    const noise = this._noiseBuffer(0.35);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400 + v * 400, t);
    bp.frequency.exponentialRampToValueAtTime(1800 + v * 900, t + 0.22);
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.4 * v, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);

    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 + v * 100, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.2);
    og.gain.setValueAtTime(0.18 * v, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(og);
    og.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  async land(distNorm = 0.5) {
    await this.ensure();
    if (this.muted) return;
    const t = this.ctx.currentTime;
    const n = Math.min(1, Math.max(0.15, distNorm));

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 + n * 80, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    g.gain.setValueAtTime(0.22 * n, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);

    const noise = this._noiseBuffer(0.15);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.2 * n, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(this.master);
    src.start(t);
  }

  async hoop() {
    await this.ensure();
    if (this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(990, t + 0.12);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  async cancel() {
    await this.ensure();
    if (this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  _noiseBuffer(duration) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
