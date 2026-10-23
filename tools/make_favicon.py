"""Generate the site favicon from simple shapes.

Usage:
  python tools/make_favicon.py --preview DIR   write every design to DIR with a comparison page
  python tools/make_favicon.py DESIGN          write icon.svg, favicon.ico and apple-touch-icon.png

Each design is a list of rectangles and circles on a 64x64 grid. The same list
is written out as SVG and drawn with Pillow for the ICO (16/32/48 px) and the
180 px Apple touch icon, so the raster files always match the SVG. No fonts are
used: letters are built from rectangles.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[1]
GRID = 64
SS = 8  # supersample for smooth edges

GREEN = "#205c4c"   # home.css accent
INK = "#171717"
BLUE, PINK, RED = "#0a72ef", "#de1d8d", "#ff5b4f"  # OGP accents


def rect(x, y, w, h, fill, rx=0, opacity=1):
    return ("rect", dict(x=x, y=y, w=w, h=h, rx=rx, fill=fill, opacity=opacity))


def circle(cx, cy, r, fill="none", stroke=None, sw=0, opacity=1):
    return ("circle", dict(cx=cx, cy=cy, r=r, fill=fill, stroke=stroke, sw=sw, opacity=opacity))


def frame(x, y, w, h, sw, fill):
    """A square outline whose outer edge is the box (x, y, w, h)."""
    return ("frame", dict(x=x, y=y, w=w, h=h, sw=sw, fill=fill))


def tile(fill):
    return rect(0, 0, GRID, GRID, fill, rx=14)


DESIGNS = {
    "hi": dict(
        title="HI モノグラム",
        note="研究室の略称「HI」を長方形だけで組んだ文字。トップページのアクセント色。",
        # Every edge sits on a multiple of 4, i.e. on a whole pixel at 16 px.
        shapes=[tile(GREEN),
                rect(12, 16, 8, 32, "#fff"), rect(28, 16, 8, 32, "#fff"), rect(12, 28, 24, 8, "#fff"),
                rect(44, 16, 8, 32, "#fff")],
    ),
    "clusters": dict(
        title="3つのクラスタ",
        note="OGP 画像と同じ3色の点。データを3つに分けるクラスタリングを表す。",
        shapes=[tile(INK), circle(20, 23, 10.5, BLUE), circle(44, 23, 10.5, PINK), circle(32, 44, 10.5, RED)],
    ),
    "fuzzy": dict(
        title="ファジィな重なり",
        note="2つの円が半透明で重なる。どちらにも少しずつ属する「あいまいな」所属度を表す。",
        shapes=[tile("#fff"), circle(25, 32, 17, BLUE, opacity=.85), circle(39, 32, 17, PINK, opacity=.8)],
    ),
    "centroid": dict(
        title="重心",
        note="散らばった点と、その中心に置いた代表点（重心）。学習デモの k-means の考え方。",
        shapes=[tile(INK),
                circle(16, 18, 5, "#fff"), circle(46, 15, 5, "#fff"), circle(51, 41, 5, "#fff"),
                circle(15, 46, 5, "#fff"), circle(35, 52, 5, "#fff"),
                circle(32, 32, 8, BLUE, stroke="#fff", sw=4)],
    ),
    "rough": dict(
        title="ラフ集合",
        note="内側の塗り（下近似＝確実な領域）と外側の枠（上近似＝可能な領域）。ラフクラスタリングの図式。",
        shapes=[tile(GREEN), frame(12, 12, 40, 40, 4, "#fff"), rect(24, 24, 16, 16, "#fff")],
    ),
}


def svg(shapes):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {GRID} {GRID}">']
    for kind, a in shapes:
        op = f' opacity="{a["opacity"]}"' if a.get("opacity", 1) != 1 else ""
        if kind == "rect" and a["fill"] != "none":
            rx = f' rx="{a["rx"]}"' if a["rx"] else ""
            out.append(f'<rect x="{a["x"]}" y="{a["y"]}" width="{a["w"]}" height="{a["h"]}"{rx} fill="{a["fill"]}"{op}/>')
        elif kind == "frame":
            half = a["sw"] / 2
            out.append(f'<rect x="{a["x"] + half}" y="{a["y"] + half}" width="{a["w"] - a["sw"]}" height="{a["h"] - a["sw"]}" '
                       f'fill="none" stroke="{a["fill"]}" stroke-width="{a["sw"]}"/>')
        elif kind == "circle":
            stroke = f' stroke="{a["stroke"]}" stroke-width="{a["sw"]}"' if a["stroke"] else ""
            out.append(f'<circle cx="{a["cx"]}" cy="{a["cy"]}" r="{a["r"]}" fill="{a["fill"]}"{stroke}{op}/>')
    out.append("</svg>")
    return "\n".join(out) + "\n"


def raster(shapes, size, opaque=False):
    """Draw the shapes at size x size px. opaque=True fills the corners (Apple touch icon)."""
    big, k = size * SS, size * SS / GRID
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if opaque:
        img.paste(shapes[0][1]["fill"], (0, 0, big, big))
    for kind, a in shapes:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        alpha = round(255 * a.get("opacity", 1))
        if kind == "rect" and a["fill"] != "none":
            box = [a["x"] * k, a["y"] * k, (a["x"] + a["w"]) * k - 1, (a["y"] + a["h"]) * k - 1]
            d.rounded_rectangle(box, radius=a["rx"] * k, fill=_rgba(a["fill"], alpha))
        elif kind == "frame":
            box = [a["x"] * k, a["y"] * k, (a["x"] + a["w"]) * k - 1, (a["y"] + a["h"]) * k - 1]
            d.rectangle(box, outline=_rgba(a["fill"], alpha), width=round(a["sw"] * k))
        elif kind == "circle":
            r = a["r"] + (a["sw"] / 2 if a["stroke"] else 0)  # SVG strokes are centred on the edge
            box = [(a["cx"] - r) * k, (a["cy"] - r) * k, (a["cx"] + r) * k, (a["cy"] + r) * k]
            fill = None if a["fill"] == "none" else _rgba(a["fill"], alpha)
            outline = _rgba(a["stroke"], alpha) if a["stroke"] else None
            d.ellipse(box, fill=fill, outline=outline, width=round(a["sw"] * k))
        img = Image.alpha_composite(img, layer)
    img = img.resize((size, size), Image.BOX)  # area average: pixel-aligned edges stay sharp
    return img.convert("RGB") if opaque else img


def _rgba(color, alpha):
    c = color.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def write_icons(name, out=REPO):
    shapes = DESIGNS[name]["shapes"]
    (out / "icon.svg").write_text(svg(shapes), encoding="utf-8")
    sizes = [16, 32, 48]
    icons = [raster(shapes, s) for s in sizes]
    icons[-1].save(out / "favicon.ico", format="ICO", sizes=[(s, s) for s in sizes], append_images=icons[:-1])
    raster(shapes, 180, opaque=True).save(out / "apple-touch-icon.png", optimize=True)
    print(f"wrote icon.svg, favicon.ico, apple-touch-icon.png for '{name}' in {out}")


PREVIEW = """<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>favicon 案</title>
<style>
body{{font:16px/1.6 system-ui,"Yu Gothic",sans-serif;margin:24px;color:#171717;background:#fff}}
h1{{font-size:22px;margin:0 0 4px}} .lead{{color:#555;margin:0 0 20px}}
.opt{{display:grid;grid-template-columns:200px 1fr;gap:16px 24px;align-items:center;padding:18px 0;border-top:1px solid #ddd}}
.opt h2{{font-size:18px;margin:0}} .opt p{{margin:4px 0 0;color:#555}} code{{font-size:14px}}
.sizes{{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}}
.sizes figure{{margin:0;text-align:center;font-size:13px;color:#666}}
.tabs{{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}}
.tab{{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px 8px 0 0;font-size:13px;width:230px}}
.light{{background:#fff;box-shadow:0 0 0 8px #dfe1e5}} .dark{{background:#35363a;color:#e8eaed;box-shadow:0 0 0 8px #202124}}
.pixel{{image-rendering:pixelated}}
</style></head><body>
<h1>favicon 案</h1>
<p class="lead">左から 16・32・48・180px（16・32px の PNG は ICO と同じ描画、拡大図は 16px をそのまま 4 倍）。下はブラウザのタブでの見え方。</p>
{rows}
</body></html>
"""

ROW = """<section class="opt"><div><h2>{title}</h2><p>{note}</p><p><code>{name}</code></p></div>
<div><div class="sizes">
<figure><img src="{name}.svg" width="16" height="16" alt=""><figcaption>16</figcaption></figure>
<figure><img src="{name}.svg" width="32" height="32" alt=""><figcaption>32</figcaption></figure>
<figure><img src="{name}.svg" width="48" height="48" alt=""><figcaption>48</figcaption></figure>
<figure><img class="pixel" src="{name}-16.png" width="64" height="64" alt=""><figcaption>16px×4</figcaption></figure>
<figure><img src="{name}-180.png" width="90" height="90" alt="" style="border-radius:20px"><figcaption>Apple</figcaption></figure>
</div>
<div class="tabs"><div class="tab light"><img src="{name}.svg" width="16" height="16" alt="">人間情報システム研究室</div>
<div class="tab dark"><img src="{name}.svg" width="16" height="16" alt="">人間情報システム研究室</div></div></div></section>"""


def preview(out):
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for name, d in DESIGNS.items():
        (out / f"{name}.svg").write_text(svg(d["shapes"]), encoding="utf-8")
        raster(d["shapes"], 16).save(out / f"{name}-16.png")
        raster(d["shapes"], 180, opaque=True).save(out / f"{name}-180.png")
        rows.append(ROW.format(name=name, **d))
    (out / "index.html").write_text(PREVIEW.format(rows="\n".join(rows)), encoding="utf-8")
    print(f"wrote {len(DESIGNS)} designs and index.html to {out}")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--preview":
        preview(Path(sys.argv[2]))
    elif len(sys.argv) == 2 and sys.argv[1] in DESIGNS:
        write_icons(sys.argv[1])
    else:
        sys.exit(__doc__ + f"\nDesigns: {', '.join(DESIGNS)}")
