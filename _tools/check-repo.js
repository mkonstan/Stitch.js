"use strict";

/*
 * Static repository checks, run by `npm test` before any browser suite.
 *
 *   version-literal   The release version lives in ONE place: the root package.json.
 *                     Any other occurrence of that version string fails, except the
 *                     generated bundles (stamped by the build, compared byte-for-byte
 *                     by build-match) and npm's own lock-file fields (compared).
 *   stale-version     No OTHER version is named either (x.y.z after "v" or "Version "):
 *                     a stale version on a page or in a doc is a false claim. Archived
 *                     history docs (ARCHIVE_PATHS) are exempt.
 *   local-path        No absolute local path (Windows drive paths, /Users/<name>/,
 *                     /home/<name>/, file URLs) in any file.
 *   missing-reference Every file a doc or page points to exists, and every
 *                     `npm run <script>` mentioned exists in package.json.
 *   build-match       stitch.js and dist/stitch.assembled.js equal a fresh assembly of
 *                     packages/*, and stitch.min.js equals a fresh minification of it.
 *   no-console        The library (packages/) never logs: an error is thrown, or goes to
 *                     Stitch.onError (D3, D23). No console.warn / console.error anywhere in
 *                     packages/, and no other console call outside comments.
 *   no-random-ids     No Math.random in packages/: ids are counters (triage #14).
 *   bundle-require    The generated bundles call no require(): every module is inlined, so
 *                     the browser bundle never reaches for a file system (triage #9).
 *
 * Usage: node _tools/check-repo.js [--root <dir>] [--only <check>[,<check>]]
 * --root points the checks at another tree (the gate self-tests use this).
 * Exit 0 when every check passes, 1 otherwise.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const GENERATED_BUNDLES = ["stitch.js", "stitch.min.js", "dist/stitch.assembled.js"];
const SKIP_DIRS = new Set(["node_modules", ".git"]);
// History documents that legitimately name old versions. PLAN.md, V2-TEST-REPORT.md and
// MIGRATION.md (the v1 -> v2 guide) are due to move to docs/history/; drop them here then.
const ARCHIVE_PATHS = ["PLAN.md", "V2-TEST-REPORT.md", "MIGRATION.md", "docs/history/"];

// ---------------------------------------------------------------------------
// File listing

function isGitRepo(root) {
    try {
        const top = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        return path.resolve(top) === path.resolve(root);
    } catch (_error) {
        return false;
    }
}

function walk(root, rel, out) {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(root, childRel, out);
        else if (entry.isFile()) out.push(childRel);
    }
    return out;
}

/** Tracked plus untracked-but-not-ignored files in a git repo; every file elsewhere. */
function listFiles(root) {
    if (isGitRepo(root)) {
        const text = execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
        return text.split("\n").map((line) => line.trim()).filter(Boolean)
            .filter((rel) => fs.existsSync(path.join(root, rel)));
    }
    return walk(root, "", []);
}

function readText(root, rel) {
    return fs.readFileSync(path.join(root, rel), "utf8");
}

function lineOf(text, index) {
    return text.slice(0, index).split("\n").length;
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// version-literal

function checkVersionLiterals(root, files) {
    const problems = [];
    const pkg = JSON.parse(readText(root, "package.json"));
    const version = pkg.version;
    if (typeof version !== "string" || !version) {
        return [`package.json: no "version" field`];
    }
    const literal = new RegExp(`(?<![0-9.])${escapeRegExp(version)}(?![0-9]|\\.[0-9])`, "g");
    for (const rel of files) {
        if (rel === "package.json" || GENERATED_BUNDLES.includes(rel)) continue;
        if (rel === "package-lock.json") {
            problems.push(...checkLockVersions(root, version));
            continue;
        }
        const text = readText(root, rel);
        let match;
        while ((match = literal.exec(text)) !== null) {
            problems.push(`${rel}:${lineOf(text, match.index)}: version literal "${version}" outside package.json (import it from packages/utils/src/version.js, or drop it)`);
        }
    }
    return problems;
}

function checkLockVersions(root, version) {
    const problems = [];
    const lock = JSON.parse(readText(root, "package-lock.json"));
    if (lock.version !== undefined && lock.version !== version) {
        problems.push(`package-lock.json: version ${lock.version} != package.json ${version} (run npm install)`);
    }
    const packages = lock.packages || {};
    for (const [key, entry] of Object.entries(packages)) {
        const ours = key === "" || key.startsWith("packages/");
        if (!ours || entry.version === undefined) continue;
        if (key === "" && entry.version === version) continue;
        problems.push(`package-lock.json: "${key || "<root>"}" carries version ${entry.version}; only the root package.json may (run npm install)`);
    }
    return problems;
}

// ---------------------------------------------------------------------------
// stale-version

function checkStaleVersions(root, files) {
    const problems = [];
    const version = JSON.parse(readText(root, "package.json")).version;
    // A version written as a Stitch version: x.y.z prefixed by "v", "V" or "Version ".
    // Bare triplets (dependency ranges, IP addresses, CDN file names) are not matched.
    const mention = /(?<![0-9A-Za-z.])(?:[vV]|[Vv]ersion\s+)(\d+\.\d+\.\d+)(?![0-9]|\.[0-9])/g;
    for (const rel of files) {
        if (rel === "package.json" || rel === "package-lock.json" || GENERATED_BUNDLES.includes(rel)) continue;
        if (ARCHIVE_PATHS.some((archived) => rel === archived || (archived.endsWith("/") && rel.startsWith(archived)))) continue;
        const text = readText(root, rel);
        let match;
        while ((match = mention.exec(text)) !== null) {
            if (match[1] === version) continue; // reported by version-literal
            problems.push(`${rel}:${lineOf(text, match.index)}: stale version "${match[0]}" (the version is ${version}; drop the number, or move the text to an archived history doc)`);
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------
// local-path

// Built from pieces so this file does not match its own patterns.
const LOCAL_PATH_PATTERNS = [
    { name: "Windows drive path", regex: new RegExp("(?<![A-Za-z0-9])[A-Za-z]:(?:\\\\{1,2}|/)(?=[A-Za-z0-9_ .$-])", "g") },
    { name: "macOS home path", regex: new RegExp("/" + "Users/[A-Za-z0-9._-]+/", "g") },
    { name: "Linux home path", regex: new RegExp("/" + "home/[A-Za-z0-9._-]+/", "g") },
    { name: "file URL", regex: new RegExp("file" + ":///", "g") }
];

function checkLocalPaths(root, files) {
    const problems = [];
    for (const rel of files) {
        const text = readText(root, rel);
        for (const { name, regex } of LOCAL_PATH_PATTERNS) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const snippet = text.slice(match.index, match.index + 40).split("\n")[0];
                problems.push(`${rel}:${lineOf(text, match.index)}: ${name}: ${snippet}`);
            }
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------
// missing-reference

const FILE_EXT = "(?:md|js|json|html|yml|yaml|css)";
const CODE_SPAN_PATH = new RegExp(`^[A-Za-z0-9_.*@/-]+\\.${FILE_EXT}$`);

function isExternal(target) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);
}

function globToRegExp(glob) {
    return new RegExp("^" + glob.split("*").map(escapeRegExp).join("[^/]*") + "$");
}

function makeExists(root, files) {
    const fileSet = new Set(files);
    const dirSet = new Set();
    const baseNames = new Set(files.map((rel) => path.posix.basename(rel)));
    for (const rel of files) {
        const parts = rel.split("/");
        for (let i = 1; i < parts.length; i++) dirSet.add(parts.slice(0, i).join("/"));
    }
    const ignored = makeIgnoredTest(root);
    return function exists(candidate, options = {}) {
        const clean = path.posix.normalize(candidate).replace(/^\.\//, "").replace(/\/$/, "");
        if (clean.startsWith("../")) return null; // outside the tree: not ours to judge
        if (ignored(clean)) return null; // generated output (gitignored): exists only after a run
        // A bare file name in prose ("observable.js") names a module wherever it lives.
        if (options.allowBaseName && !clean.includes("/") && baseNames.has(clean)) return true;
        if (clean.includes("*")) {
            const regex = globToRegExp(clean);
            return files.some((rel) => regex.test(rel)) || [...dirSet].some((dir) => regex.test(dir));
        }
        return fileSet.has(clean) || dirSet.has(clean);
    };
}

/** Paths matched by .gitignore are generated outputs; references to them are allowed. */
function makeIgnoredTest(root) {
    if (!isGitRepo(root)) return () => false;
    const cache = new Map();
    return function ignored(rel) {
        if (!cache.has(rel)) {
            let result = false;
            try {
                execFileSync("git", ["-C", root, "check-ignore", "-q", "--no-index", rel], { stdio: "ignore" });
                result = true;
            } catch (_error) {
                result = false;
            }
            cache.set(rel, result);
        }
        return cache.get(rel);
    };
}

function resolveCandidates(fromRel, target) {
    const dir = path.posix.dirname(fromRel);
    const rel = target.replace(/^\//, "");
    return dir === "." ? [rel] : [path.posix.join(dir, rel), rel];
}

function collectReferences(rel, text) {
    const refs = [];
    const add = (target, index, kind) => refs.push({ target, line: lineOf(text, index), kind });
    if (rel.endsWith(".md")) {
        // Fenced code blocks hold example code (user file names); check them for npm scripts only.
        const prose = text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "));
        let m;
        const link = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
        while ((m = link.exec(prose)) !== null) add(m[1], m.index, "link");
        const span = /`([^`\n]+)`/g;
        while ((m = span.exec(prose)) !== null) {
            const value = m[1].trim();
            if (CODE_SPAN_PATH.test(value) && (value.includes("/") || /^[A-Z_]/.test(value) || /^[a-z0-9-]+\.(?:html|js|json|md)$/.test(value))) {
                add(value, m.index, "code span");
            }
        }
    }
    if (rel.endsWith(".html")) {
        let m;
        const attr = /\b(?:src|href)\s*=\s*["']([^"']+)["']/g;
        while ((m = attr.exec(text)) !== null) add(m[1], m.index, "attribute");
    }
    return refs;
}

function checkReferences(root, files) {
    const problems = [];
    const exists = makeExists(root, files);
    const pkg = JSON.parse(readText(root, "package.json"));
    const scripts = pkg.scripts || {};

    for (const rel of files) {
        if (!/\.(?:md|html|yml|yaml)$/.test(rel)) continue;
        const text = readText(root, rel);
        for (const ref of collectReferences(rel, text)) {
            const target = ref.target.split("#")[0].split("?")[0];
            if (!target || isExternal(ref.target)) continue;
            const options = { allowBaseName: ref.kind === "code span" };
            const results = resolveCandidates(rel, target).map((candidate) => exists(candidate, options));
            if (results.includes(true) || results.every((r) => r === null)) continue;
            problems.push(`${rel}:${ref.line}: ${ref.kind} points to missing file "${target}"`);
        }
        let m;
        const npmRun = /npm run ([A-Za-z0-9:._-]+)/g;
        while ((m = npmRun.exec(text)) !== null) {
            if (!Object.prototype.hasOwnProperty.call(scripts, m[1])) {
                problems.push(`${rel}:${lineOf(text, m.index)}: "npm run ${m[1]}" but package.json has no such script`);
            }
        }
    }

    for (const [name, command] of Object.entries(scripts)) {
        const nodeFile = /\bnode\s+([^\s&|;>]+\.js)/g;
        let m;
        while ((m = nodeFile.exec(command)) !== null) {
            if (!exists(m[1])) problems.push(`package.json: script "${name}" runs missing file "${m[1]}"`);
        }
        const npmRun = /npm run ([A-Za-z0-9:._-]+)/g;
        while ((m = npmRun.exec(command)) !== null) {
            if (!Object.prototype.hasOwnProperty.call(scripts, m[1])) {
                problems.push(`package.json: script "${name}" calls missing script "${m[1]}"`);
            }
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------
// build-match

async function checkBuildMatch(root) {
    const problems = [];
    const { assemble } = require("./build-stitch-assembly.js");
    const { minifyCode } = require(path.join(REPO_ROOT, "minify.js"));

    let built;
    try {
        built = assemble({ root }).output;
    } catch (error) {
        return [`build-match: assembly failed: ${error.message}`];
    }
    for (const rel of ["stitch.js", "dist/stitch.assembled.js"]) {
        const file = path.join(root, rel);
        if (!fs.existsSync(file)) {
            problems.push(`build-match: ${rel} is missing (run npm run build)`);
        } else if (fs.readFileSync(file, "utf8") !== built) {
            problems.push(`build-match: ${rel} differs from a fresh assembly of packages/* (run npm run build and commit)`);
        }
    }
    const minFile = path.join(root, "stitch.min.js");
    const minified = await minifyCode(built);
    if (!fs.existsSync(minFile)) {
        problems.push("build-match: stitch.min.js is missing (run npm run build)");
    } else if (fs.readFileSync(minFile, "utf8") !== minified) {
        problems.push("build-match: stitch.min.js differs from a fresh minification of the assembled bundle (run npm run build and commit)");
    }
    return problems;
}

// ---------------------------------------------------------------------------
// no-console, no-random-ids (library source), bundle-require (generated bundles)

const LIBRARY_DIR = "packages/";
// Built from pieces so this file does not match its own patterns.
const CONSOLE_WARN_ERROR = new RegExp("\\bconsole\\s*\\.\\s*(?:warn|error)\\b", "g");
const CONSOLE_ANY = new RegExp("\\bconsole\\s*\\.\\s*[A-Za-z]+\\s*\\(", "g");
const RANDOM = new RegExp("\\bMath\\s*\\.\\s*random\\b", "g");
const BARE_REQUIRE = new RegExp("(?<![\\w$.])require\\s*\\(", "g");

function libraryFiles(files) {
    return files.filter((rel) => rel.startsWith(LIBRARY_DIR) && rel.endsWith(".js"));
}

/** True when index is inside a // line comment or a block comment of text (heuristic, per line). */
function inComment(text, index) {
    const lineStart = text.lastIndexOf("\n", index - 1) + 1;
    const before = text.slice(lineStart, index);
    if (/^\s*(?:\*|\/\*)/.test(before) || before.indexOf("//") !== -1) return true;
    return false;
}

function findAll(root, rels, regex, describe, skip) {
    const problems = [];
    for (const rel of rels) {
        const text = readText(root, rel);
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (skip && skip(text, match.index)) continue;
            const snippet = text.slice(match.index, match.index + 50).split("\n")[0];
            problems.push(`${rel}:${lineOf(text, match.index)}: ${describe}: ${snippet}`);
        }
    }
    return problems;
}

function checkNoConsole(root, files) {
    const rels = libraryFiles(files);
    return findAll(root, rels, CONSOLE_WARN_ERROR, "console.warn/error in the library (throw, or route to Stitch.onError)")
        .concat(findAll(root, rels, CONSOLE_ANY, "console call in the library",
            (text, index) => inComment(text, index) || /^console\s*\.\s*(?:warn|error)\b/.test(text.slice(index))));
}

function checkNoRandomIds(root, files) {
    return findAll(root, libraryFiles(files), RANDOM, "Math.random in the library (use a counter)");
}

function checkBundleRequire(root, files) {
    const bundles = GENERATED_BUNDLES.filter((rel) => files.indexOf(rel) !== -1 || fs.existsSync(path.join(root, rel)));
    return findAll(root, bundles, BARE_REQUIRE, "require() in the bundle (inline the module instead)");
}

// ---------------------------------------------------------------------------

const CHECKS = {
    "version-literal": (root, files) => checkVersionLiterals(root, files),
    "stale-version": (root, files) => checkStaleVersions(root, files),
    "local-path": (root, files) => checkLocalPaths(root, files),
    "missing-reference": (root, files) => checkReferences(root, files),
    "build-match": (root) => checkBuildMatch(root),
    "no-console": (root, files) => checkNoConsole(root, files),
    "no-random-ids": (root, files) => checkNoRandomIds(root, files),
    "bundle-require": (root, files) => checkBundleRequire(root, files)
};

async function runChecks(options = {}) {
    const root = path.resolve(options.root || REPO_ROOT);
    const names = options.only && options.only.length ? options.only : Object.keys(CHECKS);
    const files = listFiles(root);
    const results = [];
    for (const name of names) {
        if (!CHECKS[name]) throw new Error(`unknown check "${name}"`);
        const problems = await CHECKS[name](root, files);
        results.push({ name, problems });
    }
    return { root, fileCount: files.length, results, ok: results.every((r) => r.problems.length === 0) };
}

function printResults(outcome, log = console.log) {
    for (const { name, problems } of outcome.results) {
        log(`[${problems.length ? "FAIL" : "PASS"}] ${name}${problems.length ? ` (${problems.length})` : ""}`);
        for (const problem of problems) log(`       ${problem}`);
    }
}

function parseArgs(argv) {
    const options = { only: [] };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--root") options.root = argv[++i];
        else if (argv[i] === "--only") options.only.push(...argv[++i].split(","));
        else throw new Error(`unknown argument "${argv[i]}"`);
    }
    return options;
}

module.exports = { runChecks, printResults, listFiles, CHECKS };

if (require.main === module) {
    runChecks(parseArgs(process.argv.slice(2))).then((outcome) => {
        printResults(outcome);
        process.exitCode = outcome.ok ? 0 : 1;
    }, (error) => {
        console.error(error && error.stack ? error.stack : error);
        process.exitCode = 1;
    });
}
