#!/usr/bin/env python3
"""
clean_html.py — Strip scripts and non-visual elements from an HTML file while preserving rendering

Default behavior (render-safe):
  - Remove all <script> tags (inline and external)
  - Remove ALL <noscript> blocks (JS-disabled fallback only)
  - Remove GTM noscript iframe blocks
  - Remove non-visual SEO/perf/tracking elements:
      * <meta property="og:*">, <meta name="twitter:*">
      * <meta property="fb:*">, <meta property="al:*">
      * <meta name="theme-color">, <meta name="google-site-verification">
      * <meta name="shopify-checkout-api-token">, <meta id="shopify-digital-wallet">
      * <link rel="canonical">, rel="icon", rel="apple-touch-icon", rel="preconnect", rel="dns-prefetch", rel="prefetch", rel="preload", rel="alternate", rel="manifest", rel="shortlink"
  - Remove HTML comments, hidden 1x1 or CSS-hidden images, hidden/tracking iframes
  - Remove aria-* and role attributes; remove non-visual attrs (loading, integrity, crossorigin, title, tabindex, etc.)
  - Remove inline event handler attributes (onclick, onload, onerror, ...)
  - Remove non-visual form and anchor attributes (form action/method, anchor target/rel, etc.)
  - Dedupe identical stylesheet links; drop media="all" and type="text/css" on CSS links
  - Remove unreferenced SVG <symbol> and <defs> children (keep only referenced IDs)
  - Keep: <link rel="stylesheet">, <style> blocks, <meta name="viewport">, inline SVG/defs, and noscript CSS fallbacks

You can also run in scripts-only mode to only remove <script> tags.

Requires: beautifulsoup4
  pip install beautifulsoup4
"""

from __future__ import annotations

import argparse
import pathlib
import sys
from typing import Iterable, Set

from bs4 import BeautifulSoup, Comment


def read_text(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def write_text(path: pathlib.Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def remove_all_scripts(soup: BeautifulSoup) -> None:
    for script_tag in soup.find_all("script"):
        script_tag.decompose()


def normalize_rel(rel: Iterable[str] | None) -> Set[str]:
    if not rel:
        return set()
    return {value.strip().lower() for value in rel}


def remove_non_visual_extras(soup: BeautifulSoup) -> None:
    # 1) Remove GTM noscript iframe blocks (tracking, not visible content)
    for nos in list(soup.find_all("noscript")):
        text = nos.get_text(" ", strip=True).lower()
        html = str(nos).lower()
        if "googletagmanager.com" in text or "googletagmanager.com" in html:
            nos.decompose()

    # 2) Remove link rels that are non-visual perf/seo hints
    rels_to_drop = {
        "canonical",
        "icon",
        "apple-touch-icon",
        "preconnect",
        "dns-prefetch",
        "prefetch",
        "preload",
        "alternate",   # hreflang/SEO only
        "manifest",    # PWA only
        "shortlink",   # SEO only
        "pingback",    # SEO only
        "prev",        # SEO only
        "next",        # SEO only
        "search",      # OpenSearch descriptor
    }
    for link in list(soup.find_all("link")):
        rel_values = normalize_rel(link.get("rel"))
        # Keep stylesheets only
        if "stylesheet" in rel_values:
            continue
        if rel_values & rels_to_drop:
            link.decompose()

    # 3) Remove meta tags that do not affect rendering
    for meta in list(soup.find_all("meta")):
        name = (meta.get("name") or "").strip().lower()
        prop = (meta.get("property") or "").strip().lower()
        mid = (meta.get("id") or "").strip().lower()
        http_equiv = (meta.get("http-equiv") or "").strip().lower()

        # Keep viewport for responsive render
        if name == "viewport":
            continue

        if prop.startswith("og:") or prop.startswith("fb:") or prop.startswith("al:"):
            meta.decompose()
            continue

        if name.startswith("twitter:"):
            meta.decompose()
            continue

        if name in {
            "theme-color",
            "google-site-verification",
            "shopify-checkout-api-token",
            "description",
            "keywords",
            "author",
            "publisher",
            "generator",
            "robots",
            "referrer",
            "apple-itunes-app",
            "apple-mobile-web-app-capable",
            "apple-mobile-web-app-status-bar-style",
            "application-name",
            "msapplication-tilecolor",
            "msapplication-tileimage",
            "msapplication-config",
            "format-detection",
            "csrf-token",
            "csrf-param",
        }:
            meta.decompose()
            continue

        if mid == "shopify-digital-wallet":
            meta.decompose()
            continue

        # SEO-only microdata
        if meta.get("itemprop"):
            meta.decompose()
            continue

        # Legacy IE hint
        if http_equiv == "x-ua-compatible":
            meta.decompose()
            continue


def remove_all_noscript(soup: BeautifulSoup) -> None:
    for nos in list(soup.find_all("noscript")):
        nos.decompose()


def remove_html_comments(soup: BeautifulSoup) -> None:
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()


def remove_hidden_pixels(soup: BeautifulSoup) -> None:
    def is_hidden_style(style_value: str) -> bool:
        sv = style_value.lower()
        return (
            "display:none" in sv
            or "visibility:hidden" in sv
            or "opacity:0" in sv
        )

    for img in list(soup.find_all("img")):
        try:
            w_attr = img.get("width")
            h_attr = img.get("height")
            w = int(w_attr) if w_attr and str(w_attr).isdigit() else None
            h = int(h_attr) if h_attr and str(h_attr).isdigit() else None
        except Exception:
            w = h = None

        style = img.get("style") or ""
        aria_hidden = (img.get("aria-hidden") or "").lower() == "true"

        tiny = (w in {0, 1} and h in {0, 1}) or (w == 1 and (h is None)) or (h == 1 and (w is None))
        if tiny or is_hidden_style(style) or aria_hidden:
            img.decompose()


def remove_hidden_iframes(soup: BeautifulSoup) -> None:
    def is_hidden_style(style_value: str) -> bool:
        sv = style_value.lower()
        return (
            "display:none" in sv
            or "visibility:hidden" in sv
            or "opacity:0" in sv
        )

    tracking_hosts = (
        "googletagmanager.com",
        "google-analytics.com",
        "facebook.com",
        "facebook.net",
        "doubleclick.net",
        "clarity.ms",
        "tiktok.com",
        "snapchat.com",
        "linkedin.com",
        "monorail-edge.shopifysvc.com",
    )

    for iframe in list(soup.find_all("iframe")):
        style = iframe.get("style") or ""
        aria_hidden = (iframe.get("aria-hidden") or "").lower() == "true"
        width = iframe.get("width")
        height = iframe.get("height")
        src = (iframe.get("src") or "").lower()
        try:
            w = int(width) if width and str(width).isdigit() else None
            h = int(height) if height and str(height).isdigit() else None
        except Exception:
            w = h = None

        tiny = (w in {0, 1} and h in {0, 1})
        tracker = any(host in src for host in tracking_hosts)
        if tiny or is_hidden_style(style) or aria_hidden or tracker:
            iframe.decompose()


def remove_event_handler_attributes(soup: BeautifulSoup) -> None:
    # Strip attributes like onclick, onload, onerror, etc. Pure interactivity.
    for tag in soup.find_all(True):
        to_delete = [attr for attr in list(tag.attrs.keys()) if attr.lower().startswith("on")]
        for attr in to_delete:
            del tag[attr]


def remove_aria_and_role(soup: BeautifulSoup) -> None:
    for tag in soup.find_all(True):
        # Remove role and all aria-* attributes (no visual impact)
        if "role" in tag.attrs:
            del tag["role"]
        for attr in list(tag.attrs.keys()):
            if attr.lower().startswith("aria-"):
                del tag[attr]


def remove_nonvisual_attributes(soup: BeautifulSoup) -> None:
    # Attributes that do not affect visual rendering
    nonvisual = {
        "loading",
        "decoding",
        "referrerpolicy",
        "integrity",
        "crossorigin",
        "importance",
        "fetchpriority",
        "ping",
        "tabindex",
        "title",
        "contenteditable",
        "autocapitalize",
        "autocorrect",
        "spellcheck",
        "translate",
    }
    for tag in soup.find_all(True):
        for attr in list(tag.attrs.keys()):
            if attr.lower() in nonvisual:
                del tag[attr]


def remove_data_attributes(soup: BeautifulSoup) -> None:
    # Remove data-* attributes (generally JS-only). May affect CSS if used by attribute selectors.
    for tag in soup.find_all(True):
        for attr in list(tag.attrs.keys()):
            if attr.lower().startswith("data-"):
                del tag[attr]


def remove_form_and_anchor_attrs(soup: BeautifulSoup) -> None:
    # Remove interactivity-only attributes for forms and anchors
    for tag in soup.find_all(True):
        tname = tag.name.lower()
        if tname == "a":
            for attr in ["target", "rel", "ping", "download"]:
                if attr in tag.attrs:
                    del tag[attr]
            # keep href to preserve link styling
        elif tname == "form":
            for attr in [
                "action",
                "method",
                "novalidate",
                "enctype",
                "accept-charset",
                "autocomplete",
                "target",
            ]:
                if attr in tag.attrs:
                    del tag[attr]
        elif tname in {"input", "textarea", "select", "button"}:
            if "autocomplete" in tag.attrs:
                del tag["autocomplete"]


def dedupe_stylesheets_and_prune_css_link_attrs(soup: BeautifulSoup) -> None:
    seen_hrefs: Set[str] = set()
    for link in list(soup.find_all("link")):
        rel_values = normalize_rel(link.get("rel"))
        if "stylesheet" not in rel_values:
            continue
        href = (link.get("href") or "").strip()
        # remove media="all" and type="text/css" (redundant)
        media = (link.get("media") or "").strip().lower()
        if media == "all":
            del link["media"]
        ltype = (link.get("type") or "").strip().lower()
        if ltype == "text/css":
            del link["type"]
        if href and href in seen_hrefs:
            link.decompose()
        else:
            if href:
                seen_hrefs.add(href)


def prune_empty_and_default_attributes(soup: BeautifulSoup) -> None:
    for tag in soup.find_all(True):
        # empty class/id/style
        if "class" in tag.attrs and (not tag["class"] or (isinstance(tag["class"], str) and not tag["class"].strip())):
            del tag["class"]
        if "id" in tag.attrs and (not str(tag["id"]).strip()):
            del tag["id"]
        if "style" in tag.attrs and (not str(tag.get("style") or "").strip()):
            del tag["style"]
        # default input type
        if tag.name.lower() == "input":
            t = (tag.get("type") or "").strip().lower()
            if t == "text":
                del tag["type"]


def _collect_referenced_ids(soup: BeautifulSoup) -> Set[str]:
    import re
    used: Set[str] = set()
    url_ref = re.compile(r"url\(#([^)]+)\)")
    attrs_with_url = [
        "fill", "stroke", "clip-path", "mask", "filter", "marker-start", "marker-mid", "marker-end",
    ]
    # 1) <use href="#id"> or xlink:href
    for use in soup.find_all("use"):
        href = (use.get("href") or use.get("xlink:href") or "").strip()
        if href.startswith("#") and len(href) > 1:
            used.add(href[1:])
    # 2) attributes with url(#id)
    for el in soup.find_all(True):
        for attr in attrs_with_url:
            val = el.get(attr)
            if not val:
                continue
            for m in url_ref.finditer(str(val)):
                used.add(m.group(1))
        # also scan style="...url(#id)..."
        style = el.get("style")
        if style:
            for m in url_ref.finditer(str(style)):
                used.add(m.group(1))
    return used


def remove_unreferenced_svg_defs_and_symbols(soup: BeautifulSoup) -> None:
    used_ids = _collect_referenced_ids(soup)
    # Remove <symbol id> not referenced
    for sym in list(soup.find_all("symbol")):
        sid = (sym.get("id") or "").strip()
        if sid and sid not in used_ids:
            sym.decompose()
    # Remove <defs> children with ids not referenced (gradients, filters, etc.)
    for defs in soup.find_all("defs"):
        for child in list(defs.find_all(True)):
            cid = (child.get("id") or "").strip()
            # If child has an id and is not used anywhere, drop it
            if cid and cid not in used_ids:
                child.decompose()


def clean_html(
    html_text: str,
    mode_scripts_only: bool = False,
    strip_comments: bool = True,
    strip_hidden_pixels: bool = True,
    strip_hidden_iframes: bool = True,
    strip_event_handlers: bool = True,
    strip_noscript: bool = True,
    strip_aria: bool = False,
    strip_nonvisual_attrs: bool = True,
    strip_data_attrs: bool = False,
    strip_form_and_anchor_attrs: bool = True,
) -> str:
    soup = BeautifulSoup(html_text, "html.parser")

    # Always remove scripts
    remove_all_scripts(soup)

    # Optionally remove additional non-visual elements
    if not mode_scripts_only:
        remove_non_visual_extras(soup)

    if strip_noscript:
        remove_all_noscript(soup)

    if strip_comments:
        remove_html_comments(soup)

    if strip_hidden_pixels:
        remove_hidden_pixels(soup)

    if strip_hidden_iframes:
        remove_hidden_iframes(soup)

    if strip_event_handlers:
        remove_event_handler_attributes(soup)

    if strip_aria:
        remove_aria_and_role(soup)

    if strip_nonvisual_attrs:
        remove_nonvisual_attributes(soup)

    if strip_data_attrs:
        remove_data_attributes(soup)

    if strip_form_and_anchor_attrs:
        remove_form_and_anchor_attrs(soup)

    # Post-pass: dedupe/prune stylesheets and common defaults
    dedupe_stylesheets_and_prune_css_link_attrs(soup)
    prune_empty_and_default_attributes(soup)
    remove_unreferenced_svg_defs_and_symbols(soup)

    # Write back as string; BeautifulSoup will normalize minor formatting
    return str(soup)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Strip scripts and non-visual items from HTML.")
    parser.add_argument("input", help="Path to input HTML file")
    parser.add_argument(
        "-o",
        "--output",
        help="Path to output HTML file (default: <input>.render-clean.html)",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--scripts-only",
        action="store_true",
        help="Only remove <script> tags; keep SEO/meta and links intact.",
    )
    mode.add_argument(
        "--render-safe",
        action="store_true",
        help="Remove scripts plus non-visual SEO/perf/tracking (default).",
    )
    parser.set_defaults(render_safe=True)
    # Defaults: aggressively remove non-visual items without affecting pixels
    # Provide preserve-* flags to opt-out
    parser.add_argument("--preserve-comments", action="store_true", help="Keep HTML comments.")
    parser.add_argument("--preserve-hidden-pixels", action="store_true", help="Keep 1x1/display:none images.")
    parser.add_argument("--preserve-hidden-iframes", action="store_true", help="Keep hidden/tracking iframes.")
    parser.add_argument("--preserve-noscript", action="store_true", help="Keep <noscript> blocks.")
    parser.add_argument("--preserve-aria", action="store_true", help="Keep aria-* and role attributes.")
    parser.add_argument("--preserve-nonvisual-attrs", action="store_true", help="Keep non-visual attributes like loading, integrity, crossorigin.")
    parser.add_argument("--preserve-form-anchor-attrs", action="store_true", help="Keep form action/method and anchor target/rel.")

    # Optional additional removals
    parser.add_argument("--preserve-event-handlers", action="store_true", help="Keep inline event handlers (onclick, onload, etc.).")
    parser.add_argument("--strip-data-attrs", action="store_true", help="Remove data-* attributes (can affect CSS that targets them).")
    parser.add_argument("--preserve-data-attrs", action="store_true", help="Keep data-* attributes (overrides --strip-data-attrs if both set).")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    inp = pathlib.Path(args.input)
    if not inp.exists():
        print(f"Input not found: {inp}", file=sys.stderr)
        return 2

    outp = pathlib.Path(args.output) if args.output else inp.with_suffix(".render-clean.html")

    html = read_text(inp)
    cleaned = clean_html(
        html_text=html,
        mode_scripts_only=not args.render_safe and args.scripts_only,
        strip_comments=not args.preserve_comments,
        strip_hidden_pixels=not args.preserve_hidden_pixels,
        strip_hidden_iframes=not args.preserve_hidden_iframes,
        strip_event_handlers=not args.preserve_event_handlers,
        strip_noscript=not args.preserve_noscript,
        strip_aria=not args.preserve_aria,
        strip_nonvisual_attrs=not args.preserve_nonvisual_attrs,
        strip_data_attrs=(args.strip_data_attrs and not args.preserve_data_attrs),
        strip_form_and_anchor_attrs=not args.preserve_form_anchor_attrs,
    )
    write_text(outp, cleaned)
    print(f"Wrote {outp}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))


