"""Keep the full-app reading guide and its offline bundled copy in sync."""
from html.parser import HTMLParser
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]


class GuideText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.pages = []
        self.visuals = []

    def handle_starttag(self, tag, attrs):
        if tag == "section" and "data-page" in dict(attrs):
            self.pages.append(dict(attrs)["data-page"])
        if tag == "svg":
            self.visuals.append(dict(attrs))

    def handle_data(self, data):
        self.text.append(data)


def normalise(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower().replace("&", "and")).strip()


def test_guide_covers_every_app_destination_and_section():
    guide = GuideText()
    guide.feed((ROOT / "docs" / "DataHub-App-Guide.html").read_text(encoding="utf-8"))
    assert len(guide.pages) == 16
    assert len(guide.visuals) == 7
    assert all(visual.get("role") == "img" and visual.get("aria-labelledby") for visual in guide.visuals)
    navigation = (ROOT / "app" / "src" / "components" / "destinations.ts").read_text(encoding="utf-8")
    labels = re.findall(r'\blabel: "([^"]+)"', navigation)
    assert len(labels) > 40
    text = normalise(" ".join(guide.text))
    missing = [label for label in labels if normalise(label) not in text]
    assert not missing, f"Pages/sections missing from the reading guide: {missing}"
    for explainer in ("Value: units and estimated hours", "Value: return, time and scope",
                      "Consumption: credits, rates and attribution", "Consumption: runway and filter scope",
                      "Efficiency: grades and denominators", "Readiness: licence scoring",
                      "Readiness: Cowork rank and evidence"):
        assert explainer in guide.pages
    for essential in ("Reports", "Not filtered by", "snapshot", "not measured time saved",
                      "Missing data", "personal data", "billing currency"):
        assert normalise(essential) in text, essential
    for essential in ("All worked examples are fictional arithmetic", "not a screenshot",
                      "not raw files x minutes", "judged threads", "latest loaded month",
                      "not a 62% chance", "not all elapsed calendar weeks", "ranking score",
                      "rank can move", "not a stopwatch measurement"):
        assert normalise(essential) in text, essential


def test_bundled_guide_is_the_documented_pdf():
    documented = (ROOT / "docs" / "DataHub-App-Guide.pdf").read_bytes()
    assert documented.startswith(b"%PDF-")
    assert documented.rstrip().endswith(b"%%EOF")
    assert (ROOT / "app" / "src" / "assets" / "DataHub-App-Guide.pdf").read_bytes() == documented


def model_measures():
    with zipfile.ZipFile(ROOT / "fabric" / "ValueLens - Fabric.pbit") as template:
        model = json.loads(template.read("DataModelSchema").decode("utf-16-le"))["model"]
    return {
        measure["name"]: "\n".join(measure["expression"])
        if isinstance(measure["expression"], list) else measure["expression"]
        for table in model["tables"] for measure in table.get("measures", [])
    }


def test_licence_example_matches_shipped_score_weights_and_denominators():
    measures = model_measures()
    score = measures["License Priority Score (User)"]
    assert "DIVIDE(TasksPW, 30, 0)" in score and "DIVIDE(DaysPW,  5, 0)" in score
    assert "60 * VolumeScore + 40 * DaysScore" in score
    assert 60 * min(15 / 30, 1) + 40 * min(4 / 5, 1) == 62
    breadth_query = (ROOT / "app/src/queries/licensing/license-candidates-m365.dax").read_text()
    for expression in ("50 * _volume", "30 * _days", "20 * MIN(DIVIDE([@Breadth], 4, 0), 1)"):
        assert expression in breadth_query
    assert 50 * (15 / 30) + 30 * (4 / 5) + 20 * (2 / 4) == 59
    assert "DIVIDE(TotalTasks, TotalWeeks, 0)" in measures["Median Unlicensed AI Tasks Per User Per Week"]
    assert "DIVIDE(TotalActiveDays, TotalWeeks, 0)" in measures["Median Chat + Agent Active Days Per User Per Week (Unlicensed)"]


def test_cowork_example_matches_shipped_relative_rank_formula():
    query = (ROOT / "app/src/queries/agents/cowork-candidates.dax").read_text()
    for expression in ("45 * MIN(DIVIDE([@b], __MaxB, 0), 1)",
                       "35 * MIN(DIVIDE([@d], __MaxD, 0), 1)", "20 * [@a]"):
        assert expression in query
    def score(breadth, depth, agent):
        value = Decimal(45) * breadth / 4 + Decimal(35) * depth / 8 + 20 * agent
        return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))
    assert score(4, 4, 1) == 83
    assert score(2, 8, 0) == 58
    measures = model_measures()
    hours = measures["Cowork Hours (Task Category Basis)"]
    assert '"Analysis & Research", 67' in hours and '"Analysis & Research", 5' in hours
    assert round((10 / 5) * 67 / 60, 2) == 2.23
