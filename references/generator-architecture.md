# Generator architecture for long-form pieces

A 30-second clip is one hand-written HTML file. A 220-second, 12-act, 129-cue piece is not:
every palette or caption-runtime tweak becomes a 12-file edit, and the files drift apart. Past
roughly **6 sub-compositions, or any project where one rule must hold everywhere**, generate the
frames instead of typing them.

## The shape

```
tools/
├── spec/<id>.mjs      # one module per act: markup + tween script, nothing else
├── kit.mjs            # PAL (palette), KIT_CSS, KIT_JS (the runtime each frame embeds)
├── motifs.mjs         # reusable visual primitives (axis, grid, wave, chart, …)
├── cues.json          # THE measurement: every onset/cue second, derived from audio
└── build-frames.mjs   # spec -> compositions/frames/NN-fNN-*.html
```

`index.html` mounts the generated files with `data-composition-src`. The generated HTML is a
**build product**: never hand-edit it, and say so in its header comment. One `node
tools/build-frames.mjs` then propagates any kit-level fix to all acts at once — which is the
entire reason to do this.

## Rules that make it work

1. **Cues are data, never literals.** Every lyric/beat second comes from the file you measured
   (`cues.json`). If an HTML file contains a hardcoded `173.42`, a re-measure can't reach it.
2. **Two clocks, and name them in every file header.** Track time (song seconds) vs local time
   (this frame's own 0). Pick which helpers translate and which don't, and write it down —
   the classic generator bug is *double-applied* `L(t)`, which pushes a group window off the
   end of the timeline and the scene never appears. E.g.:
   `Convention: groups() windows are LOCAL; kit helpers take TRACK seconds and apply L(t) themselves; raw tweens wrap L().`
3. **Determinism survives generation.** No `Math.random()` / `Date.now()` in the emitted script.
   Ship a seeded PRNG in `KIT_JS` (mulberry32 is 6 lines) and put the seed in the spec, so a
   rebuild reproduces byte-identical pixels and a diff means something.
4. **One palette module.** Per-act colour tokens come from `kit.PAL`; an act that needs "no
   magenta here" says so in its header so a later reader knows the omission is deliberate.
5. **Audits, not eyeballs**, run after every rebuild — each is a script that greps/reads the
   generated output and exits non-zero:
   - *scope audit* — no id/variable collisions across frames;
   - *transform audit* — no GSAP `transform` tween on an SVG child (see below);
   - *alignment audit* — freeze each act at its cue seconds and probe real pixels (needs
     `scripts/build-freeze.mjs`, and must rebuild `.verify/` itself so deleting that cache is safe).
   Order matters: scope → transform → `lint` → `check` → freeze/pixel → alignment. A cheap text
   gate that fails should stop you before you spend 6 minutes rendering.
6. **Keep the harness self-healing.** `.verify/`, thumbnails and snapshots are caches: gitignore
   them, and make the audit regenerate whatever it needs.

## Frame budget, and why the generator pays for itself

`hyperframes lint` warns `too_large` on generated frames that inline a lot of markup; a persistent
*warning* is an acceptable trade when splitting the act would fight the generator (an **error**
would silently disable the layout/contrast audits — see `SKILL.md` Step 6).

What the generator buys is the standard that makes the piece a video instead of a slideshow:
**every lyric line enacted, not just displayed.** Hand-authoring 129 lines collapses into
text-on-screen; with `motifs.mjs` primitives, a line becomes a state change (a point cloud
snapping into a lattice, a circle rolling flat into a line, a curve hitting a wall and freezing)
in a handful of spec lines.
