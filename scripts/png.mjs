/* png.mjs — minimal PNG decoder for the reference art (8-bit, colour type 0/2/4/6,
   non-interlaced). Node has zlib, so there are no dependencies and no channel-order
   guesswork: decodePNG always returns true RGB bytes.
   decodePNG(path) -> { w, h, rgb: Uint8Array(w*h*3) } */
import fs from "node:fs";
import zlib from "node:zlib";

export function decodePNG(path) {
  const buf = fs.readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png: " + path);
  let p = 8, w = 0, h = 0, depth = 0, ct = 0, inter = 0, plte = null;
  const idat = [];
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      ct = data[9];
      inter = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "PLTE") plte = data;
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8 || inter !== 0) {
    throw new Error(`png.mjs: only 8-bit non-interlaced (depth=${depth} inter=${inter})`);
  }
  if (![0, 2, 3, 4, 6].includes(ct)) throw new Error("png.mjs: unsupported colour type " + ct);
  const ch = ct === 0 ? 1 : ct === 2 ? 3 : ct === 3 ? 1 : ct === 4 ? 2 : 4;

  const body = Buffer.concat(idat);
  // some encoders emit a zlib wrapper (78 xx), others raw deflate — sniff it.
  const raw = body[0] === 0x78 ? zlib.inflateSync(body) : zlib.inflateRawSync(body);
  const stride = w * ch;
  if (raw.length < (stride + 1) * h) throw new Error("png.mjs: truncated pixel data");

  const cur = Buffer.alloc(stride);
  let prev = Buffer.alloc(stride);
  const rgb = new Uint8Array(w * h * 3);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (ft !== 0) throw new Error("png.mjs: bad filter " + ft);
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const i = x * ch;
      let r, g, b;
      if (ct === 3) {
        const q = plte || [0, 0, 0];
        r = q[cur[i] * 3];
        g = q[cur[i] * 3 + 1];
        b = q[cur[i] * 3 + 2];
      } else if (ct === 2 || ct === 6) {
        r = cur[i]; g = cur[i + 1]; b = cur[i + 2];
      } else {
        r = g = b = cur[i];
      }
      rgb[o++] = r; rgb[o++] = g; rgb[o++] = b;
    }
    prev = Buffer.from(cur);
  }
  return { w, h, rgb };
}

export function toPPM(img, path) {
  const head = Buffer.from(`P6\n${img.w} ${img.h}\n255\n`, "ascii");
  fs.writeFileSync(path, Buffer.concat([head, Buffer.from(img.rgb)]));
  return path;
}
