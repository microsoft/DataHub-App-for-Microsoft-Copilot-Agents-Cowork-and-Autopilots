import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const output = resolve(import.meta.dirname, "..", "dist-demo");
const root = resolve(import.meta.dirname, "..", "..");
const businessImpactReview = process.argv.includes("--business-impact-review");
const data = JSON.parse(await readFile(resolve(root, "app", "src", "demo", "sample-data.generated.json"), "utf8"));
const scenarioSource = "app/src/screens/business-impact/scenario.ts";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
await writeFile(resolve(output, "SOURCE_PROVENANCE.json"), `${JSON.stringify({
    repository: "https://github.com/microsoft/DataHub-App-for-Microsoft-Copilot-Agents-Cowork-and-Autopilots",
    sourceRevision: git("rev-parse", "HEAD"),
    sourceDirty: git("status", "--porcelain", "--untracked-files=no") !== "",
    sampleTree: git("rev-parse", "HEAD:samples"),
    node: process.version,
    variant: businessImpactReview ? "business-impact-review" : "standard",
    businessImpact: {
        classification: "Synthetic BPS/SAP scenario and a separate invented D365 Sales cohort. No live sources.",
        source: scenarioSource,
        sha256: createHash("sha256").update(await readFile(resolve(root, scenarioSource))).digest("hex"),
    },
    ...data.provenance,
}, null, 2)}\n`);
let html = await readFile(resolve(output, "demo.html"), "utf8");
if (businessImpactReview && !html.includes("data-business-impact-review")) {
    html = html.replace(/<title>.*?<\/title>/, "<title>DataHub Business impact | Feedback demo</title>")
        .replace("</head>", [
            '<meta name="robots" content="noindex, nofollow, noarchive">',
            '<meta name="referrer" content="no-referrer">',
            '<script data-business-impact-review>if (!location.hash) history.replaceState(null, "", "#/business-impact/impact-summary");</script>',
            "</head>",
        ].join("\n"));
}
await writeFile(resolve(output, "demo.html"), html);
await writeFile(resolve(output, "index.html"), html);
await copyFile(resolve(import.meta.dirname, "..", "LICENSE"), resolve(output, "LICENSE.txt"));
await writeFile(
    resolve(output, "README.txt"),
    [
        "DataHub App interactive browser demo",
        "",
        "Static, self-contained app bundle. Uses synthetic sample data only.",
        "No sign-in, model, tenant, or app backend is required.",
        "Core pages derive from the repository's published synthetic CSVs, with original dates.",
        "Unfiltered activity: 13,337 tasks, 170 inventory people; template-rule typical hours: 2,476.65.",
        "Dated tenant exports: Cowork 44,750.8531 + Studio 117,472 = 162,222.8531 credits.",
        "User and agent exports are separate snapshots, not dated tenant totals.",
        "No Microsoft 365 telemetry, evaluation conversations, Defender or Resource Graph export is included.",
        "The cross-vendor comparison retains its separately labelled seeded scenario.",
        "Business impact adds eight headline BPS/SAP outcomes and three separate D365 Sales examples.",
        "All process data, persona mappings and attribution intervals are illustrative; no live sources are connected.",
        "The BPS/SAP, D365 and core Value samples use different cohorts: do not reconcile or sum their totals.",
        "The optional adapters are proposed, not implemented by this demo.",
        ...(businessImpactReview ? [
            "Feedback build: opens Business impact by default; existing hash links still work.",
            "Requests no search indexing. Unlisted hosting is PUBLIC, not private or access-controlled.",
        ] : []),
        "SOURCE_PROVENANCE.json records build revision, source hashes and classification settings.",
        "Keep all assets, SOURCE_PROVENANCE.json, LICENSE.txt, THIRD_PARTY_NOTICES.txt, and SHA256SUMS.txt alongside index.html.",
        "",
    ].join("\n"),
);

async function collectFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) files.push(...await collectFiles(path));
        else files.push(path);
    }
    return files;
}

const files = (await collectFiles(output))
    .filter((path) => path !== resolve(output, "SHA256SUMS.txt"))
    .sort();
const checksums = await Promise.all(files.map(async (path) => {
    const digest = createHash("sha256").update(await readFile(path)).digest("hex");
    return `${digest}  ${relative(output, path).replaceAll("\\", "/")}`;
}));
await writeFile(resolve(output, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`);
