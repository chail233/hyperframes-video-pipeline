# Audio: local BGM / SFX with no network

Two valid sources — pick per sound, mix freely. All resolved files go in
`projects/<proj>/assets/` and are referenced by relative path. **Every `<audio>` element MUST
have a unique `id`** or the render comes out silent (see pipeline Step 5). FFmpeg must resolve on
`PATH` (`export PATH="$PATH:<FFMPEG_BIN>"` — on Windows/winget it is often installed but missing
from PATH).

## Option A — shipped SFX (fastest, no synthesis)

`media-use` bundles ready sounds. Copy the ones you need into the project and reference locally:
```bash
SFX="<SKILL_DIR>/../media-use/audio/assets/sfx"   # if media-use is installed
 cp "$SFX"/whoosh.mp3   projects/<proj>/assets/whoosh.mp3
cp "$SFX"/riser.mp3    projects/<proj>/assets/riser.mp3
cp "$SFX"/impact-bass-1.mp3 projects/<proj>/assets/impact.mp3
cp "$SFX"/chime.mp3    projects/<proj>/assets/chime.mp3
```
Menu: `whoosh`, `whoosh-short`, `whoosh-cinematic` (transitions) · `riser` (buildup) ·
`impact-bass-1/2` (hits) · `chime` `ping` `pop` `notification` (blips/reveals) · `click`
`click-soft` `key-press` `typing` · `glitch-1/2/3` · `error` · `sparkle`. Full list + credits
in that `sfx/` dir (`manifest.json`). Use `media-use` `resolve` to adopt them into the project
manifest if you want ledger tracking.

## Option B — deterministic FFmpeg synthesis (pure-FFmpeg fallback, no external files)

Run from inside `projects/<proj>/assets/`. Produces `bgm.wav whoosh.wav riser.wav blip.wav`.

**whoosh** — swept filtered noise (transition):
```bash
ffmpeg -y -f lavfi -i "anoisesrc=color=pink:duration=0.7:amplitude=0.6" \
  -af "afade=t=in:st=0:d=0.15,afade=t=out:st=0.45:d=0.25,\
highpass=f=300,volume=0.8" whoosh.wav
```

**riser** — noise ramp into a peak (buildup before a reveal):
```bash
ffmpeg -y -f lavfi -i "anoisesrc=color=white:duration=1.6:amplitude=0.5" \
  -af "afade=t=in:st=0:d=1.4:curve=exp,afade=t=out:st=1.45:d=0.15,\
lowpass=f=1000:width_type=h" riser.wav
```

**blip** — short sine hit (reveal / tick), ~0.12s:
```bash
ffmpeg -y -f lavfi -i "sine=frequency=880:duration=0.12" \
  -af "afade=t=in:st=0:d=0.01,afade=t=out:st=0.05:d=0.07,volume=0.6" blip.wav
```

**bgm** — soft chord pad (deterministic, loopable). Mix three sine notes into an ambient bed:
```bash
ffmpeg -y \
  -f lavfi -i "sine=frequency=110:duration=8" \
  -f lavfi -i "sine=frequency=164.81:duration=8" \
  -f lavfi -i "sine=frequency=220:duration=8" \
  -filter_complex "[0][1][2]amix=inputs=3:normalize=0,volume=0.25,atremolo=f=0.2:d=0.4,\
aloop=loop=-1:size=2e9" -t 60 bgm.wav
```
(`aloop` + `-t 60` stretches the 8s pad to 60s without re-randomizing — deterministic.)
Swap the three frequencies for the mood: minor pad ~ `110 / 130.81 / 164.81`; brighter ~
`130.81 / 196 / 261.63`.

## Wiring audio into the composition

```html
<audio id="bgm"   class="clip" data-start="0" data-duration="60" data-volume="0.35"
       src="assets/bgm.wav"></audio>
<audio id="whoosh1" data-start="4" src="assets/whoosh.wav"></audio>
<audio id="riser1"  data-start="10.5" src="assets/riser.wav"></audio>
<audio id="blip1"   data-start="12" src="assets/blip.wav"></audio>
```
- `id` on every one (silence rule). `data-volume` for the bed vs hits balance (bgm low ~0.3, SFX ~0.8).
- SFX clips with only `data-start` inherit source duration — fine. Keep the bed's `data-duration`
  <= root `data-duration`.
- No `crossorigin` attribute anywhere on media (lint errors `media_crossorigin_breaks_preview`).

## Optional voiceover
Local: `npx --yes hyperframes tts "<line>"` (Kokoro, offline). HeyGen/ElevenLabs/Gemini voices
need their connector authorized first — if it's unavailable, don't block a render on it.

## Verify audio actually landed
After render:
```bash
ffprobe -hide_banner projects/<proj>/out.mp4 2>&1 | grep -i "Audio"
```
No `Audio:` stream line => the mix was silent (usually the missing-`id` bug). Fix and re-render.
