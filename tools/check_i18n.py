"""Check that Japanese and English pages point at each other correctly.

Usage: python tools/check_i18n.py
For every page that declares hreflang alternates, verifies that:
  - each alternate URL maps to a page in this repo,
  - every page in the group lists the same alternates (reciprocal links),
  - the page's own <html lang> matches the hreflang that points at it,
  - the canonical URL is the page itself, and
  - the page has a language-switch link to its counterpart.
Exits with status 1 and prints each problem if anything is wrong.
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SITE = "https://omu-hi.github.io"
SKIP = {"backup", "top-v2", "demo"}


def url_of(path):
    rel = path.relative_to(REPO).as_posix()
    return f"{SITE}/{rel[:-len('index.html')]}"


def file_of(url):
    return REPO / url[len(SITE) + 1:] / "index.html"


def parse(path):
    html = path.read_text(encoding="utf-8")
    alts = dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">', html))
    lang = re.search(r'<html lang="([^"]+)"', html)
    canonical = re.search(r'<link rel="canonical" href="([^"]+)">', html)
    switches = re.findall(r'<a class="lang-switch" href="([^"]+)"', html)
    return alts, lang and lang.group(1), canonical and canonical.group(1), switches


def main():
    pages = [p for p in REPO.rglob("index.html") if not SKIP & set(p.relative_to(REPO).parts)]
    errors = []
    for path in sorted(pages):
        alts, lang, canonical, switches = parse(path)
        me = url_of(path)
        rel = path.relative_to(REPO).as_posix()
        if not alts:
            errors.append(f"{rel}: no hreflang alternates")
            continue
        if canonical != me:
            errors.append(f"{rel}: canonical is {canonical}, expected {me}")
        if alts.get(lang) != me:
            errors.append(f"{rel}: hreflang=\"{lang}\" should point at the page itself")
        for code, url in alts.items():
            target = file_of(url)
            if not target.exists():
                errors.append(f"{rel}: hreflang=\"{code}\" points at missing page {url}")
            elif parse(target)[0] != alts:
                errors.append(f"{rel}: alternates differ from {target.relative_to(REPO).as_posix()}")
        others = {url[len(SITE):] for code, url in alts.items() if code not in (lang, "x-default")}
        if not others & set(switches):
            errors.append(f"{rel}: no lang-switch link to {sorted(others)}")
    for e in errors:
        print(e)
    print(f"checked {len(pages)} pages, {len(errors)} problem(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
