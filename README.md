# hyperframes-video-pipeline

An **agent skill**: a battle-tested end-to-end pipeline for producing videos with
[HyperFrames](https://github.com/heygen-com/hyperframes) ("write HTML → render MP4").

HyperFrames ships great domain skills (`hyperframes-core`, `-animation`, `-cli`, …) that tell an
agent *what a valid composition is*. What they do **not** give you is the *operating order* and the
environment traps that silently ruin renders. This skill is a thin orchestrator that fills that gap:
it turns "make me a video" into a **verified** `.mp4`, and it front-loads the bugs that otherwise
show up only after a wasted render.

## Why this exists

Every one of these has cost a real debugging session:

- 🎵 **The whole video comes out silent** — an `<audio>` without an `id` is skipped by the mixer.
- 📐 **"The lyrics drift more and more from act 4 on"** — the cue sheet was built against a
  *different take* of the song. Growing drift is a tempo mismatch, not an offset; no constant
  `+0.37 s` will fix it.
- 🧊 **GSAP `undefined`, no animation at all** — the `init` scaffold points GSAP at a CDN, and a
  locked-down / offline network can't fetch it, but the npm registry *is* reachable → vendor it.
- 🖼️ **Every `snapshot` looks identical** — on a multi-sub-composition project the snapshot and
  thumbnail surfaces can return every frame at **t=0**. You need a harness that seeks the real
  timeline; `scripts/build-freeze.mjs` + `shoot-freeze.sh` + `motion-diff.mjs` are that harness.
- 🪤 **Right in preview, wrong in the mp4** — the renderer *seeks*; anything driven from
  `onUpdate`, rAF, or an unbound CSS animation is frozen at its authoring value in the render.
- ✅ **`check` says "0 findings" but nothing was audited** — a single lint *error* disables the
  layout + contrast audits and the clean-looking number is a lie.
- ⏱️ **ffmpeg / ffprobe "not found"** — installed but not on `PATH` (very common on Windows/winget).
- 🚦 **Rendering before looking at it** — preview is cheap to fix, a re-render is not.
- 📦 **A published repo you can't clean up** — a 120 MB mp4, someone else's artwork, a repo name
  GitHub sanitised into `-3.8-world.execute-me-` because it had 中文 in the slug (and no rename
  tool to undo it). Step 12 is the ship checklist.

The skill enforces **pixel verification before the preview-approval gate**, the gate itself
before any render, and a **ffprobe verification** after. Step 12 is the ship checklist: what to
delete, what not to publish, and how to leave the project runnable by someone else.

## Install

```bash
# project-scoped (recommended — keeps it out of the global skill directory)
npx --yes skills@latest add chail233/hyperframes-video-pipeline
```

Or just drop the `SKILL.md` + `scripts/` + `references/` into your agent's skill folder
(e.g. `.qoder/skills/hyperframes-video-pipeline/`).

**Assumes the HyperFrames skill pack is also installed**: `hyperframes`, `hyperframes-core`,
`hyperframes-cli`, `hyperframes-animation`, `hyperframes-keyframes`, `hyperframes-creative`,
`hyperframes-registry`, `media-use`, `general-video`, `figma` — from `heygen-com/hyperframes`.

## Prerequisites

- Node.js **22+**
- **FFmpeg** reachable as `ffmpeg` / `ffprobe`
- HyperFrames CLI (used via `npx --yes hyperframes …`)

Placeholders used in the skill — set them for your machine:

| Placeholder | Meaning |
|---|---|
| `<PROJECT_ROOT>` | your video workspace directory (where `projects/` lives) |
| `<SKILL_DIR>` | where this skill is installed |
| `<FFMPEG_BIN>` | folder containing `ffmpeg` + `ffprobe` |
| `<BROWSER>` | a Chrome/Edge binary for the freeze harness (auto-detected, `EDGE=` overrides) |

Optional: Python 3 + `librosa` + `soundfile` if the piece is music-driven (onset measurement).

## The pipeline (12 steps, 2 hard gates)

1. **Brief** — resolution/orientation, duration, scene/beat list, VO y/n, theme/palette, deliverable.
   Spot the two special branches early: **music-driven** (a real song is the timeline) and
   **long-form** (>~6 acts → generate the frames instead of hand-writing them).
2. **Scaffold** — `hyperframes init projects/<proj>` (never hand-write the skeleton).
3. **Modular vs monolithic** — split into sub-compositions when it earns it; past ~6 acts, put a
   generator behind them and keep debug pages in `.verify/` / `.dev/` (lint skips dot-dirs).
4. **Vendor GSAP + remote assets** — `scripts/localize-gsap.sh` pulls GSAP via `npm pack` into
   `assets/vendor/`; `@font-face { src: local(...) }` for fonts. *(Required when CDN is blocked.)*
5. **Write the composition** — defer the contract to `hyperframes-*`; obey the audio-`id`,
   two-clocks, no-`onUpdate`, SVG-transform rules.
6. **Check until green** — `hyperframes check`; remember a lint error masks the audits. For a
   generator, run the text audits *before* check, cheapest first.
7. **Audio** — shipped `media-use` SFX first, deterministic FFmpeg synthesis as fallback; a given
   track is measured, not assumed, and padded to `data-duration`.
8. **Verify real pixels** — freeze the timeline at exact seconds, screenshot it headlessly, diff
   two adjacent seconds to prove motion. (`scripts/shoot-freeze.sh` + `motion-diff.mjs`)
9. **🚦 GATE: preview approval** — `hyperframes preview --background`, confirm it *looks* like the
   mp4 you want before rendering.
10. **Render + verify** — `hyperframes render --quality draft` then `ffprobe` the output.
11. **Fast iteration** — edit the source → rebuild → audits → pixels → preview → re-render only
    after approval.
12. **Ship** — sort source/derived/third-party, gitignore the rest, exclude what you don't own,
    write a runnable README, pick an ASCII repo slug, push.

## What's in the box

```
hyperframes-video-pipeline/
├── SKILL.md                          # the runbook (this skill)
├── scripts/
│   ├── localize-gsap.sh              # npm-pack + extract GSAP into assets/vendor/ (idempotent)
│   ├── build-freeze.mjs              # unwrap a frame, inline vendored GSAP, seek to ?t=
│   ├── shoot-freeze.sh               # headless Chrome/Edge screenshots at exact seconds
│   ├── motion-diff.mjs               # changed-pixel ratio between two PNGs (is it moving?)
│   └── png.mjs                       # dependency-free PNG decoder used by motion-diff
└── references/
    ├── scene-planning.md             # brief → beat map, timing, palettes, transitions
    ├── ffmpeg-audio.md               # offline BGM/SFX: shipped SFX + FFmpeg synthesis
    ├── pixel-verification.md         # which screenshot surfaces to trust, and why
    ├── music-driven-sync.md          # real-track measurement, onsets, captions, non-circular checks
    ├── generator-architecture.md     # spec-per-act + shared kit for long-form pieces
    ├── animation-traps.md            # SVG/GSAP transforms, onUpdate, CSS 3-D, pixel legibility
    └── publishing.md                 # cleanup, licences, .gitattributes, GitHub quirks
```

The `scripts/` are project-agnostic: pass `--project`, no hardcoded paths.

```bash
bash <SKILL_DIR>/scripts/shoot-freeze.sh --project projects/<proj> \
     --id <frame-id> --prefix q03 --t 6.0 --t 6.1
node <SKILL_DIR>/scripts/motion-diff.mjs projects/<proj>/snapshots/q03-t6.0.png \
                                          projects/<proj>/snapshots/q03-t6.1.png
# → q03-t6.0.png -> q03-t6.1.png: 1.30% pixels moved, max 420   ← the scene is really animating
```

## Notes

- Not affiliated with HeyGen; builds on the open-source HyperFrames engine (Apache-2.0).
- The FFmpeg synthesis recipes, GSAP-vendoring workaround, freeze harness and music-driven sync
  method were validated end-to-end on a real 220 s / 12-act / 6600-frame music video
  (init → audits → pixel verification → preview approval → render → ffprobe → cleanup → publish).
- Timings quoted in the skill (e.g. a ~5-6 minute draft render for 6600 frames) are measurements
  from one machine, offered as an order of magnitude — not a promise about yours.

## License

MIT — see [LICENSE](LICENSE).
