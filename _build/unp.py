"""Small helpers to make new pages that look exactly like the existing ones.
The header/footer/head come from an existing page used as a template.
Run from the repo root:  python3 _build/posts.py
"""
import html, json, re

DOMAIN = "https://unpasstools.com"
TEMPLATE = "how-to-merge-pdf-files.html"
PLAY = "https://play.google.com/store/apps/details?id=com.unpassapp.unpass"


def _tpl():
    return open(TEMPLATE, encoding="utf-8").read()


def head(title, desc, fname, schemas=()):
    s = _tpl()
    h = s[: s.index("</head>")]
    url = f"{DOMAIN}/{fname}"
    t, d = html.escape(title), html.escape(desc)
    h = re.sub(r"<title>.*?</title>", lambda m: f"<title>{t}</title>", h)
    h = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + d, h)
    h = re.sub(r'(<link rel="canonical" href=")[^"]*', lambda m: m.group(1) + url, h)
    h = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + t, h)
    h = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda m: m.group(1) + d, h)
    h = re.sub(r'(<meta property="og:url" content=")[^"]*', lambda m: m.group(1) + url, h)
    h = re.sub(r'(<meta name="twitter:title" content=")[^"]*', lambda m: m.group(1) + t, h)
    h = re.sub(r'(<meta name="twitter:description" content=")[^"]*', lambda m: m.group(1) + d, h)
    h = re.sub(r'<script type="application/ld\+json">.*?</script>', "", h, flags=re.S)
    ld = "".join(f'<script type="application/ld+json">{json.dumps(x)}</script>' for x in schemas)
    h = h.replace('<script async src="https://www.googletagmanager.com', ld + '\n<script async src="https://www.googletagmanager.com', 1)
    return h + "</head>\n"


def header():
    s = _tpl()
    return s[s.index("<body>"): s.index("</header>") + len("</header>")] + "\n"


def footer():
    s = _tpl()
    return s[s.index('<footer class="site">'): s.index("</footer>") + len("</footer>")] + "\n</body></html>"


def appcta():
    s = _tpl()
    i = s.index('<div class="appcta">')
    return s[i: s.index("</a></div>", i) + len("</a></div>")]


def faq_schema(faq):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}


def faq_html(faq, title="FAQ"):
    return f'<div class="faq"><h2>{title}</h2>' + "".join(
        f"<details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>" for q, a in faq) + "</div>"


def add_to_sitemap(fnames):
    sm = open("sitemap.xml", encoding="utf-8").read()
    for f in fnames:
        loc = f"<loc>{DOMAIN}/{f}</loc>"
        if loc not in sm:
            sm = sm.replace("</urlset>", f"<url>{loc}<changefreq>monthly</changefreq></url>\n</urlset>")
    open("sitemap.xml", "w", encoding="utf-8").write(sm)
