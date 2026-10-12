# Pixel verification: which surfaces to trust

**The problem:** an agent cannot see the video. It can only see screenshots — and the two
screenshots surfaces people reach for first both lie on multi-scene projects.

## Trust ranking (measured, not guessed)

| Surface | Trust | Why |
|---|---|---|
| `.verify/freeze-<id>.html` + headless browser | **high** | the frame's own script runs, then `tl.seek(t)` — real pixels at an exact second |
| `motion-diff.mjs` on a t / t+0.1 pair | **high** | proves motion exists without watching playback |
| `hyperframes snapshot --at` | **conditional** | on a project with several sub-compositions it can return every frame at **t=0** |
| Studio thumbnail API | **conditional** | same t=0 freeze |
| a live `preview` in the agent browser | **unusable** | a background/hidden tab throttles `requestAnimationFrame` to zero — GSAP keeps time, DOM-driven text does not move |

Before trusting *any* screenshot surface, **A/B it**: shoot the same composition at two
different seconds and diff. `0.00% pixels moved` means the surface is frozen, not that the
frame is static.

## The freeze harness

Invocation lives in `SKILL.md` Step 8. Under the hood: `build-freeze.mjs` lifts the frame out of
its `<template>` (or unwraps a standalone document), rewrites `assets/` refs one level up, inlines
everything in `assets/vendor/` (GSAP first), registers any `*Plugin` global it finds, and appends:

```js
var tl = window.__timelines["<frame-id>"];
tl.pause(); tl.seek(parseFloat(new URLSearchParams(location.search).get("t") || "0"));
```

Notes that bite:

- `--t` is in the frame's **local** seconds (timeline time), not track time. A frame mounted
  at track 40 s still starts its own clock at 0.
- The headless browser needs **Windows-style paths** when the binary is a `.exe`;
  `shoot-freeze.sh` uses `cygpath` for that. Passing `/c/...` paths silently produces no PNG.
- Each shot gets its own `--user-data-dir` and never touches a running browser.
  **Never `pkill msedge`** — it kills the user's windows, not just yours.
- `document.title` is `NO TIMELINE` when the id is wrong. If a shot looks blank, check that
  first — `window.__timelines` key must equal the root `data-composition-id`.

## Keep debug pages out of lint

`hyperframes lint` walks every `.html` in the project **but skips dot-directories**, so agent
scratch pages belong in `.verify/` (regenerated, gitignored) or `.dev/` — anywhere else makes lint
fail on scaffolding that was never meant to ship.
