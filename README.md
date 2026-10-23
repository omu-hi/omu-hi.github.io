# omu-hi.github.io

## 日本語ページと英語ページ

英語ページは `/en/` 以下に、日本語ページと同じ構成で置いています。

| 日本語 | 英語 |
| --- | --- |
| `index.html` | `en/index.html` |
| `honda/index.html` | `en/honda/index.html` |
| `ubukata/index.html` | `en/ubukata/index.html` |

デモ（`demo/`）は日本語のみです。英語ページからは「(Japanese)」と明記してリンクしています。

### 更新するとき

1. 日本語ページの内容を変えたら、対応する英語ページも同じように直す（お知らせ・連絡先・リンクなど）。
2. ページを追加したら、両方の `<head>` に hreflang（`ja` / `en` / `x-default`）を書き、ヘッダーに `lang-switch` リンクを置き、`sitemap.xml` に両方の URL を追加する。
3. 氏名・職名・写真を変えたら `python tools/make_ogp.py` で OGP 画像（日英）を作り直す。
4. コミット前に `python tools/check_i18n.py` を実行し、日英の対応漏れがないことを確かめる。

## favicon

`icon.svg`・`favicon.ico`・`apple-touch-icon.png` は `python tools/make_favicon.py hi` で作ります。図形はスクリプト内で定義しているので、デザインを変えるときはスクリプトを直して再実行します（`--preview <フォルダ>` で全案の比較ページを書き出せます）。ページを追加したら、`<head>` に既存ページと同じ 3 行の `<link rel="icon" …>` を入れる。
