'use strict';
/**
 * Hometown Clash - server state.
 *
 * No lobby world, no walking: players just sit in a list. Pick a name to fight,
 * the server creates the battle and runs it authoritatively (HP, bullets, hits
 * are all decided here, never by the browser).
 */
const { BOX, attacks, attackList } = require('./attacks');

const MAX_HP = 100;
const SOUL_R = 8;
const TICK_MS = 33; // 30 Hz simulation

let idSeq = 0;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

class Battle {
  constructor(a, b) {
    this.id = 'b' + ++idSeq;
    this.players = [a, b];
    this.max = MAX_HP;
    this.hp = { [a.id]: MAX_HP, [b.id]: MAX_HP };
    this.items = { [a.id]: 2, [b.id]: 2 };
    this.turnIdx = Math.random() < 0.5 ? 0 : 1;
    this.phase = 'intro'; // intro | menu | dodge | result | over
    this.timer = 1.4;
    this.idle = 0;
    this.attack = null;
    this.attackName = null;
    this.bullets = [];
    this.data = {};
    this.soul = { x: BOX.w / 2, y: BOX.h / 2 };
    this.time = 0;
    this.result = null;
    this.finished = false;
    this.log = [`* ${a.name} and ${b.name} lock eyes.`];
    this.iframes = { [a.id]: 0, [b.id]: 0 };
    a.battle = this;
    b.battle = this;
  }

  get attacker() {
    return this.players[this.turnIdx];
  }

  get defender() {
    return this.players[1 - this.turnIdx];
  }

  setSoul(player, x, y) {
    if (this.phase !== 'dodge' || player !== this.defender) return;
    this.soul.x = clamp(Number(x) || 0, SOUL_R, BOX.w - SOUL_R);
    this.soul.y = clamp(Number(y) || 0, SOUL_R, BOX.h - SOUL_R);
  }

  /** Attacker input. Returns true when accepted. */
  action(player, a) {
    if (this.finished) return false;
    if (this.phase !== 'menu' || player !== this.attacker) return false;

    if (a.type === 'fight') {
      const acc = clamp(Number(a.accuracy) || 0, 0, 1);
      const dmg = Math.round(8 + acc * 30);
      this.log = [`* ${player.name} strikes!`, `* ${dmg} damage.`];
      this.damage(this.defender, dmg);
      if (this.phase !== 'over') {
        this.phase = 'result';
        this.timer = 1.5;
      }
      return true;
    }

    if (a.type === 'attack') {
      const atk = attacks[a.id];
      if (!atk) return false;
      this.startDodge(atk, Number(a.aim) || 0);
      return true;
    }

    if (a.type === 'item') {
      if (this.items[player.id] <= 0) return false;
      this.items[player.id] -= 1;
      this.hp[player.id] = Math.min(this.max, this.hp[player.id] + 22);
      this.log = ['* You ate a Dark Candy.', '* +22 HP.'];
      this.phase = 'result';
      this.timer = 1.3;
      return true;
    }

    if (a.type === 'mercy') {
      this.result = { fled: true };
      this.phase = 'over';
      this.timer = 2.4;
      this.log = ['* You spared each other.'];
      return true;
    }

    return false;
  }

  startDodge(atk, aim) {
    this.phase = 'dodge';
    this.attack = atk;
    this.attackName = atk.name;
    this.time = 0;
    this.bullets = [];
    this.data = {};
    this.soul = { x: BOX.w / 2, y: BOX.h / 2 };
    this.iframes[this.defender.id] = 0.35;
    this.log = [`* ${this.attacker.name} points ${atk.name}!`];
    atk.init(this, clamp(aim, -Math.PI, Math.PI));
    atk.update(this, 0); // place the first bullets before the first snapshot
  }

  damage(player, amount) {
    this.hp[player.id] = Math.max(0, this.hp[player.id] - amount);
    this.iframes[player.id] = 0.45;
    if (this.hp[player.id] <= 0) {
      const winner = this.players[0] === player ? this.players[1] : this.players[0];
      this.result = { winner: winner.name, loser: player.name, youWon: null };
      this.phase = 'over';
      this.timer = 2.8;
      this.log = [`* ${player.name} was defeated.`, `* ${winner.name} wins!`];
    }
  }

  collide() {
    const d = this.defender;
    if (this.iframes[d.id] > 0) return;
    const s = this.soul;
    for (const b of this.bullets) {
      if (b.dead) continue;
      const dx = b.x - s.x;
      const dy = b.y - s.y;
      if (dx * dx + dy * dy < (b.r + SOUL_R) * (b.r + SOUL_R)) {
        b.dead = true;
        this.damage(d, b.dmg);
        break;
      }
    }
  }

  finishDodge() {
    const name = this.attackName;
    this.attack = null;
    this.attackName = null;
    this.bullets = [];
    this.phase = 'result';
    this.timer = 1.1;
    this.time = 0;
    this.log = [`* ${this.defender.name} survived ${name}.`];
  }

  nextTurn() {
    this.turnIdx = 1 - this.turnIdx;
    this.phase = 'menu';
    this.bullets = [];
    this.attack = null;
    this.attackName = null;
    this.soul = { x: BOX.w / 2, y: BOX.h / 2 };
    this.time = 0;
    this.idle = 0;
    this.log = [`* ${this.attacker.name}'s turn.`];
  }

  abandon(player) {
    if (this.finished) return;
    this.result = { fled: true, left: player.name };
    this.phase = 'over';
    this.timer = 1.8;
    this.log = [`* ${player.name} fled the battle.`];
  }

  tick(dt) {
    this.iframes[this.players[0].id] = Math.max(0, this.iframes[this.players[0].id] - dt);
    this.iframes[this.players[1].id] = Math.max(0, this.iframes[this.players[1].id] - dt);

    switch (this.phase) {
      case 'intro':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = 'menu';
          this.idle = 0;
          this.log = [`* ${this.attacker.name}'s turn.`];
        }
        break;
      case 'menu':
        this.idle += dt;
        if (this.idle > 30) {
          this.log = [`* ${this.attacker.name} hesitates...`];
          this.nextTurn();
        }
        break;
      case 'result':
        this.timer -= dt;
        if (this.timer <= 0) this.nextTurn();
        break;
      case 'dodge':
        this.time += dt;
        this.attack.update(this, dt);
        this.collide();
        this.bullets = this.bullets.filter((b) => !b.dead);
        if (this.phase === 'dodge' && this.time >= this.attack.duration) this.finishDodge();
        break;
      case 'over':
        this.timer -= dt;
        if (this.timer <= 0) this.finished = true;
        break;
    }
  }

  stateFor(player) {
    const me = player;
    const foe = this.players[0] === player ? this.players[1] : this.players[0];
    const res = this.result
      ? {
          winner: this.result.winner || null,
          fled: !!this.result.fled,
          left: this.result.left || null,
          youWon: this.result.winner ? this.result.winner === me.name : null
        }
      : null;
    return {
      id: this.id,
      phase: this.phase,
      turn: this.attacker.id,
      turnName: this.attacker.name,
      defender: this.defender.id,
      me: { id: me.id, name: me.name, hp: this.hp[me.id], max: this.max, items: this.items[me.id] },
      foe: { id: foe.id, name: foe.name, hp: this.hp[foe.id], max: this.max },
      log: this.log,
      attack: this.attackName,
      bullets:
        this.phase === 'dodge'
          ? this.bullets.map((b) => ({
              x: Math.round(b.x),
              y: Math.round(b.y),
              r: b.r,
              k: b.k || 'ball',
              rot: Math.round((b.rot || 0) * 100) / 100
            }))
          : [],
      soul: this.phase === 'dodge' ? { x: Math.round(this.soul.x), y: Math.round(this.soul.y) } : null,
      time: Math.round(this.time * 100) / 100,
      duration: this.attack ? this.attack.duration : 0,
      box: BOX,
      result: res
    };
  }
}

class Hub {
  constructor() {
    this.players = new Map();
    this.battles = new Map();
    this.frame = 0;
  }

  start() {
    this.loop = setInterval(() => this.tick(), TICK_MS);
  }

  attach(conn) {
    const p = { id: 'p' + ++idSeq, name: '', joined: false, battle: null, conn };
    this.players.set(p.id, p);
    conn.on('message', (raw) => {
      let m;
      try {
        m = JSON.parse(raw);
      } catch {
        return;
      }
      if (m && typeof m.t === 'string') this.onMessage(p, m);
    });
    conn.on('close', () => this.onClose(p));
    conn.send({ t: 'hello', id: p.id });
  }

  onMessage(p, m) {
    switch (m.t) {
      case 'join': {
        const name = String(m.name || '').replace(/[<>&"']/g, '').trim().slice(0, 12);
        p.name = name || 'JEVIL';
        p.joined = true;
        p.conn.send({ t: 'joined', id: p.id, name: p.name });
        this.broadcastPlayers();
        break;
      }
      case 'challenge': {
        this.challenge(p, String(m.target || ''));
        break;
      }
      case 'battle': {
        if (p.battle) p.battle.action(p, m.a || {});
        break;
      }
      case 'soul': {
        if (p.battle) p.battle.setSoul(p, m.x, m.y);
        break;
      }
    }
  }

  challenge(a, targetId) {
    const b = this.players.get(targetId);
    if (!b || b === a || !a.joined || !b.joined) return;
    if (a.battle || b.battle) return;
    const battle = new Battle(a, b);
    this.battles.set(battle.id, battle);
    for (const p of [a, b]) {
      p.conn.send({ t: 'battleStart', attacks: attackList, you: p.id, opponent: p === a ? b.name : a.name });
    }
    this.broadcastPlayers();
  }

  onClose(p) {
    if (p.battle) p.battle.abandon(p);
    p.battle = null;
    this.players.delete(p.id);
    this.broadcastPlayers();
  }

  tick() {
    const dt = TICK_MS / 1000;
    this.frame += 1;

    for (const [id, battle] of this.battles) {
      battle.tick(dt);
      if (battle.finished) {
        for (const p of battle.players) {
          p.battle = null;
          if (p.conn.alive) p.conn.send({ t: 'battleEnd', result: battle.result });
        }
        this.battles.delete(id);
        this.broadcastPlayers();
      } else if (this.frame % 2 === 0) {
        for (const p of battle.players) {
          p.conn.send({ t: 'battleState', s: battle.stateFor(p) });
        }
      }
    }
  }

  broadcastPlayers() {
    const list = [];
    for (const p of this.players.values()) {
      if (!p.joined) continue;
      list.push({ id: p.id, name: p.name, busy: !!p.battle });
    }
    const msg = { t: 'players', players: list };
    for (const p of this.players.values()) {
      if (p.joined && !p.battle) p.conn.send(msg);
    }
  }
}

module.exports = { Hub, Battle };
