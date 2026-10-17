// Unpass web engine — all PDF/image work happens in the browser. Nothing is uploaded.
// The PDF libraries (pdf-lib ~520KB, pdf.js ~512KB) are loaded LAZILY, only when a PDF
// tool actually runs. Image-only tools (compress/resize/convert) load none of that, so
// they stay very fast.

const PDFJS_OPTS = {
  cMapUrl: new URL('../lib/pdfjs/cmaps/', import.meta.url).href,
  cMapPacked: true,
  standardFontDataUrl: new URL('../lib/pdfjs/standard_fonts/', import.meta.url).href,
  wasmUrl: new URL('../lib/pdfjs/wasm/', import.meta.url).href,
};

let _pdflib = null, _pdfjs = null;
async function pdflib() {
  if (!_pdflib) _pdflib = await import('../lib/pdf-lib.mjs');
  return _pdflib;
}
async function getPdfjs() {
  if (!_pdfjs) {
    _pdfjs = await import('../lib/pdf.mjs');
    _pdfjs.GlobalWorkerOptions.workerSrc = new URL('../lib/pdf.worker.mjs', import.meta.url).href;
  }
  return _pdfjs;
}

export class ToolError extends Error {
  constructor(code, msg) { super(msg || code); this.code = code; }
}

// ---------------------------------------------------------------- small helpers
export const readBytes = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(new Uint8Array(r.result));
  r.onerror = () => rej(new ToolError('READ', 'Could not read the file.'));
  r.readAsArrayBuffer(file);
});

export const fmtSize = (b) => {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
};

export const download = (bytes, name, type = 'application/pdf') => {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export const stem = (name) => name.replace(/\.[^.]+$/, '');

// Parse "1-3, 5, 8-10" against a page count → 0-based unique index list in order.
export function parsePages(spec, total) {
  const out = [];
  const seen = new Set();
  for (const raw of spec.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = +m[1], b = +m[2];
      if (a < 1 || b < 1 || a > total || b > total) throw new ToolError('BAD_PAGES', part);
      const step = a <= b ? 1 : -1;
      for (let p = a; step > 0 ? p <= b : p >= b; p += step) if (!seen.has(p)) { seen.add(p); out.push(p - 1); }
    } else if (/^\d+$/.test(part)) {
      const p = +part;
      if (p < 1 || p > total) throw new ToolError('BAD_PAGES', part);
      if (!seen.has(p)) { seen.add(p); out.push(p - 1); }
    } else {
      throw new ToolError('BAD_PAGES', part);
    }
  }
  if (!out.length) throw new ToolError('BAD_PAGES', spec);
  return out;
}

// ---------------------------------------------------------------- pdf-lib / pdf.js helpers
async function loadDoc(bytes) {
  const { PDFDocument } = await pdflib();
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (e) {
    if (String(e && e.message).toLowerCase().includes('encrypt'))
      throw new ToolError('PDF_LOCKED', 'This PDF is password protected. Unlock it first.');
    throw new ToolError('INVALID_PDF', 'This file is not a valid PDF or it is damaged.');
  }
}

async function closePdfjs(doc) {
  try { if (doc && doc.loadingTask) await doc.loadingTask.destroy(); else if (doc && doc.cleanup) await doc.cleanup(); } catch { /* ignore */ }
}

async function openPdfjs(bytes, password) {
  const pdfjsLib = await getPdfjs();
  try {
    return await pdfjsLib.getDocument({ data: bytes, password, ...PDFJS_OPTS }).promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') {
      // code 1 = need password, 2 = wrong password
      throw new ToolError(e.code === 2 ? 'WRONG_PASSWORD' : 'NEED_PASSWORD', 'Password needed.');
    }
    throw new ToolError('INVALID_PDF', 'This file is not a valid PDF or it is damaged.');
  }
}

// Render one pdf.js page to a canvas at the given CSS-pixel scale.
async function renderPage(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
  return canvas;
}

const canvasJpeg = (canvas, quality) => new Promise((res) =>
  canvas.toBlob((b) => b.arrayBuffer().then((ab) => res(new Uint8Array(ab))), 'image/jpeg', quality));

// ---------------------------------------------------------------- PUBLIC TOOLS

// Detect whether a PDF needs a password. Returns 'locked' | 'ok'.
export async function probe(bytes) {
  const pdfjsLib = await getPdfjs();
  try {
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(), ...PDFJS_OPTS }).promise;
    await closePdfjs(doc);
    return 'ok';
  } catch (e) {
    if (e && e.name === 'PasswordException') return 'locked';
    throw new ToolError('INVALID_PDF', 'This file is not a valid PDF or it is damaged.');
  }
}

// UNLOCK: open with password, rebuild a clean PDF (one rasterized page each, high quality).
export async function unlock(bytes, password, { dpi = 150, onProgress } = {}) {
  const { PDFDocument } = await pdflib();
  const src = await openPdfjs(bytes, password);
  const scale = dpi / 72;
  const out = await PDFDocument.create();
  for (let i = 1; i <= src.numPages; i++) {
    const page = await src.getPage(i);
    const canvas = await renderPage(page, scale);
    const jpg = await canvasJpeg(canvas, 0.92);
    const img = await out.embedJpg(jpg);
    const p = out.addPage([canvas.width * 72 / dpi, canvas.height * 72 / dpi]);
    p.drawImage(img, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
    if (onProgress) onProgress(i, src.numPages);
  }
  await closePdfjs(src);
  return out.save();
}

// MERGE: combine PDFs in order. Any locked file throws PDF_LOCKED.
export async function merge(files, { onProgress } = {}) {
  if (files.length < 2) throw new ToolError('NEED_MORE', 'Add at least 2 PDFs.');
  const { PDFDocument } = await pdflib();
  const out = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const doc = await loadDoc(files[i]);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    if (onProgress) onProgress(i + 1, files.length);
  }
  return out.save();
}

// SPLIT: keep only the given pages (spec string) in order.
export async function split(bytes, spec) {
  const { PDFDocument } = await pdflib();
  const doc = await loadDoc(bytes);
  const idx = parsePages(spec, doc.getPageCount());
  const out = await PDFDocument.create();
  const pages = await out.copyPages(doc, idx);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

// ROTATE every page by 90/180/270.
export async function rotate(bytes, deg) {
  const { degrees } = await pdflib();
  const doc = await loadDoc(bytes);
  doc.getPages().forEach((p) => { p.setRotation(degrees(((p.getRotation().angle + deg) % 360 + 360) % 360)); });
  return doc.save();
}

// PAGE NUMBERS: add "1", "1 / N" or "Page 1 of N" at a chosen position.
export async function pageNumbers(bytes, { position = 'bottom-center', style = 'n', start = 1 } = {}) {
  const { StandardFonts, rgb } = await pdflib();
  const doc = await loadDoc(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const size = 11, margin = 24;
  pages.forEach((p, i) => {
    const n = start + i;
    const label = style === 'n_of' ? `${n} / ${total}` : style === 'page_n_of' ? `Page ${n} of ${total}` : `${n}`;
    const w = font.widthOfTextAtSize(label, size);
    const pw = p.getWidth();
    let x = (pw - w) / 2;
    if (position.endsWith('right')) x = pw - w - margin;
    else if (position.endsWith('left')) x = margin;
    const y = position.startsWith('top') ? p.getHeight() - margin - size : margin;
    p.drawText(label, { x, y, size, font, color: rgb(0.25, 0.25, 0.25) });
  });
  return doc.save();
}

// WATERMARK: draw a diagonal text across every page.
export async function watermark(bytes, { text = 'CONFIDENTIAL', opacity = 0.2, size = 48 } = {}) {
  if (!text.trim()) throw new ToolError('NEED_TEXT', 'Type the watermark text.');
  const { StandardFonts, rgb, degrees } = await pdflib();
  const doc = await loadDoc(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((p) => {
    const { width, height } = p.getSize();
    const tw = font.widthOfTextAtSize(text, size);
    p.drawText(text, {
      x: width / 2 - tw / 2 * Math.cos(Math.PI / 4) - size / 2,
      y: height / 2 - tw / 2 * Math.sin(Math.PI / 4),
      size, font, color: rgb(0.5, 0.5, 0.55),
      rotate: degrees(45), opacity,
    });
  });
  return doc.save();
}

// COMPRESS: rasterize each page to JPEG at a quality level, rebuild. Returns {bytes, before, after}.
export async function compress(bytes, { quality = 0.6, dpi = 120, onProgress } = {}) {
  const { PDFDocument } = await pdflib();
  const src = await openPdfjs(bytes.slice());
  const scale = dpi / 72;
  const out = await PDFDocument.create();
  for (let i = 1; i <= src.numPages; i++) {
    const page = await src.getPage(i);
    const canvas = await renderPage(page, scale);
    const jpg = await canvasJpeg(canvas, quality);
    const img = await out.embedJpg(jpg);
    const p = out.addPage([canvas.width * 72 / dpi, canvas.height * 72 / dpi]);
    p.drawImage(img, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
    if (onProgress) onProgress(i, src.numPages);
  }
  await closePdfjs(src);
  const result = await out.save();
  // If rasterizing didn't actually shrink the file (common for text-only PDFs),
  // keep the original so the user never gets a bigger file.
  if (result.length >= bytes.length) return { bytes, before: bytes.length, after: bytes.length, unchanged: true };
  return { bytes: result, before: bytes.length, after: result.length };
}

// IMAGES → PDF. mode 'a4' fits each image on an A4 page (portrait), 'fit' makes the page the image size.
export async function imagesToPdf(imageFiles, { mode = 'a4', onProgress } = {}) {
  const { PDFDocument } = await pdflib();
  const out = await PDFDocument.create();
  const A4 = [595.28, 841.89];
  for (let i = 0; i < imageFiles.length; i++) {
    const f = imageFiles[i];
    const bytes = f.bytes;
    let img;
    if (f.type === 'image/png') img = await out.embedPng(bytes);
    else img = await out.embedJpg(bytes);
    if (mode === 'fit') {
      const p = out.addPage([img.width, img.height]);
      p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    } else {
      const p = out.addPage(A4);
      const m = 20;
      const maxW = A4[0] - m * 2, maxH = A4[1] - m * 2;
      const s = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * s, h = img.height * s;
      p.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
    }
    if (onProgress) onProgress(i + 1, imageFiles.length);
  }
  return out.save();
}

// PDF → images. Returns array of {name, blob, width, height}.
export async function pdfToImages(bytes, { dpi = 150, format = 'jpeg', base = 'page', onProgress } = {}) {
  const src = await openPdfjs(bytes.slice());
  const scale = dpi / 72;
  const type = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? 'png' : 'jpg';
  const results = [];
  for (let i = 1; i <= src.numPages; i++) {
    const page = await src.getPage(i);
    const canvas = await renderPage(page, scale);
    const blob = await new Promise((res) => canvas.toBlob(res, type, 0.92));
    results.push({ name: `${base}_${String(i).padStart(2, '0')}.${ext}`, blob, width: canvas.width, height: canvas.height });
    if (onProgress) onProgress(i, src.numPages);
  }
  await closePdfjs(src);
  return results;
}

// COMPRESS one image to <= maxKB (optional >= minKB) with optional exact resize (center-crop). Returns {blob, width, height}.
export async function processImage(file, { width = 0, height = 0, maxKB = 0, minKB = 0 } = {}) {
  const bmp = await createImageBitmap(file);
  let tw = bmp.width, th = bmp.height, sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (width > 0 && height > 0) {
    tw = width; th = height;
    const scale = Math.max(width / bmp.width, height / bmp.height);
    sw = width / scale; sh = height / scale;
    sx = (bmp.width - sw) / 2; sy = (bmp.height - sh) / 2;
  }
  const canvas = document.createElement('canvas');
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, tw, th);
  bmp.close && bmp.close();

  const toBlob = (q) => new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
  if (!maxKB) {
    const blob = await toBlob(0.9);
    return { blob, width: tw, height: th };
  }
  let lo = 0.05, hi = 0.95, best = await toBlob(hi);
  if (best.size <= maxKB * 1024) {
    return { blob: best, width: tw, height: th };
  }
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    const blob = await toBlob(mid);
    if (blob.size > maxKB * 1024) { hi = mid; }
    else { best = blob; lo = mid; }
  }
  best = await toBlob(lo);
  if (best.size > maxKB * 1024) best = await toBlob(0.05);
  return { blob: best, width: tw, height: th };
}

// CONVERT one image to JPG / PNG / WebP. Returns {blob, width, height, format}.
export async function convertImage(file, { format = 'jpeg', quality = 0.92 } = {}) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new ToolError('BAD_IMAGE', 'This image could not be read. Try a JPG, PNG or WebP.'); }
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (format === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); } // flatten transparency
  ctx.drawImage(bmp, 0, 0);
  bmp.close && bmp.close();
  const type = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise((res) => canvas.toBlob(res, type, quality));
  if (!blob) throw new ToolError('BAD_IMAGE', 'Could not convert this image.');
  return { blob, width: canvas.width, height: canvas.height, format };
}

export const friendly = (code) => ({
  WRONG_PASSWORD: 'Wrong password. Please check and try again.',
  NEED_PASSWORD: 'This PDF needs a password. Type it above.',
  PDF_LOCKED: 'This PDF is password protected. Unlock it first with the Unlock tool.',
  INVALID_PDF: 'This file is not a valid PDF or it is damaged.',
  NEED_MORE: 'Please add at least 2 PDF files.',
  BAD_PAGES: 'Please check the page numbers. Example: 1-3, 5, 8',
  BAD_IMAGE: 'This image is not supported. Try a JPG or PNG.',
  NEED_TEXT: 'Please type the text first.',
  READ: 'Could not read the file. Please try again.',
}[code] || 'Something went wrong. Please try another file.');
