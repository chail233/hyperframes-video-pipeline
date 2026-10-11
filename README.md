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
- 🧊 **GSAP `undefined`, no animation at all** — the `init` scaffold points GSAP at a CDN, and a
  locked-down / offline network can't fetch it, but the npm registry *is* reachable → vendor it.
- ✅ **`check` says "0 findings" but nothing was audited** — a single lint *error* disables the
  layout + contrast audits and the clean-looking number is a lie.
- ⏱️ **ffmpeg / ffprobe "not found"** — installed but not on `PATH` (very common on Windows/winget).
- 🚦 **Rendering before looking at it** — preview is cheap to fix, a re-render is not.

The skill enforces a **preview-approval gate** before any render and a **ffprobe verification** after.

## Install

```bash
# via the skills CLI (adds it to your agent's skill directory)
npx --yes skills@latest add chail233/hyperframes-video-pipeline

# project-scoped (no -g), run from your project root
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

## The pipeline (10 steps, 2 hard gates)

1. **Brief** — resolution/orientation, duration, scene/beat list, VO y/n, theme/palette, deliverable.
2. **Scaffold** — `hyperframes init projects/<proj>` (never hand-write the skeleton).
3. **Modular vs monolithic** — split into sub-compositions only when it earns it.
4. **Vendor GSAP + remote assets** — `scripts/localize-gsap.sh` pulls GSAP via `npm pack` into
   `assets/vendor/`; `@font-face { src: local(...) }` for fonts. *(Required when CDN is blocked.)*
5. **Write the composition** — defer the contract to `hyperframes-*`; obey the audio-`id` rule etc.
6. **Check until green** — `hyperframes check`; remember a lint error masks the audits.
7. **Audio** — shipped `media-use` SFX first, deterministic FFmpeg synthesis as fallback.
8. **🚦 GATE: preview approval** — `hyperframes preview`, confirm it *looks* like the mp4 before rendering.
9. **Render + verify** — `hyperframes render --quality draft` then `ffprobe` the output.
10. **Fast iteration** — edit → check → preview → re-render only after approval.

## What's in the box

```
hyperframes-video-pipeline/
├── SKILL.md                       # the runbook (this skill)
├── scripts/
│   └── localize-gsap.sh           # npm-pack + extract GSAP into assets/vendor/ (idempotent)
└── references/
    ├── scene-planning.md          # brief → beat map, timing, palettes, transitions
    └── ffmpeg-audio.md            # offline BGM/SFX: shipped SFX + deterministic FFmpeg synthesis
```

## Notes

- Not affiliated with HeyGen; builds on the open-source HyperFrames engine (Apache-2.0).
- The FFmpeg synthesis recipes and GSAP-vendoring workaround were validated end-to-end on a
  real render pipeline (init → check → preview → render → ffprobe).

## License

MIT — see [LICENSE](LICENSE).
