---
name: hyperframes-video-pipeline
description: End-to-end production pipeline for making HyperFrames videos (write HTML, render MP4). Use for any request to plan, author, check, preview or render a HyperFrames video — promo, product launch, explainer, title card, captioned clip, motion graphic, music video / lyric video, or a long-form multi-act piece. Orchestrates brief -> scaffold -> offline asset vendoring -> composition -> check -> pixel verification -> preview approval -> render -> ffprobe verification -> cleanup/publish, and encodes the gotchas that break naive agent builds (blocked CDN needs a locally vendored GSAP, FFmpeg often missing from PATH, the <audio>-id silence bug that renders the whole video mute, the preview-before-render gate, snapshot surfaces frozen at t=0, the wrong audio take behind every "lyrics drift" bug, SVG transform tweens that leave residue, repo naming and licence-excluded media on GitHub). A thin orchestrator that sits on top of the hyperframes-* skills rather than duplicating them.
---

# HyperFrames Video Pipeline

## Overview

The **runbook** for turning "make me a video" into a verified `.mp4`. The `hyperframes-*`
skills tell you *what a valid composition is*; this one tells you *the order to work in* and
*the environment traps* that silently ruin renders. Follow the steps in sequence — several
are gated and must not be skipped or reordered.

Placeholders used below — set them for your machine:
- `<PROJECT_ROOT>` — your video workspace directory (where `projects/` lives).
- `<SKILL_DIR>` — where this skill is installed, e.g. `.qoder/skills/hyperframes-video-pipeline`.
- `<FFMPEG_BIN>` — the folder containing `ffmpeg.exe` + `ffprobe.exe` (or the unix `ffmpeg` dir).
- `<BROWSER>` — a Chrome/Edge binary; `scripts/shoot-freeze.sh` auto-detects it, override with
  `EDGE=/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`.

## When to use

Any of: make a video, promo, product/launch video, explainer, intro, title card, motion
graphic, music video / lyric video, or render/preview/re-edit an existing HyperFrames project.
New project -> start at Step 1. Editing an existing one -> jump to Step 5 but keep the gates
(Steps 6, 9 and 10).

## Two branches worth recognising early

The default 12 steps fit a short clip. Two kinds of project change the shape of the work, and
the cheap time to notice is the brief (Step 1):

- **Music-driven** (a real song is the timeline: MV, lyric video, beat-synced promo). Every
  cue must come from measuring *the file you will render*, and a caption must be readable
  before the singer starts it. → `references/music-driven-sync.md`. Skip the FFmpeg-synthesised
  BGM recipe in Step 7; the track is given.
- **Long-form / many acts** (>~6 sub-compositions, or any rule that must hold in every scene).
  Generate the frame HTML from per-act specs + a shared kit instead of hand-writing files, and
  gate it with script audits. → `references/generator-architecture.md`.

## Setup (once per machine)

```bash
# 1. Node 22+ required.
node --version            # must be >= 22

# 2. FFmpeg must be reachable. On Windows/winget it is often installed but NOT on PATH.
#    Find the bin dir once, then export it in every Bash session that renders or makes audio:
export PATH="$PATH:<FFMPEG_BIN>"
ffmpeg -version && ffprobe -version    # confirms both resolve

# 3. If your network blocks external CDNs (jsdelivr / unpkg / raw hosts), the GSAP
#    <script src="https://..."> that `init` writes will fail to load at preview/render
#    time -> no animation at all. This skill works around it by vendoring GSAP locally (Step 4).
```

`check` / `lint` do NOT need FFmpeg; only `render`, `snapshot`, and audio synthesis do.
Optional, only for the music-driven branch: Python 3 + `librosa` + `soundfile` for onset
measurement (`references/music-driven-sync.md`). Optional for pixel verification: a Chrome or
Edge binary for `--headless --screenshot`.

## The pipeline

### Step 1 — Brief (before writing anything)
Decide, and if genuinely ambiguous confirm with the user:
- **Resolution / orientation**: `landscape` 1920x1080 | `portrait` 1080x1920 | `square` 1080x1080.
- **Duration** and **scene/beat list** (rough seconds per scene).
- **Voiceover?** yes/no. **Theme / palette / tone** (dark tech, warm, brand colors…).
- **Deliverable**: which file counts as done (e.g. `out.mp4`).

For multi-scene or marketing pieces, sketch the beat map and get a nod before building —
re-cutting a plan is cheaper than re-rendering. See `references/scene-planning.md`.

### Step 2 — Scaffold
```bash
cd "<PROJECT_ROOT>"
HYPERFRAMES_SKIP_SKILLS=1 npx --yes hyperframes init projects/<proj> --resolution landscape --non-interactive
```
Keep each video under `projects/<proj>`. Do NOT hand-create `index.html` — `init` writes the
correct, tooling-expected skeleton. (`HYPERFRAMES_SKIP_SKILLS=1` skips its online skill re-check.)

### Step 3 — Modular vs monolithic
One `index.html` is fine for short scenes. For many scenes that need separate diffs, split into
sub-compositions via `data-composition-src` — contract in `hyperframes-core`
(`references/sub-compositions.md`).

Past ~6 sub-compositions, stop editing the generated files at all and put them behind a
**generator** (one spec module per act + a shared `kit.mjs` for palette/CSS/runtime + a build
script). A single rule change then costs one command instead of N hand edits, and the frame HTML
becomes a build product nobody should hand-tune. Also decide now where your **debug pages live**:
`hyperframes lint` walks every `.html` in the project but skips dot-directories, so agent-only
scaffolding goes in `.verify/` / `.dev/` and never pollutes the lint result.
→ `references/generator-architecture.md`.

### Step 4 — Vendor GSAP + any remote asset (REQUIRED if CDN is blocked)
The scaffold points GSAP at a CDN. On a locked-down network that fetch fails and every tween
dies. Run (from `<PROJECT_ROOT>`):
```bash
bash <SKILL_DIR>/scripts/localize-gsap.sh projects/<proj>
```
It pulls `gsap@3.14.2` via `npm pack` (registry is reachable even when CDNs aren't), extracts
`dist/gsap.min.js` into `projects/<proj>/assets/vendor/gsap.min.js`, and prints the exact `src`
to swap into `index.html`. Then edit `index.html` to reference the local file.
Same principle for fonts/images: `@font-face { src: local(...) }` for system fonts (Inter is
auto-injected by the compiler), and download any URL image into `assets/` and use a relative path.

### Step 5 — Write the composition
Author the HTML per the framework contract. **Load these skills, don't reinvent:**
- `hyperframes-core` — `data-*` timing, `class="clip"`, tracks, determinism rules.
- `hyperframes-animation` / `hyperframes-keyframes` — seekable GSAP timelines, transitions.
- `hyperframes-creative` — palette, typography, beat planning, audio-reactive visuals.
- `hyperframes-registry` — search/install a ready block before hand-building a named look.

Hard rules (top repeat offenders):
- `window.__timelines["<id>"]` key MUST equal the root `data-composition-id`.
- Root `#root` uses `width/height:100%`, NOT hardcoded `1920px/1080px`; canvas size comes from
  `data-width`/`data-height`.
- Never pair a CSS `transform` with a GSAP tween on the same property (use `fromTo`).
- No render-time `Date.now()` / unseeded `Math.random()` / network fetch (determinism).
  In a generator, ship a **seeded** PRNG in the kit instead.
- **Every `<audio>` MUST have a unique `id`** — an id-less `<audio>` is ignored by the mixer and
  the WHOLE render comes out silent. This is the #1 self-inflicted bug.
- **Two clocks.** A sub-composition's timeline starts at 0 while the track time does not.
  Pick which helpers translate (`L(t) = t - START`), state the convention in the file header,
  and never apply it twice — a double offset pushes a group past the end and the scene silently
  never appears.
- **Nothing you drive from `onUpdate` reaches the render.** The renderer seeks; per-frame DOM
  writes from `onUpdate` are not what gets captured. Use discrete `tl.set()` at explicit times.
- SVG is where transforms go wrong: prefer `attr` tweens over transform tweens on SVG children,
  and `set`-then-`to` over `fromTo` when using `svgOrigin`. → `references/animation-traps.md`.

### Step 6 — Check until green
```bash
cd "<PROJECT_ROOT>/projects/<proj>" && npx --yes hyperframes check
```
Iterate edit->check until **0 findings**. Critical caveat: a lint **error** silently turns OFF the
layout + contrast audits — output then reads `0 sample(s)` / `0/0 text checks`, which *looks* clean
but means nothing actually ran. Clear lint errors first, then trust the audit numbers.

For a generator project, run the text/script audits **before** `check`, in this order — the cheap
ones should stop you before you spend minutes rendering: scope/id collisions → SVG-transform
audit → `lint` → `check` → pixel verification (Step 8) → alignment/sync audit. A persistent
`too_large` **warning** on a generated file is an acceptable trade when splitting it would fight
the generator; the moment any of these becomes an **error**, the audits stopped running.

### Step 7 — Audio (BGM / SFX / optional VO)
- **Use ready SFX first.** If `media-use` is installed it ships sounds at
  `<SKILL_DIR>/../media-use/audio/assets/sfx/` (whoosh, riser, impact-bass, chime, ping, pop,
  notification, typing, glitch…). Copy the ones you need into `projects/<proj>/assets/` and
  reference them locally. Per-scene hit map + snippet in `references/ffmpeg-audio.md`.
- **BGM (no VO):** ask for a track, or synthesize a deterministic ambient bed with FFmpeg
  (chord-pad recipe in `references/ffmpeg-audio.md`). Do not pull audio from a CDN.
- **VO / HeyGen audio:** needs the HeyGen connector authorized. If unavailable, ship the SFX +
  FFmpeg bed instead — never block a render waiting on it.
- **Given track (music-driven):** derive every cue from the exact file that will render — by
  path *and* content hash — and re-derive whenever the user swaps it. Pad the *file* to the
  declared duration rather than letting the tail be undefined silence:
  `ffmpeg -i assets/audio.mp3 -af apad -t <data-duration> -c:a libmp3lame -q:a 0 assets/bgm.mp3`
- Remember the `id`-on-`<audio>` rule (Step 5) or you get silence. And the mixer **auto-lowers
  track gain to stay under ~-1 dBTP**, so pushing a level up can be silently capped — verify the
  rendered file (`ffmpeg -af volumedetect`) instead of turning the number up again.

### Step 8 — Verify real pixels at the seconds that matter (before asking for approval)
`check` proves structure, not picture. Freeze the frame's own timeline at an exact second and
look at it — and diff two adjacent seconds to prove motion exists:
```bash
bash <SKILL_DIR>/scripts/shoot-freeze.sh --project "<PROJECT_ROOT>/projects/<proj>" \
     --id <frame-id> --prefix q03 --t 6.0 --t 6.1
node <SKILL_DIR>/scripts/motion-diff.mjs \
     "<PROJECT_ROOT>/projects/<proj>/snapshots/q03-t6.0.png" \
     "<PROJECT_ROOT>/projects/<proj>/snapshots/q03-t6.1.png"
```
Trust ranking, and the traps in it (t=0-frozen snapshots, hidden-tab rAF throttling, Windows
paths for the headless binary, `--t` being *local* seconds): `references/pixel-verification.md`.
`0.00% pixels moved` means your harness is frozen, not that the scene is static.

### Step 9 — GATE: preview approval (never auto-render)
```bash
cd "<PROJECT_ROOT>/projects/<proj>"
npx --yes hyperframes preview --background   # server survives the invoking command
```
Use `--background` (the server must outlive the call) — never wrap `npm run dev` in a background
shell wrapper. Confirm with `npx --yes hyperframes preview --status` and stop it with `--stop`
when you're done.
**Open it in the browser and confirm it looks like the mp4 you want before rendering.** Preview is
cheap to fix; a re-render is not. Do NOT run `render` until the user (or you, if they delegated
full authority) approves the preview. Optionally `npx --yes hyperframes snapshot --at <midpoints>`
and eyeball individual frames — but see the caveat about snapshot t=0 freeze in Step 8.
Note: a *live* preview cannot be motion-checked from an agent browser (background tabs throttle
`requestAnimationFrame`), which is exactly why Step 8 exists.

### Step 10 — Render + verify
```bash
export PATH="$PATH:<FFMPEG_BIN>"
cd "<PROJECT_ROOT>/projects/<proj>"
npx --yes hyperframes render --quality draft --output out.mp4   # draft first; upgrade after visual OK
ffprobe -v error -show_entries format=duration:stream=width,height,avg_frame_rate \
        -of default=noprint_wrappers=1 out.mp4
```
Verify the probe: **duration == root `data-duration`**, resolution matches `data-width/height`,
fps sane, and (if audio) an `Audio:` stream is present. Read the render summary's second line for
`beginframe` vs `screenshot` capture mode and GPU.

Reality checks for a long render (measured on a 220 s / 6600-frame draft, 20 cores, 5 workers —
your machine will differ, so treat it as an order of magnitude, not a promise):
- ~5-6 minutes. Run it in the background and poll the log; never block a turn on it.
- Every frame is `seek`ed. Anything not derived from timeline time (rAF-driven, `onUpdate`
  writes, CSS animations not bound to `data-*`) will look right in preview and wrong in the mp4.
- CSS 3-D can switch off the high-fidelity element capture (`references/animation-traps.md`).
- Fonts are fetched into a local cache on first run — a "font not found" on a fresh machine is
  a network problem, not a composition problem.
- If the tail of the film is silent, measure it (`volumedetect` over the last window) before
  deciding whether that needs audio or a decayed visual — see `references/music-driven-sync.md`.

### Step 11 — Fast iteration
Re-edit the **source** (spec or `index.html`) -> rebuild -> the Step 6 audit ladder -> Step 8
pixels -> `preview` -> re-render only after visual approval. Keep `--quality draft` during
iteration; do one final higher-quality render once it's right.

### Step 12 — Ship it (cleanup, README, publish)
A finished project needs sorting, not just pushing: split files into **source / derived /
third-party input**, gitignore the derived (renders, snapshots, `.verify/`, `.thumbnails/`,
`node_modules/`), keep anything a script cannot rebuild, and re-run one freeze shot + `check`
after the purge to prove the pipeline still works. Exclude the rendered mp4 and any
music/lyrics/third-party art you don't own — record each excluded file with its restore command
and the designer's credit in the README. Line endings need a `.gitattributes` (`eol=lf`,
binaries marked) or `*.sh` files break on a Linux clone. GitHub: repo **slugs must be pure ASCII
English** (a 中文 title gets sanitised into mush and there is no rename tool in the MCP set),
`-32602` on `create_repository` is a known false positive — confirm with `search_repositories`
before retrying, and never `git credential fill` (it prints the token).
→ `references/publishing.md`.

## Gotchas quick table

| Symptom | Cause | Fix |
|---|---|---|
| Render silent | `<audio>` has no `id` | add a unique `id` to every audio |
| check "0 findings" but audits skipped | a lint error disabled layout/contrast | clear lint errors, re-check |
| gsap undefined / no motion | CDN blocked at render | vendor GSAP locally (Step 4) |
| ffmpeg/ffprobe not found | not on PATH | `export PATH` the ffmpeg bin (Step 10) |
| `font_family_without_font_face` | named font unshipped | `@font-face { src: local(...) }` |
| preview differs from render | skipped the approval gate | honor Step 9 |
| snapshot / thumbnail looks frozen | surface returns sub-compositions at **t=0** | A/B two `--at` values, then use the freeze harness (Step 8) |
| scene never appears / text stuck at initial state | `groups()` windows in local seconds vs helpers in track seconds — offset applied twice or not at all | state the clock convention per file (Step 5) |
| animated DOM text still at its authoring value in the mp4 | driven from `onUpdate` | use discrete `tl.set()` on the timeline |
| an SVG shape ends up offset from where its tween pointed | GSAP measured the SVG transform origin / a scaling `<g>` | `attr` tweens, `set`-then-`to`, sweep endpoints (`animation-traps.md`) |
| lyric/caption drift that **grows** across the piece | cue sheet built against a **different take** of the track | re-measure the file you render; never patch with a constant offset |
| captions all arrive ~0.3 s late | wipe still drawing when the voice starts | budget reveal to finish at/before onset (`music-driven-sync.md`) |
| raising audio gain changes nothing | renderer caps gain under ~-1 dBTP | measure the render, don't push the number |
| "everything matches" but the video is wrong | verified a transcript against itself | check against a second, independent source |
| tiny text unreadable in the mp4 | px sizes look fine at authoring size | check the freeze screenshot; ~22 px @1080p floor |
| `.sh` in the repo fails on Linux / render reads weird bytes | `core.autocrlf` committed CRLF | `.gitattributes` `eol=lf` + `git add --renormalize .` |
| repo name came out as `-3.8-world.execute-me-` | non-ASCII / parens in the slug, no rename tool | pick an English slug; 中文 title goes in description/README |
| music/lyrics/art vanished from the public repo | deliberately excluded for licence | list them in README with restore commands + designer credit |

## Related skills (install the pack)
`hyperframes` (entry router), `hyperframes-core`, `hyperframes-cli`, `hyperframes-animation`,
`hyperframes-keyframes`, `hyperframes-creative`, `hyperframes-registry`, `media-use`,
`general-video`, `figma` — from `heygen-com/hyperframes`. This skill sits on top as the
orchestrator; it assumes those are installed.

## Bundled resources
- `scripts/localize-gsap.sh` — npm-pack + extract GSAP into a project's `assets/vendor/` (idempotent).
- `scripts/build-freeze.mjs` — unwrap a frame, inline the vendored GSAP, seek its timeline to `?t=`
  (writes `<proj>/.verify/freeze-<id>.html`).
- `scripts/shoot-freeze.sh` — screenshot that page at given seconds with headless Chrome/Edge
  (Windows-safe paths, private browser profile per shot).
- `scripts/motion-diff.mjs` + `scripts/png.mjs` — dependency-free PNG decoder + changed-pixel
  ratio between two frames; the "is it actually moving" proof.
- `references/scene-planning.md` — brief -> scene/beat plan, timing, palettes.
- `references/ffmpeg-audio.md` — offline BGM/SFX recipes (shipped SFX + deterministic FFmpeg synthesis).
- `references/pixel-verification.md` — which screenshot surfaces to trust, and the freeze harness.
- `references/music-driven-sync.md` — measuring the real track, onset probing, caption reveal
  budgeting, non-circular sync audits, padding and the silent tail.
- `references/generator-architecture.md` — spec-per-act + shared kit for long-form pieces, the two
  clocks, deterministic generation, audit gates.
- `references/animation-traps.md` — SVG/GSAP transform traps, `onUpdate` in renders, CSS 3-D
  capture, legibility measured on pixels.
- `references/publishing.md` — cleanup taxonomy, licence-excluded media, `.gitattributes`, README
  run-book, GitHub naming/MCP quirks.

## Install (this skill)
```bash
npx --yes skills@latest add chail233/hyperframes-video-pipeline
# or per-project (no -g): run from <PROJECT_ROOT> without -g
```
