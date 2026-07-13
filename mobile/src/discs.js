/** Disc skins and field presets for air frisbee. */

export const DISCS = [
  {
    id: 'classic',
    label: '经典',
    short: '经',
    color: '#e8a54b',
    glide: 1.0,
    curve: 1.0,
    lift: 1.0,
    humBase: 180,
    description: '均衡顺手',
  },
  {
    id: 'soft',
    label: '软盘',
    short: '软',
    color: '#7ec8a3',
    glide: 0.82,
    curve: 0.75,
    lift: 1.25,
    humBase: 150,
    description: '飘、好控',
  },
  {
    id: 'pro',
    label: '竞技',
    short: '竞',
    color: '#4a9fd8',
    glide: 1.22,
    curve: 1.35,
    lift: 0.95,
    humBase: 210,
    description: '远、敏感',
  },
  {
    id: 'glow',
    label: '夜光',
    short: '夜',
    color: '#c6f26d',
    glide: 1.05,
    curve: 1.1,
    lift: 1.1,
    humBase: 195,
    description: '亮、灵动',
  },
];

export const FIELDS = [
  {
    id: 'lawn',
    label: '草坪',
    short: '草',
    wind: 0.04,
    mode: 'distance',
    color: '#3d8f5a',
    description: '稳、少风',
    maxDistance: 55,
  },
  {
    id: 'hoop',
    label: '穿环',
    short: '环',
    wind: 0.08,
    mode: 'hoops',
    color: '#d4a017',
    description: '穿环加分',
    maxDistance: 48,
    hoops: [
      { x: 14, y: 0, radius: 2.2 },
      { x: 26, y: -3.5, radius: 2.0 },
      { x: 38, y: 2.5, radius: 1.8 },
    ],
  },
  {
    id: 'beach',
    label: '沙滩',
    short: '沙',
    wind: 0.22,
    mode: 'distance',
    color: '#c4783a',
    description: '侧风大',
    maxDistance: 50,
  },
];

export const SCORING = {
  distanceZones: [
    { minM: 40, points: 10, label: '超远' },
    { minM: 28, points: 8, label: '远投' },
    { minM: 18, points: 5, label: '中距' },
    { minM: 10, points: 2, label: '近距' },
  ],
  hoopBonus: 6,
  miss: 0,
};

export const ROUND = {
  throws: 5,
  maxCharge: 1,
  chargeRate: 0.9,
  minThrowPower: 0.15,
};

export const PHYSICS = {
  baseSpeed: 28,
  gravity: 9.2,
  drag: 0.18,
  bankCurve: 14,
  loftLift: 6.5,
  windScale: 9,
  spinDecay: 0.35,
};

/**
 * Score a landing distance in meters.
 * @param {number} distM
 */
export function scoreDistance(distM) {
  for (const zone of SCORING.distanceZones) {
    if (distM >= zone.minM) {
      return { points: zone.points, label: zone.label, zone };
    }
  }
  return { points: SCORING.miss, label: '太近', zone: null };
}

export function wrap(i, n) {
  return ((i % n) + n) % n;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
