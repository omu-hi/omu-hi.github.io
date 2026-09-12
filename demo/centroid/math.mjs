export const COUNT = 40;
export const INITIAL_POINT = Object.freeze({ x: 8.2, y: 2 });
export const DOMAIN = Object.freeze({ min: 0, max: 10 });

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller sampling of one bivariate normal distribution. Reject samples
// outside the plot instead of clipping them into artificial piles at the edges.
export function createDataset(seed = 20260912, count = COUNT) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be a positive integer');
  const random = seededRandom(seed);
  const cx = 4.6 + random() * 1.2;
  const cy = 4.6 + random() * 1.2;
  const points = [];
  while (points.length < count) {
    const radius = Math.sqrt(-2 * Math.log(1 - random()));
    const angle = 2 * Math.PI * random();
    const u = radius * Math.cos(angle);
    const v = radius * Math.sin(angle);
    const x = cx + 1.22 * u;
    const y = cy + 1.04 * (0.35 * u + Math.sqrt(1 - 0.35 ** 2) * v);
    if (x >= 0.4 && x <= 9.6 && y >= 0.4 && y <= 9.6) points.push({ x, y });
  }
  return points;
}

export function centroid(points) {
  if (!points.length) throw new RangeError('points must not be empty');
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function squaredDistance(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

export function objective(points, prototype) {
  return points.reduce((sum, point) => sum + squaredDistance(point, prototype), 0);
}

export function clamp(value) {
  if (!Number.isFinite(value)) throw new TypeError('coordinate must be finite');
  return Math.min(DOMAIN.max, Math.max(DOMAIN.min, value));
}

export function toScreen(point) {
  return { x: 50 + point.x * 52, y: 550 - point.y * 52 };
}

export function fromScreen(point) {
  return { x: clamp((point.x - 50) / 52), y: clamp((550 - point.y) / 52) };
}
