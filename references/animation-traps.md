# Motion traps that only show up in the rendered pixels

These cost real debugging hours. None of them produce an error — they produce a *wrong video*.

## SVG + GSAP transforms

GSAP builds a transform matrix from the element's **live** geometry, and SVG geometry is where
that measurement goes wrong. Three documented failure modes:

1. **A transform tween leaves residue.** Tweening a `<line>`/`<path>` child with `rotation` or
   `x/y` can leave a permanent translate when the tween ends — the tangent finished 64 px away
   from the dot it was supposed to touch. **Grow shapes with `attr` tweens instead**
   (`{attr: {x1, y1, x2, y2}}` from the contact point outward). Cannot drift, and it reads
   better: the line *lays itself down*.
2. **`svgOrigin` + `fromTo` shears.** `svgOrigin` resolves against the element's current
   matrix, so a `fromTo` on several sibling parts resolves each one separately and they shear
   apart on entry. Use **set-then-tween**: `gsap.set(n, {rotation: a0, svgOrigin: piv})` then
   `tl.to(n, {rotation: a1, svgOrigin: piv})`.
3. **`svgOrigin` mis-resolves through a scaling `<g>`.** Inside a transformed group the pivot
   lands somewhere else entirely ("the hand lands half the frame away"). For a needle/hand on a
   dial, **sweep the endpoint attributes** (`x2/y2 = pivot + r·cos/sin`) in `steps(n)` chunks
   instead of rotating anything.

`transformOrigin` percentages and `svgOrigin: "x y"` user-units are not interchangeable — pick
by the value's shape (a bare `"120 80"` is user units ⇒ `svgOrigin`; `"50% 50%"` ⇒ CSS) and
never pass both. Encode that as an audit: grep the generated output for `transform|rotation|scale`
tweens whose selector resolves to an SVG child, and fail the build on a hit.

## CSS transform + GSAP tween on the same property

The stylesheet's static `transform` and the tween's `transform` are one property: GSAP overwrites
it, so a `translate(-50%, -50%)` centering vanishes the moment the tween starts. Either move the
static transform to a wrapper element, or express the tween as `fromTo` including the centering.

## Pivots on left-aligned text

A caption block that changes font-size mid-line must have `text-align:left` on the container, a
**fixed** left edge, and an explicit `transformOrigin: "0 50%"` on the emphasis state. Otherwise
the line jumps horizontally every time it gets loud, which reads as a broken subtitle rather
than emphasis.

## Geometry measured before it exists

Any element whose text is assigned at runtime has no useful box at authoring time — `getBBox()` /
`offsetWidth` return 0 or stale values. Don't derive positions from a width you can't know; place
by anchor (fixed left edge, fixed baseline) or measure at the moment of use.

## CSS 3D turns off capture

`perspective` / 3-D transforms disable the renderer's `drawElementImage` path — the element
falls back to a lower-fidelity capture and looks different in the mp4 than in preview. For a
"camera" feel, use 2-D `scale`/`translate` (or the keyframe skill's seek-safe 2-D/3-D helpers)
rather than authoring raw CSS 3-D.

## Legibility is a rendered-pixel property, not a CSS one

`font-size: 20px` on a 1920-wide canvas is ~1 cm tall on a phone and disappears at mp4 bitrate.
The contrast/layout audits will pass. Check the **freeze screenshot** for the smallest text in
every scene, and treat ~22 px at 1080p as the floor for anything the viewer must read.
(`data-layout-ignore` on decorative absolutely-positioned text so the layout audit doesn't flag
intentional overlaps — but that also means nothing audits its size. You have to look.)

## `onUpdate`-written text is frozen in the render

The renderer seeks per frame; `onUpdate` callbacks fire but their DOM writes are not what gets
captured at that second. **Never drive on-screen counters or scramble text from `onUpdate`** —
schedule discrete `tl.set()` writes on the timeline at explicit times.
