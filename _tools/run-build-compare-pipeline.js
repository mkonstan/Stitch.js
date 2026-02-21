"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const SOURCE_REPORT = path.join(ROOT, "_scratch", "browser-validation-report-source.json");
const ASSEMBLED_REPORT = path.join(ROOT, "_scratch", "browser-validation-report-release-candidate.json");
const DELTA_REPORT = path.join(ROOT, "_scratch", "build-output-delta.json");

function runNodeScript(scriptPath, args = [], options = {}) {
    const absScript = path.resolve(ROOT, scriptPath);
    const result = spawnSync(process.execPath, [absScript, ...args], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: options.captureOutput ? "pipe" : "inherit"
    });

    if (result.status !== 0) {
        const stdout = result.stdout || "";
        const stderr = result.stderr || "";
        throw new Error(
            `Script failed: ${scriptPath}\n` +
            (stdout ? `STDOUT:\n${stdout}\n` : "") +
            (stderr ? `STDERR:\n${stderr}\n` : "")
        );
    }

    return result.stdout || "";
}

function writeOutput(filePath, text) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, text, "utf8");
}

function main() {
    console.log("Step 1/4: Build assembled artifact...");
    runNodeScript("_tools/build-stitch-assembly.js");

    console.log("Step 2/4: Validate source artifact (stitch.js)...");
    const sourceReport = runNodeScript("_scratch/run-browser-validation.js", [], { captureOutput: true });
    writeOutput(SOURCE_REPORT, sourceReport);

    console.log("Step 3/4: Validate assembled artifact...");
    const assembledReport = runNodeScript("_scratch/run-browser-validation-release-candidate.js", [], { captureOutput: true });
    writeOutput(ASSEMBLED_REPORT, assembledReport);

    console.log("Step 4/4: Compare source vs assembled outputs...");
    runNodeScript("_tools/compare-build-output.js", [
        path.relative(ROOT, SOURCE_REPORT),
        path.relative(ROOT, ASSEMBLED_REPORT),
        path.relative(ROOT, DELTA_REPORT)
    ]);

    console.log("Pipeline complete.");
    console.log(`Source report: ${path.relative(ROOT, SOURCE_REPORT)}`);
    console.log(`Assembled report: ${path.relative(ROOT, ASSEMBLED_REPORT)}`);
    console.log(`Delta report: ${path.relative(ROOT, DELTA_REPORT)}`);
}

main();
