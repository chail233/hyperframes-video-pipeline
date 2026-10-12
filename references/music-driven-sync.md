# Music-driven edits: keeping picture on the beat

For any video whose timeline is a song (music video, lyric video, `music-to-video` workflow),
the edit must be **driven by measurements of the actual shipped audio file**, never by the
original release's timestamps and never by eye.

## The #1 failure: the audio you aligned to isn't the audio you rendered

Symptom: "from act 4 onward the lyrics drift later and later, and it keeps growing."
That is not an easing bug and not an offset bug — **drift that grows with time means the two
timelines have different tempos**, i.e. the LRC / beat map was built against a *different
take* of the song (live edit, radio edit, re-encode, a fan cut with a fade trimmed).

Rules:
- Derive every cue from **the exact file that goes into the render** (`assets/bgm.mp3`), by
  path *and* content hash. Re-derive after the user swaps the track — a swap silently
  invalidates a whole cue sheet.
- Keep the discarded take on disk with a name that says so, and record *why* it was wrong.
  Provenance beats deletion when the user may re-ask "what happened to the old one".
- Never patch drift with a global offset. A constant `+0.37 s` "fix" that fits act 1 will
  mis-fit act 10 and will make the real cause invisible. Fit per-region, and if the per-region
  fits disagree, the track changed — go find the file, not a bigger constant.

## Measuring onsets (what actually works)

Spectral flux / generic "beat tracking" libraries answer a different question than an editor
needs. What you want is **when does the voice start this line**, and it needs to survive a
dense mix:

1. decode the file with librosa at native sr;
2. **band-pass to the vocal range** (roughly 200–4500 Hz) before computing anything;
3. onset envelope over that band;
4. subtract an **adaptive local-median baseline** rather than a global threshold — a song's
   dynamics span 20+ dB, so a global threshold reports nothing in the quiet verses and
   everything in the chorus;
5. snap the surviving peaks to the nearest LRC line start.

Then compare cue-by-cue, picture-second vs audio-second. That table is the only defensible
sync claim.

## Never verify a transcript against itself

If you built the LRC by listening/transcribing with a model, checking "does the video match
the LRC" is **circular** — it can only confirm your own mistake. Sync audits need a
**second, independent** timed-lyrics source; diff the two sources first, and only trust the
cue grid where they agree. Cross-source disagreement is itself the finding.

## Caption reveal: the line must be *finished* before the voice starts

Audiences don't read a caption's first letter and wait — they read the whole line, and a wipe
that is still drawing when the singer starts reads as "the subtitles trail the music" even
though every timestamp is technically correct. At 136 BPM, a 0.33 s median lateness on the
*last* character is a whole beat.

Three rules that came out of measuring the runtime, not the plan:

1. **A line's hide may never land after the next line's show.** Both writes target the same
   element, so an overlap silently blanks the next line for its *entire* window — a missing
   caption, not a flicker.
2. **Reveal must complete at or before the onset.** Budget it: `LEAD` (how early the swap may
   open, ≤0.18 s) minus the wipe duration (≤0.18 s, front-loaded). A 0.45 s wipe guarantees
   every line arrives late.
3. **Opening early is allowed only into silence the previous line left.** Cap the early open by
   the gap to the predecessor's end; sub-editors place the swap slightly ahead of the entry so
   the eye is already on the word.

Then measure the *runtime*, not the source: with the freeze harness (or a headless page that
reports `textContent` per second), record when each line becomes fully readable and diff against
the onset table. The plan's numbers and the emitted timeline's numbers differ — that gap is the
bug you're looking for.

## Padding, duration and the silent tail

The root `data-duration` is usually chosen as a round number (220 s) while the song is not
(211.907 s). Pad the *file* to the declared duration, don't let the renderer pad with silence
of unknown level:

```bash
ffmpeg -i assets/audio.mp3 -af apad -t 220 -c:a libmp3lame -q:a 0 assets/bgm.mp3
```

Then decide what the tail shows. Two useful measurements before choosing:

```bash
# is the tail actually silent, and how silent?
ffmpeg -ss 211.9 -t 8 -i out.mp4 -af volumedetect -f null - 2>&1 | grep -E "mean|max"
```

(`volumedetect`, not `astats` — the astats metadata grep is easy to get wrong and prints
nothing.) A silent tail under a still-moving picture is not a bug per se; it reads as a
mistake when the picture keeps *rhythmically pulsing* into it. Either decay the motion to
match the audio, or give the tail its own (reverse-reverb) bed. **Measure first, then pick** —
the choice is a taste call, the measurement is not.

## Loudness

The renderer auto-lowers track gain to stay under about **−1 dBTP**; a "+6 dB to make the
BGM louder" nudge silently becomes no change because it is being capped. When audio "isn't
getting louder", read the render log for the lowering notice instead of pushing the number
higher, and verify with `volumedetect` on the rendered file.
