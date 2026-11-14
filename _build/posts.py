"""Generate blog posts from _build/posts_data.py, add them to blog.html and sitemap.xml.
Run from repo root:  python3 _build/posts.py"""
import sys, html, re
sys.path.insert(0, "_build")
from unp import *
from posts_data import POSTS, DATE
from international import HIDDEN  # India-only pages: online but never linked

esc = html.escape
by_tool = {}
for p in POSTS:
    by_tool.setdefault(p["tool"], []).append(p)

# existing posts on blog.html (for related links)
blog = open("blog.html", encoding="utf-8").read()
existing = re.findall(r'<a class="blogcard" href="([^"]+)"><h3>(.*?)</h3>', blog)


def related(p):
    out = [q for q in by_tool[p["tool"]] if q is not p and q["slug"] + ".html" not in HIDDEN][:2]
    rel = [(q["slug"] + ".html", esc(q["title"])) for q in out]
    for href, t in existing:  # fill with older guides that mention the same tool
        if len(rel) >= 3:
            break
        try:
            txt = open(href, encoding="utf-8").read()
        except OSError:
            continue
        art = txt[txt.find("<article"): txt.find("</article>")]
        if href not in HIDDEN and href != p["slug"] + ".html" and f'href="{p["tool"]}"' in art and href not in [r[0] for r in rel]:
            rel.append((href, t))
    return '<div class="related"><h2>Related guides</h2><div class="rellist">' + "".join(
        f'<a class="relcard" href="{h}"><span>{t}</span></a>' for h, t in rel) + "</div></div>"


def build(p):
    DATE = p.get("date", globals()["DATE"])
    f = p["slug"] + ".html"
    url = f"{DOMAIN}/{f}"
    h1 = re.sub(r"\s*\(.*?\)\s*$", "", p["title"]) if len(p["title"]) > 60 else p["title"]
    schemas = [
        faq_schema(p["faq"]),
        {"@context": "https://schema.org", "@type": "Article", "headline": h1, "description": p["desc"],
         "image": f"{DOMAIN}/assets/img/og.png", "datePublished": DATE, "dateModified": DATE,
         "author": {"@type": "Organization", "name": "FreeNation Softwares"},
         "publisher": {"@type": "Organization", "name": "Unpass", "logo": {"@type": "ImageObject", "url": f"{DOMAIN}/assets/img/favicon-512.png"}},
         "mainEntityOfPage": {"@type": "WebPage", "@id": url}},
        {"@context": "https://schema.org", "@type": "HowTo", "name": h1, "description": p["desc"],
         "step": [{"@type": "HowToStep", "position": i + 1, "name": n, "text": f"{n}. {t}"} for i, (n, t) in enumerate(p["steps"])]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN + "/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": DOMAIN + "/blog.html"},
            {"@type": "ListItem", "position": 3, "name": h1, "item": url}]},
    ]
    steps = "".join(f"<li><b>{esc(n)}</b> — {esc(t)}.</li>" for n, t in p["steps"])
    secs = "".join(f"<h2>{esc(h)}</h2>{body}" for h, body in p["sections"])
    art = (f'<article class="prose blogpost" style="padding-top:26px"><a class="back" href="blog.html">← All articles</a>'
           f'<h1>{esc(h1)}</h1><p class="byline">By FreeNation Softwares · Updated {DATE}</p>'
           f'<a class="toolcta" href="{p["tool"]}">Open the {esc(p["toolname"])} tool →</a>'
           f'<p>{esc(p["intro"])}</p><h2>Step by step</h2><ol class="stepslist">{steps}</ol>'
           f'<div class="tipbox">💡 {esc(p["tip"])}</div>{secs}'
           f'<div class="endcta"><b>Ready?</b> <a href="{p["tool"]}">Use the {esc(p["toolname"])} tool</a> — free, and your file never leaves your device.</div>'
           f'{faq_html(p["faq"])}{related(p)}{appcta()}</article>')
    page = head(p["title"] + " | Unpass", p["desc"], f, schemas) + header() + art + footer()
    open(f, "w", encoding="utf-8").write(page)
    return f


files = [build(p) for p in POSTS]
sitemap_files = [f for f in files if f not in HIDDEN]

# newest posts at the top of blog.html
cards = "".join(
    f'<a class="blogcard" href="{p["slug"]}.html"><h3>{esc(p["title"])}</h3><p>{esc(p["desc"])}</p><span class="readmore">Read guide →</span></a>'
    for p in POSTS if f'href="{p["slug"]}.html"' not in blog and p["slug"] + ".html" not in HIDDEN)
blog = blog.replace('<div class="bloglist">', '<div class="bloglist">' + cards, 1)
open("blog.html", "w", encoding="utf-8").write(blog)
add_to_sitemap(sitemap_files)
print(len(files), "posts")
