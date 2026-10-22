"""Generate 1200x630 OGP images for omu-hi.github.io.

Usage: python tools/make_ogp.py
Writes assets/ogp/{top,honda,ubukata}.png and their English versions
(*-en.png) for the pages under /en/. Requires Pillow and the Windows
fonts Noto Sans JP (NotoSansJP-VF.ttf) and Consolas. Rerun after changing a
name, role or photo, and keep the og:image / JSON-LD text in the pages in sync.
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "assets" / "ogp"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1200, 630
M = 72  # outer margin
SCALE = 2  # supersample for smooth edges

TEXT = "#171717"
SEC = "#4d4d4d"
MUTED = "#666666"
BORDER = "#ebebeb"
SURFACE = "#fafafa"
BADGE_BG = "#ebf5ff"
BADGE_TEXT = "#0068d6"
ACCENTS = ["#0a72ef", "#de1d8d", "#ff5b4f"]

JP = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
MONO = r"C:\Windows\Fonts\consola.ttf"


def jp(size, weight):
    f = ImageFont.truetype(JP, size * SCALE)
    f.set_variation_by_axes([weight])
    return f


def mono(size):
    return ImageFont.truetype(MONO, size * SCALE)


def s(v):
    return int(round(v * SCALE))


def canvas():
    im = Image.new("RGB", (W * SCALE, H * SCALE), "#ffffff")
    return im, ImageDraw.Draw(im)


def text(d, xy, txt, font, fill):
    d.text((s(xy[0]), s(xy[1])), txt, font=font, fill=fill)


def text_w(d, txt, font):
    return d.textlength(txt, font=font) / SCALE


def fit(d, txt, max_w, size, weight):
    """Largest Noto Sans JP font up to `size` px that keeps txt within max_w."""
    while True:
        f = jp(size, weight)
        if size <= 12 or text_w(d, txt, f) <= max_w:
            return f
        size -= 2


def badge(d, x, y, label):
    f = jp(26, 600)
    tw = text_w(d, label, f)
    h = 44
    d.rounded_rectangle([s(x), s(y), s(x + tw + 36), s(y + h)], radius=s(h / 2), fill=BADGE_BG)
    text(d, (x + 18, y + 3), label, f, BADGE_TEXT)


def card_frame(im, d, box):
    x0, y0, x1, y1 = box
    d.rounded_rectangle([s(x0) - SCALE, s(y0) - SCALE, s(x1) + SCALE, s(y1) + SCALE],
                        radius=s(18), fill=BORDER)


def paste_rounded(im, src, box, radius=16):
    x0, y0, x1, y1 = box
    size = (s(x1 - x0), s(y1 - y0))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=s(radius), fill=255)
    im.paste(src.resize(size, Image.LANCZOS) if src.size != size else src, (s(x0), s(y0)), mask)


def footer(d, lab_line, url, right_limit):
    d.line([s(M), s(512), s(right_limit), s(512)], fill=BORDER, width=s(2))
    text(d, (M, 534), lab_line, fit(d, lab_line, right_limit - M, 28, 600), TEXT)
    text(d, (M, 578), url, mono(24), MUTED)


def save(im, name):
    out = im.resize((W, H), Image.LANCZOS)
    path = OUT / name
    out.save(path, optimize=True)
    print(path, path.stat().st_size)


JA = {"header": "大阪公立大学 大学院情報学研究科", "lab": "人間情報システム研究室（HI研究室）"}
EN = {"header": "Graduate School of Informatics, OMU", "lab": "Human Information Systems Lab (HI Lab)"}


def faculty(name, sub_name, role, photo, url, filename, centering=(0.5, 0.35), lang=JA):
    im, d = canvas()
    px1, py0 = W - M, M
    pw, ph = 360, H - 2 * M
    box = (px1 - pw, py0, px1, py0 + ph)
    left_limit = box[0] - 56
    max_w = left_limit - M

    text(d, (M, M - 6), lang["header"], fit(d, lang["header"], max_w, 28, 500), SEC)
    badge(d, M, 146, role)
    name_font = fit(d, name, max_w, 100, 700)
    text(d, (M, 200 + (100 - name_font.size // SCALE) // 2), name, name_font, TEXT)
    text(d, (M, 340), sub_name, jp(44, 500), MUTED)
    footer(d, lang["lab"], url, left_limit)

    src = Image.open(photo).convert("RGB")
    fitted = ImageOps.fit(src, (s(pw), s(ph)), Image.LANCZOS, centering=centering)
    card_frame(im, d, box)
    paste_rounded(im, fitted, box)
    save(im, filename)


def top(title_lines, subtitle, members, url, filename, lang=JA):
    im, d = canvas()
    px1, py0 = W - M, M
    pw, ph = 360, H - 2 * M
    box = (px1 - pw, py0, px1, py0 + ph)
    left_limit = box[0] - 56
    max_w = left_limit - M

    text(d, (M, M - 6), lang["header"], fit(d, lang["header"], max_w, 28, 500), SEC)
    title = min((fit(d, line, max_w, 80, 700) for line in title_lines), key=lambda f: f.size)
    for i, line in enumerate(title_lines):
        text(d, (M, 140 + 110 * i), line, title, TEXT)
    text(d, (M, 376), subtitle, fit(d, subtitle, max_w, 32, 500), MUTED)
    footer(d, members, url, left_limit)

    # Clustered scatter plot as the visual: three fuzzy clusters with centroids.
    card_frame(im, d, box)
    d.rounded_rectangle([s(box[0]), s(box[1]), s(box[2]), s(box[3])], radius=s(16), fill=SURFACE)
    rng = random.Random(7)
    x0, y0, x1, y1 = box
    centers = [(x0 + 120, y0 + 130), (x0 + 250, y0 + 250), (x0 + 130, y0 + 370)]
    pts = []
    for ci, (cx, cy) in enumerate(centers):
        for _ in range(26):
            pts.append((ci, rng.gauss(cx, 34), rng.gauss(cy, 34)))
    rng.shuffle(pts)
    r = 7
    for ci, x, y in pts:
        x = min(max(x, x0 + 24), x1 - 24)
        y = min(max(y, y0 + 24), y1 - 24)
        d.ellipse([s(x - r), s(y - r), s(x + r), s(y + r)], fill=ACCENTS[ci])
    for ci, (cx, cy) in enumerate(centers):
        R = 15
        d.ellipse([s(cx - R), s(cy - R), s(cx + R), s(cy + R)], fill="#ffffff", outline=TEXT, width=s(4))
    save(im, filename)


if __name__ == "__main__":
    honda, ubukata = REPO / "honda" / "honda_202408.jpg", REPO / "ubukata" / "ubukata.jpg"
    top(["人間情報システム", "研究室"], "Human Information Systems｜HI研究室",
        "本多 克宏 教授 ・ 生方 誠希 准教授", "omu-hi.github.io", "top.png")
    faculty("本多 克宏", "Katsuhiro Honda", "教授", honda,
            "omu-hi.github.io/honda/", "honda.png", centering=(0.5, 0.3))
    faculty("生方 誠希", "Seiki Ubukata", "准教授", ubukata,
            "omu-hi.github.io/ubukata/", "ubukata.png", centering=(0.5, 0.4))

    top(["Human Information", "Systems Laboratory"], "HI Lab｜人間情報システム研究室",
        "Katsuhiro Honda ・ Seiki Ubukata", "omu-hi.github.io/en/", "top-en.png", lang=EN)
    faculty("Katsuhiro Honda", "本多 克宏", "Professor", honda,
            "omu-hi.github.io/en/honda/", "honda-en.png", centering=(0.5, 0.3), lang=EN)
    faculty("Seiki Ubukata", "生方 誠希", "Associate Professor", ubukata,
            "omu-hi.github.io/en/ubukata/", "ubukata-en.png", centering=(0.5, 0.4), lang=EN)
