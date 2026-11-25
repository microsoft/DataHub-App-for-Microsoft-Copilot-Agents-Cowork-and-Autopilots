# Business outcome reference samples

These are aggregates from four independent public datasets, not one organisation, a live connection or a before/after study. None measures AI use, costs or savings. For an illustrative cost per unit, use **one** area's `completed` count and label any budget as a scenario for that same scope and period.

## Rebuild locally

Use Python 3.11+ with `duckdb` (tested with Python 3.12 and DuckDB 1.5.5). The app does not need Python or DuckDB at runtime. Keep the downloads outside the repository. From the repository root:

```shell
python app/scripts/build-outcome-samples.py "<input-folder>"
python app/scripts/build-outcome-samples.py "<input-folder>" --check
```

The script checks SHA-256 for each input before reading it, streams the XES one trace at a time, and reads only the needed Parquet columns. `--check` recomputes from the source files and compares the JSON, CSV and bundled licence without writing. Profiles are independent cross-checks, **not** inputs to the metrics.

| Input under `<input-folder>` | Public source and attribution |
|---|---|
| `servicenow-uci.zip` | Amaral, Fantinato & Peres (2018), [Incident management process enriched event log](https://doi.org/10.24432/C57S4H), UCI. [Download](https://archive.ics.uci.edu/static/public/498/incident+management+process+enriched+event+log.zip). |
| `BPI_Challenge_2019.xes` | B. van Dongen (2019), [BPI Challenge 2019, v1](https://doi.org/10.4121/uuid:d06aff4b-79f0-45e6-8ec8-e19730c248f1), 4TU.ResearchData. [Download](https://data.4tu.nl/file/35ed7122-966a-484e-a0e1-749b64e3366d/864493d1-3a58-47f6-ad6f-27f95f995828). |
| `bank-marketing-uci.zip` | Moro, Rita & Cortez (2014), [Bank Marketing](https://doi.org/10.24432/C5K306), UCI. [Download](https://archive.ics.uci.edu/static/public/222/bank+marketing.zip); use `bank-additional-full.csv` only. See also Moro, Cortez & Rita, [*A Data-Driven Approach to Predict the Success of Bank Telemarketing*](https://doi.org/10.1016/j.dss.2014.03.001). |
| `salesforce/Opportunity.parquet`, `salesforce/Case.parquet`, `salesforce/LICENSE` | Google Cloud, [Salesforce BigQuery sample and test harness](https://github.com/GoogleCloudPlatform/devrel-demo-datasets/tree/main/sfdc-kittycorn). Use the two files from `sample-data/` and the licence from its parent directory. Originally from the public Kittycorn test harness, cleaned and augmented by **vladkol** and **lsubatin**. Demonstration data; not an officially supported Google product. |

The two UCI sources and the 4TU source are licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). The Salesforce source is licensed under [Apache License 2.0 (full upstream text)](LICENSE-Apache-2.0.txt). **Changes:** selected fields and cohorts, deduplicated incidents, grouped and counted records/events, calculated rates and medians, and added explanations. No raw records are distributed. Retain the source-specific credits and licence notices with redistributions.

## What the outputs count

| Area | `completed` (cost denominator) | Independent profile check |
|---|---:|---|
| Service | 24,918 final closed incidents | 141,712 event rows; median resolution **22.1 hours** among 23,362 with usable timestamps. Missing resolution does not exclude a closure. |
| Sales | 185,403 closed opportunities with valid dates | 185,709 closed minus 306 negative cycles. Median **76 calendar days**. Status-only win rate uses all closures: 171,388 / 185,709. |
| Finance | 183,677 PO items with a clearing | 251,734 item traces, 1,595,923 events; 211,379 items have a receipt, 9,644 have multiple receipts. First clearing per PO item is **not** an invoice count. |
| Marketing | 41,188 campaign records | 4,640 positive subscription outcomes. No row-level year: no trend. |
| Customer | 100,567 closed Salesforce cases | Of 338,512 case records; median elapsed **closure**, not resolution, is 346 hours. |

`app/src/demo/outcome-samples.json` is keyed by area. Each entry has source, original period, dataset kind, credit, source URL, licence, singular unit, `completed`, display metrics (`label`, `value`, `basis`), throughput `trend` and its basis, process `outcomeSeries`, and a limitation. Each nonempty **throughput** series contains observed months in ascending `YYYY-MM` order and sums to `completed`. Omitted months are not interpolated.

`outcomeSeries` separates changes in process measures from changes in volume. Each series has a `label`, `unit`, `basis` and ordered `points` (`period`, numeric `value`, integer `eligible`). The service series show median resolution hours and the share reopened by **closure month**; sales shows win rate by eligible close month; finance shows the share of PO items with a payment-block removal at or before first clearing; customer shows median elapsed case closure hours. Marketing has neither series because the records have no full date. Values are rounded to two decimal places. Small or partial months can vary substantially. Monthly percentages and medians are not additive; the median of monthly medians does not recover the overall median.

`outcome-samples.csv` is optional input for a **separate sample-only** Lakehouse table (for example `sample_business_outcomes`); the script never connects to Fabric. Import as UTF-8 comma-delimited CSV with header and double-quote quoting; `value` is numeric, `eligible` is a nullable integer, other columns are text. Filter by `area` and `row_kind`: `scope` has one full-period denominator; `metric` has one number per label (percentages on a 0–100 scale); `month` has throughput counts; `outcome` has one row per process-measure point with its eligible denominator. Do **not** sum across row kinds, unrelated measures or areas.
