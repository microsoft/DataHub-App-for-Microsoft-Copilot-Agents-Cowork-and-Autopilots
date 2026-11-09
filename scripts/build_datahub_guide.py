"""Render the maintained HTML guide and synchronise the app's bundled PDF."""
from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "DataHub-App-Guide.html"
OUTPUT = SOURCE.with_suffix(".pdf")
BUNDLED = ROOT / "app" / "src" / "assets" / OUTPUT.name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", type=Path, help="Optional installed Chromium/Edge executable.")
    args = parser.parse_args()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            **({"executable_path": str(args.browser)} if args.browser else {})
        )
        try:
            page = browser.new_page()
            page.goto(SOURCE.as_uri())
            page.emulate_media(media="print")
            page.evaluate("document.fonts.ready")
            pages = page.locator(".page").count()
            if not pages:
                raise ValueError("The guide has no pages.")
            overflow = page.locator(".page").evaluate_all("""pages => pages.flatMap((page, index) => {
                const footer = page.querySelector('footer');
                const previous = footer.previousElementSibling;
                return page.scrollHeight > page.clientHeight ||
                    previous.getBoundingClientRect().bottom > footer.getBoundingClientRect().top
                    ? [index + 1] : [];
            })""")
            if overflow:
                raise ValueError(f"Content overflows guide pages: {overflow}")
            pdf = page.pdf(
                prefer_css_page_size=True, print_background=True, display_header_footer=False,
                tagged=True, outline=True,
            )
        finally:
            browser.close()
    rendered = PdfReader(BytesIO(pdf))
    if len(rendered.pages) != pages:
        raise ValueError(f"Expected {pages} pages, rendered {len(rendered.pages)}.")
    for index, rendered_page in enumerate(rendered.pages, start=1):
        if f"{index:02} / {pages:02}" not in rendered_page.extract_text():
            raise ValueError(f"Missing footer on rendered page {index}.")
    OUTPUT.write_bytes(pdf)
    BUNDLED.parent.mkdir(parents=True, exist_ok=True)
    BUNDLED.write_bytes(pdf)
    print(f"Verified {pages} PDF pages: {OUTPUT.relative_to(ROOT)}")
    print(f"Identical bundled copy: {BUNDLED.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
