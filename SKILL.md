---
name: hyperframes-video-pipeline
description: End-to-end production pipeline for making HyperFrames videos (write HTML, render MP4). Use for any request to plan, author, check, preview or render a HyperFrames video — promo, product launch, explainer, title card, captioned clip, motion graphic, music video / lyric video, or a long-form multi-act piece. Orchestrates brief -> scaffold -> offline asset vendoring -> composition -> check -> pixel verification -> preview approval -> render -> ffprobe -> cleanup/publish, and encodes the traps that break naive agent builds: a blocked CDN needs a locally vendored GSAP, FFmpeg is often missing from PATH, an id-less <audio> renders the video mute, snapshot surfaces can be frozen at t=0, and "lyrics drift" is usually the wrong audio take. A thin orchestrator on top of the hyperframes-* skills, not a duplication of them.
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
- `<BROWSER>` — Chrome/Edge binary; `scripts/shoot-freeze.sh` auto-detects it (`EDGE=` overrides).

## When to use

Any request to plan, author, check, preview or render a HyperFrames video (the trigger list is in
the description above). New project -> start at Step 1. Editing an existing one -> jump to Step 5
but keep the gates (Steps 6, 9 and 10).

Two kinds of project change the shape of the work; notice at the brief: **music-driven** (a real
song is the timeline) → `references/music-driven-sync.md`; **long-form** (>~6 acts, one rule that
must hold in every scene) → `references/generator-architecture.md`.

## Setup (once per machine)

```bash
node --version                          # must be >= 22
export PATH="$PATH:<FFMPEG_BIN>"        # Windows/winget installs often miss PATH
ffmpeg -version && ffprobe -version
```

`check` / `lint` do NOT need FFmpeg; only `render`, `snapshot`, and audio synthesis do. A blocked
CDN is handled by vendoring GSAP locally (Step 4). Optional: Python 3 + `librosa` + `soundfile`
for music-driven onset measurement; a Chrome/Edge binary for pixel verification.

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

Past ~6 sub-compositions, put the frames behind a **generator** (per-act spec module + shared
`kit.mjs` + build script) so one rule change costs one command, and the frame HTML becomes a
build product nobody hand-tunes. → `references/generator-architecture.md`.

### Step 4 — Vendor GSAP + any remote asset (REQUIRED if CDN is blocked)
The scaffold points GSAP at a CDN; on a locked-down network that fetch fails and every tween dies
— but the npm registry is reachable. From `<PROJECT_ROOT>`:
```bash
bash <SKILL_DIR>/scripts/localize-gsap.sh projects/<proj>
```
It packs `gsap@3.14.2` into `projects/<proj>/assets/vendor/gsap.min.js` (idempotent) and prints
the `src` to swap into `index.html`. Same principle for other assets: `@font-face { src: local(...) }`
for system fonts (the compiler auto-injects Inter; it also fetches named fonts into its own cache),
and download any URL image into `assets/` with a relative path.

### Step 5 — Write the composition
Author the HTML per the framework contract. **Load these skills, don't reinvent:**
- `hyperframes-core` — `data-*` timing, `class="clip"`, tracks, determinism rules.
- `hyperframes-animation` / `hyperframes-keyframes` — seekable GSAP timelines, transitions.
- `hyperframes-creative` — palette, typography, beat planning, audio-reactive visuals.
- `hyperframes-registry` — search/install a ready block before hand-building a named look.

Hard rules (top repeat offenders; the *why* is in the references):
- `window.__timelines["<id>"]` key MUST equal the root `data-composition-id`.
- Root `#root` uses `width/height:100%`, NOT hardcoded `1920px/1080px`; size comes from
  `data-width`/`data-height`.
- Never pair a CSS `transform` with a GSAP tween on the same property (use `fromTo`, or put the
  static transform on a wrapper).
- No render-time `Date.now()` / unseeded `Math.random()` / network fetch (determinism) — a
  generator ships a seeded PRNG in the kit instead.
- **Every `<audio>` MUST have a unique `id`** — an id-less `<audio>` is ignored by the mixer and
  the WHOLE render comes out silent. The #1 self-inflicted bug.
- **Two clocks**: a sub-composition's timeline starts at 0 while track time doesn't. Decide which
  helpers translate (`L(t) = t - START`), write the convention in every file header, never apply
  it twice.
- **`onUpdate` writes don't reach the render** (the renderer seeks) — use discrete `tl.set()`.
- **SVG transforms**: `attr` tweens beat transform tweens on SVG children; `set`-then-`to` beats
  `fromTo` with `svgOrigin`. → `references/animation-traps.md`.

### Step 6 — Check until green
```bash
cd "<PROJECT_ROOT>/projects/<proj>" && npx --yes hyperframes check
```
Iterate edit->check until **0 findings**. Critical caveat: a lint **error** silently turns OFF the
layout + contrast audits — output then reads `0 sample(s)` / `0/0 text checks`, which *looks* clean
but means nothing actually ran. Clear lint errors first, then trust the audit numbers.

For a generator project, run the text/script audits **before** `check`, cheapest first:
scope/id collisions → SVG-transform audit → `lint` → `check` → pixels (Step 8) → alignment/sync.
A persistent `too_large` *warning* on a generated file is an acceptable trade; the moment anything
becomes an **error**, the audits stopped running.

### Step 7 — Audio (BGM / SFX / optional VO)
- **Ready SFX first:** `media-use` ships ~21 sounds at
  `<SKILL_DIR>/../media-use/audio/assets/sfx/` (whoosh, riser, impact, chime, ping, typing,
  glitch…). Copy what you need into `projects/<proj>/assets/` and reference locally. Full menu +
  wiring + FFmpeg synthesis recipes: `references/ffmpeg-audio.md`.
- **BGM (no VO):** ask for a track, or synthesize a deterministic ambient bed with FFmpeg. Never
  pull audio from a CDN.
- **VO / HeyGen audio:** needs the connector authorized; if unavailable, ship SFX + an FFmpeg bed
  rather than blocking a render.
- **Given track (music-driven):** derive every cue from the exact file that will render (path *and*
  content hash) and re-derive whenever it's swapped; pad the file to `data-duration`
  (`-af apad -t <dur>`) instead of leaving an undefined silent tail.
- Obey the `id`-on-`<audio>` rule (Step 5), and note the mixer **auto-lowers gain to stay under
  ~-1 dBTP** — measure the render (`ffmpeg -af volumedetect`) before pushing a level up again.

### Step 8 — Verify real pixels at the seconds that matter
`check` proves structure, not picture. Freeze the frame's own timeline at an exact second, shoot
it headlessly, and diff two adjacent seconds to prove motion:
```bash
bash <SKILL_DIR>/scripts/shoot-freeze.sh --project "<PROJECT_ROOT>/projects/<proj>" \
     --id <frame-id> --prefix q03 --t 6.0 --t 6.1
node <SKILL_DIR>/scripts/motion-diff.mjs \
     "<PROJECT_ROOT>/projects/<proj>/snapshots/q03-t6.0.png" \
     "<PROJECT_ROOT>/projects/<proj>/snapshots/q03-t6.1.png"
```
`--t` is that frame's **local** second; `0.00% pixels moved` means the harness is frozen, not that
the scene is static. Keep agent-only pages in `.verify/` / `.dev/` — `hyperframes lint` walks every
other `.html` in the project but skips dot-directories. Trust ranking for every screenshot surface
and the rest of the traps: `references/pixel-verification.md`.

### Step 9 — GATE: preview approval (never auto-render)
```bash
cd "<PROJECT_ROOT>/projects/<proj>"
npx --yes hyperframes preview --background   # survives the call; --status to check, --stop to end
```
Never wrap `npm run dev` in a background shell wrapper. **Confirm in the browser that it looks
like the mp4 you want before rendering** — preview is cheap to fix, a re-render is not. Do NOT run
`render` until the user (or you, if they delegated full authority) approves. `snapshot --at` is
optional, but see Step 8 on why snapshots can lie; and a *live* preview can't be motion-checked
from an agent browser at all (hidden tabs throttle rAF to zero).

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

A long render, measured once on a 220 s / 6600-frame draft (20 cores, 5 workers) — an order of
magnitude, not a promise about your machine:
- ~5-6 minutes: run it in the background and poll the log; never block a turn on it.
- Every frame is `seek`ed, so anything not derived from timeline time looks right in preview and
  wrong in the mp4 (Step 5, `references/animation-traps.md`).
- Fonts are fetched into a local cache on first run — "font not found" on a fresh machine is a
  network problem, not a composition problem.

### Step 11 — Fast iteration
Re-edit the **source** (spec or `index.html`) -> rebuild -> the Step 6 audit ladder -> Step 8
pixels -> `preview` -> re-render only after visual approval. Keep `--quality draft` during
iteration; do one final higher-quality render once it's right.

### Step 12 — Ship it (cleanup, README, publish)
Sort files into **source / derived / third-party input**; gitignore the derived (renders,
snapshots, `.verify/`, `.thumbnails/`, `node_modules/`) and keep what no script can rebuild. Then:
- re-run one freeze shot + `check` **after** the purge, to prove the pipeline still works;
- exclude the mp4 and any music/lyrics/art you don't own — list each in the README with its
  restore command and the designer's credit;
- add `.gitattributes` (`eol=lf`, binaries marked) or `*.sh` breaks on a Linux clone;
- GitHub: **slugs must be pure ASCII English** (no rename tool exists in the MCP set), and
  `-32602` from `create_repository` is a false positive — confirm with `search_repositories`
  before retrying. → `references/publishing.md`.

## Gotchas quick table

The symptom-first index; each row's full story lives in the step or reference named.

| Symptom | Cause | Fix |
|---|---|---|
| Render comes out silent | `<audio>` without an `id` | unique `id` on every audio (Step 5) |
| `check` reads "0 findings" | a lint **error** disabled layout/contrast audits | clear lint errors first (Step 6) |
| No motion at all / `gsap` undefined | CDN unreachable | vendor GSAP (Step 4) |
| `ffmpeg` / `ffprobe` not found | installed but not on PATH | `export PATH` the bin (Step 10) |
| Every snapshot looks identical | the surface returns sub-compositions at **t=0** | freeze harness instead (Step 8) |
| A scene never appears | local-vs-track clock applied twice | convention per file (Step 5) |
| Text stuck at its authoring value | driven from `onUpdate` | discrete `tl.set()` (`animation-traps.md`) |
| SVG shape lands off-target | GSAP mis-measured its transform origin | `attr` tweens, `set`-then-`to` (`animation-traps.md`) |
| Caption drift that **grows** | cue sheet built on a different take | re-measure the shipped file (`music-driven-sync.md`) |
| Raising a level changes nothing | gain capped under ~-1 dBTP | measure the render (Step 7) |
| Repo name mangled on GitHub | non-ASCII slug, no rename tool | English slug (`publishing.md`) |

## Related skills (install the pack)
`hyperframes` (entry router), `hyperframes-core`, `hyperframes-cli`, `hyperframes-animation`,
`hyperframes-keyframes`, `hyperframes-creative`, `hyperframes-registry`, `media-use`,
`general-video`, `figma` — from `heygen-com/hyperframes`. This skill sits on top as the
orchestrator; it assumes those are installed.

## Bundled resources

Scripts are project-agnostic (`--project --id --prefix --t`), dependency-free Node + bash.

- `localize-gsap.sh` — pack GSAP into `assets/vendor/` (idempotent).
- `build-freeze.mjs` — unwrap a frame, inline vendored GSAP, seek its timeline to `?t=`.
- `shoot-freeze.sh` — headless Chrome/Edge screenshots at exact seconds (Windows-safe paths).
- `motion-diff.mjs` + `png.mjs` — changed-pixel ratio between two PNGs: "is it really moving?".
- `scene-planning.md` — brief → beat map, timing, palettes.
- `ffmpeg-audio.md` — offline BGM/SFX (shipped SFX + deterministic FFmpeg synthesis).
- `pixel-verification.md` — which screenshot surfaces to trust, and the harness's own traps.
- `music-driven-sync.md` — measuring the real track, onsets, caption reveal budget, non-circular
  sync checks, padding and the silent tail.
- `generator-architecture.md` — spec-per-act + shared kit, the two clocks, audit gates.
- `animation-traps.md` — SVG/GSAP transforms, `onUpdate` in renders, CSS 3-D, legibility on pixels.
- `publishing.md` — cleanup taxonomy, licence-excluded media, `.gitattributes`, GitHub quirks.

## Install (this skill)
```bash
# project-scoped, run from <PROJECT_ROOT> (no -g — keep it out of the global skill dir)
npx --yes skills@latest add chail233/hyperframes-video-pipeline
```
