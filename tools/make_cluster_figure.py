"""Draw the clustering figure in the research section of the top page.

Usage: python tools/make_cluster_figure.py

One hand-placed data set is shown three ways: crisp nearest-centroid
assignment, fuzzy c-means memberships, and a rough split into lower
approximations and a boundary region (rough c-means style distance-ratio rule).
The three panels share the fuzzy c-means centroids, so only the representation
changes between them.

The script rewrites the three <svg data-panel="..."> elements and the fuzzy
panel's callout (position and membership values) in index.html and
en/index.html. The SVGs hold no text; every label is HTML in the pages, so edit
the wording there.
"""
import re
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[1]
PAGES = [REPO / "index.html", REPO / "en" / "index.html"]

W, H = 300, 240          # SVG viewBox
AX_X, AX_Y = 20, 222     # axis origin
ZETA = 1.6               # rough rule: a point is in the boundary if d_far / d_near <= ZETA

# Benign sits upper left and malignant lower right, so the corners beyond each
# cluster stay free for the in-plot labels (top left, bottom right, top right).
BENIGN = [(64, 62), (96, 56), (128, 66), (50, 94), (82, 88), (112, 94),
          (140, 100), (68, 122), (100, 124), (42, 146), (124, 80)]
MALIG = [(188, 120), (218, 112), (250, 122), (276, 138), (200, 146), (230, 142),
         (262, 160), (182, 170), (212, 172), (240, 168)]
BETWEEN = [(146, 134), (172, 108), (134, 160), (118, 186)]
X = np.array(BENIGN + MALIG + BETWEEN, float)
CALLOUT = len(BENIGN) + len(MALIG) + 1   # the boundary point whose memberships are shown

# Must match --fr-benign and --fr-malig in home.css (used to mix the fuzzy points' fills).
BENIGN_HEX, MALIG_HEX = "#2f6ea5", "#c25539"


def fcm(X, V, m=2.0, iters=200):
    for _ in range(iters):
        d2 = ((X[:, None, :] - V[None, :, :]) ** 2).sum(-1) + 1e-9
        U = 1.0 / ((d2[:, :, None] / d2[:, None, :]) ** (1 / (m - 1))).sum(-1)
        Um = U ** m
        V = (Um.T @ X) / Um.sum(0)[:, None]
    return U, V


U, V = fcm(X, np.array([[95, 90], [220, 145]], float))
vb, vm = V
dist = np.sqrt(((X[:, None, :] - V[None, :, :]) ** 2).sum(-1))
NEAR = dist.argmin(1)                                  # 0 benign, 1 malignant
BOUNDARY = dist.max(1) / dist.min(1) <= ZETA


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


# --- colour mixing in OKLab for the fuzzy panel ---------------------------------
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin_to_srgb(c):
    c = min(max(c, 0), 1)
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_to_oklab(h):
    r, g, b = (srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def oklab_to_hex(L, a, b):
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    return "#" + "".join(f"{round(lin_to_srgb(c) * 255):02x}" for c in rgb)


LAB_B, LAB_M = hex_to_oklab(BENIGN_HEX), hex_to_oklab(MALIG_HEX)


def mix(u):
    """Fill for a point whose membership in the benign cluster is u."""
    return oklab_to_hex(*(u * p + (1 - u) * q for p, q in zip(LAB_B, LAB_M)))


# --- geometry -------------------------------------------------------------------
def clip_half(poly, n, c):
    """Keep the part of poly where n . p <= c (Sutherland-Hodgman, one edge)."""
    out = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        fp, fq = n[0] * p[0] + n[1] * p[1] - c, n[0] * q[0] + n[1] * q[1] - c
        if fp <= 0:
            out.append(p)
        if fp * fq < 0:
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def poly_d(poly):
    return "M" + " L".join(f"{f(x)} {f(y)}" for x, y in poly) + " Z"


def apollonius(A, B, k):
    """Disk of the points P with |PA| <= k |PB| (k < 1)."""
    return (A - k * k * B) / (1 - k * k), k * np.linalg.norm(A - B) / (1 - k * k)


# --- SVG ------------------------------------------------------------------------
def pt(x, y, cls, fill=None):
    fill = f' fill="{fill}"' if fill else ""
    return f'<circle class="fr-pt{cls}" cx="{f(x)}" cy="{f(y)}" r="6"{fill}/>'


def rings():
    return "<g>" + "".join(f'<circle class="fr-ring" cx="{f(x)}" cy="{f(y)}" r="11"/>'
                           for (x, y), b in zip(X, BOUNDARY) if b) + "</g>"


def cluster_cls(i):
    return " fr-pt-benign" if i == 0 else " fr-pt-malig"


def hard_panel():
    n = vb - vm                                   # bisector: n . p = c
    c = n @ (vb + vm) / 2
    rect = [(0, 0), (W, 0), (W, H), (0, H)]
    side_m, side_b = clip_half(rect, n, c), clip_half(rect, -n, -c)
    a, b = [p for p in side_m if abs(n @ np.array(p) - c) < 1e-6]
    return [], [
        f'<path class="fr-zone-benign" d="{poly_d(side_b)}"/>',
        f'<path class="fr-zone-malig" d="{poly_d(side_m)}"/>',
        f'<path class="fr-divider" d="M{f(a[0])} {f(a[1])} L{f(b[0])} {f(b[1])}"/>',
        rings(),
        "<g>" + "".join(pt(x, y, cluster_cls(i)) for (x, y), i in zip(X, NEAR)) + "</g>",
    ]


def fuzzy_panel():
    r = 0.95 * float(np.linalg.norm(vb - vm))
    defs = [f'<radialGradient id="fr-halo-{name}">'
            f'<stop offset="0" class="fr-stop-{name}" stop-opacity=".42"/>'
            f'<stop offset=".45" class="fr-stop-{name}" stop-opacity=".2"/>'
            f'<stop offset="1" class="fr-stop-{name}" stop-opacity="0"/></radialGradient>'
            for name in ("benign", "malig")]
    return defs, [
        *(f'<circle class="fr-halo" cx="{f(v[0])}" cy="{f(v[1])}" r="{f(r)}" fill="url(#fr-halo-{name})"/>'
          for v, name in ((vb, "benign"), (vm, "malig"))),
        rings(),
        "<g>" + "".join(pt(x, y, "", mix(u[0])) for (x, y), u in zip(X, U)) + "</g>",
    ]


def rough_panel():
    k = 1 / ZETA
    (cb, rb), (cm, rm) = apollonius(vb, vm, k), apollonius(vm, vb, k)
    defs = ['<pattern id="fr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            '<path class="fr-hatch" d="M0 0 V6"/></pattern>']
    return defs, [
        f'<rect width="{W}" height="{H}" fill="url(#fr-hatch)"/>',
        f'<circle class="fr-zone-benign fr-lower-benign" cx="{f(cb[0])}" cy="{f(cb[1])}" r="{f(rb)}"/>',
        f'<circle class="fr-zone-malig fr-lower-malig" cx="{f(cm[0])}" cy="{f(cm[1])}" r="{f(rm)}"/>',
        rings(),
        "<g>" + "".join(pt(x, y, " fr-pt-bound" if b else cluster_cls(i))
                        for (x, y), i, b in zip(X, NEAR, BOUNDARY)) + "</g>",
    ]


def svg(name, defs, body, indent, nl):
    """The panel's SVG as lines indented like the <svg> tag it replaces."""
    inner = indent + "  "
    lines = [f'<svg data-panel="{name}" viewBox="0 0 {W} {H}" focusable="false">',
             f'{inner}<defs><clipPath id="fr-clip-{name}"><rect width="{W}" height="{H}" rx="12"/></clipPath>{"".join(defs)}</defs>',
             f'{inner}<rect class="fr-bg" width="{W}" height="{H}" rx="12"/>',
             f'{inner}<g clip-path="url(#fr-clip-{name})">',
             *(f"{inner}  {line}" for line in body),
             f"{inner}</g>",
             f'{inner}<path class="fr-axis" d="M{AX_X} 12 V{AX_Y} H{W - 10} M{AX_X - 4} 18 L{AX_X} 12 L{AX_X + 4} 18'
             f' M{W - 16} {AX_Y - 4} L{W - 10} {AX_Y} L{W - 16} {AX_Y + 4}"/>',
             f'{inner}<rect class="fr-frame" x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="11.5"/>',
             f"{indent}</svg>"]
    return nl.join(lines)


PANELS = {"hard": hard_panel(), "fuzzy": fuzzy_panel(), "rough": rough_panel()}
SVG_RE = re.compile(r'(?P<indent>[ \t]*)<svg data-panel="(?P<name>\w+)"[^>]*>.*?</svg>', re.S)


def update(path):
    with open(path, encoding="utf-8", newline="") as src:   # keep the file's line endings
        text = src.read()
    nl = "\r\n" if "\r\n" in text else "\n"
    names = []

    def repl(m):
        names.append(m["name"])
        defs, body = PANELS[m["name"]]
        return m["indent"] + svg(m["name"], defs, body, m["indent"], nl)

    text = SVG_RE.sub(repl, text)
    if sorted(names) != sorted(PANELS):
        raise SystemExit(f"{path}: expected one <svg data-panel> each for {sorted(PANELS)}, found {names}")
    px, py = X[CALLOUT]
    text, n = re.subn(r'(<span class="fr-callout" style=")[^"]*(")',
                      rf"\g<1>left:{f(px / W * 100)}%;top:{f(py / H * 100)}%\g<2>", text)
    for i, cluster in enumerate(("benign", "malig")):
        text, m = re.subn(rf'(<span data-u="{cluster}">)[^<]*(<)', rf"\g<1>{U[CALLOUT, i]:.2f}\g<2>", text)
        n += m
    if n != 3:
        raise SystemExit(f"{path}: expected one fr-callout with data-u=benign and data-u=malig")
    with open(path, "w", encoding="utf-8", newline="") as out:
        out.write(text)
    print("updated", path.relative_to(REPO).as_posix())


def main():
    assert BOUNDARY[CALLOUT], "the callout point must be in the boundary region"
    print("centroids", V.round(1).tolist())
    print("boundary points", [X[i].tolist() for i in np.flatnonzero(BOUNDARY)])
    print("callout memberships", U[CALLOUT].round(2).tolist())
    for page in PAGES:
        update(page)


if __name__ == "__main__":
    main()
