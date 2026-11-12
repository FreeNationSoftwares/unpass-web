import sys; sys.path.insert(0, "_build")
from unp import *

FAQ = [
    ("Is it free to sign a PDF here?", "Yes. Signing is completely free, with no sign-up, no watermark and no limit on files."),
    ("Is my PDF uploaded anywhere?", "No. The PDF and your signature are processed inside your browser and never leave your device."),
    ("Can I use a photo of my signature?", "Yes. Sign on white paper, take a photo, and choose Upload. Keep 'Remove white background' on so only the ink is placed on the page."),
    ("Can I sign every page at once?", "Yes. For PDFs with more than one page, tick 'Sign all pages' to put the signature in the same spot on every page."),
    ("Is this a legal digital signature?", "It adds a visual electronic signature (an image of your signature), which is accepted for many everyday forms and agreements. It is not a certificate-based digital signature (DSC) used for things like tax filings."),
]
TITLE = "Sign PDF Online Free — Add Your Signature to a PDF | Unpass"
DESC = "Sign a PDF free in your browser: draw your signature or upload a photo of it, drag it onto the page and download. No sign-up, nothing is uploaded."

app = {"@context": "https://schema.org", "@type": "WebApplication", "name": "Sign PDF — Unpass",
       "url": DOMAIN + "/sign-pdf.html", "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
       "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}

body = f'''<main class="toolpage"><div id="tool">
<a class="back" href="all-tools.html">← All tools</a>
<div class="toolhead"><div class="big" style="background:#2F80ED1f;color:#2F80ED"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></div>
<h1>Sign PDF</h1><p>Draw or upload your signature and place it on any page</p></div>
<div class="drop"><div class="di"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg></div><b>Select PDF</b><small>or drag &amp; drop here</small>
<input type="file" id="pdfin" accept="application/pdf,.pdf" hidden></div>
<div id="signwork" style="display:none">
<div class="field"><label>1. Your signature</label>
<div class="stabs"><button class="stab sel" data-t="draw" type="button">✍️ Draw</button><button class="stab" data-t="up" type="button">🖼️ Upload photo</button></div>
<div id="drawpane"><canvas id="pad" class="sigpad" aria-label="Signature pad"></canvas>
<div class="padbar"><span class="padhint">Sign inside the box</span><button class="swatch sel" data-c="#111111" style="background:#111" type="button" aria-label="Black ink"></button><button class="swatch" data-c="#1a3fb5" style="background:#1a3fb5" type="button" aria-label="Blue ink"></button><button id="padclear" class="linkbtn" type="button">Clear</button></div></div>
<div id="uppane" style="display:none"><label class="upbtn">Choose signature image<input type="file" id="sigfile" accept="image/*" hidden></label>
<label class="chk"><input type="checkbox" id="rmbg" checked> Remove white background</label></div>
</div>
<div class="field"><label>2. Place it on the page <small style="font-weight:400;color:var(--sub)">— drag the signature or tap where it should go</small></label>
<div class="pgnav"><button id="pgprev" type="button">‹</button><span id="pginfo">Page 1</span><button id="pgnext" type="button">›</button></div>
<div class="stagewrap"><div id="stage" class="stage"><img id="sigimg" class="sigimg" alt="Your signature" draggable="false"></div></div>
<div class="sizerow"><span>Size</span><input type="range" id="sigsize" min="10" max="70" value="30"></div>
<label class="chk" id="allwrap" style="display:none"><input type="checkbox" id="allpages"> Sign all pages (same spot)</label>
</div>
</div>
<div class="err"></div>
<div class="runwrap"><button class="btn run" id="signrun" disabled>Sign &amp; Download</button></div>
<div class="result" style="display:none"></div>
<div class="privacy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>100% private · your PDF and signature never leave your device</span></div>
{appcta()}
</div></main><div class="prose"><h2>About Sign PDF</h2><p>Sign PDF lets you add your handwritten signature to any PDF — a rental agreement, an offer letter, a school form or an invoice — without printing and scanning. Draw it with your finger or mouse, or upload a photo of your signature on paper, then drag it exactly where it belongs.</p>
<h2>How to sign a PDF</h2><ol class="stepslist"><li><b>Select your PDF</b> — it opens right here in your browser.</li><li><b>Create your signature</b> — draw it in the box, or upload a photo of it.</li><li><b>Place it</b> — drag the signature onto the line, resize it with the slider and pick the page.</li><li><b>Sign &amp; download</b> — get the signed PDF instantly.</li></ol>
<p>Want to check the result guide? Read <a href="how-to-sign-a-pdf-without-printing.html">how to sign a PDF without printing</a>.</p>
{faq_html(FAQ, "Questions")}</div>'''

page = head(TITLE, DESC, "sign-pdf.html", [faq_schema(FAQ), app]) + header() + body + footer()
page = page.replace("</body></html>", "</body></html>") + '<script type="module">import { initSign } from "./assets/js/sign.mjs"; initSign();</script>'
open("sign-pdf.html", "w", encoding="utf-8").write(page)
add_to_sitemap(["sign-pdf.html"])
print("sign-pdf.html written")
