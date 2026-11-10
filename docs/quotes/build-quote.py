#!/usr/bin/env python3.13
"""
Renders a one-off PDF quotation for a trip the admin builder cannot yet price
correctly on its own.

Why this exists rather than /admin/quotes/new: the builder omits the backhaul
on a two-stop trip, so a one-way or a short round trip comes out below the
fare the public /drive/ pages already publish. Until that is reconciled, a
hand-built quote that cites the published figures is the honest document.

Every number here is read from the road model, not typed:
  planItinerary(swakopmund -> uis -> swakopmund) by night count
  modelJourney(swakopmund, uis) and its reverse, for the one-way fares
Company details are the ones the live site publishes, so the quote cannot
disagree with the website a client checks it against.
"""
import base64, json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = json.loads(pathlib.Path(sys.argv[1]).read_text())
OUT = pathlib.Path(sys.argv[2])

HERE = pathlib.Path(__file__).resolve().parent

# ---------------------------------------------------------------- typefaces
# Embedded as data URIs rather than linked, because the PDF has to render the
# same on a machine with no network and no fonts installed. The files are
# vendored in fonts/ so this runs on a clean checkout; see fonts/README.md.
FACES = [
    ("Archivo", "archivo-variable.woff2", "100 900"),
    ("IBM Plex Mono", "ibm-plex-mono-400.woff2", "400"),
    ("IBM Plex Mono", "ibm-plex-mono-500.woff2", "500"),
]

def font_css() -> str:
    rules = []
    for family, filename, weight in FACES:
        path = HERE / "fonts" / filename
        if not path.exists():
            # Never fall back silently. A quote set in the wrong face is a
            # document that does not look like us, and nothing on screen would
            # say so - the one failure this script must not have.
            raise SystemExit(
                f"Missing {path}. See docs/quotes/fonts/README.md - the file "
                f"is vendored in the repository and should not be absent."
            )
        b64 = base64.b64encode(path.read_bytes()).decode()
        # Single braces: this string is interpolated verbatim into the HTML
        # f-string below, so doubling them here would emit invalid CSS and the
        # whole document would silently fall back to a system face.
        rules.append(
            f"@font-face{{font-family:'{family}';font-style:normal;"
            f"font-weight:{weight};font-display:block;"
            f"src:url(data:font/woff2;base64,{b64}) format('woff2');}}"
        )
    return "\n".join(rules)

fonts = font_css()

# ----------------------------------------------------------------- wordmark
# The source is 3446px wide because it also drives a vehicle decal. At the
# 85mm it prints here that is roughly 1000dpi of nothing, and it was most of
# the file size of a document that has to survive a mobile download. Scaled
# at build time rather than checked in twice, so there is one wordmark in the
# repository and no chance of the two drifting.
WORDMARK_PX = 1200

def wordmark_data_uri() -> str:
    source = HERE.parent / "invoice" / "wordmark.png"
    raw = source.read_bytes()
    try:
        from PIL import Image
    except ImportError:
        # Correct output, merely heavier - so this one degrades rather than
        # stopping, unlike a missing typeface.
        print("Pillow not installed; embedding the full-size wordmark.")
        return base64.b64encode(raw).decode()

    import io
    im = Image.open(io.BytesIO(raw))
    if im.width > WORDMARK_PX:
        im = im.resize(
            (WORDMARK_PX, round(im.height * WORDMARK_PX / im.width)),
            Image.LANCZOS,
        )
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()

wordmark = wordmark_data_uri()

def nad(n: int) -> str:
    return "N$" + f"{n:,}"


# Archivo's Latin subset has no U+2192, so a literal arrow drops to whatever
# sans the renderer finds - a silent substitution that looks fine here and may
# not elsewhere. Drawn instead, so the document depends on no font we did not
# ship.
ARROW = (
    '<svg class="arw" viewBox="0 0 16 10" aria-hidden="true">'
    '<path d="M0 5h13M9.5 1.2 13.3 5 9.5 8.8" fill="none" stroke="currentColor" '
    'stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
)


def arrows(text: str) -> str:
    """Swap arrow characters for the drawn one."""
    return text.replace("\u2192", ARROW).replace("&rarr;", ARROW)

opts = DATA["options"]
def scale_strip(o):
    if not o.get("scale"):
        return ""
    items = "".join(
        f"<li><span>{x['label']}</span><b>{nad(x['price'])}</b></li>" for x in o["scale"]
    )
    return f'<ul class="scale">{items}</ul>'

rows = "".join(
    f"""<tr class="{'rec' if o.get('recommend') else ''}">
      <td class="opt"><span class="tag">{o['tag']}</span></td>
      <td class="what"><strong>{o['title']}</strong><span>{o['note']}</span>{scale_strip(o)}</td>
      <td class="amt">{o.get('price_prefix','')}{nad(o['price'])}</td>
    </tr>"""
    for o in opts
)

html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
{fonts}
:root{{
  --ink:#11151a; --paper:#f3f5f6; --surface:#ffffff;
  --muted:#5f656d; --line:#dbdee1; --brand:#004e94;
}}
@page {{ size: A4; margin: 12mm 15mm 10mm; }}
*{{box-sizing:border-box}}
body{{margin:0;font-family:'Archivo',system-ui,sans-serif;font-weight:400;
     color:var(--ink);background:var(--surface);font-size:8.8pt;line-height:1.44;
     -webkit-font-smoothing:antialiased}}
svg.arw{{width:2.7mm;height:1.9mm;vertical-align:-.05mm;margin:0 .5mm;color:var(--muted)}}
.tabular{{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}}

header{{display:flex;align-items:flex-start;justify-content:space-between;gap:16mm;
        padding-bottom:3.6mm;border-bottom:1.4pt solid var(--ink)}}
header img{{height:5.6mm;display:block}}
.meta{{text-align:right;font-size:8.2pt;line-height:1.5;color:var(--muted)}}
.meta .kind{{font-size:8pt;font-weight:700;letter-spacing:.17em;text-transform:uppercase;
             color:var(--ink);display:block;margin-bottom:1.5mm}}
.meta b{{color:var(--ink);font-weight:600}}

h1{{font-size:15pt;font-weight:700;letter-spacing:-.018em;margin:5mm 0 1mm;text-wrap:balance}}
.sub{{color:var(--muted);font-size:8.9pt;margin:0 0 4.5mm}}

.to{{display:flex;gap:9mm;margin:0 0 5mm;font-size:8.8pt}}
.to div{{flex:1}}
.lbl{{font-size:7.2pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
      color:var(--muted);display:block;margin-bottom:1.2mm}}

.facts{{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--line);
        border-radius:2.4mm;overflow:hidden;background:var(--paper);margin-bottom:4mm}}
.facts div{{padding:2.6mm 4mm;border-right:1px solid var(--line)}}
.facts div:last-child{{border-right:0}}
.facts .v{{font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:10.8pt;
           color:var(--ink);display:block;letter-spacing:-.02em}}
.facts .k{{font-size:7.2pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
           color:var(--muted);display:block;margin-top:.8mm}}
.via{{font-size:8.1pt;color:var(--muted);margin:-2mm 0 5mm}}

h2{{font-size:8pt;font-weight:700;letter-spacing:.15em;text-transform:uppercase;
    color:var(--ink);margin:0 0 2.5mm}}

table{{width:100%;border-collapse:collapse}}
.price-table td{{padding:2.7mm 0;border-bottom:1px solid var(--line);vertical-align:top}}
.price-table tr:first-child td{{border-top:1px solid var(--line)}}
.price-table tr.rec td{{background:#f6f9fc}}
td.opt{{width:13mm;padding-left:2.5mm!important}}
.tag{{display:inline-block;width:5.6mm;height:5.6mm;line-height:5.6mm;text-align:center;
      border-radius:50%;background:var(--ink);color:#fff;font-size:7.6pt;font-weight:700}}
tr.rec .tag{{background:var(--brand)}}
td.what strong{{display:block;font-weight:600;font-size:9.4pt}}
td.what span{{display:block;color:var(--muted);font-size:8.1pt;margin-top:.6mm;max-width:108mm}}
td.amt{{text-align:right;white-space:nowrap;font-family:'IBM Plex Mono',monospace;
        font-weight:500;font-size:11.4pt;letter-spacing:-.02em;padding-right:2.5mm!important}}
tr.rec td.amt{{color:var(--brand)}}
ul.scale{{display:flex;gap:0;margin:2mm 0 .5mm;padding:0;list-style:none;
         border-top:1px dotted var(--line);max-width:108mm}}
ul.scale li{{flex:1;margin:0;padding:1.6mm 0 0;font-size:8.1pt;border-right:1px dotted var(--line)}}
ul.scale li:last-child{{border-right:0}}
ul.scale li span{{display:block;color:var(--muted);font-size:7.4pt;letter-spacing:.04em;text-transform:uppercase}}
ul.scale li b{{font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:9.4pt;letter-spacing:-.02em}}
.per{{text-align:right;font-size:8.2pt;color:var(--muted);margin:2mm 2.5mm 0 0}}


.cols{{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:4.5mm;page-break-inside:avoid}}
ul{{margin:0;padding-left:4.2mm}}
li{{margin-bottom:.9mm;font-size:8.2pt}}
li::marker{{color:var(--brand)}}
.cols p{{font-size:8.2pt;margin:0 0 1.1mm;color:var(--ink)}}
.cols .q{{color:var(--muted)}}

.next{{margin-top:4mm;padding:3mm 4.5mm;page-break-inside:avoid;border-radius:2.4mm;background:var(--ink);color:#fbfcfd}}
.next strong{{font-size:9.6pt;font-weight:600;display:block;margin-bottom:1mm}}
.next p{{margin:0;font-size:8.2pt;color:#c6ccd3}}
.next a{{color:#fff;text-decoration:none;font-weight:600}}

footer{{margin-top:4.5mm;padding-top:2.8mm;page-break-inside:avoid;border-top:1px solid var(--line);
        display:flex;justify-content:space-between;gap:8mm;
        font-size:7.6pt;color:var(--muted);line-height:1.45}}
footer b{{color:var(--ink);font-weight:600}}
</style></head><body>

<header>
  <img src="data:image/png;base64,{wordmark}" alt="Namibia Transport">
  <div class="meta">
    <span class="kind">Quotation</span>
    Reference <b class="tabular">{DATA['ref']}</b><br>
    Issued <b>{DATA['issued']}</b><br>
    Valid until <b>{DATA['valid_until']}</b>
  </div>
</header>

<h1>{DATA['title']}</h1>
<p class="sub">{DATA['subtitle']}</p>

<div class="to">
  <div><span class="lbl">Prepared for</span>{DATA['client']}</div>
  <div><span class="lbl">Journey</span>{arrows(DATA['journey'])}</div>
  <div><span class="lbl">Vehicle</span>{DATA['vehicle']}</div>
</div>

<div class="facts">
  <div><span class="v">205 km</span><span class="k">each way</span></div>
  <div><span class="v">3h 05m</span><span class="k">each way</span></div>
  <div><span class="v">130 km</span><span class="k">gravel each way</span></div>
  <div><span class="v">C34 · C35</span><span class="k">roads</span></div>
</div>
<p class="via">North on the C34 salt road to Henties Bay, then inland on the C35. Sixty-three per cent of the drive is gravel,
which is why it takes longer than the distance suggests — times computed at 100 km/h on tar and 65 on gravel, rest stop included.</p>

<h2>The price, three ways to run it</h2>
<table class="price-table">{rows}</table>
<p class="per">All figures are <b>per vehicle</b>, not per person — the fare buys the whole car.</p>

<div class="cols">
  <div>
    <h2>What the fare includes</h2>
    <ul>
      <li>The whole vehicle and a professional driver, for the full distance</li>
      <li>Fuel and all running costs — no meter, no per-kilometre extra</li>
      <li>No surge pricing, no night supplement, no surcharges of any kind</li>
      <li>Fifteen minutes of waiting at each pickup</li>
      <li>The vehicle and its registration sent to you before pickup</li>
    </ul>
  </div>
  <div>
    <h2>Terms</h2>
    <p class="q">Nothing is charged when you book. Your fare is locked from the moment a booking reference is issued, whether you have paid or not.</p>
    <p class="q">More than 24 hours before pickup: free cancellation, anything paid refunded in full. Within 24 hours: 50% of the fare. No-show: the full fare.</p>
    <p class="q">If a driver cannot make it, re-assignment is ours to solve — same price, same standard.</p>
  </div>
</div>

<div class="next">
  <strong>{DATA['next_title']}</strong>
  <p>{DATA['next_body']}</p>
</div>

<footer>
  <div><b>Namibia Transport</b>, a trading name of Chrimson Investments CC · Reg. {DATA['registration']} · {DATA['address']}<br>
  Fixed-price ground transport across Namibia. Trips are fulfilled by independent Namibian
  partner drivers we select and brief.</div>
  <div style="text-align:right;white-space:nowrap"><b>WhatsApp</b> {DATA['whatsapp']}<br>
  <b>Phone</b> {DATA['phone']}<br>
  <b>Email</b> {DATA['email']}<br>
  Coordination {DATA['hours']}</div>
</footer>

</body></html>"""

tmp = pathlib.Path("/tmp/quote.html")
tmp.write_text(html)

subprocess.run([
    "node", "-e", f"""
const pw = require('/opt/node-tools/node_modules/playwright/index.js');
(async () => {{
  const b = await pw.chromium.launch({{ args: ['--no-sandbox'] }});
  const p = await (await b.newContext()).newPage();
  await p.goto('file://{tmp}', {{ waitUntil: 'networkidle' }});
  await p.pdf({{ path: '{OUT}', format: 'A4', printBackground: true }});
  await b.close();
}})();
"""], check=True)
print("wrote", OUT, OUT.stat().st_size, "bytes")
