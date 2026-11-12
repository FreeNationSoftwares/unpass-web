// Sign PDF: draw / upload a signature, drag it onto a page, download the signed PDF.
// Everything runs in the browser — the PDF and the signature are never uploaded.
import * as E from './engine.mjs';

const $ = (s, r = document) => r.querySelector(s);

export function initSign() {
  const root = $('#tool');
  const drop = $('.drop', root), input = $('#pdfin', root);
  const errBox = $('.err', root), resultBox = $('.result', root);
  const work = $('#signwork', root), runBtn = $('#signrun', root);
  const st = { file: null, bytes: null, prev: null, page: 1, count: 1, png: null, aspect: 0.4,
    box: { x: 0.55, y: 0.78, w: 0.3 } };

  const showErr = (m) => { errBox.textContent = m; errBox.classList.add('show'); };
  const clearErr = () => errBox.classList.remove('show');

  // ------------------------------------------------ PDF in
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('hover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('hover'); if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if (input.files[0]) load(input.files[0]); input.value = ''; });

  async function load(f) {
    clearErr(); resultBox.style.display = 'none';
    if (!/\.pdf$/i.test(f.name)) { showErr('Please choose a PDF file.'); return; }
    try {
      const bytes = await E.readBytes(f);
      if (await E.probe(bytes) === 'locked') { showErr(E.friendly('PDF_LOCKED')); return; }
      if (st.prev) st.prev.close();
      st.file = f; st.bytes = bytes; st.prev = await E.openPreview(bytes);
      st.count = st.prev.count; st.page = 1;
      $('b', drop).textContent = f.name;
      $('small', drop).textContent = `${E.fmtSize(f.size)} · ${st.count} page${st.count > 1 ? 's' : ''} · tap to change`;
      drop.classList.add('filled');
      work.style.display = 'block';
      $('#allwrap').style.display = st.count > 1 ? 'flex' : 'none';
      await showPage();
    } catch (e) {
      showErr(e instanceof E.ToolError ? E.friendly(e.code) : 'Could not open this PDF.');
    }
  }

  // ------------------------------------------------ page preview + placement
  const stage = $('#stage'), sig = $('#sigimg');
  async function showPage() {
    $('#pginfo').textContent = `Page ${st.page} of ${st.count}`;
    $('#pgprev').disabled = st.page <= 1; $('#pgnext').disabled = st.page >= st.count;
    const canvas = await st.prev.render(st.page, Math.min(stage.parentElement.clientWidth || 600, 700));
    stage.querySelectorAll('canvas').forEach((c) => c.remove());
    stage.prepend(canvas);
    place();
  }
  $('#pgprev').onclick = () => { if (st.page > 1) { st.page--; showPage(); } };
  $('#pgnext').onclick = () => { if (st.page < st.count) { st.page++; showPage(); } };

  function hFrac() { // signature height as a fraction of the page height
    const r = stage.clientWidth / (stage.clientHeight || 1);
    return st.box.w * st.aspect * r;
  }
  function place() {
    if (!st.png) { sig.style.display = 'none'; runBtn.disabled = true; return; }
    const h = hFrac();
    st.box.x = Math.min(Math.max(0, st.box.x), 1 - st.box.w);
    st.box.y = Math.min(Math.max(0, st.box.y), Math.max(0, 1 - h));
    Object.assign(sig.style, { display: 'block', left: st.box.x * 100 + '%', top: st.box.y * 100 + '%', width: st.box.w * 100 + '%' });
    runBtn.disabled = false;
  }
  $('#sigsize').addEventListener('input', (e) => { st.box.w = +e.target.value / 100; place(); });

  let drag = null;
  sig.addEventListener('pointerdown', (e) => {
    e.preventDefault(); sig.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, bx: st.box.x, by: st.box.y };
  });
  sig.addEventListener('pointermove', (e) => {
    if (!drag) return;
    st.box.x = drag.bx + (e.clientX - drag.x) / stage.clientWidth;
    st.box.y = drag.by + (e.clientY - drag.y) / stage.clientHeight;
    place();
  });
  const endDrag = () => { drag = null; };
  sig.addEventListener('pointerup', endDrag); sig.addEventListener('pointercancel', endDrag);
  // tap on the page = move signature there
  stage.addEventListener('click', (e) => {
    if (!st.png || e.target === sig) return;
    const r = stage.getBoundingClientRect();
    st.box.x = (e.clientX - r.left) / r.width - st.box.w / 2;
    st.box.y = (e.clientY - r.top) / r.height - hFrac() / 2;
    place();
  });

  // ------------------------------------------------ signature: draw
  const pad = $('#pad'), pctx = pad.getContext('2d');
  let color = '#111111', drawing = false, inked = false, last = null;
  function sizePad() {
    const w = pad.clientWidth || 600, ratio = Math.min(2, window.devicePixelRatio || 1);
    pad.width = w * ratio; pad.height = (w * 0.36) * ratio;
    pctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    pctx.lineCap = 'round'; pctx.lineJoin = 'round'; inked = false;
  }
  const pt = (e) => { const r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); pad.setPointerCapture(e.pointerId); drawing = true; last = pt(e); });
  pad.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pt(e);
    pctx.strokeStyle = color; pctx.lineWidth = 2.6;
    pctx.beginPath(); pctx.moveTo(last.x, last.y); pctx.lineTo(p.x, p.y); pctx.stroke();
    last = p; inked = true;
  });
  const endStroke = () => { if (drawing) { drawing = false; if (inked) useCanvas(pad); } };
  pad.addEventListener('pointerup', endStroke); pad.addEventListener('pointercancel', endStroke);
  $('#padclear').onclick = () => { pctx.clearRect(0, 0, pad.width, pad.height); inked = false; st.png = null; sig.removeAttribute('src'); place(); };
  root.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('.swatch').forEach((x) => x.classList.remove('sel'));
    b.classList.add('sel'); color = b.dataset.c;
  }));

  // ------------------------------------------------ signature: upload
  $('#sigfile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      const scale = Math.min(1, 1200 / bmp.width);
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      const cx = c.getContext('2d'); cx.drawImage(bmp, 0, 0, c.width, c.height);
      if ($('#rmbg').checked) {
        const d = cx.getImageData(0, 0, c.width, c.height), a = d.data;
        for (let i = 0; i < a.length; i += 4) {
          const l = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
          if (l > 190) a[i + 3] = 0; else if (l > 140) a[i + 3] = Math.round(a[i + 3] * (190 - l) / 50);
        }
        cx.putImageData(d, 0, 0);
      }
      useCanvas(c);
    } catch { showErr('Could not read that image. Try a JPG or PNG.'); }
  });

  // tabs
  root.querySelectorAll('.stab').forEach((t) => t.addEventListener('click', () => {
    root.querySelectorAll('.stab').forEach((x) => x.classList.toggle('sel', x === t));
    $('#drawpane').style.display = t.dataset.t === 'draw' ? 'block' : 'none';
    $('#uppane').style.display = t.dataset.t === 'up' ? 'block' : 'none';
  }));

  // crop to the ink and turn into PNG bytes
  function useCanvas(src) {
    const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 20) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return;
    const pad2 = 6; x0 = Math.max(0, x0 - pad2); y0 = Math.max(0, y0 - pad2);
    x1 = Math.min(w - 1, x1 + pad2); y1 = Math.min(h - 1, y1 + pad2);
    const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
    c.getContext('2d').drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    st.aspect = c.height / c.width;
    c.toBlob(async (b) => {
      st.png = new Uint8Array(await b.arrayBuffer());
      sig.src = URL.createObjectURL(b);
      place();
    }, 'image/png');
  }

  // ------------------------------------------------ run
  runBtn.dataset.label = runBtn.innerHTML;
  runBtn.addEventListener('click', async () => {
    clearErr();
    if (!st.png) { showErr(E.friendly('NO_SIGNATURE')); return; }
    runBtn.disabled = true; runBtn.innerHTML = '<span class="spin"></span>Signing…';
    try {
      const pages = $('#allpages').checked ? Array.from({ length: st.count }, (_, i) => i) : [st.page - 1];
      const out = await E.signPdf(st.bytes, st.png, pages, { ...st.box, aspect: st.aspect });
      const name = E.stem(st.file.name) + '_signed.pdf';
      resultBox.innerHTML = `<div class="rc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div><h3>PDF signed!</h3><div class="meta">${pages.length > 1 ? pages.length + ' pages' : 'Page ' + st.page} · ${E.fmtSize(out.length)}</div><div class="btnrow"><button class="btn">Download PDF</button></div>`;
      resultBox.querySelector('button').onclick = () => E.download(out, name);
      resultBox.style.display = 'block';
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      showErr(e instanceof E.ToolError ? E.friendly(e.code) : 'Something went wrong. Please try another file.');
    }
    runBtn.disabled = false; runBtn.innerHTML = runBtn.dataset.label;
  });

  sizePad();
  window.addEventListener('resize', () => { if (!inked) sizePad(); });
}
