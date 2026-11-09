"""Keep the full-app reading guide and its offline bundled copy in sync."""
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


class GuideText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.pages = []

    def handle_starttag(self, tag, attrs):
        if tag == "section" and "data-page" in dict(attrs):
            self.pages.append(dict(attrs)["data-page"])

    def handle_data(self, data):
        self.text.append(data)


def normalise(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower().replace("&", "and")).strip()


def test_guide_covers_every_app_destination_and_section():
    guide = GuideText()
    guide.feed((ROOT / "docs" / "DataHub-App-Guide.html").read_text(encoding="utf-8"))
    assert len(guide.pages) == 9
    navigation = (ROOT / "app" / "src" / "components" / "destinations.ts").read_text(encoding="utf-8")
    labels = re.findall(r'\blabel: "([^"]+)"', navigation)
    assert len(labels) > 40
    text = normalise(" ".join(guide.text))
    missing = [label for label in labels if normalise(label) not in text]
    assert not missing, f"Pages/sections missing from the reading guide: {missing}"
    for essential in ("Reports", "Not filtered by", "snapshot", "not measured time saved",
                      "Missing data", "personal data", "billing currency"):
        assert normalise(essential) in text, essential


def test_bundled_guide_is_the_documented_pdf():
    documented = (ROOT / "docs" / "DataHub-App-Guide.pdf").read_bytes()
    assert documented.startswith(b"%PDF-")
    assert documented.rstrip().endswith(b"%%EOF")
    assert (ROOT / "app" / "src" / "assets" / "DataHub-App-Guide.pdf").read_bytes() == documented
