/**
 * Undertale-style battle client.
 *
 * The server owns HP, bullets and hits. This module only renders and streams
 * the attacker's choice / the defender's soul position.
 */
import { JevilSprite } from './jevil.js';

const BOX = { w: 620, h: 200 };
const SOUL_PAD = 9;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class BattleView {
  constructor(net, input) {
    this.net = net;
    this.input = input;
    const $ = (id) => document.getElementById(id);

    this.el = $('battle');
    this.inner = $('battleInner');
    this.turnTag = $('turnTag');
    this.foeNameEl = $('foeName');
    this.foeHpBar = $('foeHpBar');
    this.foeSpriteHost = $('foeSprite');
    this.textEl = $('battleText');
    this.canvas = $('field');
    this.ctx = this.canvas.getContext('2d');
    this.soulEl = $('soul');
    this.aimEl = $('aimArrow');
    this.meNameEl = $('meName');
    this.hpFill = $('hpFill');
    this.hpText = $('hpText');
    this.itemsLeft = $('itemsLeft');
    this.mainMenu = $('mainMenu');
    this.attackMenu = $('attackMenu');
    this.attackListEl = $('attackList');
    this.attackDescEl = $('attackDesc');
    this.attackBack = $('attackBack');
    this.fightWrap = $('fightWrap');
    this.fightNeedle = $('fightNeedle');
    this.fightStop = $('fightStop');
    this.aimBar = $('aimBar');
    this.aimLabel = $('aimLabel');
    this.fireBtn = $('fireBtn');
    this.aimBackBtn = $('aimBack');
    this.endOverlay = $('endOverlay');
    this.endTitle = $('endTitle');
    this.endText = $('endText');

    this.myId = null;
    this.state = null;
    this.attacks = [];
    this.aiming = null;
    this.aimAngle = 0;
    this.fight = null;
    this.soul = { x: BOX.w / 2, y: BOX.h / 2 };
    this.soulSendAt = 0;
    this.prevHp = { me: null, foe: null };
    this.typed = { text: '', shown: 0 };
    this.hitTimer = 0;
    this.foe = null;

    this.bind();
  }

  bind() {
    this.mainMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn || !this.myTurn()) return;
      this.chooseMain(btn.dataset.act);
    });
    this.attackBack.addEventListener('click', () => this.closeAttackMenu());
    this.fightStop.addEventListener('click', () => this.strike());
    this.fireBtn.addEventListener('click', () => this.fire());
    this.aimBackBtn.addEventListener('click', () => this.cancelAim());

    window.addEventListener('keydown', (e) => {
      if (!this.el.classList.contains('show')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (this.fight) {
          e.preventDefault();
          this.strike();
        } else if (this.aiming) {
          e.preventDefault();
          this.fire();
        }
      }
      if (e.key === 'Escape' && this.aiming) this.cancelAim();
    });
  }

  myTurn() {
    return !!this.state && this.state.phase === 'menu' && this.state.turn === this.myId;
  }

  resize() {
    const bs = Math.min((window.innerWidth * 0.97) / 760, (window.innerHeight * 0.98) / 690);
    this.inner.style.setProperty('--bs', String(Math.max(0.3, bs)));
  }

  start(msg) {
    this.myId = msg.you;
    this.attacks = msg.attacks || [];
    this.state = null;
    this.prevHp = { me: null, foe: null };
    this.soul = { x: BOX.w / 2, y: BOX.h / 2 };
    this.aiming = null;
    this.fight = null;
    this.typed = { text: '', shown: 0 };

    this.endOverlay.classList.add('hidden');
    this.textEl.textContent = '* ...';
    this.mainMenu.classList.remove('off', 'hidden');
    this.attackMenu.classList.add('hidden');
    this.fightWrap.classList.add('hidden');
    this.aimBar.classList.add('hidden');
    this.soulEl.classList.add('hidden');
    this.aimEl.classList.add('hidden');
    this.ctx.clearRect(0, 0, BOX.w, BOX.h);

    this.buildAttackList();
    if (this.foe) this.foe.destroy();
    this.foeSpriteHost.innerHTML = '';
    this.foe = new JevilSprite('idle');
    this.foeSpriteHost.appendChild(this.foe.canvas);

    this.el.classList.add('show');
    this.resize();
  }

  hide() {
    this.el.classList.remove('show');
    this.state = null;
    this.aiming = null;
    this.fight = null;
  }

  /* ---------------------------- server state ---------------------------- */
  handleState(s) {
    const prev = this.state;
    this.state = s;

    const me = s.me;
    const foe = s.foe;
    this.meNameEl.textContent = me.name.toUpperCase();
    this.foeNameEl.textContent = foe.name.toUpperCase();
    this.hpFill.style.width = `${(Math.max(0, me.hp) / me.max) * 100}%`;
    this.hpText.textContent = `${Math.max(0, me.hp)} / ${me.max}`;
    this.foeHpBar.style.width = `${(Math.max(0, foe.hp) / foe.max) * 100}%`;
    this.itemsLeft.textContent = `CANDY x${me.items}`;

    if (this.prevHp.foe !== null && foe.hp < this.prevHp.foe) this.floatDamage(this.prevHp.foe - foe.hp);
    if (this.prevHp.me !== null && me.hp < this.prevHp.me) {
      this.inner.classList.add('hit');
      clearTimeout(this.hitTimer);
      this.hitTimer = setTimeout(() => this.inner.classList.remove('hit'), 260);
    }
    this.prevHp = { me: me.hp, foe: foe.hp };

    const mine = s.turn === this.myId;
    if (s.phase === 'over') this.turnTag.textContent = '...';
    else if (s.phase === 'dodge') this.turnTag.textContent = mine ? 'DODGE!' : `${s.turnName.toUpperCase()} ATTACKS`;
    else this.turnTag.textContent = mine ? 'YOUR TURN' : `${s.turnName.toUpperCase()}'S TURN`;

    this.setText(s.log.join('\n'));

    const canAct = mine && s.phase === 'menu';
    this.mainMenu.classList.toggle('off', !canAct);
    if (!canAct) {
      this.closeAttackMenu();
      if (this.fight) this.endFight();
      if (this.aiming) this.cancelAim(true);
    }

    if (s.phase === 'dodge') {
      this.soulEl.classList.remove('hidden');
      if (!mine && s.soul) this.soul = { x: s.soul.x, y: s.soul.y };
      this.placeSoul();
    } else {
      this.soulEl.classList.add('hidden');
      this.soul = { x: BOX.w / 2, y: BOX.h / 2 };
      this.ctx.clearRect(0, 0, BOX.w, BOX.h);
    }

    if (s.phase === 'over' && (!prev || prev.phase !== 'over')) this.showEnd(s.result);
    if (s.phase !== 'over') this.endOverlay.classList.add('hidden');
  }

  /* ---------------------------- main loop ---------------------------- */
  frame(dt) {
    const s = this.state;
    if (!s) return;
    if (this.aiming) this.updateAim();
    if (this.fight) this.updateFight(dt);
    if (s.phase === 'dodge') {
      if (s.defender === this.myId) this.moveSoul(dt);
      this.drawBullets(s.bullets);
      this.placeSoul();
    }
    this.updateTyping(dt);
  }

  /* ---------------------------- menus ---------------------------- */
  buildAttackList() {
    this.attackListEl.innerHTML = '';
    for (const atk of this.attacks) {
      const b = document.createElement('button');
      b.textContent = atk.name;
      b.addEventListener('mouseenter', () => (this.attackDescEl.textContent = `* ${atk.desc}`));
      b.addEventListener('click', () => this.chooseAttack(atk));
      this.attackListEl.appendChild(b);
    }
    this.attackDescEl.textContent = this.attacks[0] ? `* ${this.attacks[0].desc}` : '';
  }

  chooseMain(act) {
    if (act === 'fight') this.startFight();
    else if (act === 'act') this.openAttackMenu();
    else if (act === 'item') {
      this.net.send({ t: 'battle', a: { type: 'item' } });
      this.mainMenu.classList.add('off');
    } else if (act === 'mercy') {
      this.net.send({ t: 'battle', a: { type: 'mercy' } });
      this.mainMenu.classList.add('off');
    }
  }

  openAttackMenu() {
    if (!this.myTurn()) return;
    this.mainMenu.classList.add('hidden');
    this.attackMenu.classList.remove('hidden');
  }

  closeAttackMenu() {
    this.attackMenu.classList.add('hidden');
    if (this.el.classList.contains('show')) this.mainMenu.classList.remove('hidden');
  }

  /* ---------------------------- FIGHT timing bar ---------------------------- */
  startFight() {
    if (!this.myTurn()) return;
    this.mainMenu.classList.add('hidden');
    this.fightWrap.classList.remove('hidden');
    this.fight = { p: 0, dir: 1, speed: 1.05 };
  }

  updateFight(dt) {
    const f = this.fight;
    f.p += f.dir * f.speed * dt;
    if (f.p >= 1) {
      f.p = 1;
      f.dir = -1;
    } else if (f.p <= 0) {
      f.p = 0;
      f.dir = 1;
    }
    this.fightNeedle.style.left = `${f.p * 100}%`;
  }

  strike() {
    if (!this.fight) return;
    const accuracy = clamp(1 - Math.abs(this.fight.p - 0.5) / 0.3, 0, 1);
    this.net.send({ t: 'battle', a: { type: 'fight', accuracy } });
    this.endFight();
  }

  endFight() {
    this.fight = null;
    this.fightWrap.classList.add('hidden');
    this.closeAttackMenu();
  }

  /* ---------------------------- ACT: aim Jevil's attack ---------------------------- */
  chooseAttack(atk) {
    this.aiming = atk;
    this.attackMenu.classList.add('hidden');
    this.mainMenu.classList.add('hidden');
    this.aimBar.classList.remove('hidden');
    this.aimEl.classList.remove('hidden');
    this.aimLabel.textContent = `* ${atk.name}: aim, then press FIRE.`;
    this.updateAim();
  }

  updateAim() {
    const v = this.input.vector;
    if (v.len > 0.25) this.aimAngle = Math.atan2(v.y, v.x);
    this.aimEl.style.transform = `rotate(${this.aimAngle}rad)`;
  }

  fire() {
    if (!this.aiming) return;
    this.net.send({ t: 'battle', a: { type: 'attack', id: this.aiming.id, aim: this.aimAngle } });
    this.cancelAim(true);
  }

  cancelAim(silent) {
    this.aiming = null;
    this.aimBar.classList.add('hidden');
    this.aimEl.classList.add('hidden');
    if (!silent) this.closeAttackMenu();
  }

  /* ---------------------------- SOUL ---------------------------- */
  moveSoul(dt) {
    const v = this.input.vector;
    const speed = 245;
    this.soul.x = clamp(this.soul.x + v.x * speed * dt, SOUL_PAD, BOX.w - SOUL_PAD);
    this.soul.y = clamp(this.soul.y + v.y * speed * dt, SOUL_PAD, BOX.h - SOUL_PAD);
    const now = performance.now();
    if (now - this.soulSendAt > 45) {
      this.soulSendAt = now;
      this.net.send({ t: 'soul', x: this.soul.x, y: this.soul.y });
    }
  }

  placeSoul() {
    this.soulEl.style.left = `${this.soul.x}px`;
    this.soulEl.style.top = `${this.soul.y}px`;
  }

  drawBullets(list) {
    const c = this.ctx;
    c.clearRect(0, 0, BOX.w, BOX.h);
    for (const b of list) {
      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.rot || 0);
      if (b.k === 'knife') {
        c.strokeStyle = '#fff';
        c.lineWidth = 7;
        c.beginPath();
        c.arc(0, 0, b.r - 4, -0.7, 2.3);
        c.stroke();
        c.strokeStyle = '#120d1f';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, b.r - 4, -0.7, 2.3);
        c.stroke();
        c.fillStyle = '#120d1f';
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, 4, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (b.k === 'saber') {
        c.fillStyle = '#fff';
        c.fillRect(-22, -3, 44, 6);
        c.fillStyle = '#120d1f';
        c.fillRect(-14, -1, 28, 2);
      } else {
        c.beginPath();
        c.arc(0, 0, b.r, 0, Math.PI * 2);
        c.fillStyle = '#120d1f';
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 2.5;
        c.stroke();
      }
      c.restore();
    }
  }

  /* ---------------------------- text + feedback ---------------------------- */
  setText(text) {
    if (text !== this.typed.text) {
      this.typed.text = text;
      this.typed.shown = 0;
    }
  }

  updateTyping(dt) {
    const t = this.typed.text;
    if (this.typed.shown < t.length) {
      this.typed.shown = Math.min(t.length, this.typed.shown + dt * 95);
      this.textEl.textContent = t.slice(0, Math.floor(this.typed.shown));
    }
  }

  floatDamage(amount) {
    const n = document.createElement('div');
    n.className = 'dmgNum';
    n.textContent = `-${amount}`;
    n.style.right = '104px';
    n.style.top = '104px';
    this.inner.appendChild(n);
    setTimeout(() => n.remove(), 900);
    if (this.foe) this.foe.jump();
  }

  showEnd(result) {
    let title = 'SPARED';
    let text = '* You spared each other.';
    if (result && result.winner) {
      title = result.youWon ? 'YOU WON' : 'YOU LOST';
      text = `* ${result.winner} wins.`;
    } else if (result && result.left) {
      title = 'THEY FLED';
      text = `* ${result.left} left the battle.`;
    }
    this.endTitle.textContent = title;
    this.endText.textContent = text;
    this.endOverlay.classList.remove('hidden');
  }
}
