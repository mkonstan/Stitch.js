"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const ENTRY_FILE = path.join(ROOT, "stitch.entry.js");
const GENERATED_SOURCE_FILE = path.join(ROOT, "stitch.js");
const OUTPUT_FILE = path.join(DIST_DIR, "stitch.assembled.js");

const PACKAGE_DIRS = [
    "packages/core",
    "packages/api",
    "packages/utils",
    "packages/browser"
];

function getBuildMode() {
    const arg = process.argv.find((item) => item.startsWith("--mode="));
    const mode = arg ? arg.split("=")[1] : (process.env.STITCH_ASSEMBLY_MODE || "reachable");
    if (mode !== "reachable" && mode !== "all") {
        throw new Error(`Invalid assembly mode "${mode}". Use "reachable" or "all".`);
    }
    return mode;
}

function toPosix(filePath) {
    return filePath.split(path.sep).join("/");
}

function normalizeModuleId(moduleId) {
    let id = moduleId.replace(/\\/g, "/");
    if (id.startsWith("./")) id = id.slice(2);
    return id;
}

function listModuleFiles() {
    const files = [];
    for (const pkgRoot of PACKAGE_DIRS) {
        const absPkgRoot = path.join(ROOT, pkgRoot);
        const indexPath = path.join(absPkgRoot, "index.js");
        if (fs.existsSync(indexPath)) {
            files.push(indexPath);
        }

        const srcRoot = path.join(absPkgRoot, "src");
        if (!fs.existsSync(srcRoot)) {
            continue;
        }
        const entries = fs.readdirSync(srcRoot, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(".js")) {
                files.push(path.join(srcRoot, entry.name));
            }
        }
    }
    return files.sort();
}

function resolveRequireId(fromModuleId, requestId) {
    if (requestId.startsWith(".")) {
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromModuleId), requestId));
        return resolved.endsWith(".js") ? resolved : `${resolved}.js`;
    }
    const normalized = normalizeModuleId(requestId);
    return normalized.endsWith(".js") ? normalized : `${normalized}.js`;
}

function transformModuleSource(moduleId, source, knownIds, pathToNumericId) {
    return source.replace(/require\((['"])([^'"]+)\1\)/g, (fullMatch, _quote, rawId) => {
        const resolved = resolveRequireId(moduleId, rawId);
        if (!knownIds.has(resolved)) {
            return fullMatch;
        }
        const numId = pathToNumericId.get(resolved);
        if (numId === undefined) {
            return `__stitchRequire(${JSON.stringify(resolved)})`;
        }
        return `__stitchRequire(${numId})`;
    });
}

function collectInitialEntryRequires(entrySource, knownIds) {
    const ids = new Set();
    const pattern = /require\((['"])([^'"]+)\1\)/g;
    let match;
    while ((match = pattern.exec(entrySource)) !== null) {
        const rawId = match[2];
        if (!rawId.startsWith("./packages/")) continue;
        const normalized = normalizeModuleId(rawId).endsWith(".js")
            ? normalizeModuleId(rawId)
            : `${normalizeModuleId(rawId)}.js`;
        if (knownIds.has(normalized)) {
            ids.add(normalized);
        }
    }
    return ids;
}

function collectTransitiveModuleIds(initialIds, moduleSourceById, knownIds) {
    const selected = new Set(initialIds);
    const queue = [...initialIds];

    while (queue.length > 0) {
        const currentId = queue.shift();
        const source = moduleSourceById.get(currentId);
        if (!source) continue;

        const pattern = /require\((['"])([^'"]+)\1\)/g;
        let match;
        while ((match = pattern.exec(source)) !== null) {
            const resolved = resolveRequireId(currentId, match[2]);
            if (!knownIds.has(resolved) || selected.has(resolved)) continue;
            selected.add(resolved);
            queue.push(resolved);
        }
    }

    return selected;
}

function buildInlinePrelude(modules) {
    const lines = [];
    lines.push("(function(root){");
    lines.push("  var __stitchModuleFactories = Object.create(null);");
    for (const mod of modules) {
        lines.push(`  __stitchModuleFactories[${mod.numericId}] = function(module, exports, __stitchRequire){`);
        lines.push(mod.source);
        lines.push("  };");
    }
    lines.push("  var __stitchModuleCache = Object.create(null);");
    lines.push("  function __stitchRequire(id){");
    lines.push("    var factory = __stitchModuleFactories[id];");
    lines.push("    if (!factory) throw new Error('Stitch assembly missing inline module: ' + id);");
    lines.push("    if (__stitchModuleCache[id]) return __stitchModuleCache[id].exports;");
    lines.push("    var module = { exports: {} };");
    lines.push("    __stitchModuleCache[id] = module;");
    lines.push("    factory(module, module.exports, __stitchRequire);");
    lines.push("    return module.exports;");
    lines.push("  }");
    lines.push("  if (typeof root.__stitchInlineRequire !== 'function') {");
    lines.push("    root.__stitchInlineRequire = function(id){");
    lines.push("      try {");
    lines.push("        return __stitchRequire(id);");
    lines.push("      } catch (_error) {");
    lines.push("        return null;");
    lines.push("      }");
    lines.push("    };");
    lines.push("  }");
    lines.push("})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));");
    return lines.join("\n");
}

function patchEntrySourceForInlineRequire(entrySource, pathToNumericId) {
    return entrySource.replace(/require\((['"])(\.\/packages\/[^'"]+)\1\)/g, (_match, _quote, reqId) => {
        const normalized = normalizeModuleId(reqId).endsWith(".js")
            ? normalizeModuleId(reqId)
            : `${normalizeModuleId(reqId)}.js`;
        const numId = pathToNumericId.get(normalized);
        const lit = JSON.stringify(reqId);
        if (numId !== undefined) {
            return `(typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire(${numId}) || require(${lit})) : require(${lit}))`;
        }
        return `(typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire(${lit}) || require(${lit})) : require(${lit}))`;
    });
}

function main() {
    if (!fs.existsSync(ENTRY_FILE)) {
        throw new Error("Cannot build assembly: stitch.entry.js not found.");
    }

    const mode = getBuildMode();
    const entrySource = fs.readFileSync(ENTRY_FILE, "utf8");
    const moduleFiles = listModuleFiles();
    const moduleIds = moduleFiles.map(file => normalizeModuleId(toPosix(path.relative(ROOT, file))));
    const knownIds = new Set(moduleIds);
    const moduleSourceById = new Map();
    for (const file of moduleFiles) {
        const id = normalizeModuleId(toPosix(path.relative(ROOT, file)));
        moduleSourceById.set(id, fs.readFileSync(file, "utf8"));
    }

    let selectedModuleIds;
    if (mode === "all") {
        selectedModuleIds = new Set(moduleIds);
    } else {
        const initialIds = collectInitialEntryRequires(entrySource, knownIds);
        selectedModuleIds = collectTransitiveModuleIds(initialIds, moduleSourceById, knownIds);
    }

    const sortedSelectedIds = [...selectedModuleIds].sort();
    const pathToNumericId = new Map();
    for (let i = 0; i < sortedSelectedIds.length; i++) {
        pathToNumericId.set(sortedSelectedIds[i], i);
    }

    const modules = sortedSelectedIds.map((id, index) => {
        const rawSource = moduleSourceById.get(id);
        const transformed = transformModuleSource(id, rawSource, knownIds, pathToNumericId);
        return { id, numericId: index, source: transformed };
    });

    const prelude = buildInlinePrelude(modules);
    const patchedEntrySource = patchEntrySourceForInlineRequire(entrySource, pathToNumericId);

    const moduleMap = {};
    for (const mod of modules) {
        moduleMap[String(mod.numericId)] = mod.id;
    }

    const metadata = {
        generatedAt: new Date().toISOString(),
        source: "stitch.entry.js",
        mode,
        availableModuleCount: moduleFiles.length,
        moduleCount: modules.length,
        modules: modules.map(m => m.id),
        moduleMap
    };

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const licenseBanner = `/*! Stitch.js v${pkg.version} | MIT License | https://github.com/user/Stitch.js */`;

    const output = [
        licenseBanner,
        `/*! STITCH_ASSEMBLY_METADATA ${JSON.stringify(metadata)} */`,
        prelude,
        patchedEntrySource
    ].join("\n\n");

    fs.mkdirSync(DIST_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, output, "utf8");
    fs.writeFileSync(GENERATED_SOURCE_FILE, output, "utf8");

    const entrySize = fs.statSync(ENTRY_FILE).size;
    const outputSize = fs.statSync(OUTPUT_FILE).size;
    const growthRatio = (outputSize - entrySize) / entrySize;

    console.log(`Built ${path.relative(ROOT, OUTPUT_FILE)} from ${modules.length}/${moduleFiles.length} inline modules (mode=${mode}).`);
    console.log(`Synced generated source: ${path.relative(ROOT, GENERATED_SOURCE_FILE)}.`);
    console.log(`Size: entry=${entrySize} bytes, assembled=${outputSize} bytes, growth-vs-entry=${(growthRatio * 100).toFixed(2)}%.`);
}

main();
