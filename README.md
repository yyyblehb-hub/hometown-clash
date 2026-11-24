# HOMETOWN CLASH

A free, non-monetised UNDERTALE/DELTARUNE fan game: **1v1 online Jevil battles**.
No lobby, no walking around — black screen, pick your character, pick who to fight.

## Run

```bash
node server/server.js      # http://localhost:3000
```

No dependencies, no install step. Node 18+ (uses only `http`, `fs`, `crypto`).
The port comes from `PORT` (default 3000) and it binds `0.0.0.0`, so it runs as-is on
any Node host.

Two players are needed: open the page in two tabs/devices on the same server.

## Deploy (Render, free)

`render.yaml` describes the whole service, so Render can create it in one step:

1. Push this repo to GitHub (already done for `yyyblehb-hub/hometown-clash`).
2. On [Render](https://render.com) open **New → Blueprint** and pick this repo.
3. Apply. Render builds with `npm install`, runs `npm start`, health-checks
   `/health`, and serves it over HTTPS (the client switches to `wss://` by itself).

Or do it manually with **New → Web Service**: runtime **Node**, build
`npm install`, start `npm start`, plan **Free**.

Free instances sleep after ~15 minutes with no traffic; the first player after that
waits ~30 seconds for the instance to wake.

## Flow

1. **Name** — type a name, no account.
2. **Choose your character** — Jevil. The card plays his idle loop; tap it to make
   him jump, or use **IDLE x4 / WALK x4 / JUMP x4** to preview every frame set.
3. **Choose someone to fight** — the list shows everyone online. Tap a name and the
   battle starts immediately. Players already fighting are greyed out.
4. **Battle** — Undertale-style UI, strictly turn based.

## Battle controls

Your turn (attacker):

| button | what it does |
| --- | --- |
| **FIGHT** | timing bar — press `STRIKE` (or Space/Enter) when the white line is in the middle; accuracy sets the damage |
| **ACT** | pick one of Jevil's four attacks (`DEVILSKNIFE`, `CHAOS SABER`, `CAROUSEL`, `HYPNOSIS`), aim with the joystick/arrows, press **FIRE** |
| **ITEM** | Dark Candy, +22 HP, 2 per fight |
| **MERCY** | spare — ends the battle |

Their turn (defender): move the red **SOUL** inside the box with the joystick,
WASD or arrow keys and dodge the bullets for the length of the pattern.

Server-side authority: HP, bullets, collisions, turns and win/lose are all decided
in `server/game.js`, so the browser only renders and sends input.

## Layout

```
server/
  ws.js        hand-rolled WebSocket server (no deps)
  server.js    static files + /health + /ws
  game.js      Battle (turns, HP, bullets, hits) + Hub (matchmaking)
  attacks.js   Jevil's four attack patterns + the list the ACT menu uses
public/
  index.html   join / select / battle screens
  js/jevil.js  the character: 12 pixel-art frames drawn in code
  js/main.js   screens, matchmaking, previews, fullscreen
  js/battle.js Undertale battle UI (timing bar, aim, soul, canvas bullets)
  js/net.js    JSON WebSocket wrapper
  js/input.js  joystick + keyboard
  css/style.css
scripts/smoke.js  two-client end-to-end check
render.yaml       one-step Render deploy
ASSETS.md         frame map, palette, "which animation is which"
```

## Checks

```bash
node server/server.js &   # server must be running
node scripts/smoke.js     # join, challenge, FIGHT, ACT/aim/dodge, MERCY
```

## Controls / screen

- **⛶ FULLSCREEN** top right; on phones it also tries to lock landscape.
- Portrait phones get a "turn your phone sideways" screen (can be dismissed).
- Joystick appears only on touch screens.

## Legal

Free fan project, no monetisation. UNDERTALE and DELTARUNE are © Toby Fox.
All character art here is drawn in code — no ripped sprite sheets.
