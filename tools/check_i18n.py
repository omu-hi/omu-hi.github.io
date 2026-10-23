"""Check that Japanese and English pages point at each other correctly.

Usage: python tools/check_i18n.py
For every page that declares hreflang alternates, verifies that:
  - it declares exactly one alternate each for ja, en and x-default,
  - each alternate URL maps to a page in this repo,
  - every page in the group lists the same alternates (reciprocal links),
  - the page's own <html lang> matches the hreflang that points at it,
  - the canonical URL is the page itself,
  - the page has a language-switch link to its counterpart, and
  - the page is listed in sitemap.xml.
Exits with status 1 and prints each problem if anything is wrong.
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SITE = "https://omu-hi.github.io"
SKIP = {"backup", "top-v2", "demo"}
REQUIRED = {"ja", "en", "x-default"}


def url_of(path):
    rel = path.relative_to(REPO).as_posix()
    return f"{SITE}/{rel[:-len('index.html')]}"


def file_of(url):
    """Map a site URL ending in "/" to its index.html, or None if it is not one."""
    if not (url.startswith(SITE + "/") and url.endswith("/")):
        return None
    return REPO / url[len(SITE) + 1:] / "index.html"


class Head(HTMLParser):
    """Collects hreflang alternates, <html lang>, canonical and lang-switch links."""

    def __init__(self):
        super().__init__()
        self.alts, self.duplicates, self.switches = {}, [], []
        self.lang = self.canonical = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        rel = (a.get("rel") or "").split()
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "link" and "alternate" in rel and a.get("hreflang"):
            code = a["hreflang"]
            if code in self.alts:
                self.duplicates.append(code)
            self.alts[code] = a.get("href")
        elif tag == "link" and "canonical" in rel:
            self.canonical = a.get("href")
        elif tag == "a" and "lang-switch" in (a.get("class") or "").split():
            self.switches.append(a.get("href"))


def parse(path):
    head = Head()
    head.feed(path.read_text(encoding="utf-8"))
    return head


def main():
    pages = [p for p in REPO.rglob("index.html") if not SKIP & set(p.relative_to(REPO).parts)]
    sitemap = set(re.findall(r"<loc>([^<]+)</loc>", (REPO / "sitemap.xml").read_text(encoding="utf-8")))
    errors = []
    for path in sorted(pages):
        page = parse(path)
        alts = page.alts
        me = url_of(path)
        rel = path.relative_to(REPO).as_posix()
        if not alts:
            errors.append(f"{rel}: no hreflang alternates")
            continue
        if me not in sitemap:
            errors.append(f"{rel}: {me} is missing from sitemap.xml")
        for code in page.duplicates:
            errors.append(f"{rel}: hreflang=\"{code}\" is declared more than once")
        if set(alts) != REQUIRED:
            errors.append(f"{rel}: hreflang codes are {sorted(alts)}, expected {sorted(REQUIRED)}")
        if page.canonical != me:
            errors.append(f"{rel}: canonical is {page.canonical}, expected {me}")
        if alts.get(page.lang) != me:
            errors.append(f"{rel}: hreflang=\"{page.lang}\" should point at the page itself")
        for code, url in alts.items():
            target = file_of(url)
            if target is None:
                errors.append(f"{rel}: hreflang=\"{code}\" URL {url} is not a {SITE}/.../ page URL")
            elif not target.exists():
                errors.append(f"{rel}: hreflang=\"{code}\" points at missing page {url}")
            elif parse(target).alts != alts:
                errors.append(f"{rel}: alternates differ from {target.relative_to(REPO).as_posix()}")
        others = {url[len(SITE):] for code, url in alts.items() if code not in (page.lang, "x-default")}
        if not others & set(page.switches):
            errors.append(f"{rel}: no lang-switch link to {sorted(others)}")
    for e in errors:
        print(e)
    print(f"checked {len(pages)} pages, {len(errors)} problem(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
