"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "_tools", "phase2_kpi_gate.json");
const DEFAULT_REPORT = path.join(ROOT, "_scratch", "browser-validation-report-assembly.json");
const KPI_RESULT_PATH = path.join(ROOT, "_scratch", "kpi-gate-result.json");

function fail(message) {
    throw new Error(message);
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

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
    if (!fs.existsSync(CONFIG_PATH)) {
        fail(`KPI gate config not found: ${CONFIG_PATH}`);
    }

    const config = readJson(CONFIG_PATH);
    const reportPath = process.argv[2] ? path.resolve(ROOT, process.argv[2]) : DEFAULT_REPORT;

    if (!fs.existsSync(reportPath)) {
        fail(`Validation report not found: ${path.relative(ROOT, reportPath)}`);
    }

    const report = readJson(reportPath);
    const checks = [];

    // 1) Validation gate
    const suiteFailures = [];
    for (const suite of report.suites || []) {
        if ((suite.failed || 0) > config.validation.max_failed_tests_per_suite) {
            suiteFailures.push({
                file: suite.file,
                failed: suite.failed
            });
        }
    }

    const targetedConsoleErrors = (report.targeted?.consoleErrors || []).length;
    const targetedPageErrors = (report.targeted?.pageErrors || []).length;

    checks.push({
        name: "validation_suites",
        pass: suiteFailures.length === 0,
        details: suiteFailures
    });
    checks.push({
        name: "validation_targeted_console_errors",
        pass: targetedConsoleErrors <= config.validation.max_targeted_console_errors,
        details: {
            actual: targetedConsoleErrors,
            threshold: config.validation.max_targeted_console_errors
        }
    });
    checks.push({
        name: "validation_targeted_page_errors",
        pass: targetedPageErrors <= config.validation.max_targeted_page_errors,
        details: {
            actual: targetedPageErrors,
            threshold: config.validation.max_targeted_page_errors
        }
    });

    // 2) Assembly gate
    const artifactPath = path.resolve(ROOT, config.assembly.artifact);
    const sourcePath = path.resolve(ROOT, config.assembly.source);
    if (!fs.existsSync(artifactPath)) {
        fail(`Assembly artifact missing: ${path.relative(ROOT, artifactPath)}. Run build:assembly first.`);
    }
    if (!fs.existsSync(sourcePath)) {
        fail(`Assembly source missing: ${path.relative(ROOT, sourcePath)}.`);
    }

    const artifactText = fs.readFileSync(artifactPath, "utf8");
    const metadata = parseAssemblyMetadata(artifactText);
    if (!metadata) {
        fail(`Assembly metadata missing/invalid in ${path.relative(ROOT, artifactPath)}.`);
    }

    const sourceSize = fs.statSync(sourcePath).size;
    const artifactSize = fs.statSync(artifactPath).size;
    const growthRatio = (artifactSize - sourceSize) / sourceSize;

    checks.push({
        name: "assembly_module_count",
        pass: (metadata.moduleCount || 0) >= config.assembly.min_inlined_modules,
        details: {
            actual: metadata.moduleCount || 0,
            threshold: config.assembly.min_inlined_modules
        }
    });
    if (typeof config.assembly.min_available_modules === "number") {
        checks.push({
            name: "assembly_available_module_count",
            pass: (metadata.availableModuleCount || 0) >= config.assembly.min_available_modules,
            details: {
                actual: metadata.availableModuleCount || 0,
                threshold: config.assembly.min_available_modules
            }
        });
    }
    if (typeof config.assembly.mode === "string") {
        checks.push({
            name: "assembly_mode",
            pass: metadata.mode === config.assembly.mode,
            details: {
                actual: metadata.mode || null,
                expected: config.assembly.mode
            }
        });
    }
    checks.push({
        name: "assembly_size_growth_ratio",
        pass: growthRatio <= config.assembly.max_size_growth_ratio,
        details: {
            actual: growthRatio,
            threshold: config.assembly.max_size_growth_ratio
        }
    });

    // 3) Smoke gate
    const artifactAbs = path.resolve(ROOT, config.assembly.artifact);
    delete require.cache[artifactAbs];
    const stitch = require(artifactAbs);
    const missingExports = [];
    for (const key of config.smoke.required_exports || []) {
        if (!(key in stitch)) {
            missingExports.push(key);
        }
    }
    checks.push({
        name: "smoke_required_exports",
        pass: missingExports.length === 0,
        details: {
            missing: missingExports
        }
    });

    const passed = checks.every(check => check.pass);
    const result = {
        generatedAt: new Date().toISOString(),
        report: path.relative(ROOT, reportPath),
        artifact: path.relative(ROOT, artifactPath),
        source: path.relative(ROOT, sourcePath),
        sourceSize,
        artifactSize,
        growthRatio,
        checks,
        passed
    };

    fs.mkdirSync(path.dirname(KPI_RESULT_PATH), { recursive: true });
    fs.writeFileSync(KPI_RESULT_PATH, JSON.stringify(result, null, 2));

    for (const check of checks) {
        const status = check.pass ? "PASS" : "FAIL";
        console.log(`[${status}] ${check.name}`);
    }

    if (!passed) {
        console.error(`KPI gate failed. Details: ${path.relative(ROOT, KPI_RESULT_PATH)}`);
        process.exit(1);
    }

    console.log(`KPI gate passed. Details: ${path.relative(ROOT, KPI_RESULT_PATH)}`);
}

main();
