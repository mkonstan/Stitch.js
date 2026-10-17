"use strict";

const fs = require("fs");
const path = require("path");

// Paths resolve against the repository root (the parent of _tools/), not the
// caller's working directory, so the build is the same wherever it is started.
const DEFAULT_ROOT = path.resolve(__dirname, "..");

const VERSION_MODULE_ID = "packages/utils/src/version.js";

const PACKAGE_DIRS = [
    "packages/core",
    "packages/api",
    "packages/utils",
    "packages/browser"
];

function getBuildMode(argv) {
    const arg = argv.find((item) => item.startsWith("--mode="));
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

function listModuleFiles(ROOT) {
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

/**
 * The module table and the bundle's own require, as the opening of ONE closure that the
 * entry source also runs in (see assemble). Nothing is put on the global object, and the
 * bundle never calls a real require(): every module it needs is inlined, and an id the
 * build cannot resolve fails the build.
 */
function buildInlinePrelude(modules) {
    const lines = [];
    lines.push("(function(){");
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
    return lines.join("\n");
}

const CLOSE_BUNDLE = "})();";

function patchEntrySourceForInlineRequire(entrySource, pathToNumericId) {
    return entrySource.replace(/require\((['"])(\.\/packages\/[^'"]+)\1\)/g, (_match, _quote, reqId) => {
        const normalized = normalizeModuleId(reqId).endsWith(".js")
            ? normalizeModuleId(reqId)
            : `${normalizeModuleId(reqId)}.js`;
        const numId = pathToNumericId.get(normalized);
        if (numId === undefined) {
            throw new Error(`Cannot build assembly: stitch.entry.js requires "${reqId}", which is not an inlined module.`);
        }
        return `__stitchRequire(${numId})`;
    });
}

/**
 * Assembles the single-file bundle from stitch.entry.js and packages/*.
 * Pure: reads sources, returns the bundle text. The output depends only on the
 * sources and package.json (no timestamps), so rebuilding unchanged sources is
 * byte-identical and `git diff --exit-code` after a build is meaningful.
 */
function assemble(options = {}) {
    const ROOT = options.root || DEFAULT_ROOT;
    const mode = options.mode || "reachable";
    const ENTRY_FILE = path.join(ROOT, "stitch.entry.js");
    if (!fs.existsSync(ENTRY_FILE)) {
        throw new Error("Cannot build assembly: stitch.entry.js not found.");
    }

    const entrySource = fs.readFileSync(ENTRY_FILE, "utf8");
    const moduleFiles = listModuleFiles(ROOT);
    const moduleIds = moduleFiles.map(file => normalizeModuleId(toPosix(path.relative(ROOT, file))));
    const knownIds = new Set(moduleIds);
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+/.test(pkg.version)) {
        throw new Error(`package.json has no usable "version" field: ${JSON.stringify(pkg.version)}`);
    }
    const moduleSourceById = new Map();
    for (const file of moduleFiles) {
        const id = normalizeModuleId(toPosix(path.relative(ROOT, file)));
        moduleSourceById.set(id, fs.readFileSync(file, "utf8"));
    }
    if (!moduleSourceById.has(VERSION_MODULE_ID)) {
        throw new Error(`Cannot build assembly: ${VERSION_MODULE_ID} not found.`);
    }
    // Stamp the single version source. Unbuilt, the module reads package.json;
    // in the bundle it is a constant, so the bundle never touches the file system.
    moduleSourceById.set(VERSION_MODULE_ID,
        `"use strict";
// Stamped by the build from package.json.
module.exports = { VERSION: ${JSON.stringify(pkg.version)} };
`);

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
        source: "stitch.entry.js",
        mode,
        availableModuleCount: moduleFiles.length,
        moduleCount: modules.length,
        modules: modules.map(m => m.id),
        moduleMap
    };

    const licenseBanner = `/*! Stitch.js v${pkg.version} | MIT License | https://github.com/user/Stitch.js */`;

    const output = [
        licenseBanner,
        `/*! STITCH_ASSEMBLY_METADATA ${JSON.stringify(metadata)} */`,
        prelude,
        patchedEntrySource,
        CLOSE_BUNDLE
    ].join("\n\n");

    return { output, metadata, entrySource };
}

function main() {
    const ROOT = DEFAULT_ROOT;
    const mode = getBuildMode(process.argv);
    const { output, metadata, entrySource } = assemble({ root: ROOT, mode });

    const DIST_DIR = path.join(ROOT, "dist");
    const OUTPUT_FILE = path.join(DIST_DIR, "stitch.assembled.js");
    const GENERATED_SOURCE_FILE = path.join(ROOT, "stitch.js");
    fs.mkdirSync(DIST_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, output, "utf8");
    fs.writeFileSync(GENERATED_SOURCE_FILE, output, "utf8");

    const entrySize = Buffer.byteLength(entrySource, "utf8");
    const outputSize = Buffer.byteLength(output, "utf8");
    const growthRatio = (outputSize - entrySize) / entrySize;

    console.log(`Built ${path.relative(ROOT, OUTPUT_FILE)} from ${metadata.moduleCount}/${metadata.availableModuleCount} inline modules (mode=${mode}).`);
    console.log(`Synced generated source: ${path.relative(ROOT, GENERATED_SOURCE_FILE)}.`);
    console.log(`Size: entry=${entrySize} bytes, assembled=${outputSize} bytes, growth-vs-entry=${(growthRatio * 100).toFixed(2)}%.`);
}

module.exports = { assemble };

if (require.main === module) {
    main();
}
