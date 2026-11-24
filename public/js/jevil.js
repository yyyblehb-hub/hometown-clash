/**
 * MAIN CHARACTER — pink jester critter (from the reference pics).
 *
 * Original pixel art drawn in code. Nothing is ripped: every frame is generated
 * from a tiny 40x40 pixel grid, so the whole character is a few hundred bytes
 * and the palette can be changed in one place.
 *
 * Palette per request: green hat (was orange), pink skin, orange-red boots.
 *
 * Frame set (12 frames, 3 states):
 *   idle  x4  gentle bob + one blink
 *   walk  x4  pose A, pose B, mirror(A), mirror(B)  <- one pose reused per side
 *   jump  x4  crouch, launch, apex, land
 *
 * Usage:
 *   const jev = new JevilSprite('idle');   // jev.canvas -> <canvas>
 *   jev.play('walk');  jev.jump();  jev.face(-1);
 */

const W = 40;
const H = 40;

export const PALETTE = {
  outline: '#2b0f26',

  skin: '#d271b6',
  skinLit: '#efa5d6',
  skinShade: '#a74e8f',
  blush: '#f9c2e4',

  eye: '#150a18',
  shine: '#ffffff',

  hat: '#3fa855',
  hatLit: '#83e28d',
  hatShade: '#205f33',

  pom: '#fffdf6',
  pomShade: '#d5cee2',

  boot: '#e8663a',
  bootShade: '#a63c1e',

  shadow: '#2b1a36'
};

/* ------------------------------ pixel helpers ------------------------------ */
const blank = () => new Array(W * H).fill(null);

function put(g, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  g[y * W + x] = c;
}

function disc(g, cx, cy, rx, ry, c, onlyEmpty = false) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (onlyEmpty && g[y * W + x]) continue;
      put(g, x, y, c);
    }
  }
}

function box(g, x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, c);
}

/** 1px outline around everything already painted. */
function outlined(g, color) {
  const out = g.slice();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y * W + x]) continue;
      const near =
        (x > 0 && g[y * W + x - 1]) ||
        (x < W - 1 && g[y * W + x + 1]) ||
        (y > 0 && g[(y - 1) * W + x]) ||
        (y < H - 1 && g[(y + 1) * W + x]);
      if (near) out[y * W + x] = color;
    }
  }
  return out;
}

function mirrored(g) {
  const out = blank();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) out[y * W + (W - 1 - x)] = g[y * W + x];
  }
  return out;
}

function blit(ctx, g) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = g[y * W + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/* ------------------------------ one frame ------------------------------ */
/**
 * pose:
 *   lift      body vertical offset in px (negative = crouch)
 *   squash    body flatten factor (0 = round)
 *   tilt      hat lean in px (positive = leans right)
 *   eye       'open' | 'wide' | 'blink'
 *   shoeL / shoeR  [x, y] boot positions
 *   hatLift   extra hat offset (for jump)
 *   pomLift   extra bobble offset
 */
function buildLayers(pose) {
  const {
    lift = 0,
    squash = 0,
    tilt = 0,
    eye = 'open',
    shoeL = [13, 35],
    shoeR = [27, 35],
    hatLift = 0,
    pomLift = 0,
    shadow = 1
  } = pose;

  const cx = 20;
  const cy = 24 + lift;
  const rx = 11 + squash * 0.5;
  const ry = 10 - squash;

  /* ground shadow - shrinks while airborne, sells the jump */
  const shade = blank();
  if (shadow > 0) disc(shade, cx, 38, 10.5 * shadow, 1.7, PALETTE.shadow);

  /* boots (drawn first, so the body overlaps their tops) */
  const boots = blank();
  disc(boots, shoeL[0], shoeL[1], 4.8, 2.8, PALETTE.boot);
  disc(boots, shoeR[0], shoeR[1], 4.8, 2.8, PALETTE.boot);
  disc(boots, shoeL[0], shoeL[1] + 1.4, 4.8, 1.4, PALETTE.bootShade);
  disc(boots, shoeR[0], shoeR[1] + 1.4, 4.8, 1.4, PALETTE.bootShade);
  const bootLayer = outlined(boots, PALETTE.outline);

  /* round body / face */
  const body = blank();
  disc(body, cx, cy, rx, ry, PALETTE.skin);
  disc(body, cx, cy + 3, rx - 0.6, ry - 1.4, PALETTE.skinShade); // belly shade
  disc(body, cx - 3, cy - 4, rx * 0.6, ry * 0.55, PALETTE.skinLit); // top light
  disc(body, cx, cy + 4.4, 4.6, 2.8, PALETTE.skinLit); // muzzle

  /* eyes */
  const eyeY = cy - 0.6;
  if (eye === 'blink') {
    box(body, cx - 7, eyeY + 1, 4, 1, PALETTE.eye);
    box(body, cx + 3, eyeY + 1, 4, 1, PALETTE.eye);
  } else {
    const erx = 2.7;
    const ery = eye === 'wide' ? 4.4 : 3.6;
    disc(body, cx - 4.8, eyeY, erx, ery, PALETTE.eye);
    disc(body, cx + 4.8, eyeY, erx, ery, PALETTE.eye);
    // 2x2 square highlight, like the reference sprites
    put(body, cx - 6, eyeY - 2, PALETTE.shine);
    put(body, cx - 5, eyeY - 2, PALETTE.shine);
    put(body, cx - 6, eyeY - 1, PALETTE.shine);
    put(body, cx - 5, eyeY - 1, PALETTE.shine);
    put(body, cx + 3, eyeY - 2, PALETTE.shine);
    put(body, cx + 4, eyeY - 2, PALETTE.shine);
    put(body, cx + 3, eyeY - 1, PALETTE.shine);
    put(body, cx + 4, eyeY - 1, PALETTE.shine);
  }

  /* tiny mouth */
  put(body, cx - 1, cy + 6, PALETTE.eye);
  put(body, cx, cy + 6, PALETTE.eye);

  const bodyLayer = outlined(body, PALETTE.outline);

  /* hat: wide brim + dome, drooping to one side */
  const hat = blank();
  const hy = 12.5 + lift + hatLift;
  const hx = cx + tilt;
  disc(hat, hx, hy + 2.6, 12.4, 4.4, PALETTE.hat); // brim
  disc(hat, hx + tilt * 0.5, hy - 2.2, 9, 4.8, PALETTE.hat); // dome
  disc(hat, hx - 2.4, hy - 3.8, 4.6, 2.4, PALETTE.hatLit); // highlight
  disc(hat, hx, hy + 4.4, 12, 1.6, PALETTE.hatShade); // rolled rim shade
  // floppy tip that carries the bobble
  disc(hat, hx - 9.5, hy + 2.6, 4.4, 3.2, PALETTE.hat);
  disc(hat, hx - 12, hy + 3.8, 3.2, 2.6, PALETTE.hat);
  const hatLayer = outlined(hat, PALETTE.outline);

  /* white bobble */
  const pom = blank();
  const px = hx - 12;
  const py = hy + 4.2 + pomLift;
  disc(pom, px, py, 3.4, 3.4, PALETTE.pom);
  disc(pom, px + 0.8, py + 2, 2.6, 1.2, PALETTE.pomShade);
  put(pom, px - 1, py - 2, PALETTE.shine);
  put(pom, px - 2, py - 2, PALETTE.shine);
  const pomLayer = outlined(pom, PALETTE.outline);

  return [shade, bootLayer, bodyLayer, hatLayer, pomLayer];
}

/** Turn a stack of outlined grids into a ready-to-draw frame. */
function renderGrids(layers) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (const g of layers) blit(ctx, g);
  return canvas;
}

function buildFrame(pose) {
  return renderGrids(buildLayers(pose));
}

/* ------------------------------ frame table ------------------------------ */
function framesFrom(poses) {
  return poses.map(buildFrame);
}

const IDLE_POSES = [
  { lift: 0, tilt: 0, shoeL: [12, 36], shoeR: [28, 36] },
  { lift: 1, tilt: 0.8, shoeL: [12, 35], shoeR: [28, 35] },
  { lift: 0, tilt: -0.8, eye: 'blink', shoeL: [12, 36], shoeR: [28, 36] },
  { lift: 1, tilt: 0.4, shoeL: [12, 35], shoeR: [28, 35] }
];

// Two walk poses; frames 3 and 4 are their mirrors (left / right step reused).
const WALK_A = { lift: 0, tilt: 1.6, shoeL: [10, 37], shoeR: [29, 35] };
const WALK_B = { lift: 2, tilt: -1.2, shoeL: [14, 35], shoeR: [25, 35] };

const JUMP_POSES = [
  { lift: -2, squash: 1.2, eye: 'wide', shoeL: [13, 35], shoeR: [27, 35], hatLift: -0.6, shadow: 1.15 },
  { lift: 2, squash: -0.5, eye: 'wide', shoeL: [14, 35], shoeR: [26, 35], hatLift: 1, pomLift: 1, shadow: 0.8 },
  { lift: 4, squash: 0, eye: 'wide', shoeL: [15, 33], shoeR: [25, 33], hatLift: 2, pomLift: -1, shadow: 0.45 },
  { lift: -1, squash: 0.8, eye: 'blink', shoeL: [13, 35], shoeR: [27, 35], hatLift: -0.5, shadow: 1.15 }
];

/** Pre-rendered frames: idle[4], walk[4], jump[4]. */
// walk: the same two poses, reused mirrored for the other side
const WALK_GRIDS_A = buildLayers(WALK_A);
const WALK_GRIDS_B = buildLayers(WALK_B);

export const FRAMES = {
  idle: framesFrom(IDLE_POSES),
  walk: [
    renderGrids(WALK_GRIDS_A),
    renderGrids(WALK_GRIDS_B),
    renderGrids(WALK_GRIDS_A.map(mirrored)),
    renderGrids(WALK_GRIDS_B.map(mirrored))
  ],
  jump: framesFrom(JUMP_POSES)
};

export const FPS = { idle: 5, walk: 10, jump: 12 };

export const FRAME_META = {
  idle: ['idle_0 bob low', 'idle_1 bob high', 'idle_2 blink', 'idle_3 bob high'],
  walk: ['walk_0 step A', 'walk_1 step B', 'walk_2 step A mirrored (right)', 'walk_3 step B mirrored (right)'],
  jump: ['jump_0 crouch', 'jump_1 launch', 'jump_2 apex', 'jump_3 land']
};

/* ------------------------------ animator ------------------------------ */
export class JevilSprite {
  constructor(state = 'idle') {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.className = 'jevil';
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.flip = 1;
    this.state = state;
    this.index = 0;
    this.acc = 0;
    this.last = 0;
    this.once = false;
    this.skipBlink = Math.random() < 0.65;
    this.raf = 0;

    this.loop = this.loop.bind(this);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  }

  play(state, { once = false } = {}) {
    if (!FRAMES[state]) return;
    if (this.state === state && !once) return;
    this.state = state;
    this.index = 0;
    this.acc = 0;
    this.once = once;
    this.skipBlink = Math.random() < 0.65;
    this.draw();
  }

  jump() {
    this.play('jump', { once: true });
  }

  face(dir) {
    this.flip = dir < 0 ? -1 : 1;
    this.draw();
  }

  loop(now) {
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    const set = FRAMES[this.state];
    const step = 1 / (FPS[this.state] || 6);
    this.acc += dt;
    if (this.acc >= step) {
      this.acc -= step;
      if (this.index < set.length - 1) this.index += 1;
      else if (this.once) this.play('idle');
      else {
        this.index = 0;
        this.skipBlink = Math.random() < 0.65;
      }
      // blink is idle frame 2, but a blink every 0.8s looks sleepy: skip it most loops
      if (this.state === 'idle' && this.index === 2 && this.skipBlink) this.index = 3;
      this.draw();
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  draw() {
    const set = FRAMES[this.state] || FRAMES.idle;
    const frame = set[this.index] || set[0];
    this.ctx.clearRect(0, 0, W, H);
    this.ctx.save();
    if (this.flip < 0) {
      this.ctx.translate(W, 0);
      this.ctx.scale(-1, 1);
    }
    this.ctx.drawImage(frame, 0, 0);
    this.ctx.restore();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }
}

/** Convenience: returns the <canvas> with its animator attached as .sprite */
export function createJevil(state = 'idle') {
  const sprite = new JevilSprite(state);
  sprite.canvas.sprite = sprite;
  return sprite.canvas;
}
