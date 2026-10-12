/* tools/motion-diff.mjs — pixel-level proof that the frame is actually moving:
   decode a pair of PNGs taken 0.1s apart and report the changed-pixel ratio.
   usage: node tools/motion-diff.mjs a.png b.png [c.png d.png ...] */
import { decodePNG } from "./png.mjs";

const args = process.argv.slice(2);
for (let i = 0; i + 1 < args.length; i += 2) {
  const A = decodePNG(args[i]);
  const B = decodePNG(args[i + 1]);
  if (A.w !== B.w || A.h !== B.h) {
    console.log(`${args[i]} vs ${args[i + 1]}: size mismatch ${A.w}x${A.h} / ${B.w}x${B.h}`);
    continue;
  }
  let changed = 0, big = 0, maxd = 0;
  const n = A.w * A.h;
  for (let p = 0; p < n; p++) {
    const o = p * 3;
    const d = Math.abs(A.rgb[o] - B.rgb[o]) + Math.abs(A.rgb[o + 1] - B.rgb[o + 1]) + Math.abs(A.rgb[o + 2] - B.rgb[o + 2]);
    if (d > 12) changed++;
    if (d > 90) big++;
    if (d > maxd) maxd = d;
  }
  const pct = (100 * changed / n).toFixed(2);
  const pctBig = (100 * big / n).toFixed(2);
  console.log(`${args[i].split(/[\\/]/).pop()} -> ${args[i + 1].split(/[\\/]/).pop()}: ${pct}% pixels moved (>=90 delta: ${pctBig}%), max ${maxd}`);
}
