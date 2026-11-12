// Password-protect a PDF in the browser: standard security handler, AES-128 (V4/R4, AESV2).
// pdf-lib can't encrypt, so this encrypts every string and stream itself, then adds
// the /Encrypt dictionary. Opens in every normal PDF reader (Chrome, Adobe, phones).

const PAD = new Uint8Array([0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56,
  0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe,
  0x64, 0x53, 0x69, 0x7a]);

// ---------------------------------------------------------------- MD5
const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20,
  5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15,
  21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
export function md5(data) {
  const len = data.length, nBlk = ((len + 8) >> 6) + 1;
  const m = new Uint8Array(nBlk * 64); m.set(data); m[len] = 0x80;
  const bits = len * 8, dv = new DataView(m.buffer);
  dv.setUint32(m.length - 8, bits >>> 0, true); dv.setUint32(m.length - 4, Math.floor(bits / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < m.length; o += 64) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + dv.getUint32(o + g * 4, true)) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16), odv = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((v, i) => odv.setUint32(i * 4, v, true));
  return out;
}

// ---------------------------------------------------------------- RC4 (only for the O/U keys)
function rc4(key, data) {
  const s = new Uint8Array(256); for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; [s[i], s[j]] = [s[j], s[i]]; }
  const out = new Uint8Array(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255; j = (j + s[i]) & 255; [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

const cat = (...arrs) => { const o = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0)); let p = 0; for (const a of arrs) { o.set(a, p); p += a.length; } return o; };
const padPw = (pw) => { const b = new TextEncoder().encode(pw).slice(0, 32); return cat(b, PAD.slice(0, 32 - b.length)); };
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function ownerValue(ownerPw, userPw) {           // Algorithm 3 (R4)
  let h = md5(padPw(ownerPw));
  for (let i = 0; i < 50; i++) h = md5(h);
  const key = h.slice(0, 16);
  let o = rc4(key, padPw(userPw));
  for (let i = 1; i <= 19; i++) o = rc4(key.map((b) => b ^ i), o);
  return o;
}
function fileKey(userPw, O, P, id0) {           // Algorithm 2
  const p = new Uint8Array(4); new DataView(p.buffer).setInt32(0, P, true);
  let h = md5(cat(padPw(userPw), O, p, id0));
  for (let i = 0; i < 50; i++) h = md5(h.slice(0, 16));
  return h.slice(0, 16);
}
function userValue(key, id0) {                  // Algorithm 5
  let u = rc4(key, md5(cat(PAD, id0)));
  for (let i = 1; i <= 19; i++) u = rc4(key.map((b) => b ^ i), u);
  return cat(u, new Uint8Array(16));
}

export async function encryptPdf(doc, lib, userPw, ownerPw) {
  const { PDFName, PDFNumber, PDFHexString, PDFString, PDFArray, PDFDict, PDFRawStream, PDFStream } = lib;
  const ctx = doc.context;
  const P = -4; // every permission allowed: the password only protects opening
  const id0 = crypto.getRandomValues(new Uint8Array(16));
  const O = ownerValue(ownerPw || userPw, userPw);
  const key = fileKey(userPw, O, P, id0);
  const U = userValue(key, id0);

  const keyCache = new Map();
  async function objKey(ref) {
    const k = ref.objectNumber + ':' + ref.generationNumber;
    if (!keyCache.has(k)) {
      const n = ref.objectNumber, g = ref.generationNumber;
      const raw = md5(cat(key, new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, g & 255, (g >> 8) & 255]),
        new Uint8Array([0x73, 0x41, 0x6c, 0x54])));
      keyCache.set(k, await crypto.subtle.importKey('raw', raw.slice(0, 16), 'AES-CBC', false, ['encrypt']));
    }
    return keyCache.get(k);
  }
  async function aes(ref, data) {
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, await objKey(ref), data));
    return cat(iv, ct);
  }
  async function walk(obj, ref) {               // returns a replacement or the same object
    if (obj instanceof PDFString || obj instanceof PDFHexString) return PDFHexString.of(hex(await aes(ref, obj.asBytes())));
    if (obj instanceof PDFArray) {
      for (let i = 0; i < obj.size(); i++) obj.set(i, await walk(obj.get(i), ref));
      return obj;
    }
    if (obj instanceof PDFDict) {
      for (const [k, v] of obj.entries()) obj.set(k, await walk(v, ref));
      return obj;
    }
    return obj;
  }

  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFStream) {
      const type = obj.dict.get(PDFName.of('Type'));
      if (type === PDFName.of('XRef')) continue;
      await walk(obj.dict, ref);
      const contents = obj instanceof PDFRawStream ? obj.contents : obj.getContents();
      const enc = await aes(ref, contents);
      const dict = obj.dict;
      dict.set(PDFName.of('Length'), PDFNumber.of(enc.length));
      ctx.assign(ref, PDFRawStream.of(dict, enc));
    } else {
      const out = await walk(obj, ref);
      if (out !== obj) ctx.assign(ref, out);
    }
  }

  const stdCF = ctx.obj({ AuthEvent: 'DocOpen', CFM: 'AESV2', Length: 16 });
  const encDict = ctx.obj({
    Filter: 'Standard', V: 4, R: 4, Length: 128, P,
    CF: ctx.obj({ StdCF: stdCF }), StmF: 'StdCF', StrF: 'StdCF',
  });
  encDict.set(PDFName.of('O'), PDFHexString.of(hex(O)));
  encDict.set(PDFName.of('U'), PDFHexString.of(hex(U)));
  ctx.trailerInfo.Encrypt = ctx.register(encDict);
  const idHex = PDFHexString.of(hex(id0));
  ctx.trailerInfo.ID = ctx.obj([idHex, idHex]);
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
}
