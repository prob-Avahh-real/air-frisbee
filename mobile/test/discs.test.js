const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const DISCS = [
  { id: 'classic', label: '经典', glide: 1.0, curve: 1.0, lift: 1.0 },
  { id: 'soft', label: '软盘', glide: 0.82, curve: 0.75, lift: 1.25 },
  { id: 'pro', label: '竞技', glide: 1.22, curve: 1.35, lift: 0.95 },
  { id: 'glow', label: '夜光', glide: 1.05, curve: 1.1, lift: 1.1 },
];

const FIELDS = [
  { id: 'lawn', label: '草坪', wind: 0.04, mode: 'distance' },
  { id: 'hoop', label: '穿环', wind: 0.08, mode: 'hoops' },
  { id: 'beach', label: '沙滩', wind: 0.22, mode: 'distance' },
];

const SCORING = {
  distanceZones: [
    { minM: 40, points: 10, label: '超远' },
    { minM: 28, points: 8, label: '远投' },
    { minM: 18, points: 5, label: '中距' },
    { minM: 10, points: 2, label: '近距' },
  ],
  hoopBonus: 6,
  miss: 0,
};

const ROUND = {
  throws: 5,
  maxCharge: 1,
  minThrowPower: 0.15,
};

function wrap(i, n) {
  return ((i % n) + n) % n;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function scoreDistance(distM) {
  for (const zone of SCORING.distanceZones) {
    if (distM >= zone.minM) {
      return { points: zone.points, label: zone.label, zone };
    }
  }
  return { points: SCORING.miss, label: '太近', zone: null };
}

describe('air-frisbee discs', () => {
  it('has four disc styles', () => {
    assert.deepEqual(
      DISCS.map((d) => d.id),
      ['classic', 'soft', 'pro', 'glow']
    );
  });

  it('pro glides farther than soft', () => {
    const pro = DISCS.find((d) => d.id === 'pro');
    const soft = DISCS.find((d) => d.id === 'soft');
    assert.ok(pro.glide > soft.glide);
    assert.ok(pro.curve > soft.curve);
  });

  it('wrap cycles disc index', () => {
    assert.equal(wrap(-1, 4), 3);
    assert.equal(wrap(4, 4), 0);
  });
});

describe('air-frisbee scoring', () => {
  it('scores distance zones', () => {
    assert.equal(scoreDistance(42).points, 10);
    assert.equal(scoreDistance(30).points, 8);
    assert.equal(scoreDistance(20).points, 5);
    assert.equal(scoreDistance(12).points, 2);
    assert.equal(scoreDistance(5).points, 0);
  });

  it('clamp and charge bounds', () => {
    assert.equal(clamp(1.5, 0, ROUND.maxCharge), 1);
    assert.equal(clamp(-0.2, 0, 1), 0);
    assert.ok(ROUND.minThrowPower < ROUND.maxCharge);
  });
});

describe('air-frisbee fields', () => {
  it('has three fields including hoop mode', () => {
    assert.equal(FIELDS.length, 3);
    assert.equal(FIELDS.find((f) => f.id === 'hoop').mode, 'hoops');
    assert.ok(FIELDS.find((f) => f.id === 'beach').wind > FIELDS.find((f) => f.id === 'lawn').wind);
  });
});

describe('project scaffold', () => {
  it('protocol file exists with ring and cane gestures', () => {
    const p = path.join(__dirname, '..', '..', 'protocol', 'air-frisbee.json');
    assert.ok(fs.existsSync(p));
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(data.gestures.ring);
    assert.ok(data.gestures.cane);
    assert.equal(data.gestures.cane.swing.action, 'charge');
    assert.equal(data.gestures.cane.tap.action, 'throw');
    assert.equal(data.gestures.ring.shake.action, 'cancel_charge');
    assert.equal(data.discs.length, 4);
    assert.equal(data.fields.length, 3);
  });
});
