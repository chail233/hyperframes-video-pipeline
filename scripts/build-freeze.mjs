/* build-freeze.mjs — emit <project>/.verify/freeze-<id>.html: a frame's own markup +
   script, unwrapped from its <template>, with the locally vendored GSAP inlined and the
   timeline seeked to ?t=. Studio thumbnails and `hyperframes snapshot` can freeze
   sub-compositions at t=0, so this is the only way to get real pixels at an exact second
   — and the only honest motion test: shoot t and t+0.1, then diff (motion-diff.mjs).
   usage: node build-freeze.mjs --project <dir> --id <frame-id> [--out <dir>] */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
}
const PROJECT = resolve(flag("project", "."));
const id = flag("id", argv[0]);
const OUT = resolve(flag("out", join(PROJECT, ".verify")));
if (!PROJECT || !id) {
  console.error("usage: node build-freeze.mjs --project <dir> --id <frame-id>");
  process.exit(1);
}

const framesDir = existsSync(join(PROJECT, "compositions", "frames"))
  ? join(PROJECT, "compositions", "frames")
  : PROJECT;
const src = readFileSync(join(framesDir, `${id}.html`), "utf8");

/* a frame authored as a sub-composition keeps its markup in <template>; a standalone
   document is used as-is, minus its own <html>/<head> shell. */
const open = src.indexOf("<template>");
const close = src.lastIndexOf("</template>");
let inner;
if (open >= 0 && close > open) {
  inner = src.slice(open + "<template>".length, close);
} else {
  const body = src.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!body) {
    console.error(`${id}: neither a <template> block nor a <body> was found`);
    process.exit(1);
  }
  inner = body[1]
    .replace(/<script[^>]*src=[^>]*><\/script>/gi, "")
    .replace(/<\/?div[^>]*class="[^"]*\bclip\b[^"]*"[^>]*>/gi, "");
}
/* the page lives one directory deeper than the project root, so re-point local refs */
inner = inner
  .replace(/\b(src|href)="\.?\/?assets\//g, '$1="../assets/')
  .replace(/url\((['"]?)\.?\/?assets\//g, "url($1../assets/");

const vendorDir = join(PROJECT, "assets", "vendor");
const vendor = existsSync(vendorDir)
  ? readdirSync(vendorDir)
      .filter((f) => /\.m?js$/i.test(f))
      .sort((a, b) => (a.includes("gsap") ? -1 : 1) - (b.includes("gsap") ? -1 : 1))
      .map((f) => `    <script src="../assets/vendor/${f}"></script>`)
  : [];

const out = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style> html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; } </style>
${vendor.join("\n")}
    <script>
      /* register every GSAP plugin the vendored files hung on window */
      if (window.gsap) Object.keys(window)
        .filter((k) => /Plugin$/.test(k) && window[k] && window[k].init)
        .forEach((k) => gsap.registerPlugin(window[k]));
    </script>
  </head>
  <body>
${inner}
    <script>
      (function () {
        var T = parseFloat(new URLSearchParams(location.search).get("t") || "0");
        var tl = window.__timelines && window.__timelines["${id}"];
        if (!tl) { document.title = "NO TIMELINE"; return; }
        tl.pause();
        tl.seek(T);
        document.title = "frozen " + T;
      })();
    </script>
  </body>
</html>
`;

mkdirSync(OUT, { recursive: true });
const path = join(OUT, `freeze-${id}.html`);
writeFileSync(path, out);
console.log(path);
