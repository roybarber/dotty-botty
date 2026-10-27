/**
 * Dotty Botty engine: a procedural SVG character.
 *
 * Each frame is computed from numbers (shape radii, eye parameters, pose),
 * serialised to an SVG string, and diffed against the previous string so only
 * changed attribute values are written to the DOM. Framework-free; the React
 * wrapper in DottyBotty.tsx is a thin shell around createEngine().
 *
 * Colours come from CSS custom properties on any ancestor:
 *   --dotty-ink   body and extras (defaults to orange, #ff6b1a)
 *   --dotty-spot  eyes (defaults to #fff)
 */

/* ---------- maths ---------- */

const TAU = Math.PI * 2;
const N = 96;
const EYE_N = 36;
const C = 100;
const R = 54;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const approach = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const f2 = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return (r === 0 ? 0 : r).toString();
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const wrapDeg = (d: number) => (((d + 180) % 360) + 360) % 360 - 180;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ell = (a: number, x: number, y: number) => 1 / Math.hypot(Math.cos(a) / x, Math.sin(a) / y);
const rpoly = (a: number, n: number, round: number, rot: number) => {
  const s = TAU / n;
  const l = ((((a - rot) % s) + s) % s) - s / 2;
  return lerp(Math.cos(Math.PI / n) / Math.cos(l), 1, round);
};

/* ---------- outline helpers: far-side ray distance from the centre ---------- */

type Vec = [number, number];

/** Distance from the origin to the far side of a circle along angle a, or 0 if the ray misses. */
const circleAt = (a: number, cx: number, cy: number, r: number) => {
  const b = Math.cos(a) * cx + Math.sin(a) * cy;
  const disc = b * b - (cx * cx + cy * cy) + r * r;
  return disc < 0 ? 0 : Math.max(0, b + Math.sqrt(disc));
};

/** Distance from the origin to the furthest polygon edge along angle a, or 0 if the ray misses. */
const polygonAt = (a: number, pts: Vec[]) => {
  const dx = Math.cos(a), dy = Math.sin(a);
  let best = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (x1 * ey - y1 * ex) / den, u = (x1 * dy - y1 * dx) / den;
    if (t > best && u >= 0 && u <= 1) best = t;
  }
  return best;
};

const HEART: Vec[] = Array.from({ length: 120 }, (_, i) => {
  const t = (i / 120) * TAU;
  return [(16 * Math.sin(t) ** 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 - 0.15];
});
const GHOST: Vec[] = [
  ...Array.from({ length: 24 }, (_, i): Vec => [-0.9 * Math.cos((i / 23) * Math.PI), -0.9 * Math.sin((i / 23) * Math.PI)]),
  ...Array.from({ length: 37 }, (_, i): Vec => {
    const x = 0.9 - (i / 36) * 1.8;
    return [x, 0.75 + 0.12 * Math.cos((x / 0.9) * 3 * Math.PI)];
  }),
];
const BUNNY_EARS = [-1, 1].flatMap((s) => [0, 1, 2, 3].map((k): [number, number, number] => [s * (0.25 + 0.1 * k), -(0.72 + 0.24 * k), 0.21]));

/* ---------- body shapes: radius as a function of angle ---------- */

const SHAPES = {
  blob: (a: number) => 1 + 0.06 * Math.sin(3 * a + 0.6) + 0.035 * Math.sin(5 * a - 1.1),
  circle: () => 1,
  squircle: (a: number) => Math.pow(Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4, -0.25),
  egg: (a: number) => ell(a, 0.88, 1.04) * (1 + 0.08 * Math.sin(a)),
  bean: (a: number) => ell(a, 1.14, 0.86) * (1 - 0.14 * Math.exp(-(wrapA(a + Math.PI / 2) ** 2) / 0.16)),
  pebble: (a: number) => ell(a, 1.12, 0.84) * (1 + 0.05 * Math.sin(2 * a + 1)),
  hex: (a: number) => rpoly(a, 6, 0.3, 0),
  star: (a: number) => 1 - 0.12 * Math.cos(6 * a),
  diamond: (a: number) => rpoly(a, 4, 0.4, 0),
  triangle: (a: number) => rpoly(a, 3, 0.25, -Math.PI / 2),
  pentagon: (a: number) => rpoly(a, 5, 0.3, -Math.PI / 2),
  flower: (a: number) => 1 + 0.11 * Math.cos(5 * (a + Math.PI / 2)),
  clover: (a: number) => 1 + 0.13 * Math.cos(4 * a),
  gear: (a: number) => 1 + (0.07 * Math.tanh(5 * Math.cos(10 * a))) / Math.tanh(5),
  burst: (a: number) => 1 + 0.08 * Math.cos(12 * a),
  lemon: (a: number) => ell(a, 1.1, 0.86) * (1 + 0.14 * Math.abs(Math.cos(a)) ** 14),
  peanut: (a: number) => ell(a, 1.22, 0.88) * (1 - 0.17 * Math.abs(Math.sin(a)) ** 6),
  drop: (a: number) => ell(a, 0.9, 0.95) * (1 + 0.5 * Math.max(0, -Math.sin(a)) ** 12),
  heart: (a: number) => polygonAt(a, HEART),
  cloud: (a: number) =>
    Math.max(circleAt(a, 0, 0.1, 0.72), circleAt(a, -0.55, 0.25, 0.48), circleAt(a, 0.55, 0.25, 0.48), circleAt(a, -0.28, -0.3, 0.5), circleAt(a, 0.3, -0.36, 0.46)),
  bear: (a: number) => Math.max(circleAt(a, 0, 0.08, 0.9), circleAt(a, -0.66, -0.66, 0.3), circleAt(a, 0.66, -0.66, 0.3)),
  bunny: (a: number) => Math.max(circleAt(a, 0, 0.1, 0.85), ...BUNNY_EARS.map(([x, y, r]) => circleAt(a, x, y, r))),
  cat: (a: number) =>
    Math.max(circleAt(a, 0, 0.08, 0.9), polygonAt(a, [[-0.85, -0.2], [-0.75, -1.05], [-0.2, -0.72]]), polygonAt(a, [[0.85, -0.2], [0.75, -1.05], [0.2, -0.72]])),
  ghost: (a: number) => polygonAt(a, GHOST),
  house: (a: number) => polygonAt(a, [[-0.8, 0.9], [0.8, 0.9], [0.8, -0.15], [0, -0.95], [-0.8, -0.15]]),
  shield: (a: number) => polygonAt(a, [[-0.85, -0.8], [0, -0.95], [0.85, -0.8], [0.82, 0.15], [0, 1], [-0.82, 0.15]]),
  crown: (a: number) => polygonAt(a, [[-0.9, 0.8], [0.9, 0.8], [0.95, -0.75], [0.48, -0.3], [0, -0.95], [-0.48, -0.3], [-0.95, -0.75]]),
} satisfies Record<string, (a: number) => number>;

export type ShapeName = keyof typeof SHAPES;
export const SHAPE_NAMES = Object.keys(SHAPES) as ShapeName[];

/** Blur passes over the sampled radii, to soften corners and joins. */
const SMOOTH: Partial<Record<ShapeName, number>> = { gear: 1, cat: 1, ghost: 1, crown: 1, bunny: 2, house: 2, shield: 2 };

const ANG = Array.from({ length: N }, (_, i) => (i / N) * TAU - Math.PI / 2);
const SHAPE_R = Object.fromEntries(
  SHAPE_NAMES.map((k) => {
    let r = ANG.map(SHAPES[k]);
    for (let p = 0; p < (SMOOTH[k] ?? 0); p++) r = r.map((v, i) => (r[(i + N - 1) % N] + 2 * v + r[(i + 1) % N]) / 4);
    const mean = r.reduce((s, v) => s + v, 0) / N;
    return [k, r.map((v) => v / mean)];
  }),
) as Record<ShapeName, number[]>;

/* ---------- eyes: superellipse + lids + bend, all numeric so they interpolate ---------- */

interface Eye {
  w: number;
  h: number;
  n: number;
  lt: number;
  lb: number;
  tilt: number;
  bend: number;
  dy: number;
}
type EyeSpec = Partial<Eye> & { L?: Partial<Eye>; R?: Partial<Eye> };

const EYE_KEYS: (keyof Eye)[] = ['w', 'h', 'n', 'lt', 'lb', 'tilt', 'bend', 'dy'];
const EYE_BASE: Eye = { w: 0.1, h: 0.2, n: 2.4, lt: 0, lb: 0, tilt: 0, bend: 0, dy: 0 };

const EXPRESSIONS = {
  neutral: {},
  happy: { w: 0.13, h: 0.12, n: 2, lb: 0.5, bend: 0.07 },
  surprised: { w: 0.14, h: 0.24, n: 2 },
  sad: { w: 0.105, h: 0.17, lt: 0.28, tilt: 1.1, dy: 0.03 },
  angry: { w: 0.11, h: 0.18, lt: 0.3, tilt: -1.2 },
  sleepy: { w: 0.12, h: 0.14, lt: 0.62, lb: 0.18, dy: 0.04 },
  squinted: { w: 0.12, h: 0.16, lt: 0.3, lb: 0.3 },
  calm: { w: 0.12, h: 0.12, lt: 0.5, bend: -0.035, dy: 0.03 },
  thinking: { w: 0.1, h: 0.18, lb: 0.28 },
  inspecting: { L: { w: 0.12, h: 0.15, lt: 0.38, lb: 0.22 }, R: { w: 0.115, h: 0.22 } },
  confused: { L: { w: 0.085, h: 0.13, dy: 0.03 }, R: { w: 0.125, h: 0.22, dy: -0.03 } },
  asleep: { w: 0.12, h: 0.1, lt: 0.9, bend: -0.03, dy: 0.05 },
} satisfies Record<string, EyeSpec>;

export type ExpressionName = keyof typeof EXPRESSIONS;
export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS) as ExpressionName[];

const eyeFor = (name: ExpressionName, side: -1 | 1): Eye => {
  const { L, R: right, ...both }: EyeSpec = EXPRESSIONS[name];
  return { ...EYE_BASE, ...both, ...((side < 0 ? L : right) ?? {}) };
};

/* ---------- extras drawn around the body ---------- */

type Part =
  | { k: 'dot'; x: number; y: number; r: number; o: number }
  | { k: 'ring'; r: number; w: number; o: number }
  | { k: 'arc'; r: number; w: number; frac: number; rot: number }
  | { k: 'shadow'; rx: number; ry: number; o: number }
  | { k: 'spark'; x: number; y: number; s: number; rot: number; o: number }
  | { k: 'z'; x: number; y: number; s: number; o: number }
  | { k: 'bang'; x: number; y: number; s: number; o: number };

/* ---------- states: pure functions of time returning a pose ---------- */

interface Pose {
  expr: ExpressionName;
  ox: number;
  oy: number;
  rot: number;
  sx: number;
  sy: number;
  wob: number;
  ws: number;
  gaze: { x: number; y: number } | null;
  blinks: boolean;
  shape: ShapeName | null;
  parts: Part[];
}
type PoseNum = 'ox' | 'oy' | 'sx' | 'sy' | 'wob' | 'ws';

const POSE0: Pose = {
  expr: 'neutral', ox: 0, oy: 0, rot: 0, sx: 1, sy: 1, wob: 0, ws: 1,
  gaze: null, blinks: true, shape: null, parts: [],
};
const POSE_NUM: PoseNum[] = ['ox', 'oy', 'sx', 'sy', 'wob', 'ws'];

interface StateContext {
  mem: Record<string, number>;
  /** False when the state is only being sampled (cross-fade, still frame): no side effects. */
  live: boolean;
  kick(v: number): void;
  startBlink(): void;
}

const shadow = (h: number): Part => ({ k: 'shadow', rx: R * 0.75 * (1 - 0.4 * h), ry: 4.5, o: 0.18 * (1 - 0.5 * h) });

const STATES = {
  idle(t: number): Partial<Pose> {
    const b = Math.sin(t * 2);
    return { sy: 1 + 0.018 * b, sx: 1 - 0.012 * b };
  },
  thinking(t: number): Partial<Pose> {
    const parts = [0, 1, 2].map((i): Part => ({
      k: 'dot', x: C + R * 0.72 + i * 13, y: C - R * 1.02 - i * 11, r: 3 + i * 1.6,
      o: 0.2 + 0.8 * Math.max(0, Math.sin(t * 3.2 - i * 0.9)),
    }));
    return { expr: 'thinking', gaze: { x: 0.55, y: -0.7 }, wob: 0.025, ws: 1.6, rot: -4, sy: 1 + 0.012 * Math.sin(t * 1.6), parts };
  },
  working(t: number): Partial<Pose> {
    const dart = Math.floor(t * 1.8) % 2 ? 0.55 : -0.55;
    return {
      expr: 'squinted', gaze: { x: dart, y: 0.25 }, rot: 3.5 * Math.sin(t * 6), wob: 0.02, ws: 5,
      parts: [{ k: 'arc', r: R * 1.28, w: 5, frac: 0.22, rot: (t * 320) % 360 }],
    };
  },
  listening(t: number): Partial<Pose> {
    const parts = [0, 1].map((i): Part => {
      const p = (t * 0.6 + i * 0.5) % 1;
      return { k: 'ring', r: R * (1.08 + 0.5 * p), w: 3, o: 0.45 * (1 - p) };
    });
    return { rot: 6 + 2 * Math.sin(t * 1.4), gaze: { x: 0.1, y: -0.1 }, sy: 1 + 0.01 * Math.sin(t * 3), parts };
  },
  bouncing(t: number): Partial<Pose> {
    const ph = (t % 0.8) / 0.8;
    const h = 4 * ph * (1 - ph);
    const edge = Math.min(ph, 1 - ph);
    const impact = edge < 0.09 ? 1 - edge / 0.09 : 0;
    const sy = impact > 0 ? 1 - 0.2 * impact : 1 + 0.08 * Math.abs(1 - 2 * ph);
    return { expr: 'happy', oy: -40 * h, sy, sx: 1 / sy, parts: [shadow(h)] };
  },
  celebrating(t: number): Partial<Pose> {
    const ph = (t % 2.4) / 2.4;
    let oy = 0, sy = 1, rot = 0, h = 0;
    if (ph < 0.18) sy = 1 - 0.16 * Math.sin((ph / 0.18) * (Math.PI / 2));
    else if (ph < 0.78) {
      const q = (ph - 0.18) / 0.6;
      h = 4 * q * (1 - q);
      oy = -46 * h;
      sy = 1 + 0.06 * (1 - h);
      rot = 360 * easeInOut(q);
    } else sy = 1 - 0.14 * Math.sin(((ph - 0.78) / 0.22) * Math.PI);
    const sp = ph > 0.4 ? (ph - 0.4) / 0.6 : 0;
    const sparks = [0, 1, 2, 3, 4].map((i): Part => {
      const a = -Math.PI / 2 + (i - 2) * 0.6;
      const d = R * (1.15 + 0.5 * sp);
      const pulse = Math.sin(sp * Math.PI);
      return { k: 'spark', x: C + Math.cos(a) * d, y: C + Math.sin(a) * d, s: 3 + 5 * pulse, rot: sp * 180, o: sp > 0 ? pulse : 0 };
    });
    return { expr: 'happy', oy, sy, sx: 1 + (1 - sy) * 0.8, rot, parts: [shadow(h), ...sparks] };
  },
  sleeping(t: number): Partial<Pose> {
    const b = Math.sin(t * 1.3);
    const parts = [0, 1, 2].map((i): Part => {
      const p = (t * 0.22 + i / 3) % 1;
      return { k: 'z', x: C + R * 0.55 + p * 34 + Math.sin(p * 7) * 3, y: C - R * 0.75 - p * 48, s: 9 + p * 11, o: 0.85 * Math.sin(p * Math.PI) };
    });
    return { expr: 'asleep', sy: 1 + 0.035 * b, sx: 1 - 0.02 * b, rot: -5, blinks: false, gaze: { x: 0, y: 0.3 }, parts };
  },
  alert(t: number): Partial<Pose> {
    const ph = t % 2.2;
    const shake = ph < 0.5 ? Math.sin(ph * 55) * 7 * (1 - ph / 0.5) : 0;
    const pop = Math.min(1, ph / 0.12);
    return {
      expr: 'surprised', ox: shake, sy: 1 + 0.04 * Math.max(0, 1 - ph / 0.3),
      parts: [{ k: 'bang', x: C + shake * 0.5, y: C - R - 12, s: 28 * (0.6 + 0.4 * pop), o: pop }],
    };
  },
  shapeshift(t: number, ctx: StateContext): Partial<Pose> {
    const idx = Math.floor(t / 0.9) % SHAPE_NAMES.length;
    if (ctx.live && ctx.mem.idx !== idx) {
      if (ctx.mem.idx !== undefined) {
        ctx.kick(1.6);
        ctx.startBlink();
      }
      ctx.mem.idx = idx;
    }
    return { shape: SHAPE_NAMES[idx] };
  },
} satisfies Record<string, (t: number, ctx: StateContext) => Partial<Pose>>;

export type StateName = keyof typeof STATES;
export const STATE_NAMES = Object.keys(STATES) as StateName[];

/* ---------- serialisation ---------- */

const INK = 'fill:var(--dotty-ink,#ff6b1a)';
const INK_LINE = 'stroke:var(--dotty-ink,#ff6b1a)';
const SPOT = 'fill:var(--dotty-spot,#fff)';
const TEXT = `${INK};font-family:system-ui,sans-serif`;

function partSvg(p: Part, bx: number, by: number): string {
  const o = 'o' in p ? f2(clamp(p.o, 0, 1)) : '1';
  switch (p.k) {
    case 'dot':
      return `<circle style="${INK}" cx="${f2(p.x)}" cy="${f2(p.y)}" r="${f2(p.r)}" opacity="${o}"/>`;
    case 'ring':
      return `<circle style="${INK_LINE}" cx="${f2(bx)}" cy="${f2(by)}" r="${f2(p.r)}" fill="none" stroke-width="${f2(p.w)}" opacity="${o}"/>`;
    case 'arc': {
      const c = TAU * p.r;
      return `<circle style="${INK_LINE}" cx="${f2(bx)}" cy="${f2(by)}" r="${f2(p.r)}" fill="none" stroke-width="${f2(p.w)}" stroke-linecap="round" stroke-dasharray="${f2(c * p.frac)} ${f2(c)}" transform="rotate(${f2(p.rot)} ${f2(bx)} ${f2(by)})"/>`;
    }
    case 'shadow':
      return `<ellipse style="${INK}" cx="${f2(bx)}" cy="${C + R + 7}" rx="${f2(p.rx)}" ry="${f2(p.ry)}" opacity="${o}"/>`;
    case 'spark': {
      const s = f2(p.s), n = f2(-p.s);
      return `<path style="${INK}" d="M0 ${n}Q0 0 ${s} 0Q0 0 0 ${s}Q0 0 ${n} 0Q0 0 0 ${n}Z" transform="translate(${f2(p.x)} ${f2(p.y)}) rotate(${f2(p.rot)})" opacity="${o}"/>`;
    }
    case 'z':
      return `<text style="${TEXT}" x="${f2(p.x)}" y="${f2(p.y)}" font-size="${f2(p.s)}" font-weight="700" opacity="${o}">z</text>`;
    case 'bang':
      return `<text style="${TEXT}" x="${f2(p.x)}" y="${f2(p.y)}" font-size="${f2(p.s)}" font-weight="800" text-anchor="middle" opacity="${o}">!</text>`;
  }
}

interface FrameInput {
  pose: Pick<Pose, 'ox' | 'oy' | 'rot' | 'sx' | 'sy' | 'wob' | 'ws'>;
  radii: number[];
  eyes: [Eye, Eye];
  gaze: { x: number; y: number };
  blink: number;
  squash: number;
  time: number;
  parts: Part[];
}

function frameSvg(f: FrameInput): string {
  const P = f.pose;
  const sx = P.sx * (1 + 0.7 * f.squash);
  const sy = P.sy * (1 - f.squash);
  const cr = Math.cos((P.rot * Math.PI) / 180);
  const sr = Math.sin((P.rot * Math.PI) / 180);
  // Local body coordinates (centre origin) to viewBox: squash anchored at the feet, then rotate.
  const T = (x: number, y: number): [number, number] => {
    const X = x * sx, Y = y * sy - (sy - 1) * R;
    return [C + P.ox + X * cr - Y * sr, C + P.oy + X * sr + Y * cr];
  };

  let body = '';
  for (let i = 0; i < N; i++) {
    const a = ANG[i];
    const w = 1 + P.wob * (0.6 * Math.sin(3 * a + f.time * P.ws) + 0.4 * Math.sin(5 * a - f.time * P.ws * 1.3));
    const rr = f.radii[i] * w * R;
    const [x, y] = T(Math.cos(a) * rr, Math.sin(a) * rr);
    body += (i ? 'L' : 'M') + f2(x) + ' ' + f2(y);
  }
  body += 'Z';

  let eyes = '';
  const minT = 0.025 * R;
  for (const side of [-1, 1] as const) {
    const e = f.eyes[side < 0 ? 0 : 1];
    const ecx = side * 0.27 * R + f.gaze.x * 0.13 * R;
    const ecy = -0.04 * R + f.gaze.y * 0.11 * R + e.dy * R;
    const w = e.w * R * (1 - 0.16 * Math.abs(f.gaze.x));
    const h = e.h * R;
    const lt = e.lt + (1 - e.lt) * f.blink * 0.5;
    const lb = e.lb + (1 - e.lb) * f.blink * 0.5;
    for (let i = 0; i < EYE_N; i++) {
      const a = (i / EYE_N) * TAU, c = Math.cos(a), s = Math.sin(a);
      const x = w * Math.sign(c) * Math.abs(c) ** (2 / e.n);
      const y0 = h * Math.sign(s) * Math.abs(s) ** (2 / e.n);
      // Lids clip the eye from above and below; tilt is mirrored so it reads as a brow.
      let top = -h + 2 * h * lt + e.tilt * x * side;
      let bot = h - 2 * h * lb;
      if (top > bot - minT) {
        const m = (top + bot) / 2;
        top = m - minT / 2;
        bot = m + minT / 2;
      }
      const y = clamp(y0, top, bot) - e.bend * R * (1 - (x / w) ** 2);
      const [X, Y] = T(ecx + x, ecy + y);
      eyes += (i ? 'L' : 'M') + f2(X) + ' ' + f2(Y);
    }
    eyes += 'Z';
  }

  const bx = C + P.ox;
  const by = C + P.oy - (sy - 1) * R;
  const extras = f.parts.map((p) => partSvg(p, bx, by)).join('');
  return `<svg viewBox="0 0 200 200" width="100%" height="100%" overflow="visible" aria-hidden="true"><path style="${INK}" d="${body}"/><path style="${SPOT}" d="${eyes}"/>${extras}</svg>`;
}

/* ---------- DOM patching: write only the attribute values that changed ---------- */

interface PatchCache {
  root: ChildNode | null;
  slots: Attr[];
  parts: string[];
}
const patchCache = new WeakMap<Element, PatchCache>();

export const renderStats = { patched: 0, rebuilt: 0, attributesWritten: 0 };

function patchInto(host: Element, html: string) {
  const parts = html.split('"');
  const c = patchCache.get(host);
  if (c && host.firstChild === c.root && c.parts.length === parts.length) {
    const changed: number[] = [];
    let sameStructure = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === c.parts[i]) continue;
      // Even chunks are markup outside quotes: a change there means the elements differ.
      if (i % 2 === 0) {
        sameStructure = false;
        break;
      }
      changed.push(i);
    }
    if (sameStructure) {
      for (const i of changed) c.slots[(i - 1) / 2].value = parts[i];
      c.parts = parts;
      renderStats.patched++;
      renderStats.attributesWritten += changed.length;
      return;
    }
  }
  host.innerHTML = html;
  renderStats.rebuilt++;
  const slots = [...host.querySelectorAll('*')].flatMap((el) => [...el.attributes]);
  const aligned =
    parts.length === 2 * slots.length + 1 &&
    slots.every((a, i) => parts[2 * i].endsWith(` ${a.name}=`) && a.value === parts[2 * i + 1]);
  if (aligned) patchCache.set(host, { root: host.firstChild, slots, parts });
  else patchCache.delete(host);
}

/* ---------- shared animation loop ---------- */

const active = new Set<Engine>();
let rafId = 0;

function loop(now: number) {
  rafId = requestAnimationFrame(loop);
  if (document.hidden) return;
  for (const m of active) m.tick(now);
}

function onPointerMove(e: PointerEvent) {
  for (const m of active) m.pointerAt(e.clientX, e.clientY);
}
function onPointerLeave() {
  for (const m of active) m.pointerAt(null, null);
}

function register(m: Engine) {
  active.add(m);
  if (active.size === 1) {
    rafId = requestAnimationFrame(loop);
    addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onPointerLeave);
  }
}
function unregister(m: Engine) {
  active.delete(m);
  if (active.size === 0) {
    cancelAnimationFrame(rafId);
    removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('mouseleave', onPointerLeave);
  }
}

/* ---------- public API ---------- */

export interface EngineOptions {
  shape?: ShapeName;
  state?: StateName;
  /** Fixed expression; null lets the state choose. */
  expression?: ExpressionName | null;
  followPointer?: boolean;
  maxFrameRate?: number;
  /** Overrides the system prefers-reduced-motion setting when set. */
  reducedMotion?: boolean;
}

export interface EngineHandle {
  update(options: EngineOptions): void;
  poke(): void;
  blink(): void;
  destroy(): void;
}

type Resolved = Required<Omit<EngineOptions, 'reducedMotion'>> & { reducedMotion?: boolean };

const DEFAULTS: Resolved = { shape: 'ghost', state: 'idle', expression: null, followPointer: true, maxFrameRate: 60 };

class Engine implements EngineHandle {
  private opts: Resolved;
  private radii: number[];
  private eyes: [Eye, Eye];
  private pose: FrameInput['pose'] = { ox: 0, oy: 0, rot: 0, sx: 1, sy: 1, wob: 0, ws: 1 };
  private parts: Part[] = [];
  private gaze = { x: 0, y: 0 };
  private pointer: { x: number; y: number } | null = null;
  private glance: { x: number; y: number } | null = null;
  private t = 0;
  private stateTime = 0;
  private mem: Record<string, number> = {};
  private prev: { state: StateName; time: number; mem: Record<string, number> } | null = null;
  private blend = 1;
  private blinkAmount = 0;
  private blinkTime = -1;
  private nextBlink = rand(0.8, 3);
  private nextGlance = rand(1, 3);
  private squash = { v: 0, vel: 0 };
  private tempExpr: ExpressionName | null = null;
  private tempUntil = 0;
  private visible = true;
  private last = performance.now();
  private lastHtml = '';
  private io: IntersectionObserver | null;
  private motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private host: HTMLElement, options: EngineOptions) {
    this.opts = { ...DEFAULTS, ...options };
    this.radii = SHAPE_R[this.opts.shape].slice();
    this.eyes = [eyeFor('neutral', -1), eyeFor('neutral', 1)];
    this.io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((es) => {
            this.visible = es.at(-1)?.isIntersecting ?? true;
            this.last = performance.now();
          });
    this.io?.observe(host);
    this.motionQuery.addEventListener('change', this.onMotionChange);
    register(this);
    if (this.reduced) this.still();
    else this.draw();
  }

  private get reduced() {
    return this.opts.reducedMotion ?? this.motionQuery.matches;
  }
  private onMotionChange = () => this.refresh();

  update(options: EngineOptions) {
    const next = { ...this.opts, ...options };
    if (next.state !== this.opts.state) {
      this.prev = { state: this.opts.state, time: this.stateTime, mem: this.mem };
      this.blend = 0;
      this.stateTime = 0;
      this.mem = {};
    }
    if (!next.followPointer) this.pointer = null;
    this.opts = next;
    this.refresh();
  }

  poke() {
    if (this.reduced) return;
    this.kick(3);
    this.startBlink();
    this.tempExpr = 'surprised';
    this.tempUntil = this.t + 0.9;
  }

  blink() {
    if (!this.reduced) this.startBlink();
  }

  destroy() {
    unregister(this);
    this.io?.disconnect();
    this.motionQuery.removeEventListener('change', this.onMotionChange);
  }

  /** Called by the shared loop. */
  tick(now: number) {
    if (!this.visible || this.reduced) {
      this.last = now;
      return;
    }
    if (now - this.last < 1000 / this.opts.maxFrameRate - 1) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.step(dt);
    this.draw();
  }

  pointerAt(x: number | null, y: number | null) {
    if (!this.opts.followPointer || x === null || y === null) {
      this.pointer = null;
      return;
    }
    const r = this.host.getBoundingClientRect();
    const span = Math.max(160, r.width * 1.5);
    this.pointer = {
      x: clamp((x - r.left - r.width / 2) / span, -1, 1),
      y: clamp((y - r.top - r.height / 2) / span, -1, 1),
    };
  }

  private refresh() {
    if (this.reduced) this.still();
  }

  private kick(v: number) {
    this.squash.vel += v;
  }

  private startBlink() {
    if (this.blinkTime < 0) this.blinkTime = 0;
  }

  private sample(state: StateName, t: number, mem: Record<string, number>, live: boolean): Pose {
    const ctx: StateContext = { mem, live, kick: (v) => this.kick(v), startBlink: () => this.startBlink() };
    return { ...POSE0, ...STATES[state](t, ctx) };
  }

  private step(dt: number) {
    this.t += dt;
    this.stateTime += dt;
    const pose = this.sample(this.opts.state, this.stateTime, this.mem, true);

    // Cross-fade the numeric pose from the previous state so switching never jumps.
    if (this.prev && this.blend < 1) {
      this.prev.time += dt;
      this.blend = Math.min(1, this.blend + dt / 0.35);
      const old = this.sample(this.prev.state, this.prev.time, this.prev.mem, false);
      const k = easeInOut(this.blend);
      for (const key of POSE_NUM) pose[key] = lerp(old[key], pose[key], k);
      pose.rot = old.rot + wrapDeg(pose.rot - old.rot) * k;
    }
    for (const key of POSE_NUM) this.pose[key] = pose[key];
    this.pose.rot = pose.rot;
    this.parts = pose.parts;

    const exprName =
      this.tempExpr && this.t < this.tempUntil ? this.tempExpr : (this.opts.expression ?? pose.expr);
    if (this.t >= this.tempUntil) this.tempExpr = null;
    const ke = approach(18, dt);
    this.eyes.forEach((e, i) => {
      const target = eyeFor(exprName, i ? 1 : -1);
      for (const k of EYE_KEYS) e[k] += (target[k] - e[k]) * ke;
    });

    const shapeR = SHAPE_R[pose.shape ?? this.opts.shape];
    const kr = approach(9, dt);
    for (let i = 0; i < N; i++) this.radii[i] += (shapeR[i] - this.radii[i]) * kr;

    let target: { x: number; y: number };
    if (this.opts.followPointer && this.pointer) target = this.pointer;
    else if (pose.gaze) target = pose.gaze;
    else {
      if (this.t > this.nextGlance) {
        if (this.glance) {
          this.glance = null;
          this.nextGlance = this.t + rand(1.5, 3.5);
        } else {
          this.glance = { x: rand(-0.8, 0.8), y: rand(-0.5, 0.4) };
          this.nextGlance = this.t + rand(0.5, 1.1);
        }
      }
      target = this.glance ?? { x: 0, y: 0 };
    }
    const kg = approach(16, dt);
    this.gaze.x += (target.x - this.gaze.x) * kg;
    this.gaze.y += (target.y - this.gaze.y) * kg;

    if (pose.blinks && this.t > this.nextBlink) {
      this.startBlink();
      this.nextBlink = this.t + (Math.random() < 0.18 ? 0.3 : rand(2.2, 5));
    }
    if (this.blinkTime >= 0) {
      const b = (this.blinkTime += dt);
      this.blinkAmount = b < 0.07 ? b / 0.07 : b < 0.11 ? 1 : b < 0.21 ? 1 - (b - 0.11) / 0.1 : 0;
      if (b >= 0.21) {
        this.blinkTime = -1;
        this.blinkAmount = 0;
      }
    }

    // Damped spring for poke squash, sub-stepped for stability at low frame rates.
    const s = this.squash;
    const steps = Math.ceil(dt * 240);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      s.vel += (-260 * s.v - 13 * s.vel) * h;
      s.v += s.vel * h;
    }
  }

  /** Reduced motion: one settled frame per change, no loop. */
  private still() {
    const pose = this.sample(this.opts.state, 0.5, {}, false);
    const name = this.opts.expression ?? pose.expr;
    this.pose = { ox: 0, oy: 0, rot: 0, sx: 1, sy: 1, wob: 0, ws: 1 };
    this.eyes = [eyeFor(name, -1), eyeFor(name, 1)];
    this.radii = SHAPE_R[this.opts.shape].slice();
    this.gaze = { ...(pose.gaze ?? { x: 0, y: 0 }) };
    this.blinkAmount = 0;
    this.squash = { v: 0, vel: 0 };
    this.parts = [];
    this.draw();
  }

  private draw() {
    const html = frameSvg({
      pose: this.pose, radii: this.radii, eyes: this.eyes, gaze: this.gaze,
      blink: this.blinkAmount, squash: this.squash.v, time: this.t, parts: this.parts,
    });
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    patchInto(this.host, html);
  }
}

export function createEngine(host: HTMLElement, options: EngineOptions = {}): EngineHandle {
  return new Engine(host, options);
}

/** A settled frame as an SVG string, for server rendering or a no-JS poster. Needs no DOM. */
export function renderStillSvg(options: Pick<EngineOptions, 'shape' | 'state' | 'expression'> = {}): string {
  const { shape, state, expression } = { ...DEFAULTS, ...options };
  const pose: Pose = { ...POSE0, ...STATES[state](0.5, { mem: {}, live: false, kick() {}, startBlink() {} }) };
  const name = expression ?? pose.expr;
  return frameSvg({
    pose: { ox: 0, oy: 0, rot: 0, sx: 1, sy: 1, wob: 0, ws: 1 },
    radii: SHAPE_R[shape], eyes: [eyeFor(name, -1), eyeFor(name, 1)],
    gaze: pose.gaze ?? { x: 0, y: 0 }, blink: 0, squash: 0, time: 0, parts: [],
  });
}
