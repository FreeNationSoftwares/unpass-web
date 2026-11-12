import sys; sys.path.insert(0, "_build")
from unp import *

FAQ = [
    ("Is Protect PDF free?", "Yes. It is free with no sign-up, no watermark and no file limit."),
    ("Is my PDF uploaded?", "No. The PDF is encrypted inside your browser and never leaves your device."),
    ("How strong is the protection?", "The PDF is encrypted with AES-128, the standard supported by Adobe Reader, Chrome, Edge and phone PDF apps."),
    ("What if I forget the password?", "It cannot be recovered — not even by us, because we never see your file or password. Keep the original unprotected copy somewhere safe."),
    ("How do I remove the password later?", "Use our Unlock PDF tool with the same password to save a copy without it."),
]
TITLE = "Protect PDF — Add a Password to a PDF Online Free | Unpass"
DESC = "Password-protect a PDF free in your browser with AES encryption. No sign-up and no upload — your file never leaves your device."
app = {"@context": "https://schema.org", "@type": "WebApplication", "name": "Protect PDF — Unpass",
       "url": DOMAIN + "/protect-pdf.html", "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
       "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}
LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
body = f'''<main class="toolpage"><div id="tool">
<a class="back" href="all-tools.html">← All tools</a>
<div class="toolhead"><div class="big" style="background:#7C5CFF1f;color:#7C5CFF">{LOCK}</div>
<h1>Protect PDF</h1><p>Add a password so only you can open it</p></div>
<div class="drop"><div class="di"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg></div><b>Select PDF</b><small>or drag &amp; drop here</small>
<input type="file" accept="application/pdf,.pdf" hidden></div>
<div class="field"><label for="pw">New password</label><input type="password" id="pw" placeholder="Choose a password" autocomplete="new-password"></div>
<div class="field"><label for="pw2">Repeat password</label><input type="password" id="pw2" placeholder="Type it again" autocomplete="new-password"></div>
<div class="err"></div>
<div class="runwrap"><button class="btn run">Protect PDF</button></div>
<div class="result" style="display:none"></div>
<div class="privacy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>100% private · your file and password never leave your device</span></div>
{appcta()}
</div></main><div class="prose"><h2>About Protect PDF</h2><p>Protect PDF locks a document with a password using AES-128 encryption, so anyone who opens it — on a computer, phone or in an email preview — must type the password first. It is ideal for salary slips, bank statements, ID copies, contracts and medical reports you need to send by email or WhatsApp.</p>
<h2>How to password-protect a PDF</h2><ol class="stepslist"><li><b>Select your PDF</b> — it stays on your device.</li><li><b>Type a password twice</b> — use something you can remember but others can't guess.</li><li><b>Protect &amp; download</b> — the new PDF asks for the password every time it is opened.</li></ol>
<div class="tipbox">💡 Sending the PDF to someone? Share the password in a different way — for example, the file by email and the password by phone or SMS.</div>
<p>Need to remove a password instead? Use <a href="unlock-pdf.html">Unlock PDF</a>.</p>
{faq_html(FAQ, "Questions")}</div>'''
page = head(TITLE, DESC, "protect-pdf.html", [faq_schema(FAQ), app]) + header() + body + footer()
page += '<script type="module">import { initTool } from "./assets/js/tools.mjs"; initTool("protect");</script>'
open("protect-pdf.html", "w", encoding="utf-8").write(page)
add_to_sitemap(["protect-pdf.html"])
print("ok")
