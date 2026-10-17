// Per-tool UI controller. Each tool page calls initTool('<id>').
import * as E from './engine.mjs';

const $ = (s, r = document) => r.querySelector(s);
const el = (t, cls, html) => { const e = document.createElement(t); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const ICON = {
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
};

// Which tools take images vs PDFs, single vs multiple
const CONF = {
  unlock:   { accept: '.pdf', multi: false, kind: 'pdf' },
  merge:    { accept: '.pdf', multi: true, kind: 'pdf' },
  split:    { accept: '.pdf', multi: false, kind: 'pdf' },
  compress: { accept: '.pdf', multi: false, kind: 'pdf' },
  img2pdf:  { accept: 'image/*', multi: true, kind: 'img' },
  pdf2img:  { accept: '.pdf', multi: false, kind: 'pdf' },
  rotate:   { accept: '.pdf', multi: false, kind: 'pdf' },
  pagenum:  { accept: '.pdf', multi: false, kind: 'pdf' },
  watermark:{ accept: '.pdf', multi: false, kind: 'pdf' },
  imgcomp:  { accept: 'image/*', multi: false, kind: 'img' },
  resize:   { accept: 'image/*', multi: false, kind: 'img' },
};

export function initTool(id) {
  const conf = CONF[id];
  const root = $('#tool');
  if (!root || !conf) return;

  const state = { files: [] }; // each: {file, name, size, bytes?, type?}
  const drop = $('.drop', root);
  const input = $('input[type=file]', root);
  const list = el('ul', 'files');
  drop.after(list);
  const errBox = $('.err', root) || (() => { const e = el('div', 'err'); root.querySelector('.runwrap').before(e); return e; })();
  const runBtn = $('.btn.run', root);
  const resultBox = $('.result', root);

  input.accept = conf.accept;
  input.multiple = conf.multi;

  const showErr = (msg) => { errBox.textContent = msg; errBox.classList.add('show'); };
  const clearErr = () => errBox.classList.remove('show');

  // dropzone events
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('hover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('hover'); addFiles(e.dataTransfer.files); });
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });

  async function addFiles(fileList) {
    clearErr();
    resultBox.style.display = 'none';
    const arr = Array.from(fileList);
    for (const f of arr) {
      if (conf.kind === 'pdf' && !/\.pdf$/i.test(f.name)) { showErr('Please choose a PDF file.'); continue; }
      if (conf.kind === 'img' && !/^image\//.test(f.type) && !/\.(jpe?g|png)$/i.test(f.name)) { showErr('Please choose a JPG or PNG image.'); continue; }
      const entry = { file: f, name: f.name, size: f.size, type: f.type };
      if (conf.kind === 'img') entry.bytes = await E.readBytes(f);
      if (!conf.multi) state.files = [];
      state.files.push(entry);
      if (!conf.multi) break;
    }
    render();
  }

  function render() {
    list.innerHTML = '';
    state.files.forEach((f, i) => {
      const li = el('li');
      if (conf.multi) {
        const ord = el('div', 'ord');
        const up = el('button', null, '▲'); up.title = 'Move up';
        const dn = el('button', null, '▼'); dn.title = 'Move down';
        up.onclick = () => { if (i > 0) { [state.files[i-1], state.files[i]] = [state.files[i], state.files[i-1]]; render(); } };
        dn.onclick = () => { if (i < state.files.length-1) { [state.files[i+1], state.files[i]] = [state.files[i], state.files[i+1]]; render(); } };
        ord.append(up, dn); li.append(ord);
      }
      li.append(el('span', 'fn', `${f.name}`));
      li.append(el('span', null, `<small style="color:var(--sub)">${E.fmtSize(f.size)}</small>`));
      const x = el('button', 'fx', '×'); x.onclick = () => { state.files.splice(i, 1); render(); };
      li.append(x);
      list.append(li);
    });
    drop.classList.toggle('filled', state.files.length > 0);
    const dd = $('.dyn', root); // dynamic hint (page count etc.)
    if (dd) dd.textContent = '';
    runBtn.disabled = state.files.length === 0;
    // probe page count for split
    if (id === 'split' && state.files.length) probeSplit();
  }

  async function probeSplit() {
    try {
      const bytes = await E.readBytes(state.files[0].file);
      const st = await E.probe(bytes);
      const info = $('#pageinfo');
      if (st === 'locked') { info.textContent = 'This PDF is locked — unlock it first.'; }
      else {
        const { PDFDocument } = await import('../lib/pdf-lib.mjs');
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        info.textContent = `This PDF has ${doc.getPageCount()} pages.`;
      }
    } catch { /* ignore */ }
  }

  function busy(on, label) {
    runBtn.disabled = on || state.files.length === 0;
    runBtn.innerHTML = on ? `<span class="spin"></span>${label || 'Working…'}` : runBtn.dataset.label;
  }

  runBtn.dataset.label = runBtn.innerHTML;
  runBtn.addEventListener('click', () => run().catch((e) => {
    busy(false);
    showErr(e instanceof E.ToolError ? E.friendly(e.code) : 'Something went wrong. Please try another file.');
  }));

  function result(title, meta, actions, extraHTML) {
    resultBox.innerHTML = `<div class="rc">${ICON.check}</div><h3>${title}</h3>`
      + (meta ? `<div class="meta">${meta}</div>` : '')
      + (extraHTML || '')
      + '<div class="btnrow"></div>';
    const row = $('.btnrow', resultBox);
    actions.forEach((a) => {
      const b = el('button', 'btn' + (a.sec ? ' sec' : ''), `${ICON.dl}${a.label}`);
      b.onclick = a.onClick; row.append(b);
    });
    resultBox.style.display = 'block';
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function run() {
    clearErr();
    const f0 = state.files[0];
    const onProgress = (i, n) => busy(true, `Processing ${i}/${n}…`);

    if (id === 'unlock') {
      busy(true, 'Unlocking…');
      const bytes = await E.readBytes(f0.file);
      const pw = $('#pw').value;
      if (!pw) { busy(false); showErr('Please type the PDF password.'); return; }
      const out = await E.unlock(bytes, pw, { dpi: 150, onProgress });
      busy(false);
      const name = E.stem(f0.name) + '_unlocked.pdf';
      result('Password removed!', `${out.length ? E.fmtSize(out.length) : ''} · ready to download`,
        [{ label: 'Download PDF', onClick: () => E.download(out, name) }]);
    }

    else if (id === 'merge') {
      busy(true, 'Merging…');
      const buffers = [];
      for (const f of state.files) buffers.push(await E.readBytes(f.file));
      const out = await E.merge(buffers, { onProgress });
      busy(false);
      result('PDFs merged!', `${state.files.length} files · ${E.fmtSize(out.length)}`,
        [{ label: 'Download PDF', onClick: () => E.download(out, 'merged.pdf') }]);
    }

    else if (id === 'split') {
      const spec = $('#pages').value.trim();
      if (!spec) { showErr('Type which pages to keep, e.g. 1-3, 5'); return; }
      busy(true, 'Extracting…');
      const bytes = await E.readBytes(f0.file);
      const out = await E.split(bytes, spec);
      busy(false);
      result('Pages extracted!', E.fmtSize(out.length),
        [{ label: 'Download PDF', onClick: () => E.download(out, E.stem(f0.name) + '_pages.pdf') }]);
    }

    else if (id === 'compress') {
      const q = +($('.opt.sel', root)?.dataset.q || 0.6);
      const dpi = +($('.opt.sel', root)?.dataset.dpi || 120);
      busy(true, 'Compressing…');
      const bytes = await E.readBytes(f0.file);
      const { bytes: out, before, after, unchanged } = await E.compress(bytes, { quality: q, dpi, onProgress });
      busy(false);
      const pct = unchanged ? ' (already optimized — kept original)' : ` (${Math.round(100 - after * 100 / before)}% smaller)`;
      result(unchanged ? 'Already optimized' : 'PDF compressed!', `${E.fmtSize(before)} → ${E.fmtSize(after)}${pct}`,
        [{ label: 'Download PDF', onClick: () => E.download(out, E.stem(f0.name) + '_compressed.pdf') }]);
    }

    else if (id === 'img2pdf') {
      const mode = $('.opt.sel', root)?.dataset.mode || 'a4';
      busy(true, 'Building PDF…');
      const out = await E.imagesToPdf(state.files, { mode, onProgress });
      busy(false);
      result('PDF created!', `${state.files.length} image(s) · ${E.fmtSize(out.length)}`,
        [{ label: 'Download PDF', onClick: () => E.download(out, 'images.pdf') }]);
    }

    else if (id === 'pdf2img') {
      const dpi = +($('.opt.sel', root)?.dataset.dpi || 150);
      const format = $('#fmt')?.value || 'jpeg';
      busy(true, 'Converting…');
      const bytes = await E.readBytes(f0.file);
      const imgs = await E.pdfToImages(bytes, { dpi, format, base: E.stem(f0.name), onProgress });
      busy(false);
      const thumbs = '<div class="thumbs">' + imgs.slice(0, 12).map((im) =>
        `<img src="${URL.createObjectURL(im.blob)}" alt="${im.name}">`).join('') + '</div>';
      result(`${imgs.length} image${imgs.length > 1 ? 's' : ''} ready!`, 'Download all as ZIP or save individually',
        [
          { label: 'Download ZIP', onClick: async () => {
            const JSZip = (await import('../lib/jszip.min.js')).default || window.JSZip;
            const zip = new JSZip();
            imgs.forEach((im) => zip.file(im.name, im.blob));
            const blob = await zip.generateAsync({ type: 'blob' });
            E.download(blob, E.stem(f0.name) + '_images.zip', 'application/zip');
          } },
          { label: 'Save first image', sec: true, onClick: async () => {
            const ab = await imgs[0].blob.arrayBuffer();
            E.download(new Uint8Array(ab), imgs[0].name, imgs[0].blob.type);
          } },
        ], thumbs);
    }

    else if (id === 'rotate') {
      const deg = +($('.opt.sel', root)?.dataset.deg || 90);
      busy(true, 'Rotating…');
      const bytes = await E.readBytes(f0.file);
      const out = await E.rotate(bytes, deg);
      busy(false);
      result('PDF rotated!', E.fmtSize(out.length),
        [{ label: 'Download PDF', onClick: () => E.download(out, E.stem(f0.name) + '_rotated.pdf') }]);
    }

    else if (id === 'pagenum') {
      const style = $('.opt.sel', root)?.dataset.style || 'n';
      const position = $('#position')?.value || 'bottom-center';
      busy(true, 'Adding numbers…');
      const bytes = await E.readBytes(f0.file);
      const out = await E.pageNumbers(bytes, { style, position });
      busy(false);
      result('Page numbers added!', E.fmtSize(out.length),
        [{ label: 'Download PDF', onClick: () => E.download(out, E.stem(f0.name) + '_numbered.pdf') }]);
    }

    else if (id === 'watermark') {
      const text = $('#wmtext').value.trim();
      if (!text) { showErr('Please type the watermark text.'); return; }
      const opacity = +($('.opt.sel', root)?.dataset.op || 0.2);
      busy(true, 'Adding watermark…');
      const bytes = await E.readBytes(f0.file);
      const out = await E.watermark(bytes, { text, opacity });
      busy(false);
      result('Watermark added!', E.fmtSize(out.length),
        [{ label: 'Download PDF', onClick: () => E.download(out, E.stem(f0.name) + '_watermark.pdf') }]);
    }

    else if (id === 'imgcomp') {
      const maxKB = +($('.opt.sel', root)?.dataset.kb || 0) || +($('#customkb')?.value || 0);
      if (!maxKB) { showErr('Choose a target size (e.g. 100 KB).'); return; }
      busy(true, 'Compressing…');
      const { blob, width, height } = await E.processImage(f0.file, { maxKB });
      busy(false);
      const url = URL.createObjectURL(blob);
      result('Image compressed!', `${width}×${height} px · ${E.fmtSize(blob.size)}`,
        [{ label: 'Download JPG', onClick: () => blob.arrayBuffer().then((ab) => E.download(new Uint8Array(ab), E.stem(f0.name) + '_' + maxKB + 'kb.jpg', 'image/jpeg')) }],
        `<img src="${url}" style="max-height:200px;border-radius:10px;margin:6px auto;display:block">`);
    }

    else if (id === 'resize') {
      const sel = $('.opt.sel', root);
      let w = +($('#cw')?.value || 0), h = +($('#ch')?.value || 0), maxKB = 0, minKB = 0;
      if (sel && sel.dataset.w) { w = +sel.dataset.w; h = +sel.dataset.h; maxKB = +sel.dataset.max || 0; minKB = +sel.dataset.min || 0; }
      if (!w || !h) { showErr('Choose a preset or enter width and height.'); return; }
      busy(true, 'Resizing…');
      const { blob, width, height } = await E.processImage(f0.file, { width: w, height: h, maxKB, minKB });
      busy(false);
      const url = URL.createObjectURL(blob);
      result('Photo ready!', `${width}×${height} px · ${E.fmtSize(blob.size)}`,
        [{ label: 'Download JPG', onClick: () => blob.arrayBuffer().then((ab) => E.download(new Uint8Array(ab), E.stem(f0.name) + '_resized.jpg', 'image/jpeg')) }],
        `<img src="${url}" style="max-height:200px;border-radius:10px;margin:6px auto;display:block">`);
    }
  }

  // option selectors
  root.querySelectorAll('.opt').forEach((o) => o.addEventListener('click', () => {
    o.parentElement.querySelectorAll('.opt').forEach((x) => x.classList.remove('sel'));
    o.classList.add('sel');
    const custom = $('#customwrap', root);
    if (custom) custom.style.display = o.dataset.custom ? 'block' : 'none';
  }));

  render();
}
