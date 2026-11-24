/**
 * Two-client smoke test: join, matchmaking, one FIGHT turn, one ACT/aim turn,
 * then MERCY -> battleEnd. Run the server first:  node server/server.js
 *
 *   node scripts/smoke.js
 */
const URL = process.env.WS_URL || 'ws://127.0.0.1:3000/ws';
let passed = 0;
function ok(cond, label) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  passed += 1;
  console.log(`  ok  ${label}`);
}

class Client {
  constructor(name) {
    this.name = name;
    this.msgs = [];
    this.waiters = [];
    this.cursor = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(URL);
      this.ws.onopen = () => {
        this.send({ t: 'join', name: this.name });
        resolve();
      };
      this.ws.onerror = () => reject(new Error(`${this.name}: socket error`));
      this.ws.onmessage = (ev) => {
        let m;
        try {
          m = JSON.parse(ev.data);
        } catch {
          return;
        }
        this.msgs.push(m);
        for (const w of [...this.waiters]) {
          if (!w.pred(m)) continue;
          this.waiters.splice(this.waiters.indexOf(w), 1);
          w.resolve(m);
        }
      };
    });
  }

  wait(pred, ms = 9000) {
    for (let i = this.cursor; i < this.msgs.length; i++) {
      if (!pred(this.msgs[i])) continue;
      this.cursor = i + 1;
      return Promise.resolve(this.msgs[i]);
    }
    return new Promise((resolve, reject) => {
      const w = {
        pred,
        resolve: (m) => {
          this.cursor = this.msgs.length;
          resolve(m);
        }
      };
      this.waiters.push(w);
      setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error(`${this.name}: timed out waiting for ${pred}`));
      }, ms);
    });
  }

  /** Drop everything received so far: the next wait() only sees fresh messages. */
  skipBuffered() {
    this.cursor = this.msgs.length;
  }

  send(obj) {
    this.ws.send(JSON.stringify(obj));
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

const isState = (pred) => (m) => m.t === 'battleState' && pred(m.s);

async function main() {
  const a = new Client('AAA');
  const b = new Client('BBB');

  console.log('# connect + join');
  await a.connect();
  await b.connect();
  const joined = await a.wait((m) => m.t === 'players' && m.players.length >= 2);
  ok(joined.players.length >= 2, 'both players listed');

  const ida = joined.players.find((p) => p.name === 'AAA').id;
  const idb = joined.players.find((p) => p.name === 'BBB').id;
  ok(ida && idb && ida !== idb, 'distinct player ids');

  console.log('# challenge');
  a.send({ t: 'challenge', target: idb });
  const startA = await a.wait((m) => m.t === 'battleStart');
  const startB = await b.wait((m) => m.t === 'battleStart');
  ok(startA.attacks.length === 4, 'four Jevil attacks for the ACT menu');
  ok(startA.you === ida && startB.you === idb, 'battleStart names the right side');

  const first = await a.wait(isState((s) => s.phase === 'menu'));
  const attacker = first.s.turn === ida ? a : b;
  const defender = attacker === a ? b : a;
  ok(first.s.turn === ida || first.s.turn === idb, 'turn is one of the players');
  console.log(`  --  ${attacker.name} attacks first`);

  console.log('# FIGHT (timing bar accuracy 1)');
  attacker.send({ t: 'battle', a: { type: 'fight', accuracy: 1 } });
  const hurt = await defender.wait(isState((s) => s.me.hp < 100));
  ok(hurt.s.me.hp <= 62, `defender took damage (hp ${hurt.s.me.hp})`);

  console.log('# next turn: ACT -> aim -> dodge');
  const second = await attacker.wait(isState((s) => s.phase === 'menu' && s.turn !== first.s.turn));
  const atk2 = second.s.turn === ida ? a : b;
  const def2 = atk2 === a ? b : a;
  ok(atk2 !== attacker, 'turn swapped');
  atk2.send({ t: 'battle', a: { type: 'attack', id: 'chaos_saber', aim: 0.4 } });
  const dodge = await def2.wait(isState((s) => s.phase === 'dodge' && s.bullets.length > 0));
  ok(dodge.s.bullets.length > 0, `${dodge.s.bullets.length} bullets streaming`);
  ok(dodge.s.defender === (def2 === a ? ida : idb), 'only the defender dodges');
  def2.send({ t: 'soul', x: 120, y: 150 });

  console.log('# MERCY ends the battle');
  // the dodge stream keeps both clients busy: ignore states already buffered, or a
  // stale "menu" from the earlier turn answers this wait and MERCY goes to the
  // wrong player (rejected, battle never ends).
  a.skipBuffered();
  b.skipBuffered();
  const third = await a.wait(isState((s) => s.phase === 'menu'), 12000);
  const ma = third.s.turn === ida ? a : b;
  ma.send({ t: 'battle', a: { type: 'mercy' } });
  const endA = await a.wait((m) => m.t === 'battleEnd', 12000);
  const endB = await b.wait((m) => m.t === 'battleEnd', 12000);
  ok(endA.result.fled === true && endB.result.fled === true, 'battleEnd reports the flee');

  a.close();
  b.close();
  console.log(`\nPASS — ${passed} checks`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
