---
name: hyperframes-video-pipeline
description: End-to-end production pipeline for making HyperFrames videos (write HTML, render MP4). Use for any request to plan, author, check, preview or render a HyperFrames video — promo, product launch, explainer, title card, captioned clip, motion graphic. Orchestrates brief -> scaffold -> offline asset vendoring -> composition -> check -> preview approval -> render -> ffprobe verification, and encodes the gotchas that break naive agent builds (blocked CDN needs a locally vendored GSAP, FFmpeg often missing from PATH, the <audio>-id silence bug that renders the whole video mute, the preview-before-render gate). A thin orchestrator that sits on top of the hyperframes-* skills rather than duplicating them.
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

## When to use

Any of: make a video, promo, product/launch video, explainer, intro, title card, motion
graphic, or render/preview/re-edit an existing HyperFrames project. New project -> start at
Step 1. Editing an existing one -> jump to Step 5 but keep the gates (Steps 6 and 8).

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
- **Every `<audio>` MUST have a unique `id`** — an id-less `<audio>` is ignored by the mixer and
  the WHOLE render comes out silent. This is the #1 self-inflicted bug.

### Step 6 — Check until green
```bash
cd "<PROJECT_ROOT>/projects/<proj>" && npx --yes hyperframes check
```
Iterate edit->check until **0 findings**. Critical caveat: a lint **error** silently turns OFF the
layout + contrast audits — output then reads `0 sample(s)` / `0/0 text checks`, which *looks* clean
but means nothing actually ran. Clear lint errors first, then trust the audit numbers.

### Step 7 — Audio (BGM / SFX / optional VO)
- **Use ready SFX first.** If `media-use` is installed it ships sounds at
  `<SKILL_DIR>/../media-use/audio/assets/sfx/` (whoosh, riser, impact-bass, chime, ping, pop,
  notification, typing, glitch…). Copy the ones you need into `projects/<proj>/assets/` and
  reference them locally. Per-scene hit map + snippet in `references/ffmpeg-audio.md`.
- **BGM (no VO):** ask for a track, or synthesize a deterministic ambient bed with FFmpeg
  (chord-pad recipe in `references/ffmpeg-audio.md`). Do not pull audio from a CDN.
- **VO / HeyGen audio:** needs the HeyGen connector authorized. If unavailable, ship the SFX +
  FFmpeg bed instead — never block a render waiting on it.
- Remember the `id`-on-`<audio>` rule (Step 5) or you get silence.

### Step 8 — GATE: preview approval (never auto-render)
```bash
cd "<PROJECT_ROOT>/projects/<proj>"
npx --yes hyperframes preview --background   # server survives the invoking command
```
**Open it in the browser and confirm it looks like the mp4 you want before rendering.** Preview is
cheap to fix; a re-render is not. Do NOT run `render` until the user (or you, if they delegated
full authority) approves the preview. Optionally `npx --yes hyperframes snapshot --at <midpoints>`
and eyeball individual frames.

### Step 9 — Render + verify
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

### Step 10 — Fast iteration
Re-edit `index.html` -> `check` -> `preview` -> re-render only after visual approval. Keep
`--quality draft` during iteration; do one final higher-quality render once it's right.

## Gotchas quick table

| Symptom | Cause | Fix |
|---|---|---|
| Render silent | `<audio>` has no `id` | add a unique `id` to every audio |
| check "0 findings" but audits skipped | a lint error disabled layout/contrast | clear lint errors, re-check |
| gsap undefined / no motion | CDN blocked at render | vendor GSAP locally (Step 4) |
| ffmpeg/ffprobe not found | not on PATH | `export PATH` the ffmpeg bin (Step 9) |
| `font_family_without_font_face` | named font unshipped | `@font-face { src: local(...) }` |
| preview differs from render | skipped the approval gate | honor Step 8 |

## Related skills (install the pack)
`hyperframes` (entry router), `hyperframes-core`, `hyperframes-cli`, `hyperframes-animation`,
`hyperframes-keyframes`, `hyperframes-creative`, `hyperframes-registry`, `media-use`,
`general-video`, `figma` — from `heygen-com/hyperframes`. This skill sits on top as the
orchestrator; it assumes those are installed.

## Bundled resources
- `scripts/localize-gsap.sh` — npm-pack + extract GSAP into a project's `assets/vendor/` (idempotent).
- `references/scene-planning.md` — brief -> scene/beat plan, timing, palettes.
- `references/ffmpeg-audio.md` — offline BGM/SFX recipes (shipped SFX + deterministic FFmpeg synthesis).

## Install (this skill)
```bash
npx --yes skills@latest add chail233/hyperframes-video-pipeline
# or per-project (no -g): run from <PROJECT_ROOT> without -g
```
