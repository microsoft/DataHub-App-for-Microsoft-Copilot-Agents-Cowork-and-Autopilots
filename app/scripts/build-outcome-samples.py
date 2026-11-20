"""Rebuild the public business-outcome aggregates locally; see samples/business-outcomes."""

import argparse
import csv
import hashlib
import io
import json
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from statistics import median
from zipfile import ZipFile

import duckdb


ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "samples" / "business-outcomes"
JSON_FILE = ROOT / "app" / "src" / "demo" / "outcome-samples.json"
# Pin only inputs actually consumed, to the public download manifest (plus the upstream license).
HASHES = {
    "servicenow-uci.zip": "6294e29a311647306bfdfc85783f7df66517c197b9cd49aa5ee36ba9c525d1d6",
    "salesforce/Opportunity.parquet": "7ccf9b03692e477fdfe380eecf1268fc1fccd8c3f4174d3515723f3177ee68e8",
    "BPI_Challenge_2019.xes": "af63bc687fc4152f2123b05c3af7772b37ef3fce2d3f67f812666c9e356baae7",
    "bank-marketing-uci.zip": "e0bf5f5de5b846e2f18e9d90606637267d46dfa260e0f17bb12e605db5efbeb4",
    "salesforce/Case.parquet": "714071907a923db8478ccb0cfdbda548952736570632b5f7c1453c6eff75d306",
    "salesforce/LICENSE": "43070e2d4e532684de521b885f385d0841030efa2b1a20bafb76133a5e1379c1",
}

CC_BY = "CC BY 4.0"
SF_CREDIT = "Google Cloud, sfdc-kittycorn public test harness; cleaned and augmented by vladkol and lsubatin."
SF_URL = "https://github.com/GoogleCloudPlatform/devrel-demo-datasets/tree/main/sfdc-kittycorn"


@dataclass
class Metric:
    label: str
    amount: int | float
    unit: str
    basis: str
    decimals: int = 0

    def ui(self):
        suffix = {"%": "%", "hour": " hours", "day": " days"}.get(self.unit, "")
        return dict(label=self.label, value=f"{self.amount:,.{self.decimals}f}{suffix}", basis=self.basis)


@dataclass
class Sample:
    source: str
    period: str
    kind: str
    credit: str
    url: str
    license: str
    unit: str
    completed: int
    metrics: list[Metric]
    trend: Counter
    trendBasis: str
    limitation: str
    outcomeSeries: list[dict]

    def ui(self):
        if self.trend and self.trend.total() != self.completed:
            raise ValueError(f"{self.source}: monthly counts do not reconcile to the scoped denominator")
        return {
            **vars(self),
            "metrics": [m.ui() for m in self.metrics],
            "trend": [{"period": p, "count": n} for p, n in sorted(self.trend.items())],
        }


def coverage(dates, scope):
    return f"{min(dates)} to {max(dates)} ({scope})"


def series(label, unit, basis, rows):
    return dict(label=label, unit=unit, basis=basis, points=[
        dict(period=month, value=round(value, 2), eligible=n) for month, value, n in sorted(rows)
    ])


@lru_cache(maxsize=16384)
def incident_time(value):
    return datetime.strptime(value, "%d/%m/%Y %H:%M")


def service(folder):
    latest = {}
    events = 0
    with ZipFile(folder / "servicenow-uci.zip") as archive, archive.open("incident_event_log.csv") as data:
        for r in csv.DictReader(io.TextIOWrapper(data, encoding="utf-8")):
            events += 1
            key = r["number"]
            order = (incident_time(r["sys_updated_at"]), int(r["sys_mod_count"]))
            if key not in latest or order > latest[key][0]:
                latest[key] = (order, r["incident_state"], r["opened_at"], r["resolved_at"],
                               r["closed_at"], int(r["reopen_count"]), int(r["reassignment_count"]))

    close_dates, hours_by_month = [], defaultdict(list)
    reopened_by_month = Counter()
    reopened = reassigned = missing = negative = 0
    for _, state, opened, resolved, closed, reopen, reassign in latest.values():
        if state != "Closed":
            continue
        start = incident_time(opened)
        end = incident_time(closed)
        if end < start:
            raise ValueError("Closed incident with invalid closure chronology")
        close_dates.append(end.date())
        month = end.strftime("%Y-%m")
        reopened += reopen > 0
        reopened_by_month[month] += reopen > 0
        reassigned += reassign > 0
        if resolved in ("?", ""):
            missing += 1
        else:
            duration = (incident_time(resolved) - start).total_seconds() / 3600
            if duration < 0:
                negative += 1
            else:
                hours_by_month[month].append(duration)
    hours = [duration for group in hours_by_month.values() for duration in group]
    months = Counter(d.strftime("%Y-%m") for d in close_dates)
    n = len(close_dates)
    return Sample(
        "ServiceNow incident event log", coverage(close_dates, "incident closures"),
        "Anonymised historical IT service-desk log",
        "C. Amaral, M. Fantinato and S. Peres (2018), UCI Machine Learning Repository.",
        "https://doi.org/10.24432/C57S4H", CC_BY, "closed incident", n,
        [
            Metric("Closed incidents", n, "incident",
                   f"{n:,} of {len(latest):,} distinct incidents are closed in their final state; "
                   f"{events:,} event rows reduced to one state per incident."),
            Metric("Median elapsed resolution time", median(hours), "hour",
                   f"Opened to resolved for {len(hours):,} of {n:,} closed incidents; "
                   f"{missing:,} missing resolution times and {negative:,} negative durations excluded.", 1),
            Metric("Reopened at least once", reopened, "incident",
                   f"Positive final reopen count among {n:,} closed incidents; not a count of reopen events."),
            Metric("Reassigned at least once", reassigned, "incident",
                   f"Positive final reassignment count among {n:,} closed incidents."),
        ],
        months,
        f"Month of closed_at for all {n:,} final closed incidents. Latest sys_updated_at wins, "
        "then highest sys_mod_count. Closure does not require a resolution timestamp.",
        "Calendar elapsed time is not analyst handling time. This historical log does not measure current backlog or SLA attainment.",
        [
            series("Median elapsed resolution time", "hours",
                   f"By closure month, not opening month. Median opened_at to resolved_at among the "
                   f"{len(hours):,} closed incidents with usable resolution times; "
                   f"{missing:,} missing and {negative:,} negative durations excluded. Only eligible months shown.",
                   ((p, median(group), len(group)) for p, group in hours_by_month.items())),
            series("Reopened at least once", "%",
                   "By closure month: incidents with a positive final reopen count / all final closed incidents. "
                   "Counts an incident only once, regardless of the number of reopens.",
                   ((p, 100 * reopened_by_month[p] / count, count) for p, count in months.items())),
        ],
    )


def salesforce(folder, *, cases):
    name = "Case" if cases else "Opportunity"
    # CloseDate is date-only; ClosedDate and CreatedDate are UTC timestamps.
    fields = ("CreatedDate AS opened, ClosedDate AS closed_on, NULL::BOOLEAN AS won" if cases else
              "CreatedDate::DATE AS opened, CloseDate AS closed_on, IsWon AS won")
    duration = "epoch(closed_on - opened) / 3600" if cases else "closed_on - opened"
    with duckdb.connect() as db:
        db.execute("SET TimeZone='UTC'")
        db.read_parquet(str(folder / "salesforce" / f"{name}.parquet")).project(
            f"IsClosed, {fields}"
        ).create_view("records")
        db.execute("CREATE VIEW eligible AS SELECT * FROM records WHERE IsClosed AND closed_on >= opened")
        total, closed, wins, missing, negative = db.execute("""
            SELECT count(*), count_if(IsClosed), count(*) FILTER (WHERE IsClosed AND won),
                   count(*) FILTER (WHERE IsClosed AND (opened IS NULL OR closed_on IS NULL)),
                   count(*) FILTER (WHERE IsClosed AND closed_on < opened)
            FROM records
        """).fetchone()
        n, first, last, elapsed = db.execute(f"""
            SELECT count(*), min(closed_on)::DATE, max(closed_on)::DATE, median({duration}) FROM eligible
        """).fetchone()
        outcome = f"median({duration})" if cases else "100.0 * count_if(won) / count(*)"
        monthly = db.execute(f"""
            SELECT strftime(closed_on, '%Y-%m'), {outcome}, count(*) FROM eligible GROUP BY 1 ORDER BY 1
        """).fetchall()
    months = Counter({p: count for p, _, count in monthly})
    scope = (f"{closed:,} of {total:,} records flagged closed; {total - closed:,} not closed. "
             f"Of the closed records, {missing:,} missing dates and {negative:,} closes before creation "
             f"excluded from dated throughput and duration ({n:,} eligible).")
    if cases:
        unit = "closed case"
        metrics = [
            Metric("Closed cases", n, "case", scope),
            Metric("Case closure rate", 100 * closed / total, "%",
                   f"{closed:,} flagged closed out of all {total:,} case records.", 2),
            Metric("Median elapsed closure time", elapsed, "hour",
                   f"CreatedDate to ClosedDate (UTC) for {n:,} closed cases with nonnegative durations."),
        ]
        limitation = "ClosedDate measures closure, not necessarily resolution. Test-harness records are not a customer-service benchmark."
        process = series("Median elapsed closure time", "hours",
                         "By UTC ClosedDate month: median hours from CreatedDate to ClosedDate among closed cases "
                         "with both timestamps and nonnegative duration.", monthly)
    else:
        unit = "closed opportunity"
        metrics = [
            Metric("Closures with valid dates", n, "opportunity", scope),
            Metric("Win rate among all closed opportunities", 100 * wins / closed, "%",
                   f"{wins:,} won out of {closed:,} flagged closed. This status measure does not require valid cycle dates.", 2),
            Metric("Median closed-deal cycle", elapsed, "day",
                   f"CloseDate minus UTC creation date for {n:,} eligible closures; "
                   f"{negative:,} negative cycles and {missing:,} missing dates excluded."),
        ]
        limitation = "CloseDate has day precision. The win rate describes test-harness records, not an industry benchmark."
        process = series("Win rate among dated closures", "%",
                         f"By recorded CloseDate month: IsWon among {n:,} eligible closed opportunities. "
                         f"Excludes {missing:,} missing dates and {negative:,} negative cycles, unlike the all-closures win rate.",
                         monthly)
    return Sample(
        f"Salesforce {name} (sfdc-kittycorn)", coverage([first, last], "eligible case closures" if cases else "eligible opportunity closures"),
        "Public Salesforce test-harness data", SF_CREDIT, SF_URL, "Apache-2.0", unit, n, metrics, months,
        f"Month of {'ClosedDate (UTC)' if cases else 'recorded CloseDate'} for {n:,} closed records with "
        f"nonnegative elapsed time. {missing:,} missing and {negative:,} out-of-order dates excluded.", limitation, [process],
    )


def finance(folder):
    items = events = receipts = multiple = 0
    clear_dates = []
    unblocked = Counter()
    with (folder / "BPI_Challenge_2019.xes").open("rb") as data:
        parser = ET.iterparse(data, events=("start", "end"))
        _, root = next(parser)
        for action, trace in parser:
            if action != "end" or trace.tag != "trace":
                continue
            items += 1
            receipt_count = 0
            first_clear = first_unblock = None
            for event in trace.iterfind("event"):
                events += 1
                activity = event.find("string[@key='concept:name']").attrib["value"]
                if activity == "Record Invoice Receipt":
                    receipt_count += 1
                elif activity in ("Clear Invoice", "Remove Payment Block"):
                    stamp = datetime.fromisoformat(event.find("date[@key='time:timestamp']").attrib["value"])
                    if activity == "Clear Invoice":
                        first_clear = min(first_clear, stamp) if first_clear else stamp
                    else:
                        first_unblock = min(first_unblock, stamp) if first_unblock else stamp
            receipts += receipt_count > 0
            multiple += receipt_count > 1
            if first_clear:
                clear_dates.append(first_clear.date())
                if first_unblock and first_unblock <= first_clear:
                    unblocked[first_clear.strftime("%Y-%m")] += 1
            root.clear()  # Release the completed trace; do not retain the 700 MB tree.
    n = len(clear_dates)
    months = Counter(day.strftime("%Y-%m") for day in clear_dates)
    return Sample(
        "BPI Challenge 2019 purchase-to-pay log", coverage(clear_dates, "first invoice clearing per PO item"),
        "Anonymised historical purchase-to-pay event log",
        "B. van Dongen (2019), BPI Challenge 2019, version 1, 4TU.ResearchData.",
        "https://doi.org/10.4121/uuid:d06aff4b-79f0-45e6-8ec8-e19730c248f1", CC_BY,
        "PO item with invoice clearing", n,
        [
            Metric("PO items with invoice clearing", n, "PO item",
                   f"{n:,} of {items:,} PO items have at least one Clear Invoice event; "
                   f"{items - n:,} with no clearing excluded from throughput."),
            Metric("PO items with invoice receipt", receipts, "PO item",
                   f"At least one Record Invoice Receipt event among all {items:,} PO items ({events:,} events)."),
            Metric("PO items with multiple invoice receipts", multiple, "PO item",
                   f"More than one Record Invoice Receipt among {receipts:,} items with any receipt."),
        ],
        months,
        f"Month of earliest Clear Invoice event (UTC) on each of {n:,} PO-item traces. Repeated clearings never add volume.",
        "PO-item clearing is a proxy, not an invoice count, proof of payment, invoice payment time or financial savings.",
        [series("Payment block removed by first clearing", "%",
                "By month of first Clear Invoice (UTC): share of cleared PO items with a Remove Payment Block "
                "event at or before that clearing. Each item counted once; not a share of invoices or a payment rate.",
                ((p, 100 * unblocked[p] / count, count) for p, count in months.items()))],
    )


def marketing(folder):
    with ZipFile(folder / "bank-marketing-uci.zip") as outer, ZipFile(io.BytesIO(outer.read("bank-additional.zip"))) as inner:
        with inner.open("bank-additional/bank-additional-full.csv") as data:
            outcomes = Counter(r["y"] for r in csv.DictReader(io.TextIOWrapper(data, encoding="utf-8"), delimiter=";"))
    if set(outcomes) != {"yes", "no"}:
        raise ValueError("Unexpected or missing marketing outcome")
    n, yes = outcomes.total(), outcomes["yes"]
    return Sample(
        "UCI Bank Marketing (bank-additional-full)", "May 2008 to November 2010 (publisher's full-file coverage)",
        "Historical telephone marketing campaign records",
        "S. Moro, P. Rita and P. Cortez (2014), Bank Marketing, UCI Machine Learning Repository.",
        "https://doi.org/10.24432/C5K306", CC_BY, "campaign record", n,
        [
            Metric("Campaign records", n, "campaign record",
                   f"All {n:,} records in the full additional variant, not unique people or campaigns; no rows excluded."),
            Metric("Term-deposit subscriptions", yes, "campaign record",
                   f"{yes:,} yes and {outcomes['no']:,} no outcomes among {n:,} campaign records."),
            Metric("Subscription rate", 100 * yes / n, "%", f"{yes:,} yes outcomes / {n:,} campaign records.", 2),
        ],
        Counter(), "Only month name and weekday are supplied, not a row-level year or full date. No monthly series.",
        "The denominator counts campaign records, not subscriptions or distinct calls. No campaign spend or ROI is available.",
        [],
    )


def flat_csv(samples):
    buf = io.StringIO(newline="")
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["area", "row_kind", "period", "label", "value", "unit", "eligible", "basis", "source", "kind", "url", "license", "credit"])
    for area, s in samples.items():
        provenance = [s.source, s.kind, s.url, s.license, s.credit]
        writer.writerow([area, "scope", s.period, "Illustrative cost denominator", s.completed, s.unit, None,
                         s.metrics[0].basis, *provenance])
        for m in s.metrics:
            writer.writerow([area, "metric", s.period, m.label, round(m.amount, m.decimals), m.unit, None, m.basis, *provenance])
        for month, count in sorted(s.trend.items()):
            writer.writerow([area, "month", month, "Monthly throughput", count, s.unit, None, s.trendBasis, *provenance])
        for outcome in s.outcomeSeries:
            for point in outcome["points"]:
                writer.writerow([area, "outcome", point["period"], outcome["label"], point["value"], outcome["unit"],
                                 point["eligible"], outcome["basis"], *provenance])
    return buf.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_folder", type=Path, help="Local folder holding the pinned public source files")
    parser.add_argument("--check", action="store_true", help="Rebuild in memory and compare; do not write files")
    args = parser.parse_args()
    folder = args.input_folder
    for filename, expected in HASHES.items():
        with (folder / filename).open("rb") as f:
            if hashlib.file_digest(f, "sha256").hexdigest() != expected:
                parser.exit(1, f"Source SHA-256 mismatch: {filename}\n")
    samples = {
        "service": service(folder), "sales": salesforce(folder, cases=False), "finance": finance(folder),
        "marketing": marketing(folder), "customer": salesforce(folder, cases=True),
    }
    outputs = {
        JSON_FILE: json.dumps({k: s.ui() for k, s in samples.items()}, indent=2, ensure_ascii=False) + "\n",
        SAMPLES / "outcome-samples.csv": flat_csv(samples),
        SAMPLES / "LICENSE-Apache-2.0.txt": (folder / "salesforce" / "LICENSE").read_text(encoding="utf-8"),
        JSON_FILE.with_name("LICENSE-Apache-2.0.txt"): (folder / "salesforce" / "LICENSE").read_text(encoding="utf-8"),
    }
    for path, text in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text(encoding="utf-8") != text:
                parser.exit(1, f"Missing or stale output: {path.name}\n")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8", newline="\n")
    print("Verified input hashes;", "matched all outputs." if args.check else "wrote all outputs.")
    for area, s in samples.items():
        print(f"{area}: {s.completed:,} x {s.unit}; {len(s.trend)} observed months")


if __name__ == "__main__":
    main()
