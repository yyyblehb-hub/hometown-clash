# Character art — what is what

Everything is drawn in code (`public/js/jevil.js`) on a 40×40 pixel grid. No ripped
sheets, no PNGs: each frame is generated at load, so recolouring the character is a
one-line palette change.

## Palette (top of `public/js/jevil.js`)

| key | colour | used for |
| --- | --- | --- |
| `hat` / `hatLit` / `hatShade` | green | the floppy hat (was orange) |
| `skin` / `skinLit` / `skinShade` | pink | round body + face (pinker than before) |
| `blush` | light pink | cheeks |
| `pom` / `pomShade` | white | bobble on the hat |
| `boot` / `bootShade` | orange-red | the two little boots |
| `outline` | near-black plum | 1px outline around every layer |
| `eye` / `shine` | black / white | eyes and mouth |

## Frames (`FRAMES`, 12 total)

Idle — 5 fps, loops

| frame | pose |
| --- | --- |
| `idle_0` | neutral bob low |
| `idle_1` | bob high, hat leans right |
| `idle_2` | **blink**, hat leans left |
| `idle_3` | bob high, hat leans slightly right |

Walk — 10 fps, loops — this is the dance "left right left right"

| frame | pose |
| --- | --- |
| `walk_0` | step A: body up, left boot forward |
| `walk_1` | step B: squash down, boots together |
| `walk_2` | step A **mirrored** (right side) |
| `walk_3` | step B **mirrored** (right side) |

`walk_2` / `walk_3` are literally `walk_0` / `walk_1` flipped on the X axis, so one
pair of poses covers both left and right. Facing is `sprite.face(-1 | 1)`.

Jump — 12 fps, plays once then returns to idle

| frame | pose |
| --- | --- |
| `jump_0` | crouch (squashed, wide eyes) |
| `jump_1` | launch (stretched up, hat lifts) |
| `jump_2` | apex (highest, boots tucked) |
| `jump_3` | land (squash + blink) |

## Where each animation is used

- **Select screen card** — idle loop; tap the card to jump.
- **Frame preview buttons** (IDLE x4 / WALK x4 / JUMP x4) — play each set so you can
  check them one by one.
- **Battle** — your opponent idles the whole fight, and plays the 4 jump frames when
  it takes damage.

## Cut-out method (if a real sheet is ever used)

The old sprite was one SVG split into named parts (`.j-hat`, `.j-arm-l`, …) and
animated with CSS. This build replaces that with explicit frames, so "which animation
is which" is a name in `FRAMES` and a row in the table above — nothing is guessed from
pixels.

If we ever cut a real sheet instead: measure the grid, export `frame_000.png…`,
render a numbered contact sheet, label the ranges, then write the same
`name → frames → fps → loop` table. The spriters-resource site answers **403** to
automated requests from this environment, and ripped sprites are copyrighted, so
this build stays code-drawn (fine for a free, non-monetised fan game, but not
something to redistribute as our own).
