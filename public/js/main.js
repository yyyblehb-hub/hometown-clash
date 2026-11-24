/**
 * App shell: name -> choose character -> choose someone to fight -> battle.
 * There is no lobby world; the only screens are these three.
 */
import { Net } from './net.js';
import { Input } from './input.js';
import { BattleView } from './battle.js';
import { JevilSprite } from './jevil.js';

const $ = (id) => document.getElementById(id);

const net = new Net();
const input = new Input();
const battle = new BattleView(net, input);

const joinEl = $('join');
const selectEl = $('select');
const battleEl = $('battle');
const nameInput = $('nameInput');
const joinBtn = $('joinBtn');
const joinError = $('joinError');
const foeList = $('foeList');
const foeEmpty = $('foeEmpty');
const onlineCount = $('onlineCount');
const charArt = $('charArt');
const charCard = $('charCard');
const frameBtns = $('frameBtns');

/* the character card animates with the same frames as the fighter */
const sprite = new JevilSprite('idle');
charArt.appendChild(sprite.canvas);

let myId = null;
let myName = '';
let signedIn = false;
let screen = 'join';
let pose = 'idle';
let listSig = '';

function showScreen(name) {
  screen = name;
  joinEl.classList.toggle('show', name === 'join');
  selectEl.classList.toggle('show', name === 'select');
  battleEl.classList.toggle('show', name === 'battle');
  document.getElementById('game').classList.toggle('playing', name === 'battle');
  if (name === 'battle') battle.resize();
}

/* ------------------------------ join ------------------------------ */
function doJoin() {
  const name = (nameInput.value || '').trim().slice(0, 12);
  if (!name) {
    joinError.textContent = '* You need a name!';
    return;
  }
  joinError.textContent = '';
  myName = name;
  try {
    localStorage.setItem('hc.name', name);
  } catch {}
  net.send({ t: 'join', name });
  joinBtn.disabled = true;
  joinBtn.textContent = 'CONNECTING...';
}

joinBtn.addEventListener('click', doJoin);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doJoin();
});

try {
  const saved = localStorage.getItem('hc.name');
  if (saved) nameInput.value = saved;
} catch {}

/* ------------------------------ network ------------------------------ */
net.on('joined', (m) => {
  myId = m.id;
  signedIn = true;
  joinBtn.disabled = false;
  joinBtn.textContent = 'ENTER';
  showScreen('select');
  updateOnline();
});

net.on('players', (m) => renderPlayers(m.players || []));

net.on('battleStart', (m) => {
  showScreen('battle');
  battle.start(m);
});

net.on('battleState', (m) => {
  if (screen === 'battle') battle.handleState(m.s);
});

net.on('battleEnd', () => {
  battle.hide();
  listSig = '';
  showScreen('select');
});

net.on('open', () => {
  if (signedIn && myName) net.send({ t: 'join', name: myName });
});

/* ------------------------------ select screen ------------------------------ */
function renderPlayers(list) {
  updateOnline(list.length);
  if (!myId) return;
  const foes = list.filter((p) => p.id !== myId);
  const sig = foes.map((p) => `${p.id}:${p.name}:${p.busy ? 1 : 0}`).join('|');
  if (sig === listSig) return;
  listSig = sig;

  foeList.innerHTML = '';
  foeEmpty.classList.toggle('hidden', foes.length > 0);

  for (const foe of foes) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'foeBtn';
    const name = document.createElement('span');
    name.className = 'foeName';
    name.textContent = foe.name;
    const state = document.createElement('span');
    state.className = 'foeState';
    state.textContent = foe.busy ? 'IN BATTLE' : 'FIGHT';
    btn.append(name, state);
    btn.disabled = !!foe.busy;
    btn.addEventListener('click', () => net.send({ t: 'challenge', target: foe.id }));
    li.appendChild(btn);
    foeList.appendChild(li);
  }
}

function updateOnline(count) {
  const n = typeof count === 'number' ? count : 1;
  onlineCount.textContent = `${n} online`;
}

/* character card: tap to jump, buttons to preview the frame sets */
charCard.addEventListener('click', () => sprite.jump());

frameBtns.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-pose]');
  if (!btn) return;
  const next = btn.dataset.pose;
  lightPose(btn);
  if (next === 'jump') {
    sprite.jump();
    setTimeout(() => {
      lightPose(frameBtns.querySelector(`[data-pose="${pose}"]`));
      sprite.play(pose);
    }, 1100);
  } else {
    pose = next;
    sprite.play(pose);
  }
});

function lightPose(btn) {
  for (const b of frameBtns.querySelectorAll('button')) b.classList.toggle('on', b === btn);
}

/* ------------------------------ fullscreen / landscape ------------------------------ */
$('fsBtn').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      const orientation = window.screen && window.screen.orientation;
      if (orientation && orientation.lock) {
        try {
          await orientation.lock('landscape');
        } catch {}
      }
    } else {
      await document.exitFullscreen();
    }
  } catch {}
});

$('rotateSkip').addEventListener('click', () => $('rotate').classList.add('dismissed'));

/* ------------------------------ resize + loop ------------------------------ */
function onResize() {
  battle.resize();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

let last = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - (last || now)) / 1000);
  last = now;
  if (screen === 'battle') battle.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
