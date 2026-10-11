# Scene planning: brief -> beat map

Do this **before** writing any composition HTML. It is Step 1-2 of the pipeline and the
cheapest place to change your mind — re-cutting scenes in HTML costs a full re-render.

## 1. Freeze the brief

One line each, agreed with the user:
- **Purpose**: what the video must make the viewer do/feel (launch hype, feature explainer, brand reel).
- **Resolution / orientation**: landscape 1920x1080 · portrait 1080x1920 · square 1080x1080.
- **Total duration** (seconds) = root `data-duration`.
- **Voiceover?**: yes -> plan narration beats first and time scenes to the VO; no -> BGM/SFX bed drives pacing.
- **Tone / palette**: e.g. "dark tech, indigo #6366f1 accent, high contrast" or brand colors.
- **Copy**: the exact headline / subline / CTA strings (short — long strings break text-fit lint).

## 2. Beat map (the "flow chart")

List scenes as a table. This IS the plan you get approved before coding.

| # | Scene | Start(s) | Dur(s) | On-screen content | Motion | Audio hit |
|---|-------|---------|--------|-------------------|--------|-----------|
| 1 | Hook  | 0       | 4      | Product name fade-in | zoom-in + blur-out | whoosh.mp3 at 0 |
| 2 | Problem | 4     | 8      | pain-point line + icon | slide-left, stagger | riser.mp3 lead-in |
| 3 | Feature | 12    | 16     | 3 feature cards | pop sequence | pop/ping per card |
| 4 | Proof | 28    | 12     | stat count-up | count-up tween | impact-bass at peak |
| 5 | CTA   | 40    | 6      | brand + tagline | settle + hold | chime at lock |

Rules:
- `Start` of scene N == `Start + Dur` of scene N-1 (back-to-back) unless you want overlap/crossfade.
- Sum of durations == root `data-duration`. Extend root if any clip runs past it.
- One **idea** per scene. If a scene needs >1 message, split it.
- Give each scene a single entrance motion + one exit; avoid stacking 3 effects on one clip.
- Budget ~3-6s for a title card, ~6-10s for a feature beat. Under 2s reads as a flash.

## 3. Transitions between beats

Pick a transition per boundary, map it to an SFX so audio + motion land together:
- hard cut -> `impact-bass` · whip/slide -> `whoosh` · buildup into a reveal -> `riser` then
  `chime`/`ping` · end/lock -> `chime`. Keep it consistent; too many transition types = noise.

## 4. Typography & palette quick-pick (HyperFrames-specific)

- Name a font only if you can `@font-face { src: local(...) }` it (system fonts) or vendor a
  woff2 locally. Inter is auto-injected. Unknown font name -> `font_family_without_font_face`.
- Keep on-screen contrast >= WCAG AA (the `check` contrast audit flags low contrast).
- Set the root background explicitly in CSS (dark scenes: `background:#0a0a0a` on `html,body`).
  Full-bleed fill goes on a child `position:absolute; inset:0`, not the comp root, when using
  shader transitions or HDR media.

## 5. Approve, then build

Hand the beat-map table to the user, get a nod, then start Step 3 (scaffold) and Step 5
(write composition). The `general-video` skill has a fuller storyboard/validation loop for long
multi-scene pieces; `hyperframes-creative` covers palettes/narration in depth.
