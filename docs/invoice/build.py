"""Regenerate the branded invoice workbook.

    /usr/local/bin/python3.13 docs/invoice/build.py

The fares in ROUTES and the vehicle multipliers are MIRRORED from
lib/catalog.ts, not derived from it — a deliberate copy, because a
spreadsheet cannot import TypeScript. When a published fare changes there,
change it here and re-run, or the invoices will quote a price the website
no longer offers. That is the one thing in this file that can silently rot.

Arial, not Archivo: the brand face is not installed on most machines and a
substituted font would be worse than an honest fallback. The wordmark is
embedded as an image, so the identity is correct wherever this opens.
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.drawing.image import Image as XLImage
from openpyxl.comments import Comment
from PIL import Image as PILImage

OUT = "/home/user/namibia-transport/docs/invoice/Namibia-Transport-Invoice.xlsx"
LOGO = "/home/user/namibia-transport/docs/invoice/wordmark.png"

# The brand's only written-down colours (app/globals.css + lib/brand-colors.ts).
INK, BRAND, MUTED, PAPER, LINE = "FF11151A", "FF004E94", "FF5F656D", "FFF3F5F6", "FFDBDEE1"
WHITE = "FFFFFFFF"
F = "Arial"   # Archivo is the brand face but is not installed on most machines;
              # the logo image carries it, the data is set in something universal.

MONEY = '"N$"#,##0.00'
DATE  = "dd mmm yyyy"

def font(sz=10, b=False, c=INK, i=False): return Font(name=F, size=sz, bold=b, color=c, italic=i)
def fill(c): return PatternFill("solid", fgColor=c)
def side(c=LINE, s="thin"): return Side(style=s, color=c)

wb = Workbook()

# ───────────────────────────────────────────────────────── Invoice
inv = wb.active
inv.title = "Invoice"
widths = {"A": 3, "B": 50, "C": 14, "D": 8, "E": 15, "F": 17, "G": 5}
for col, w in widths.items(): inv.column_dimensions[col].width = w

ROW_FIRST, ROW_LAST = 16, 30          # line-item rows

inv.row_dimensions[1].height = 8
inv.row_dimensions[2].height = 26

img = XLImage(LOGO)
w0, h0 = PILImage.open(LOGO).size
img.width, img.height = 330, round(330 * h0 / w0)
inv.add_image(img, "B2")

inv["E1"] = "INVOICE"; inv.merge_cells("E1:F1")
inv["E1"].font = font(22, True, INK); inv["E1"].alignment = Alignment(horizontal="right", vertical="center")
inv.row_dimensions[1].height = 30

for r, (label, val) in enumerate(
    [("Invoice no.", None), ("Invoice date", None), ("Payment due", "=IF($F$3=\"\",\"\",$F$3+Settings!$C$25)")], start=2):
    inv[f"E{r}"] = label
    inv[f"E{r}"].font = font(9, False, MUTED); inv[f"E{r}"].alignment = Alignment(horizontal="right")
    c = inv[f"F{r}"]
    if val: c.value = val
    c.font = font(10, True, INK); c.alignment = Alignment(horizontal="right")
    if r in (3, 4): c.number_format = DATE
    if r in (2, 3): c.fill = fill(PAPER)
inv["F2"].number_format = "@"

# Brand rule under the header.
for col in "BCDEF":
    inv[f"{col}5"].border = Border(bottom=side(BRAND, "medium"))
inv.row_dimensions[5].height = 6

inv["B7"] = "FROM"; inv["D7"] = "BILL TO"; inv.merge_cells("D7:F7")
for cell in ("B7", "D7"):
    inv[cell].font = Font(name=F, size=8, bold=True, color=MUTED)

FROM = ["=Settings!$C$4", "=Settings!$C$7", "=Settings!$C$8", "=Settings!$C$9",
        '=IF(Settings!$C$5="","","Reg. no. "&Settings!$C$5)',
        '=IF(Settings!$C$6="","","VAT no. "&Settings!$C$6)']
for i, f in enumerate(FROM):
    c = inv.cell(row=8 + i, column=2, value=f)
    c.font = font(10, i == 0, INK if i == 0 else MUTED)

for i in range(6):
    r = 8 + i
    inv.merge_cells(f"D{r}:F{r}")
    c = inv[f"D{r}"]
    c.font = font(10, i == 0, INK if i == 0 else MUTED)
    c.fill = fill(PAPER)
inv["D8"] = "Okahandja Lodge (Pty) Ltd"
inv["D9"] = "Attn: Maria Shikongo"
inv["D10"] = "accounts@example.na"
inv["D11"] = "+264 81 000 0000"

# ── line-item table
HEAD = [("B", "Description"), ("C", "Travel date"), ("D", "Qty"), ("E", "Rate"), ("F", "Amount")]
for col, label in HEAD:
    c = inv[f"{col}15"]
    c.value = label
    c.font = Font(name=F, size=9, bold=True, color=WHITE)
    c.fill = fill(INK)
    c.alignment = Alignment(horizontal="right" if col in "DEF" else "left", vertical="center")
inv.row_dimensions[15].height = 20

for r in range(ROW_FIRST, ROW_LAST + 1):
    inv.row_dimensions[r].height = 17
    for col in "BCDEF":
        cell = inv[f"{col}{r}"]
        cell.border = Border(bottom=side(LINE))
        cell.font = font(10)
        if col in "DEF": cell.alignment = Alignment(horizontal="right")
    inv[f"C{r}"].number_format = DATE
    # Rate looks the service up in Routes; type over it for anything bespoke.
    inv[f"E{r}"] = f'=IF($B{r}="","",IFERROR(INDEX(Routes!$E$2:$E$17,MATCH($B{r},Routes!$A$2:$A$17,0)),""))'
    inv[f"E{r}"].number_format = MONEY
    inv[f"F{r}"] = f'=IF($B{r}="","",ROUND(IF($D{r}="",1,$D{r})*IF($E{r}="",0,$E{r}),2))'
    inv[f"F{r}"].number_format = MONEY

# One worked example, so the expected shape of a row is visible.
inv["B16"] = "Hosea Kutako Airport to Windhoek - Private Car"
inv["C16"] = "=DATE(2026,11,18)"
inv["D16"] = 1

dv_service = DataValidation(type="list", formula1="=Routes!$A$2:$A$17", allow_blank=True, showErrorMessage=False)
inv.add_data_validation(dv_service)
dv_service.add(f"B{ROW_FIRST}:B{ROW_LAST}")

dv_client = DataValidation(type="list", formula1="=Clients!$A$2:$A$60", allow_blank=True, showErrorMessage=False)
inv.add_data_validation(dv_client)
dv_client.add("D8")

# ── totals
tot = [("Subtotal", f"=ROUND(SUM(F{ROW_FIRST}:F{ROW_LAST}),2)", False),
       ('="VAT @ "&TEXT(Settings!$C$14,"0%")', "=ROUND($F$32*Settings!$C$14,2)", False),
       ("TOTAL DUE", "=ROUND($F$32+$F$33,2)", True)]
for i, (label, formula, strong) in enumerate(tot):
    r = 32 + i
    inv[f"E{r}"] = label
    inv[f"E{r}"].alignment = Alignment(horizontal="right")
    inv[f"F{r}"] = formula
    inv[f"F{r}"].number_format = MONEY
    inv[f"F{r}"].alignment = Alignment(horizontal="right")
    if strong:
        for col in "EF":
            inv[f"{col}{r}"].font = Font(name=F, size=12, bold=True, color=WHITE)
            inv[f"{col}{r}"].fill = fill(BRAND)
        inv.row_dimensions[r].height = 24
    else:
        inv[f"E{r}"].font = font(10, False, MUTED)
        inv[f"F{r}"].font = font(10, True)

# ── how to pay
inv["B36"] = "HOW TO PAY"; inv["B36"].font = Font(name=F, size=8, bold=True, color=MUTED)
PAY = [('="Account name:   "&Settings!$C$18'), ('="Bank:   "&Settings!$C$19'),
       ('="Account number:   "&Settings!$C$20'), ('="Branch code:   "&Settings!$C$21'),
       ('=IF(Settings!$C$22="","","SWIFT:   "&Settings!$C$22)'),
       ('="Payment reference:   "&IF($F$2="","(use the invoice number above)",$F$2)')]
for i, f in enumerate(PAY):
    r = 37 + i
    inv.merge_cells(f"B{r}:F{r}")
    inv[f"B{r}"] = f
    inv[f"B{r}"].font = font(10, i == 5, INK if i == 5 else MUTED)

inv.merge_cells("B44:F44"); inv["B44"] = "=Settings!$C$26"
inv["B44"].font = font(9, False, MUTED); inv["B44"].alignment = Alignment(wrap_text=True, vertical="top")
inv.row_dimensions[44].height = 26

inv.merge_cells("B46:F46")
inv["B46"] = ("Our bank details never change. We will never message you to say our account has changed "
              "- if you receive anything that does, it is not from us. Check with us before sending money.")
inv["B46"].font = Font(name=F, size=8, bold=True, color=BRAND)
inv["B46"].alignment = Alignment(wrap_text=True, vertical="top")
inv.row_dimensions[46].height = 24

inv.sheet_view.showGridLines = False
inv.print_area = "A1:G47"
inv.page_setup.orientation = "portrait"
inv.page_setup.paperSize = inv.PAPERSIZE_A4
inv.page_setup.fitToWidth, inv.page_setup.fitToHeight = 1, 1
inv.sheet_properties.pageSetUpPr.fitToPage = True
inv.page_margins.left = 0.5
inv.page_margins.right = 0.6
inv.page_margins.top = 0.5
inv.page_margins.bottom = 0.5

wb.save(OUT)
print("invoice sheet written")
# Appended to build_invoice.py — the reference sheets the Invoice reads from.
ROUTES = [  # published sedan fares, read out of lib/catalog.ts
    ("Hosea Kutako Airport to Windhoek", 650), ("Hosea Kutako Airport to Swakopmund", 4200),
    ("Windhoek to Swakopmund", 3900), ("Hosea Kutako Airport to Walvis Bay", 4400),
    ("Hosea Kutako Airport to Sossusvlei", 6500), ("Hosea Kutako Airport to Etosha", 6900),
    ("Windhoek to Walvis Bay", 4100), ("Windhoek city transfer (corporate)", 550),
]
VEHICLES = [("Private Car", 1.00), ("SUV / 4x4", 1.40)]   # multipliers from lib/catalog.ts

rt = wb.create_sheet("Routes")
for col, w in {"A": 46, "B": 36, "C": 14, "D": 16, "E": 14, "F": 12}.items():
    rt.column_dimensions[col].width = w
for i, h in enumerate(["Service (this is the dropdown)", "Route", "Vehicle",
                       "Published fare, Private Car", "Rate", "Vehicle multiplier"], start=1):
    c = rt.cell(row=1, column=i, value=h)
    c.font = Font(name=F, size=9, bold=True, color=WHITE); c.fill = fill(INK)
    c.alignment = Alignment(wrap_text=True, vertical="center")
rt.row_dimensions[1].height = 28

r = 2
for route, base in ROUTES:
    for veh, mult in VEHICLES:
        rt.cell(row=r, column=1, value=f"{route} - {veh}").font = font(10)
        rt.cell(row=r, column=2, value=route).font = font(10, False, MUTED)
        rt.cell(row=r, column=3, value=veh).font = font(10, False, MUTED)
        c = rt.cell(row=r, column=4, value=base); c.font = font(10); c.number_format = MONEY
        c = rt.cell(row=r, column=5, value=f"=ROUND(D{r}*F{r},2)"); c.font = font(10, True); c.number_format = MONEY
        c = rt.cell(row=r, column=6, value=mult); c.font = font(10); c.number_format = "0.00"
        r += 1
rt["A20"] = ("Fares are the published per-vehicle prices from the website. The fare buys the whole "
             "vehicle - passenger count never multiplies it. The SUV multiplier is the one the site "
             "prices with; change a base fare here and every new invoice follows.")
rt.merge_cells("A20:F21")
rt["A20"].font = font(9, False, MUTED); rt["A20"].alignment = Alignment(wrap_text=True, vertical="top")
rt.sheet_view.showGridLines = False

# ───────────────────────────────────────────────────────── Clients
cl = wb.create_sheet("Clients")
for col, w in {"A": 34, "B": 24, "C": 30, "D": 20, "E": 34, "F": 20}.items():
    cl.column_dimensions[col].width = w
for i, h in enumerate(["Client (this is the dropdown)", "Contact person", "Email", "Phone",
                       "Address", "Their VAT / Reg no."], start=1):
    c = cl.cell(row=1, column=i, value=h)
    c.font = Font(name=F, size=9, bold=True, color=WHITE); c.fill = fill(INK)
cl.append(["Okahandja Lodge (Pty) Ltd", "Maria Shikongo", "accounts@example.na",
           "+264 81 000 0000", "PO Box 1234, Okahandja", "CC/2019/01234"])
for c in cl[2]: c.font = font(10)
cl["A4"] = "Example row above - overwrite it. Add one row per client; they appear in the BILL TO dropdown."
cl.merge_cells("A4:F4"); cl["A4"].font = font(9, False, MUTED)
cl.sheet_view.showGridLines = False

# ───────────────────────────────────────────────────────── Settings
st = wb.create_sheet("Settings")
for col, w in {"A": 3, "B": 36, "C": 46}.items(): st.column_dimensions[col].width = w

def heading(row, text):
    st[f"B{row}"] = text
    st[f"B{row}"].font = Font(name=F, size=9, bold=True, color=WHITE)
    st[f"B{row}"].fill = fill(INK)
    st[f"C{row}"].fill = fill(INK)

def row(r, label, value=None, note=None, fmt=None, editable=True):
    st[f"B{r}"] = label; st[f"B{r}"].font = font(10, False, MUTED)
    c = st[f"C{r}"]
    if value is not None: c.value = value
    c.font = font(10, True, INK)
    if fmt: c.number_format = fmt
    if editable: c.fill = fill(PAPER); c.border = Border(bottom=side(LINE))
    if note: c.comment = Comment(note, "Namibia Transport")

heading(2, "COMPANY")
row(3, "Trading name", "Namibia Transport")
row(4, "Name shown on the invoice", "Namibia Transport")
row(5, "Company registration no.", "", "Fill in. Leave blank and the line is hidden on the invoice.")
row(6, "VAT registration no.", "", "Fill in ONLY if you are VAT registered. Leave blank and the line is hidden.")
row(7, "Address", "Windhoek, Namibia")
row(8, "Email", "bookings@namibiatransport.com")
row(9, "Phone / WhatsApp", "+264 81 278 4828")
row(10, "Website", "namibiatransport.com")

heading(12, "TAX")
st["B13"] = ("Namibia VAT is 15%, and registration is compulsory above N$500,000 turnover in 12 months. "
             "Set the rate to 15% ONLY if you are registered - charging VAT without a registration number "
             "is an offence, and so is omitting it once you are registered.")
st.merge_cells("B13:C13"); st["B13"].font = font(9, False, MUTED)
st["B13"].alignment = Alignment(wrap_text=True, vertical="top"); st.row_dimensions[13].height = 40
row(14, "VAT rate", 0, "0 = not registered. Enter 15% (or 0.15) once you are.", "0%")

heading(16, "BANK DETAILS")
st["B17"] = "These appear on every invoice under HOW TO PAY. Fill them in once."
st.merge_cells("B17:C17"); st["B17"].font = font(9, False, MUTED)
for i, label in enumerate(["Account name", "Bank", "Account number", "Branch code",
                           "SWIFT (for payments from abroad)"], start=18):
    row(i, label, "")

heading(24, "TERMS")
row(25, "Payment due (days after invoice)", 7, None, "0")
row(26, "Terms line shown on the invoice",
    "Payment confirms the vehicle. Your fare is held at the quoted amount until then.")
st["C26"].alignment = Alignment(wrap_text=True, vertical="top"); st.row_dimensions[26].height = 30

heading(29, "HOW TO USE THIS WORKBOOK")
LEGEND = [
    "Shaded cells are the ones you fill in. Everything else is a formula - leave it alone.",
    "1. Fill in this Settings sheet once: company details, VAT rate, bank details, terms.",
    "2. Add your clients on the Clients sheet. They appear in the BILL TO dropdown.",
    "3. On the Invoice sheet: type the invoice number and date, pick the client, then pick each",
    "    service from the Description dropdown. The rate fills itself from the Routes sheet.",
    "4. For anything not on the Routes list, type your own description and type the rate over the formula.",
    "5. Save a copy per invoice (File > Save As), and log it on the Register sheet.",
    "",
    "The Invoice sheet is set up to print on one A4 page. Print to PDF to send it.",
    "The font is Arial so it renders anywhere. The logo is the brand face (Archivo) as an image,",
    "so the identity is right even on a machine that has never heard of Archivo.",
]
for i, line in enumerate(LEGEND, start=30):
    st[f"B{i}"] = line; st.merge_cells(f"B{i}:C{i}")
    st[f"B{i}"].font = font(9, False, INK if line.startswith(("1.", "2.", "3.", "4.", "5.")) else MUTED)
st.sheet_view.showGridLines = False

# ───────────────────────────────────────────────────────── Register
rg = wb.create_sheet("Register")
for col, w in {"A": 16, "B": 14, "C": 32, "D": 14, "E": 14, "F": 14, "G": 14, "H": 26}.items():
    rg.column_dimensions[col].width = w
for i, h in enumerate(["Invoice no.", "Date", "Client", "Subtotal", "VAT", "Total",
                       "Paid on", "Notes"], start=1):
    c = rg.cell(row=1, column=i, value=h)
    c.font = Font(name=F, size=9, bold=True, color=WHITE); c.fill = fill(INK)
for r in range(2, 60):
    for i, fmt in enumerate([None, DATE, None, MONEY, MONEY, MONEY, DATE, None], start=1):
        c = rg.cell(row=r, column=i); c.font = font(10)
        if fmt: c.number_format = fmt
        c.fill = fill(PAPER); c.border = Border(bottom=side(LINE))
rg["A61"] = "Total invoiced"; rg["A61"].font = font(10, True)
for col, letter in (("D", "D"), ("E", "E"), ("F", "F")):
    c = rg[f"{letter}61"]; c.value = f"=ROUND(SUM({letter}2:{letter}59),2)"
    c.font = font(10, True); c.number_format = MONEY
rg["H61"] = "One row per invoice you issue."
rg["H61"].font = font(9, False, MUTED)
rg.sheet_view.showGridLines = False

wb.save(OUT)
print("all sheets written ->", OUT)
