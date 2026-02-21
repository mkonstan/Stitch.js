"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();
const DEFAULT_SOURCE_REPORT = path.join(ROOT, "_scratch", "browser-validation-report-source.json");
const DEFAULT_ASSEMBLED_REPORT = path.join(ROOT, "_scratch", "browser-validation-report-release-candidate.json");
const DEFAULT_OUTPUT = path.join(ROOT, "_scratch", "build-output-delta.json");
const STITCH_SOURCE = path.join(ROOT, "stitch.js");
const STITCH_ASSEMBLED = path.join(ROOT, "dist", "stitch.assembled.js");

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hashFile(filePath) {
    const text = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(text).digest("hex");
}

function normalize(value) {
    if (Array.isArray(value)) {
        return value.map(normalize);
    }
    if (value && typeof value === "object") {
        const out = {};
        const keys = Object.keys(value).sort();
        for (const key of keys) {
            out[key] = normalize(value[key]);
        }
        return out;
    }
    return value;
}

function isEqual(a, b) {
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function parseAssemblyMetadata(artifactText) {
    const match = artifactText.match(/\/\*\s*STITCH_ASSEMBLY_METADATA\s+(\{[\s\S]*?\})\s*\*\//);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch (_error) {
        return null;
    }
}

function toSuiteMap(report) {
    const map = new Map();
    for (const suite of report.suites || []) {
        map.set(suite.file, suite);
    }
    return map;
}

function compareSuites(sourceReport, assembledReport) {
    const sourceSuites = toSuiteMap(sourceReport);
    const assembledSuites = toSuiteMap(assembledReport);
    const files = new Set([...sourceSuites.keys(), ...assembledSuites.keys()]);
    const diffs = [];

    for (const file of files) {
        const source = sourceSuites.get(file);
        const assembled = assembledSuites.get(file);
        if (!source || !assembled) {
            diffs.push({
                file,
                type: "missing_suite",
                sourceExists: !!source,
                assembledExists: !!assembled
            });
            continue;
        }

        const fields = ["total", "passed", "failed"];
        for (const field of fields) {
            if (source[field] !== assembled[field]) {
                diffs.push({
                    file,
                    type: "summary_mismatch",
                    field,
                    source: source[field],
                    assembled: assembled[field]
                });
            }
        }

        if (!isEqual(source.failedCases, assembled.failedCases)) {
            diffs.push({
                file,
                type: "failed_cases_mismatch",
                source: source.failedCases,
                assembled: assembled.failedCases
            });
        }

        if (!isEqual(source.failedAssertions, assembled.failedAssertions)) {
            diffs.push({
                file,
                type: "failed_assertions_mismatch",
                source: source.failedAssertions,
                assembled: assembled.failedAssertions
            });
        }
    }

    return diffs;
}

function compareTargeted(sourceReport, assembledReport) {
    const diffs = [];
    const sourceTargeted = sourceReport.targeted || {};
    const assembledTargeted = assembledReport.targeted || {};

    if (!isEqual(sourceTargeted.checks || {}, assembledTargeted.checks || {})) {
        diffs.push({
            type: "targeted_checks_mismatch",
            source: sourceTargeted.checks || {},
            assembled: assembledTargeted.checks || {}
        });
    }

    const sourceConsoleErrors = (sourceTargeted.consoleErrors || []).length;
    const sourcePageErrors = (sourceTargeted.pageErrors || []).length;
    const assembledConsoleErrors = (assembledTargeted.consoleErrors || []).length;
    const assembledPageErrors = (assembledTargeted.pageErrors || []).length;

    if (sourceConsoleErrors !== assembledConsoleErrors) {
        diffs.push({
            type: "targeted_console_error_count_mismatch",
            source: sourceConsoleErrors,
            assembled: assembledConsoleErrors
        });
    }

    if (sourcePageErrors !== assembledPageErrors) {
        diffs.push({
            type: "targeted_page_error_count_mismatch",
            source: sourcePageErrors,
            assembled: assembledPageErrors
        });
    }

    return diffs;
}

function compareExports() {
    const sourcePath = path.resolve(STITCH_SOURCE);
    const assembledPath = path.resolve(STITCH_ASSEMBLED);

    delete require.cache[sourcePath];
    delete require.cache[assembledPath];

    const source = require(sourcePath);
    const assembled = require(assembledPath);

    const sourceKeys = Object.keys(source).sort();
    const assembledKeys = Object.keys(assembled).sort();
    const missingInAssembled = sourceKeys.filter((key) => !assembledKeys.includes(key));
    const extraInAssembled = assembledKeys.filter((key) => !sourceKeys.includes(key));
    const typeDiffs = [];

    for (const key of sourceKeys) {
        if (!assembledKeys.includes(key)) continue;
        const sourceType = typeof source[key];
        const assembledType = typeof assembled[key];
        if (sourceType !== assembledType) {
            typeDiffs.push({ key, sourceType, assembledType });
        }
    }

    const versionMatch = source.version === assembled.version;
    const debugKeysSource = source.debug && typeof source.debug === "object" ? Object.keys(source.debug).sort() : [];
    const debugKeysAssembled = assembled.debug && typeof assembled.debug === "object" ? Object.keys(assembled.debug).sort() : [];
    const debugShapeMatch = isEqual(debugKeysSource, debugKeysAssembled);

    return {
        sourceKeys,
        assembledKeys,
        missingInAssembled,
        extraInAssembled,
        typeDiffs,
        versionMatch,
        debugShapeMatch,
        debugKeysSource,
        debugKeysAssembled
    };
}

function main() {
    const sourceReportPath = process.argv[2] ? path.resolve(ROOT, process.argv[2]) : DEFAULT_SOURCE_REPORT;
    const assembledReportPath = process.argv[3] ? path.resolve(ROOT, process.argv[3]) : DEFAULT_ASSEMBLED_REPORT;
    const outputPath = process.argv[4] ? path.resolve(ROOT, process.argv[4]) : DEFAULT_OUTPUT;

    if (!fs.existsSync(sourceReportPath)) {
        throw new Error(`Source report missing: ${path.relative(ROOT, sourceReportPath)}`);
    }
    if (!fs.existsSync(assembledReportPath)) {
        throw new Error(`Assembled report missing: ${path.relative(ROOT, assembledReportPath)}`);
    }
    if (!fs.existsSync(STITCH_SOURCE)) {
        throw new Error("stitch.js not found.");
    }
    if (!fs.existsSync(STITCH_ASSEMBLED)) {
        throw new Error("dist/stitch.assembled.js not found. Run build first.");
    }

    const sourceReport = readJson(sourceReportPath);
    const assembledReport = readJson(assembledReportPath);

    const suiteDiffs = compareSuites(sourceReport, assembledReport);
    const targetedDiffs = compareTargeted(sourceReport, assembledReport);
    const exportDiffs = compareExports();

    const assembledText = fs.readFileSync(STITCH_ASSEMBLED, "utf8");
    const assemblyMetadata = parseAssemblyMetadata(assembledText);

    const exportMismatch =
        exportDiffs.missingInAssembled.length > 0 ||
        exportDiffs.extraInAssembled.length > 0 ||
        exportDiffs.typeDiffs.length > 0 ||
        !exportDiffs.versionMatch ||
        !exportDiffs.debugShapeMatch;

    const passed = suiteDiffs.length === 0 && targetedDiffs.length === 0 && !exportMismatch;

    const result = {
        generatedAt: new Date().toISOString(),
        sourceReport: path.relative(ROOT, sourceReportPath),
        assembledReport: path.relative(ROOT, assembledReportPath),
        sourceArtifact: "stitch.js",
        assembledArtifact: "dist/stitch.assembled.js",
        sourceHash: hashFile(STITCH_SOURCE),
        assembledHash: hashFile(STITCH_ASSEMBLED),
        sourceSize: fs.statSync(STITCH_SOURCE).size,
        assembledSize: fs.statSync(STITCH_ASSEMBLED).size,
        assemblyMetadata,
        suiteDiffs,
        targetedDiffs,
        exportDiffs,
        passed
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`Source report: ${path.relative(ROOT, sourceReportPath)}`);
    console.log(`Assembled report: ${path.relative(ROOT, assembledReportPath)}`);
    console.log(`Delta report: ${path.relative(ROOT, outputPath)}`);
    console.log(`Suite diffs: ${suiteDiffs.length}`);
    console.log(`Targeted diffs: ${targetedDiffs.length}`);
    console.log(`Export mismatches: ${exportMismatch ? "yes" : "no"}`);

    if (!passed) {
        console.error("Build output comparison FAILED.");
        process.exit(1);
    }

    console.log("Build output comparison PASSED.");
}

main();
