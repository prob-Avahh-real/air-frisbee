import { DISCS, FIELDS, wrap } from './discs.js';
import { FrisbeePhysics } from './physics.js';
import { AudioEngine } from './audio-engine.js';
import { WearableInput } from './wearable-input.js';

const $ = (id) => document.getElementById(id);

const audio = new AudioEngine();
const state = {
  discIndex: 0,
  fieldIndex: 0,
  muted: false,
  bestScore: Number(localStorage.getItem('air-frisbee-best') || 0),
  spaceDown: false,
  lastHoopCount: 0,
  lastLandKey: null,
};

const physics = new FrisbeePhysics(DISCS[0], FIELDS[0]);
let lastTs = 0;
const canvas = /** @type {HTMLCanvasElement} */ ($('field'));
const ctx = canvas.getContext('2d');

function currentDisc() {
  return DISCS[state.discIndex];
}

function currentField() {
  return FIELDS[state.fieldIndex];
}

function showToast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 1300);
}

function haptic(ms = 14) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}

function applyTheme() {
  const disc = currentDisc();
  const field = currentField();
  document.documentElement.style.setProperty('--accent', disc.color);
  document.documentElement.style.setProperty('--field', field.color);
  document.body.dataset.disc = disc.id;
  document.body.dataset.field = field.id;
  audio.setDiscProfile(disc);
}

function renderChrome() {
  const disc = currentDisc();
  const field = currentField();
  applyTheme();
  $('disc-name').textContent = disc.label;
  $('disc-hint').textContent = disc.description;
  $('field-label').textContent = field.label;

  const discTabs = $('disc-tabs');
  discTabs.innerHTML = DISCS.map(
    (d, i) => `
    <button type="button" class="tab ${i === state.discIndex ? 'active' : ''}" data-kind="disc" data-i="${i}">
      ${d.label}
    </button>`
  ).join('');

  const fieldTabs = $('field-tabs');
  fieldTabs.innerHTML = FIELDS.map(
    (f, i) => `
    <button type="button" class="tab ${i === state.fieldIndex ? 'active' : ''}" data-kind="field" data-i="${i}">
      ${f.label}
    </button>`
  ).join('');

  $('mute-btn').classList.toggle('on', state.muted);
  $('mute-btn').textContent = state.muted ? '已静音' : '静音';
  $('best-score').textContent = String(Math.max(state.bestScore, physics.score));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function worldToScreen(x, y, maxX, w, h) {
  const padL = 28;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const sx = padL + (x / maxX) * (w - padL - padR);
  const sy = h / 2 + (y / (maxX * 0.35)) * ((h - padT - padB) * 0.42);
  return { sx, sy };
}

function drawField(snap) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;

  const maxX = snap.fieldMax || 55;
  ctx.clearRect(0, 0, w, h);

  // Grass lanes
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e8a54b';
  const fieldCol = getComputedStyle(document.documentElement).getPropertyValue('--field').trim() || '#3d8f5a';

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(8, 22, 16, 0.15)');
  grad.addColorStop(1, 'rgba(8, 22, 16, 0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let m = 10; m <= maxX; m += 10) {
    const { sx } = worldToScreen(m, 0, maxX, w, h);
    ctx.strokeStyle = 'rgba(200, 230, 210, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, 10);
    ctx.lineTo(sx, h - 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(180, 210, 195, 0.45)';
    ctx.font = '600 10px Syne, sans-serif';
    ctx.fillText(`${m}m`, sx - 8, h - 8);
  }

  // Center lane
  ctx.strokeStyle = 'rgba(232, 245, 236, 0.18)';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(28, h / 2);
  ctx.lineTo(w - 16, h / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Wind arrow
  const wind = snap.wind || 0;
  ctx.fillStyle = 'rgba(200, 220, 230, 0.55)';
  ctx.font = '600 11px Noto Sans SC, sans-serif';
  ctx.fillText(`风 ${wind >= 0 ? '→' : '←'} ${Math.abs(wind).toFixed(2)}`, w - 88, 18);

  // Hoops
  if (snap.hoops?.length) {
    snap.hoops.forEach((hoop, i) => {
      const { sx, sy } = worldToScreen(hoop.x, hoop.y, maxX, w, h);
      const hit = snap.disc?.hoopsHit?.includes(i);
      const r = 14 + hoop.radius * 2;
      ctx.strokeStyle = hit ? accent : fieldCol;
      ctx.lineWidth = hit ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 0.55, r, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hit ? accent : 'rgba(255,255,255,0.35)';
      ctx.font = '700 10px Syne, sans-serif';
      ctx.fillText(`#${i + 1}`, sx - 6, sy - r - 4);
    });
  }

  // Past landings
  for (const t of snap.throws || []) {
    const { sx, sy } = worldToScreen(t.x, t.y, maxX, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aim guide
  if (!snap.flying) {
    const aimLen = 8 + snap.charge * 18;
    const yaw = snap.aimYaw * 0.55;
    const tipX = Math.cos(yaw) * aimLen;
    const tipY = Math.sin(yaw) * aimLen * 6;
    const a0 = worldToScreen(0, 0, maxX, w, h);
    const a1 = worldToScreen(tipX, tipY, maxX, w, h);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35 + snap.charge * 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a0.sx, a0.sy);
    ctx.lineTo(a1.sx, a1.sy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Ready disc at origin
    drawDiscIcon(a0.sx, a0.sy, 11 + snap.charge * 4, snap.aimYaw, accent, 1);
  }

  // Flight trail + disc
  if (snap.disc) {
    const trail = snap.disc.trail || [];
    if (trail.length > 1) {
      ctx.beginPath();
      trail.forEach((p, i) => {
        const { sx, sy } = worldToScreen(p.x, p.y, maxX, w, h);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const { sx, sy } = worldToScreen(snap.disc.x, snap.disc.y, maxX, w, h);
    const scale = 1 + Math.min(0.5, snap.disc.z * 0.08);
    drawDiscIcon(sx, sy, 10 * scale, snap.disc.bank || 0, accent, 0.85 + Math.min(0.15, snap.disc.z * 0.03));

    // Height shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 10 + snap.disc.z * 2, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDiscIcon(x, y, r, bank, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank * 0.6);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderHud(snap) {
  $('score').textContent = String(snap.score);
  $('throws-left').textContent = String(snap.throwsLeft);
  $('charge-val').textContent = `${Math.round(snap.charge * 100)}%`;
  $('loft-val').textContent = `${Math.round(snap.aimLoft * 100)}%`;

  const status = $('status');
  if (snap.roundOver) {
    status.textContent = '本轮结束';
    status.dataset.state = 'over';
  } else if (snap.flying) {
    status.textContent = '飞行中';
    status.dataset.state = 'fly';
  } else if (snap.charging) {
    status.textContent = '蓄力';
    status.dataset.state = 'charge';
  } else {
    status.textContent = '待命';
    status.dataset.state = 'idle';
  }

  const bar = $('charge-bar');
  if (bar) bar.style.width = `${Math.min(100, snap.charge * 100)}%`;

  drawField(snap);
}

function selectDisc(i) {
  if (physics.flying) return;
  state.discIndex = wrap(i, DISCS.length);
  physics.applyDisc(currentDisc());
  renderChrome();
  showToast(`飞盘 · ${currentDisc().label}`);
  haptic(8);
}

function selectField(i) {
  if (physics.flying) return;
  state.fieldIndex = wrap(i, FIELDS.length);
  physics.applyField(currentField());
  physics.resetRound();
  state.lastHoopCount = 0;
  state.lastLandKey = null;
  renderChrome();
  showToast(`场地 · ${currentField().label}`);
  haptic(8);
}

function setMuted(muted) {
  state.muted = muted;
  audio.setMuted(muted);
  renderChrome();
  showToast(muted ? '已静音' : '取消静音');
}

function newRound() {
  physics.resetRound();
  state.lastHoopCount = 0;
  state.lastLandKey = null;
  renderChrome();
  showToast('新一轮');
  haptic(10);
}

async function doCharge(detail = {}) {
  await audio.ensure();
  const v = detail.velocity ?? 0.9;
  physics.addCharge(0.1 + v * 0.08);
  haptic(8);
}

async function doThrow(detail = {}) {
  await audio.ensure();
  const v = detail.velocity ?? 1;
  const result = physics.throwDisc(v);
  if (!result) {
    showToast('蓄力不足');
    return;
  }
  await audio.throwWhoosh(v * (result.power || 1));
  haptic(18);
  showToast('出手！');
  state.lastHoopCount = 0;
}

async function doCancel() {
  if (!physics.charging && physics.charge < 0.02) return;
  physics.cancelCharge();
  await audio.cancel();
  haptic(10);
  showToast('取消蓄力');
}

function handleGesture(gesture, detail) {
  switch (gesture) {
    case 'aim':
      if (detail) physics.setAim(detail.yaw, detail.loft);
      break;
    case 'charge':
      doCharge(detail || { velocity: 0.85 });
      break;
    case 'throw':
      doThrow(detail || { velocity: 0.95 });
      break;
    case 'cancel_charge':
      doCancel();
      break;
    case 'toggle_mute':
      setMuted(!state.muted);
      break;
    default:
      break;
  }
}

const wearable = new WearableInput({
  onGesture: handleGesture,
  onBadge: (kind, text, active) => {
    const el = $(`${kind}-badge`);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('active', active);
  },
});

function bindUi() {
  $('disc-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.dataset.kind !== 'disc') return;
    selectDisc(Number(btn.dataset.i));
  });

  $('field-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.dataset.kind !== 'field') return;
    selectField(Number(btn.dataset.i));
  });

  $('charge-btn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    physics.startCharge();
    state.spaceDown = true;
  });
  $('charge-btn').addEventListener('pointerup', () => {
    state.spaceDown = false;
  });
  $('charge-btn').addEventListener('pointerleave', () => {
    state.spaceDown = false;
  });

  $('throw-btn').addEventListener('click', () => doThrow({ velocity: 1.0 }));
  $('round-btn').addEventListener('click', newRound);
  $('mute-btn').addEventListener('click', () => setMuted(!state.muted));

  // Drag on canvas to aim
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture?.(e.pointerId);
    aimFromPointer(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    aimFromPointer(e);
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (!state.spaceDown) {
        state.spaceDown = true;
        physics.startCharge();
      }
    } else if (e.key === '1') selectField(0);
    else if (e.key === '2') selectField(1);
    else if (e.key === '3') selectField(2);
    else if (e.key === 'ArrowLeft') selectDisc(state.discIndex - 1);
    else if (e.key === 'ArrowRight') selectDisc(state.discIndex + 1);
    else if (e.key === 'r' || e.key === 'R') newRound();
    else if (e.key === 'm' || e.key === 'M') setMuted(!state.muted);
    else if (e.key === 'Escape') doCancel();
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      state.spaceDown = false;
      doThrow({ velocity: 1.0 });
    }
  });

  window.addEventListener('resize', resizeCanvas);
}

function aimFromPointer(e) {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  const yaw = (nx - 0.35) * 2.2;
  const loft = 0.85 - ny * 0.75;
  physics.setAim(yaw, loft);
}

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;

  if (state.spaceDown && !physics.flying) {
    physics.addCharge(ROUND_CHARGE_PER_FRAME * (dt / 0.016));
  }

  const snap = physics.update(dt);
  renderHud(snap);
  audio.sync(snap);

  // Hoop chime
  const hoopCount = snap.disc?.hoopsHit?.length || 0;
  if (hoopCount > state.lastHoopCount) {
    audio.hoop();
    haptic([12, 30, 12]);
    showToast(`穿环 ×${hoopCount}`);
    state.lastHoopCount = hoopCount;
  }

  // Landing
  if (snap.pendingResult) {
    const key = `${snap.throws.length}-${snap.pendingResult.distM.toFixed(2)}`;
    if (state.lastLandKey !== key) {
      state.lastLandKey = key;
      const r = snap.pendingResult;
      audio.land(Math.min(1, r.distM / 40));
      haptic(20);
      showToast(`${r.label} · ${r.distM.toFixed(1)}m · +${r.points}`);
      if (snap.score > state.bestScore) {
        state.bestScore = snap.score;
        localStorage.setItem('air-frisbee-best', String(state.bestScore));
      }
      renderChrome();
      if (snap.roundOver) {
        setTimeout(() => showToast(`本轮 ${snap.score} 分`), 900);
      }
    }
  }

  requestAnimationFrame(loop);
}

const ROUND_CHARGE_PER_FRAME = 0.035;

resizeCanvas();
renderChrome();
bindUi();
wearable.setupRing();
wearable.setupCane();
requestAnimationFrame(loop);

document.body.addEventListener(
  'pointerdown',
  () => {
    audio.ensure();
  },
  { once: true }
);
