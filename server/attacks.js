'use strict';
/**
 * Jevil's attack list. This is the only character in the game right now, so
 * these are the only attacks anyone can pick. Coordinates are in "battle box"
 * space (BOX.w x BOX.h). The attacker's aim (radians) biases each pattern.
 *
 * Each attack: { id, name, desc, duration(ms-ish seconds), dmg, init(bs, aim), update(bs, dt) }
 * `bs` is a Battle: bs.bullets, bs.soul, bs.data, bs.time.
 */
const BOX = { w: 620, h: 200 };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function push(bs, b) {
  if (bs.bullets.length >= 90) return;
  bs.bullets.push(Object.assign({ x: BOX.w / 2, y: BOX.h / 2, r: 8, dmg: 5, k: 'ball', rot: 0, dead: false }, b));
}

/* 1. Devilsknife - a giant scythe that ricochets around the box. */
const devilsknife = {
  id: 'devilsknife',
  name: 'DEVILSKNIFE',
  desc: 'A giant scythe ricochets around the box.',
  duration: 6.8,
  init(bs, aim) {
    bs.data = { t: 0, spawned: 0, aim };
  },
  update(bs, dt) {
    const d = bs.data;
    d.t += dt;
    const marks = [0, 2.2, 4.4];
    while (d.spawned < marks.length && d.t >= marks[d.spawned]) {
      const i = d.spawned++;
      const fromLeft = i % 2 === 0;
      const base = fromLeft ? 0 : Math.PI;
      const angle = base + clamp(d.aim, -0.85, 0.85) * (fromLeft ? 1 : -1);
      push(bs, {
        x: fromLeft ? 34 : BOX.w - 34,
        y: clamp(bs.soul.y, 34, BOX.h - 34),
        vx: Math.cos(angle) * 255,
        vy: Math.sin(angle) * 255,
        r: 22,
        dmg: 9,
        k: 'knife',
        spin: 9
      });
    }
    for (const b of bs.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += (b.spin || 0) * dt;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x > BOX.w - b.r) { b.x = BOX.w - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
      if (b.y > BOX.h - b.r) { b.y = BOX.h - b.r; b.vy = -Math.abs(b.vy); }
    }
  }
};

/* 2. Chaos Saber - fast sabers slash across the box, aim tilts the sweep. */
const chaosSaber = {
  id: 'chaos_saber',
  name: 'CHAOS SABER',
  desc: 'Fast sabers slash across the box.',
  duration: 6.0,
  init(bs, aim) {
    bs.data = { t: 0, next: 0, aim };
  },
  update(bs, dt) {
    const d = bs.data;
    d.t += dt;
    while (d.t >= d.next && d.next < 5.2) {
      const i = Math.round(d.next / 0.7);
      d.next += 0.7;
      const tilt = Math.sin(d.aim) * 95;
      const fromLeft = i % 2 === 0;
      push(bs, {
        x: fromLeft ? 12 : BOX.w - 12,
        y: 26 + ((i * 53) % (BOX.h - 52)),
        vx: (fromLeft ? 1 : -1) * 470,
        vy: tilt,
        r: 8,
        dmg: 6,
        k: 'saber',
        spin: fromLeft ? -14 : 14
      });
    }
    for (const b of bs.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += (b.spin || 0) * dt;
      if (b.x < -40 || b.x > BOX.w + 40 || b.y < -40 || b.y > BOX.h + 40) b.dead = true;
    }
  }
};

/* 3. Carousel - an orbiting ring of blades that slowly closes in. */
const carousel = {
  id: 'carousel',
  name: 'CAROUSEL',
  desc: 'A ring of blades spins and closes in.',
  duration: 6.5,
  init(bs, aim) {
    const cx = clamp(BOX.w / 2 + Math.cos(aim) * 100, 130, BOX.w - 130);
    const cy = clamp(BOX.h / 2 + Math.sin(aim) * 45, 60, BOX.h - 60);
    bs.data = { t: 0, next: 0, cx, cy };
    for (let i = 0; i < 9; i++) {
      push(bs, { orbit: true, a: (i * Math.PI * 2) / 9, dmg: 5, r: 9, k: 'ball', x: cx, y: cy });
    }
  },
  update(bs, dt) {
    const d = bs.data;
    d.t += dt;
    if (d.t >= d.next && d.next < 4.0) {
      d.next += 1.5;
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        push(bs, { x: d.cx, y: d.cy, vx: Math.cos(a) * 145, vy: Math.sin(a) * 145, r: 7, dmg: 5, k: 'ball', life: 3 });
      }
    }
    const shrink = 12 * Math.min(1, d.t / 6);
    for (const b of bs.bullets) {
      if (b.orbit) {
        b.a += 1.7 * dt;
        const rad = 104 - shrink;
        b.x = d.cx + Math.cos(b.a) * rad;
        b.y = d.cy + Math.sin(b.a) * rad * 0.62;
      } else {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) b.dead = true;
      }
    }
  }
};

/* 4. Hypnosis - a hypnotic spiral of dark orbs. */
const hypnosis = {
  id: 'hypnosis',
  name: 'HYPNOSIS',
  desc: 'A hypnotic spiral of dark orbs.',
  duration: 6.0,
  init(bs, aim) {
    bs.data = { t: 0, next: 0, ang: clamp(aim, -Math.PI, Math.PI) };
  },
  update(bs, dt) {
    const d = bs.data;
    d.t += dt;
    while (d.t >= d.next && d.next < 5.2) {
      d.next += 0.12;
      const ang = d.ang;
      d.ang += 0.62;
      push(bs, { x: BOX.w / 2, y: BOX.h / 2, vx: Math.cos(ang) * 145, vy: Math.sin(ang) * 101, r: 6, dmg: 4, k: 'ball', life: 4.5 });
      push(bs, { x: BOX.w / 2, y: BOX.h / 2, vx: Math.cos(ang + Math.PI) * 145, vy: Math.sin(ang + Math.PI) * 101, r: 6, dmg: 4, k: 'ball', life: 4.5 });
    }
    for (const b of bs.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > BOX.w + 20 || b.y < -20 || b.y > BOX.h + 20) b.dead = true;
    }
  }
};

const attacks = {
  [devilsknife.id]: devilsknife,
  [chaosSaber.id]: chaosSaber,
  [carousel.id]: carousel,
  [hypnosis.id]: hypnosis
};

// Sent to clients so the ACT menu builds itself from the same source of truth.
const attackList = Object.values(attacks).map((a) => ({ id: a.id, name: a.name, desc: a.desc }));

module.exports = { BOX, attacks, attackList };
