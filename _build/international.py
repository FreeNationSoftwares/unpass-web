"""One-time pass (Nov 2026): make the site international.
- India-only pages stay online (old Google traffic keeps working) but are hidden:
  removed from home, all-tools, blog list, sitemap and every 'related guides' box.
- Photo & Signature tool gets international presets.
- Stronger '100% Privacy Guarantee' wording everywhere.
Run from repo root: python3 _build/international.py
"""
import glob, re

HIDDEN = {
    # India exam / ID guides
    "ssc-photo-signature-size.html", "neet-jee-photo-signature-size.html", "resize-signature-to-10kb-20kb-for-exam.html",
    "passport-size-photo-in-pixels-india.html", "ibps-sbi-bank-photo-signature-size.html", "upsc-photo-signature-size-rules.html",
    "railway-rrb-photo-size.html", "aadhaar-pdf-password-open-remove.html", "gate-photo-signature-size.html",
    "up-police-photo-signature-size.html", "ctet-photo-signature-size.html", "pan-card-photo-size.html",
    "indian-passport-photo-size.html", "nsp-scholarship-photo-signature-size.html", "how-to-open-e-pan-card-pdf-password.html",
    "cuet-photo-signature-size.html", "how-to-make-scholarship-documents-pdf.html",
    # India exam resizer landing pages
    "ssc-photo-signature-resize.html", "neet-jee-photo-resize.html", "upsc-photo-resize.html",
    "bank-photo-signature-resize.html", "railway-rrb-photo-resize.html",
}
# visible replacement for a hidden related link (by topic)
SUB = {
    "aadhaar-pdf-password-open-remove.html": "unlock-pdf-without-password.html",
    "how-to-open-e-pan-card-pdf-password.html": "how-to-print-a-password-protected-pdf.html",
    "passport-size-photo-in-pixels-india.html": "us-visa-passport-photo-size-600x600.html",
    "indian-passport-photo-size.html": "make-passport-photo-at-home.html",
    "how-to-make-scholarship-documents-pdf.html": "how-to-make-pdf-under-200kb-for-online-forms.html",
    "nsp-scholarship-photo-signature-size.html": "how-to-resize-photo-for-online-application.html",
}
DEFAULT_SUBS = ["how-to-resize-photo-for-online-application.html", "compress-image-to-20kb-50kb-100kb.html",
                "how-to-reduce-image-size-in-kb.html", "resize-image-to-exact-pixels.html",
                "us-visa-passport-photo-size-600x600.html", "best-free-private-pdf-tools.html"]

PRIV_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>'
PRIV_LINE = (f'<div class="privacy">{PRIV_SVG}<span><b>100% Privacy Guarantee</b> · your file is processed on your device and '
             f'never uploaded — nobody can see, store or leak it. <a href="privacy.html#guarantee">How?</a></span></div>')


def title_of(href):
    s = open(href, encoding="utf-8").read()
    m = re.search(r"<h1>(.*?)</h1>", s, re.S)
    return m.group(1) if m else href


def fix_related(s, fname):
    def repl_list(m):
        cards = re.findall(r'<a class="relcard" href="([^"]+)"><span>(.*?)</span></a>', m.group(1))
        keep, used = [], {fname}
        for h, t in cards:
            if h not in HIDDEN and h not in used:
                keep.append((h, t)); used.add(h)
        for h, _ in cards:  # replace hidden ones with a visible guide on a similar topic
            if h in HIDDEN:
                for cand in [SUB.get(h)] + DEFAULT_SUBS:
                    if cand and cand not in used and cand not in HIDDEN:
                        keep.append((cand, title_of(cand))); used.add(cand); break
        keep = keep[:3]
        return '<div class="rellist">' + "".join(f'<a class="relcard" href="{h}"><span>{t}</span></a>' for h, t in keep) + "</div>"
    return re.sub(r'<div class="rellist">(.*?)</div>', repl_list, s, flags=re.S)


TEXT = [  # (file or '*', old, new)
    ("unlock-pdf-without-password.html", "bank statements and Aadhaar PDFs", "bank statements and ID documents"),
    ("best-free-private-pdf-tools.html", "bank statement, Aadhaar, salary slip", "bank statement, ID card, salary slip"),
    ("how-to-print-a-password-protected-pdf.html", ' For Aadhaar, see <a href="aadhaar-pdf-password-open-remove.html">the Aadhaar PDF password format</a>.', ""),
    ("how-to-make-pdf-under-200kb-for-online-forms.html", "on Indian government, university and scholarship portals", "on government, university and job portals"),
    ("about.html", "the exact size that exam and government forms need", "the exact size that visa, passport, job and online forms need"),
    # home
    ("index.html", "compress photos to an exact KB, resize for exam &amp; govt forms, unlock", "sign, protect &amp; unlock PDFs, compress photos to an exact KB, resize for visa &amp; passport forms"),
    ("index.html", "Photo Tools — most used (exams & forms)", "Photo Tools"),
    ("index.html", "bank statements, Aadhaar and PAN PDFs, salary slips, exam forms and photos", "bank statements, contracts, tax forms, ID documents, salary slips and photos"),
    ("index.html", "For students and job seekers, the <b>Photo &amp; Signature</b> tool resizes images to the exact size govt forms ask for.",
     "<b>Sign PDF</b> adds your handwritten signature, <b>Protect PDF</b> locks a file with a password, and the <b>Photo &amp; Signature</b> tool resizes images to the exact size visa, passport and job applications ask for."),
    ("index.html", '<span class="chip">🔒 <b>100% private</b></span>', '<span class="chip">🔒 <b>100% Privacy Guarantee</b></span>'),
    ("*", "<p>Exam &amp; form upload size</p>", "<p>Visa, passport &amp; form sizes</p>"),
]

EXAM_CHIPS = re.compile(r'<div class="sec-title"><span class="bar"></span>(Resize photo &amp; signature for your exam|Exam Resizers)</div><div class="examchips">.*?</div>', re.S)

RESIZE_OPTS = [  # label, small, w, h, max KB, min KB
    ("US Passport / Visa", "600×600, ≤240KB", 600, 600, 240, 0),
    ("UK Passport", "600×750", 600, 750, 1000, 50),
    ("Canada Visa", "420×540", 420, 540, 1000, 0),
    ("Schengen / EU 35×45mm", "413×531", 413, 531, 500, 0),
    ("ID Photo 2×2 in", "600×600", 600, 600, 500, 0),
    ("LinkedIn Profile", "400×400", 400, 400, 500, 0),
    ("Signature", "350×150, ≤50KB", 350, 150, 50, 0),
    ("Small Signature", "140×60, ≤20KB", 140, 60, 20, 0),
    ("Instagram Square", "1080×1080", 1080, 1080, 1000, 0),
    ("YouTube Thumbnail", "1280×720, ≤2MB", 1280, 720, 2000, 0),
]


def fix_resize_page(s):
    opts = "".join(
        f'<div class="opt{" sel" if i == 0 else ""}" data-w="{w}" data-h="{h}" data-max="{mx}"' + (f' data-min="{mn}"' if mn else "")
        + f'><b>{l}</b><small>{sm}</small></div>' for i, (l, sm, w, h, mx, mn) in enumerate(RESIZE_OPTS))
    opts += '<div class="opt" data-custom="1"><b>Custom</b><small>Your size</small></div>'
    s = re.sub(r'(<div class="field"><div class="opts">).*?(</div></div><div class="field" id="customwrap")',
               lambda m: m.group(1) + opts + m.group(2), s, count=1, flags=re.S)
    s = s.replace("<p>Exact size for exam &amp; govt forms</p>", "<p>Exact size for visa, passport &amp; online forms</p>")
    s = s.replace("Pick your exam preset below — it sets the pixels and KB automatically.", "Pick a preset below — it sets the pixels and KB automatically.")
    prose = ('<div class="prose"><h2>About Photo &amp; Signature</h2><p>Photo &amp; Signature resizes your photo or signature to the exact pixels and file size that '
             'online applications require — US, UK, Canada and Schengen visa and passport photos, ID photos, job portals and social profiles. Pick a preset and it sets the size automatically, or type your own.</p>'
             '<h2>Common photo sizes</h2><div style="overflow-x:auto"><table class="reqtable"><thead><tr><th>Use</th><th>Size</th><th>File</th></tr></thead><tbody>'
             '<tr><td>US passport &amp; visa (digital)</td><td>600×600 px (square)</td><td>JPEG, ≤ 240 KB</td></tr>'
             '<tr><td>UK passport (online)</td><td>at least 600×750 px</td><td>JPEG</td></tr>'
             '<tr><td>Canada visa (online)</td><td>at least 420×540 px</td><td>JPEG</td></tr>'
             '<tr><td>Schengen / EU visa</td><td>35×45 mm (413×531 px)</td><td>JPEG</td></tr>'
             '<tr><td>LinkedIn profile</td><td>400×400 px</td><td>JPG / PNG</td></tr></tbody></table></div>'
             '<p style="font-size:13px;color:var(--sub)">Rules change — always check the official site of the office you are applying to.</p>'
             '<div class="faq"><h2>Questions</h2><details><summary>Which sizes are covered?</summary><p>US, UK, Canada and Schengen visa and passport photos, 2×2 inch ID photos, signatures, LinkedIn, Instagram and YouTube sizes.</p></details>'
             '<details><summary>What if my size isn\'t listed?</summary><p>Choose Custom and type the exact width and height in pixels.</p></details>'
             '<details><summary>Is my photo uploaded anywhere?</summary><p>No. Resizing happens on your own device — your photo never leaves your phone or computer.</p></details></div></div>')
    s = re.sub(r'<div class="prose"><h2>About Photo &amp; Signature</h2>.*?</div></div>(?=<footer)', prose, s, count=1, flags=re.S)
    return s


def main():
    files = sorted(glob.glob("*.html"))
    for f in files:
        if f in HIDDEN:
            continue
        s = o = open(f, encoding="utf-8").read()
        s = fix_related(s, f)
        s = EXAM_CHIPS.sub("", s)
        for tf, a, b in TEXT:
            if tf in ("*", f):
                s = s.replace(a, b)
        s = re.sub(r'<div class="privacy">.*?</div>', PRIV_LINE, s, flags=re.S)
        if f == "resize-image.html":
            s = fix_resize_page(s)
        if f == "blog.html":
            s = re.sub(r'<a class="blogcard" href="([^"]+)">.*?</a>', lambda m: "" if m.group(1) in HIDDEN else m.group(0), s, flags=re.S)
        if s != o:
            open(f, "w", encoding="utf-8").write(s)
    sm = open("sitemap.xml", encoding="utf-8").read()
    for h in HIDDEN:
        sm = re.sub(r"<url>\s*<loc>[^<]*/" + re.escape(h) + r"</loc>.*?</url>\s*", "", sm, flags=re.S)
    open("sitemap.xml", "w", encoding="utf-8").write(sm)


if __name__ == "__main__":
    main()
