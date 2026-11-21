import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

FONT = sys.argv[1]
OUT = sys.argv[2]
S, PAD, R = 1024, 100, 185          # macOS icon grid: 824px tile, ~22% corner radius
T = S - 2 * PAD

NAVY_DEEP = (9, 30, 58)
NAVY = (27, 83, 136)               # site primary #1B5388
BLUE = (37, 99, 235)               # logo "info" blue
SKY = (125, 200, 255)              # logo "Tech" light blue
GOLD = (240, 165, 60)              # course-cover gold #F0A53C
WHITE = (255, 255, 255)

def font(size, weight=700, width=100):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_axes([width, weight])
    return f

def vgrad(w, h, top, bottom):
    g = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / (h - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return g.resize((w, h))

def diag(w, h, a, b):
    g = Image.new('RGB', (w, h))
    px = g.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return g

def mask(w, h, r):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=255)
    return m

def finish(tile_rgba):
    """Place the tile on the 1024 canvas with a soft shadow, like macOS icons."""
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sm = Image.new('L', (S, S), 0)
    ImageDraw.Draw(sm).rounded_rectangle((PAD, PAD + 12, PAD + T, PAD + T + 12), radius=R, fill=90)
    shadow.putalpha(sm.filter(ImageFilter.GaussianBlur(18)))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(tile_rgba, (PAD, PAD))
    return canvas

def square_dot(d, x, y, f, text_before, col, gap_ratio=0.42):
    """Square tittle centred over the stem of the dotless i (ignoring the glyph's top spur)."""
    gx = x + d.textlength(text_before, font=f)
    full = d.textbbox((gx, y), 'ı', font=f)
    # Ink of the lower half of the glyph = the plain stem.
    m = Image.new('L', (int(full[2]) + 4, int(full[3]) + 4), 0)
    ImageDraw.Draw(m).text((gx, y), 'ı', font=f, fill=255)
    mid = int((full[1] + full[3]) / 2)
    lower = m.crop((0, mid, m.width, int(full[3]))).getbbox()
    stem_l, stem_r = lower[0], lower[2]
    w = (stem_r - stem_l) * 1.0
    cx = (stem_l + stem_r) / 2
    top = full[1]
    d.rectangle((cx - w / 2, top - w * (1 + gap_ratio), cx + w / 2, top - w * gap_ratio), fill=col)

def wordmark(draw_on, cx, cy, size, info_col, tech_col, dot_col, weight=700, max_w=None):
    """'InfoTech' on one line (logo-style dotless i with a square gold dot), fitted to max_w."""
    d = ImageDraw.Draw(draw_on)
    while True:
        f = font(size, weight)
        wi = d.textlength('ınfo', font=f); wt = d.textlength('Tech', font=f)
        gap = size * 0.06
        total = wi + gap + wt
        if not max_w or total <= max_w or size < 40:
            break
        size -= 4
    x0 = cx - total / 2
    # centre on the cap height of "T"
    tb = d.textbbox((0, 0), 'T', font=f)
    y0 = cy - (tb[1] + tb[3]) / 2
    d.text((x0, y0), 'ınfo', font=f, fill=info_col)
    d.text((x0 + wi + gap, y0), 'Tech', font=f, fill=tech_col)
    square_dot(d, x0, y0, f, '', dot_col)
    return x0, y0, total, f

# ── A: Navy night — deep gradient, white/sky wordmark, gold rule ──────────────
def concept_a():
    tile = vgrad(T, T, NAVY, NAVY_DEEP).convert('RGBA')
    # soft light from the top-left
    glow = Image.new('L', (T, T), 0)
    ImageDraw.Draw(glow).ellipse((-T * 0.35, -T * 0.55, T * 0.85, T * 0.45), fill=70)
    tile = Image.composite(Image.new('RGBA', (T, T), (90, 160, 230, 255)), tile, glow.filter(ImageFilter.GaussianBlur(90)))
    x0, y0, total, f = wordmark(tile, T / 2, T * 0.45, 200, WHITE, SKY, GOLD, max_w=T * 0.76)
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle((T / 2 - 70, T * 0.66, T / 2 + 70, T * 0.66 + 16), radius=8, fill=GOLD)
    sub = font(44, 500)
    label = 'TRAINING INSTITUTE'
    lw = d.textlength(label, font=sub)
    # letter-spaced caption
    spacing = 6; x = T / 2 - (lw + spacing * (len(label) - 1)) / 2
    for ch in label:
        d.text((x, T * 0.73), ch, font=sub, fill=(188, 224, 255))
        x += d.textlength(ch, font=sub) + spacing
    tile.putalpha(mask(T, T, R))
    return finish(tile)

# ── B: Desktop window — white app window on a blue gradient ──────────────────
def concept_b():
    tile = diag(T, T, (59, 130, 246), NAVY).convert('RGBA')
    d = ImageDraw.Draw(tile)
    m = 92                                           # window inset
    win = (m, m + 40, T - m, T - m + 10)
    # window shadow
    sh = Image.new('L', (T, T), 0)
    ImageDraw.Draw(sh).rounded_rectangle((win[0], win[1] + 18, win[2], win[3] + 18), radius=60, fill=120)
    tile = Image.composite(Image.new('RGBA', (T, T), (8, 28, 60, 255)), tile, sh.filter(ImageFilter.GaussianBlur(26)))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle(win, radius=60, fill=WHITE)
    # title bar with three dots
    bar_h = 96
    d.rounded_rectangle((win[0], win[1], win[2], win[1] + bar_h), radius=60, fill=(232, 240, 252))
    d.rectangle((win[0], win[1] + bar_h - 40, win[2], win[1] + bar_h), fill=(232, 240, 252))
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        cx = win[0] + 62 + i * 52; cy = win[1] + bar_h / 2
        d.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), fill=c)
    body_cy = (win[1] + bar_h + win[3]) / 2
    wordmark(tile, T / 2, body_cy - 24, 160, BLUE, (56, 150, 230), GOLD, max_w=(win[2] - win[0]) * 0.80)
    # three "content lines" under the wordmark, suggesting the admin
    d = ImageDraw.Draw(tile)
    for i, w in enumerate([300, 220]):
        y = body_cy + 88 + i * 34
        d.rounded_rectangle((T / 2 - w / 2, y, T / 2 + w / 2, y + 14), radius=7, fill=(214, 228, 245))
    tile.putalpha(mask(T, T, R))
    return finish(tile)

# ── C: Stacked bold — "Info" over "Tech" on white, gold corner arc ──────────
def concept_c():
    tile = vgrad(T, T, (255, 255, 255), (232, 241, 252)).convert('RGBA')
    d = ImageDraw.Draw(tile)
    # big navy arc from the bottom-right corner, with a gold edge
    arc = Image.new('L', (T, T), 0)
    ImageDraw.Draw(arc).ellipse((T * 0.60, T * 0.74, T * 1.7, T * 1.8), fill=255)
    tile = Image.composite(Image.new('RGBA', (T, T), NAVY + (255,)), tile, arc)
    ring = Image.new('L', (T, T), 0)
    ImageDraw.Draw(ring).ellipse((T * 0.60, T * 0.74, T * 1.7, T * 1.8), outline=255, width=14)
    tile = Image.composite(Image.new('RGBA', (T, T), GOLD + (255,)), tile, ring)
    f = font(236, 700, 92)
    d = ImageDraw.Draw(tile)
    x = T * 0.12
    d.text((x, T * 0.16), 'ınfo', font=f, fill=BLUE)
    d.text((x, T * 0.42), 'Tech', font=f, fill=(56, 150, 230))
    square_dot(d, x, T * 0.16, f, '', GOLD)
    tile.putalpha(mask(T, T, R))
    return finish(tile)

icons = {'A': concept_a(), 'B': concept_b(), 'C': concept_c()}
for k, im in icons.items():
    im.save(f'{OUT}/icon-{k}.png')

# Comparison sheet: each concept large, plus Dock (128) and taskbar (32) sizes.
sheet = Image.new('RGBA', (3 * 560 + 40, 760), (241, 245, 249, 255))
d = ImageDraw.Draw(sheet)
lab = font(40, 600)
names = {'A': 'A · Navy night', 'B': 'B · Desktop window', 'C': 'C · Stacked + arc'}
for i, (k, im) in enumerate(icons.items()):
    x = 20 + i * 560
    sheet.alpha_composite(im.resize((520, 520), Image.LANCZOS), (x + 20, 20))
    sheet.alpha_composite(im.resize((128, 128), Image.LANCZOS), (x + 120, 560))
    sheet.alpha_composite(im.resize((64, 64), Image.LANCZOS), (x + 280, 592))
    sheet.alpha_composite(im.resize((32, 32), Image.LANCZOS), (x + 380, 608))
    d.text((x + 30, 700), names[k], font=lab, fill=(30, 41, 59))
sheet.save(f'{OUT}/concepts.png')
print('ok')
