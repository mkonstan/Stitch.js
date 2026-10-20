"use strict";

/*
 * Static checks that keep the documentation true to the code (run by check-repo.js).
 *
 *   doc-snippets   Every html/js code block in a public markdown document carries a mode
 *                  (run, page, throws, fragment; see tests/doc-snippets.js), and every such
 *                  document is in DOC_SET, so test-doc-snippets.html executes it.
 *   api-coverage   Both ways: every public name (window.Stitch and what hangs off it, the
 *                  model helpers, the bindings and attributes Stitch reads, the row-context
 *                  names) has a heading in docs/API.md, and every heading names something
 *                  that exists. Code spans in the guides that name a Stitch API must name a
 *                  real one.
 *   error-coverage Both ways, by code: every error built in packages/ starts with a code
 *                  ("[Stitch E###] ..."); every code has one "### E###: title" entry in
 *                  docs/ERRORS.md (with a Cause and a Fix) whose Message line is that
 *                  error's message; every entry's code is thrown; a code is never used for
 *                  two different messages.
 *   doc-hygiene    Public documents state rules, not the project's private history: no
 *                  decision numbers (D12), no analysis/ paths, no triage numbers.
 *   skill          The Claude skill (skills/stitch/): names only attributes, APIs, $ helpers and
 *                  codes that exist; its grammar covers the public surface; its error table is
 *                  generated from docs/ERRORS.md; its recipe index gives real lines; every
 *                  gotcha row has a Wrong half and a Right half in tests/skill-proofs.md that
 *                  contain the row's code (see checkGotchaProofs).
 *
 * A message is read as its static parts, with "…" for every part filled in at run time (a
 * name, a value, a path). See canonicalMessages().
 *
 * What these checks do NOT verify: the signatures and prose under an API heading, and the Cause
 * and Fix prose of an error entry. Those are covered only where an executed snippet exercises them.
 */

const fs = require("fs");
const path = require("path");

const snippets = require("../tests/doc-snippets.js");

const HISTORY_DIR = "docs/history/";
const FIXTURE_DIR = "tests/gate-fixtures/";
const API_DOC = "docs/API.md";
const ERRORS_DOC = "docs/ERRORS.md";
// Documents whose code spans may only name Stitch APIs that exist.
const SPAN_CHECKED_DOCS = ["README.md", "AGENTS.md", "docs/GUIDE.md", "docs/API.md", "docs/ERRORS.md"];

function read(root, rel) {
    return fs.readFileSync(path.join(root, rel), "utf8");
}

function publicMarkdown(files) {
    return files.filter((rel) => rel.endsWith(".md") && !rel.startsWith(HISTORY_DIR) && !rel.startsWith(FIXTURE_DIR) &&
        !rel.startsWith("node_modules/") && !rel.startsWith("_scratch/"));
}

// ---------------------------------------------------------------------------
// doc-snippets

function checkDocSnippets(root, files) {
    const problems = [];
    const docs = publicMarkdown(files);
    for (const rel of docs) {
        const text = read(root, rel);
        const listed = snippets.DOC_SET.indexOf(rel) !== -1;
        if (!listed) {
            if (snippets.hasOurBlocks(text, rel)) {
                problems.push(`${rel}: has html/js code blocks but is not in DOC_SET (tests/doc-snippets.js), so they are never run. Add it to DOC_SET.`);
            }
            continue;
        }
        const parsed = snippets.parse(text, rel);
        problems.push(...parsed.problems);
    }
    for (const rel of snippets.DOC_SET) {
        if (files.indexOf(rel) === -1) problems.push(`DOC_SET lists ${rel}, which does not exist`);
    }
    return problems;
}

// ---------------------------------------------------------------------------
// api-coverage

function loadFresh(file) {
    file = path.resolve(file);
    delete require.cache[require.resolve(file)];
    return require(file);
}

function publicNames(obj, exclude = []) {
    return Object.getOwnPropertyNames(obj).filter((name) =>
        !name.startsWith("_") && exclude.indexOf(name) === -1);
}

/**
 * The public surface, read from the code: the built bundle (what a page gets as
 * window.Stitch) and the modules that define the bindings and the row context.
 * @returns {Set<string>} canonical names, e.g. "Stitch.Observable.create", "binder.bind",
 *   "model.$onChange", "data-text", "$index"
 */
function enumerateApi(root) {
    const names = new Set();
    const add = (name) => names.add(name);
    const Stitch = loadFresh(path.join(root, "stitch.js"));
    const CLASS_STATICS = ["length", "name", "prototype"];

    publicNames(Stitch).forEach((k) => add(`Stitch.${k}`));
    publicNames(Stitch.Observable, CLASS_STATICS).forEach((k) => add(`Stitch.Observable.${k}`));
    publicNames(Stitch.DataBinder, CLASS_STATICS).forEach((k) => add(`Stitch.DataBinder.${k}`));
    publicNames(Stitch.MessageBus, CLASS_STATICS).forEach((k) => add(`Stitch.MessageBus.${k}`));
    publicNames(Stitch.DataBinder.prototype, ["constructor"]).forEach((k) => add(`binder.${k}`));
    // Underscore names that are nonetheless the documented contract of custom bindings.
    for (const name of SUPPORTED_PRIVATE_BINDER) {
        if (typeof Stitch.DataBinder.prototype[name] === "function") add(`binder.${name}`);
    }
    publicNames(Stitch.MessageBus.prototype, ["constructor"]).forEach((k) => add(`bus.${k}`));
    publicNames(Stitch.debug).forEach((k) => add(`Stitch.debug.${k}`));

    // Model helpers: what Stitch defines (hidden) on a root model and a nested object.
    const model = Stitch.Observable.create({ nested: { x: 1 }, list: [] });
    const helperNames = (obj) => Object.getOwnPropertyNames(obj).filter((k) => {
        const d = Object.getOwnPropertyDescriptor(obj, k);
        return !d.enumerable && !k.startsWith("_");
    });
    helperNames(model).concat(helperNames(model.nested)).forEach((k) => add(`model.${k}`));

    // The ReactiveSystem a custom binding receives as context.reactiveSystem.
    const system = model._factory.reactiveSystem;
    publicNames(Object.getPrototypeOf(system), ["constructor"]).forEach((k) => add(`reactiveSystem.${k}`));

    // Bindings: the built-in handlers, data-<name>.
    const runtime = loadFresh(path.join(root, "packages/browser/src/binding-runtime.js"));
    Object.keys(runtime.createBindingRuntime({}).BINDING_HANDLERS).forEach((k) => add(`data-${k}`));
    // Other attributes Stitch reads (list configuration, input types).
    const scan = loadFresh(path.join(root, "packages/browser/src/binding-scan-helpers.js"));
    scan.INTERNAL_ATTRIBUTES.forEach(add);
    for (const rel of listPackageFiles(root)) {
        const text = read(root, rel);
        const re = /\b(?:getAttribute|hasAttribute)\(\s*["'](data-[a-z-]+)["']\s*\)/g;
        let m;
        while ((m = re.exec(text)) !== null) add(m[1]);
    }

    // Row context names.
    const rowContext = loadFresh(path.join(root, "packages/utils/src/foreach-row-context.js"));
    Object.getOwnPropertyNames(rowContext.createItemContext({}, 0, {})).forEach(add);
    return names;
}

// context.binder._trackCleanup(element, fn) is how a custom binding registers cleanup.
const SUPPORTED_PRIVATE_BINDER = ["_trackCleanup"];

function listPackageFiles(root) {
    const out = [];
    const walk = (rel) => {
        for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
            const child = `${rel}/${entry.name}`;
            if (entry.isDirectory()) walk(child);
            else if (entry.name.endsWith(".js")) out.push(child);
        }
    };
    walk("packages");
    return out.sort();
}

/** "`new Stitch.DataBinder(hooks)`" -> "Stitch.DataBinder"; "`data-text=\"path\"`" -> "data-text". */
function canonicalName(span) {
    const text = span.trim().replace(/^new\s+/, "");
    const m = /^[\w$.-]+/.exec(text);
    return m ? m[0].replace(/\.+$/, "") : null;
}

/** The names docs/API.md documents: the leading code span of each ### / #### heading. */
function documentedApi(text) {
    const out = [];
    const lines = text.split("\n");
    let inFence = false;
    lines.forEach((line, i) => {
        if (/^(`{3,}|~{3,})/.test(line)) inFence = !inFence;
        if (inFence) return;
        const m = /^#{3,4}\s+`([^`]+)`/.exec(line);
        if (m) out.push({ name: canonicalName(m[1]), line: i + 1, span: m[1] });
    });
    return out;
}

// Code spans that name a Stitch API (checked in SPAN_CHECKED_DOCS).
const API_SPAN = /^(?:new\s+)?(Stitch(?:\.[\w$]+)+|(?:context\.)?binder\.[\w$]+|bus\.[\w$]+|(?:context\.)?reactiveSystem\.[\w$]+|model\.\$[\w$]+)/;

function spanProblems(rel, text, known) {
    const problems = [];
    const prose = text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "));
    const re = /`([^`\n]+)`/g;
    let m;
    while ((m = re.exec(prose)) !== null) {
        const hit = API_SPAN.exec(m[1].trim());
        if (!hit) continue;
        let name = hit[1].replace(/^context\./, "");
        // The longest known prefix must be the whole dotted name: Stitch.debug.enable is not.
        if (!known.has(name)) {
            const line = prose.slice(0, m.index).split("\n").length;
            problems.push(`${rel}:${line}: \`${m[1]}\` names ${name}, which is not part of the API (see ${API_DOC})`);
        }
    }
    return problems;
}

function checkApiCoverage(root, files) {
    const problems = [];
    if (files.indexOf(API_DOC) === -1) return [`${API_DOC} does not exist`];
    let known;
    try {
        known = enumerateApi(root);
    } catch (error) {
        return [`api-coverage: could not read the public surface from the code: ${error.message}`];
    }
    const documented = documentedApi(read(root, API_DOC));
    const documentedNames = new Set(documented.map((d) => d.name));
    for (const name of Array.from(known).sort()) {
        if (!documentedNames.has(name)) problems.push(`${API_DOC}: ${name} exists in the code but has no heading (### \`${name}...\`)`);
    }
    for (const d of documented) {
        if (!known.has(d.name)) problems.push(`${API_DOC}:${d.line}: heading \`${d.span}\` names ${d.name}, which does not exist in the code`);
    }
    for (const rel of SPAN_CHECKED_DOCS) {
        if (files.indexOf(rel) === -1) continue;
        problems.push(...spanProblems(rel, read(root, rel), known));
    }
    return problems;
}

// ---------------------------------------------------------------------------
// error-coverage: reading error messages out of the source

/**
 * A small JavaScript tokenizer: strings, template literals (with their ${} parts),
 * regular expression literals, comments, identifiers and punctuation. Enough to find
 * `new Error(...)` and read its argument.
 */
function tokenize(src) {
    const tokens = [];
    let i = 0;
    const n = src.length;
    const prevSignificant = () => tokens.length ? tokens[tokens.length - 1] : null;
    const regexAllowed = () => {
        const p = prevSignificant();
        if (!p) return true;
        if (p.type === "ident") return /^(return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await|instanceof)$/.test(p.value);
        if (p.type === "num" || p.type === "str" || p.type === "tpl" || p.type === "regex") return false;
        return !/^[)\]}]$/.test(p.value);
    };
    while (i < n) {
        const c = src[i];
        if (c === "/" && src[i + 1] === "/") { const e = src.indexOf("\n", i); i = e === -1 ? n : e; continue; }
        if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); i = e === -1 ? n : e + 2; continue; }
        if (/\s/.test(c)) { i++; continue; }
        if (c === "'" || c === "\"") {
            let j = i + 1;
            let value = "";
            while (j < n && src[j] !== c) {
                if (src[j] === "\\") { value += unescapeChar(src[j + 1]); j += 2; continue; }
                value += src[j++];
            }
            tokens.push({ type: "str", value, start: i, end: j + 1 });
            i = j + 1;
            continue;
        }
        if (c === "`") {
            const parsed = readTemplate(src, i);
            tokens.push({ type: "tpl", parts: parsed.parts, start: i, end: parsed.end });
            i = parsed.end;
            continue;
        }
        if (c === "/" && regexAllowed()) {
            let j = i + 1;
            let inClass = false;
            while (j < n) {
                if (src[j] === "\\") { j += 2; continue; }
                if (src[j] === "[") inClass = true;
                else if (src[j] === "]") inClass = false;
                else if (src[j] === "/" && !inClass) break;
                j++;
            }
            j++;
            while (j < n && /[a-z]/i.test(src[j])) j++;
            tokens.push({ type: "regex", value: src.slice(i, j), start: i, end: j });
            i = j;
            continue;
        }
        if (/[A-Za-z_$]/.test(c)) {
            let j = i + 1;
            while (j < n && /[\w$]/.test(src[j])) j++;
            tokens.push({ type: "ident", value: src.slice(i, j), start: i, end: j });
            i = j;
            continue;
        }
        if (/[0-9]/.test(c)) {
            let j = i + 1;
            while (j < n && /[\w.]/.test(src[j])) j++;
            tokens.push({ type: "num", value: src.slice(i, j), start: i, end: j });
            i = j;
            continue;
        }
        tokens.push({ type: "punct", value: c, start: i, end: i + 1 });
        i++;
    }
    return tokens;
}

function unescapeChar(ch) {
    if (ch === "n" || ch === "t" || ch === "r") return " ";
    return ch === undefined ? "" : ch;
}

/** Reads a template literal starting at i: { parts: [string | {expr: string}], end }. */
function readTemplate(src, i) {
    const parts = [];
    let j = i + 1;
    let text = "";
    while (j < src.length && src[j] !== "`") {
        if (src[j] === "\\") { text += unescapeChar(src[j + 1]); j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") {
            parts.push(text);
            text = "";
            // Find the matching brace, skipping nested strings and templates.
            let depth = 1;
            let k = j + 2;
            while (k < src.length && depth > 0) {
                const ch = src[k];
                if (ch === "`") { k = readTemplate(src, k).end; continue; }
                if (ch === "'" || ch === "\"") {
                    let q = k + 1;
                    while (q < src.length && src[q] !== ch) q += src[q] === "\\" ? 2 : 1;
                    k = q + 1;
                    continue;
                }
                if (ch === "{") depth++;
                else if (ch === "}") depth--;
                k++;
            }
            parts.push({ expr: src.slice(j + 2, k - 1) });
            j = k;
            continue;
        }
        text += src[j++];
    }
    parts.push(text);
    return { parts, end: j + 1 };
}

const HOLE = "…";

/** The tokens of the argument list starting after `(` at index open: [[tokens of arg 0], ...]. */
function readArguments(tokens, open) {
    const args = [[]];
    let depth = 0;
    for (let k = open + 1; k < tokens.length; k++) {
        const t = tokens[k];
        if (t.type === "punct" && /[([{]/.test(t.value)) depth++;
        if (t.type === "punct" && /[)\]}]/.test(t.value)) {
            if (depth === 0) return { args, end: k };
            depth--;
        }
        if (depth === 0 && t.type === "punct" && t.value === ",") { args.push([]); continue; }
        args[args.length - 1].push(t);
    }
    return { args, end: tokens.length };
}

/**
 * The message pattern of an expression: string pieces joined, everything computed is a
 * hole. A bare identifier is inlined when the nearest declaration of that name in scope
 * is a `const NAME = <strings and templates>` (see scopedConsts).
 */
function patternOf(exprTokens, lookup) {
    lookup = lookup || (() => null);
    let out = "";
    let operandHasText = false;
    let depth = 0;
    for (let k = 0; k < exprTokens.length; k++) {
        const t = exprTokens[k];
        if (t.type === "punct" && /[([{]/.test(t.value)) { if (depth === 0 && !operandHasText) out += HOLE; depth++; continue; }
        if (t.type === "punct" && /[)\]}]/.test(t.value)) { depth--; continue; }
        if (depth > 0) continue;
        if (t.type === "punct" && t.value === "+") { operandHasText = false; continue; }
        if (t.type === "str") { out += t.value; operandHasText = true; continue; }
        if (t.type === "tpl") {
            for (const part of t.parts) {
                if (typeof part === "string") { out += part; continue; }
                const inlined = /^[A-Za-z_$][\w$]*$/.test(part.expr.trim()) ? lookup(part.expr.trim(), t.start) : null;
                out += inlined === null ? HOLE : inlined;
            }
            operandHasText = true;
            continue;
        }
        const next = exprTokens[k + 1];
        const inlined = t.type === "ident" && !operandHasText && !(next && next.type === "punct" && /[.([]/.test(next.value))
            ? lookup(t.value, t.start) : null;
        if (inlined !== null) { out += inlined; operandHasText = true; continue; }
        if (!operandHasText) { out += HOLE; operandHasText = true; }
    }
    return out;
}

/**
 * Every `const` / `let` / `var` declaration with the block it is visible in. Returns
 * lookup(name, position): the static text of the nearest declaration of name whose block
 * contains position, when that declaration is a const of strings and templates only;
 * otherwise null. (Function parameters are not seen; a message never names one that
 * shadows a static const.)
 */
function scopedConsts(tokens, sourceLength) {
    // Block ranges: the innermost { ... } around each token.
    const blockOf = new Array(tokens.length);
    const stack = [{ from: 0, to: sourceLength }];
    const open = [];
    for (let k = 0; k < tokens.length; k++) {
        const t = tokens[k];
        if (t.type === "punct" && t.value === "{") {
            const block = { from: t.start, to: sourceLength };
            open.push(block);
            stack.push(block);
        } else if (t.type === "punct" && t.value === "}") {
            const block = open.pop();
            if (block) block.to = t.end;
            stack.pop();
        }
        blockOf[k] = stack[stack.length - 1];
    }
    const decls = [];
    for (let k = 0; k < tokens.length - 2; k++) {
        if (!/^(const|let|var)$/.test(tokens[k].value) || tokens[k].type !== "ident" || tokens[k + 1].type !== "ident") continue;
        let value = null;
        if (tokens[k].value === "const" && tokens[k + 2].value === "=") {
            const expr = [];
            for (let e = k + 3; e < tokens.length && !(tokens[e].type === "punct" && tokens[e].value === ";"); e++) expr.push(tokens[e]);
            const isStatic = expr.length > 0 && expr.every((t) => t.type === "str" || t.type === "tpl" || (t.type === "punct" && t.value === "+"));
            if (isStatic) value = patternOf(expr);
        }
        decls.push({ name: tokens[k + 1].value, value, block: blockOf[k] });
    }
    return function lookup(name, position) {
        let best = null;
        for (const d of decls) {
            if (d.name !== name || position < d.block.from || position > d.block.to) continue;
            if (!best || (d.block.to - d.block.from) < (best.block.to - best.block.from)) best = d;
        }
        return best ? best.value : null;
    };
}

function normalizeMessage(text) {
    return text
        .replace(/\s+/g, " ")
        .replace(/…(?:\s*…)+/g, HOLE)
        .trim();
}

function hasText(pattern) {
    return /[A-Za-z]{4,}/.test(pattern.replace(/…/g, ""));
}

// Every Stitch error message starts with its stable code: "[Stitch E201] ...".
const CODE_PREFIX = /^\[Stitch (E\d{3})\] /;

// Functions that build an error from a code argument and a message argument (they add the
// "[Stitch E###] <where>: " prefix themselves): file -> { name: { code, message } (indexes) }.
// problem(code, text) makes a reason that a bindingError call relays: a call whose code
// argument is `<x>.code` relays a code made by one of these calls and is not read again.
const MESSAGE_WRAPPERS = {
    "packages/browser/src/binding-paths.js": { bindingError: { code: 0, message: 2 }, problem: { code: 0, message: 1 } },
    "packages/browser/src/binding-runtime.js": { bindingError: { code: 0, message: 4 } },
    "packages/api/src/reactive-factory.js": { helperError: { code: 0, message: 1 } }
};

function functionBody(tokens, name) {
    for (let k = 0; k < tokens.length - 2; k++) {
        if (tokens[k].type === "ident" && tokens[k].value === "function" && tokens[k + 1].value === name) {
            let b = k + 2;
            while (b < tokens.length && !(tokens[b].type === "punct" && tokens[b].value === "{")) b++;
            let depth = 0;
            for (let e = b; e < tokens.length; e++) {
                if (tokens[e].type === "punct" && tokens[e].value === "{") depth++;
                if (tokens[e].type === "punct" && tokens[e].value === "}") { depth--; if (depth === 0) return { start: b, end: e }; }
            }
        }
    }
    return null;
}

function isRelay(arg) {
    return arg.length === 3 && arg[0].type === "ident" && arg[1].value === "." && arg[2].value === "code";
}

/**
 * Every error constructed in packages/: [{ code, message, where }], message without its
 * "[Stitch E###] " prefix. Problems: an error without a code, a code argument that is not a
 * literal code, and a message whose static text cannot be read (so a new way of building
 * errors cannot slip past the check).
 */
function canonicalMessages(root) {
    const found = [];
    const problems = [];
    for (const rel of listPackageFiles(root)) {
        const src = read(root, rel);
        const tokens = tokenize(src);
        const consts = scopedConsts(tokens, src.length);
        const lineAt = (pos) => src.slice(0, pos).split("\n").length;
        const wrappers = MESSAGE_WRAPPERS[rel] || {};
        const wrapperBodies = Object.keys(wrappers).map((name) => functionBody(tokens, name)).filter(Boolean);
        const inWrapper = (k) => wrapperBodies.some((b) => k > b.start && k < b.end);
        for (let k = 0; k < tokens.length - 2; k++) {
            const t = tokens[k];
            let wrapper = null;
            let open = -1;
            if (t.type === "ident" && t.value === "new" && /^(?:Type|Range|Syntax)?Error$/.test(tokens[k + 1].value) &&
                tokens[k + 2].value === "(") {
                if (inWrapper(k)) continue; // the wrapper's own `new Error(prefix + message)`
                open = k + 2;
            } else if (t.type === "ident" && Object.prototype.hasOwnProperty.call(wrappers, t.value) && tokens[k + 1].value === "(" &&
                !(tokens[k - 1] && tokens[k - 1].value === "function")) {
                open = k + 1;
                wrapper = wrappers[t.value];
            } else {
                continue;
            }
            const { args } = readArguments(tokens, open);
            const where = `${rel}:${lineAt(t.start)}`;
            let code = null;
            let message;
            if (wrapper) {
                const codeArg = args[wrapper.code] || [];
                if (isRelay(codeArg)) continue;
                if (codeArg.length === 1 && codeArg[0].type === "str" && /^E\d{3}$/.test(codeArg[0].value)) {
                    code = codeArg[0].value;
                } else {
                    problems.push(`${where}: the code argument of ${t.value}() must be a literal code such as "E201"`);
                    continue;
                }
                message = normalizeMessage(patternOf(args[wrapper.message] || [], consts));
            } else {
                const full = normalizeMessage(patternOf(args[0] || [], consts));
                const m = CODE_PREFIX.exec(full);
                if (m) {
                    code = m[1];
                    message = full.slice(m[0].length);
                } else {
                    message = full;
                }
            }
            if (!hasText(message)) {
                problems.push(`${where}: cannot read the message of this error (it has no static text: ${JSON.stringify(message)}). ` +
                    "Write the message where the error is made, or teach _tools/doc-checks.js (MESSAGE_WRAPPERS) where it comes from.");
                continue;
            }
            if (!code) {
                problems.push(`${where}: this error has no code: start its message with "[Stitch E###] " (a new code, documented in ${ERRORS_DOC}): ${message}`);
                continue;
            }
            found.push({ code, message, where });
        }
    }
    return { found, problems };
}

/** docs/ERRORS.md: one section per code ("### E201: title"), its Message, Cause and Fix lines. */
function documentedErrors(text) {
    const sections = [];
    let current = null;
    const lines = text.split("\n");
    let inFence = false;
    lines.forEach((line, i) => {
        if (/^(`{3,}|~{3,})/.test(line)) inFence = !inFence;
        if (inFence) return;
        if (/^#{2,3}\s/.test(line)) {
            const code = /^###\s+(E\d{3})\b/.exec(line);
            current = { title: line.replace(/^#+\s*/, ""), line: i + 1, code: code ? code[1] : null, messages: [], cause: false, fix: false };
            sections.push(current);
            return;
        }
        if (!current) return;
        const m = /^(?:[-*]\s+)?\*\*Message:?\*\*:?\s+`([^`]+)`/.exec(line);
        if (m) current.messages.push({ message: normalizeMessage(m[1]), line: i + 1 });
        if (/^\*\*Cause:?\*\*/.test(line)) current.cause = true;
        if (/^\*\*Fix:?\*\*/.test(line)) current.fix = true;
    });
    return sections;
}

/**
 * Both ways, by code: every code thrown in packages/ has one entry in docs/ERRORS.md, every
 * entry's code is thrown, a code means one thing (its sites build the same message), and the
 * entry's Message line is that message.
 */
function checkErrorCoverage(root, files) {
    if (files.indexOf(ERRORS_DOC) === -1) return [`${ERRORS_DOC} does not exist`];
    const { found, problems } = canonicalMessages(root);
    const byCode = new Map();
    for (const f of found) {
        if (!byCode.has(f.code)) byCode.set(f.code, []);
        byCode.get(f.code).push(f);
    }
    for (const [code, sites] of byCode) {
        const messages = Array.from(new Set(sites.map((s) => s.message)));
        if (messages.length > 1) {
            problems.push(`${code} is used for different messages (a code means one thing; give each its own code): ` +
                sites.map((s) => `${s.where} "${s.message.slice(0, 60)}"`).join("; "));
        }
    }
    const sections = documentedErrors(read(root, ERRORS_DOC));
    const documented = new Map();
    for (const section of sections) {
        if (!section.code) {
            if (section.messages.length) problems.push(`${ERRORS_DOC}:${section.line}: "${section.title}" lists a message but its heading has no code (### E###: title)`);
            continue;
        }
        if (documented.has(section.code)) problems.push(`${ERRORS_DOC}:${section.line}: ${section.code} has two entries`);
        documented.set(section.code, section);
        if (!section.cause || !section.fix) {
            problems.push(`${ERRORS_DOC}:${section.line}: "${section.title}" needs a **Cause:** line and a **Fix:** line`);
        }
    }
    for (const [code, sites] of byCode) {
        const section = documented.get(code);
        if (!section) {
            problems.push(`${code} is thrown at ${sites[0].where} but has no entry in ${ERRORS_DOC} (add "### ${code}: <title>" with **Message:** \`${sites[0].message}\`, **Cause:** and **Fix:**)`);
            continue;
        }
        if (section.messages.length !== 1 || section.messages[0].message !== sites[0].message) {
            problems.push(`${ERRORS_DOC}:${section.line}: the entry for ${code} must have one **Message:** line, \`${sites[0].message}\``);
        }
    }
    for (const [code, section] of documented) {
        if (!byCode.has(code)) problems.push(`${ERRORS_DOC}:${section.line}: ${code} has an entry but no error in packages/ throws it`);
    }
    return problems;
}


// ---------------------------------------------------------------------------
// doc-hygiene

const PRIVATE_REFERENCES = [
    { regex: /\bD[1-9][0-9]?\b/g, what: "a decision number (state the rule itself)" },
    { regex: /\banalysis\//g, what: "a path into the private analysis folder" },
    { regex: /\btriage #\d+/gi, what: "a triage number (state the rule itself)" }
];

function checkDocHygiene(root, files) {
    const problems = [];
    for (const rel of publicMarkdown(files)) {
        const text = read(root, rel);
        for (const { regex, what } of PRIVATE_REFERENCES) {
            regex.lastIndex = 0;
            let m;
            while ((m = regex.exec(text)) !== null) {
                problems.push(`${rel}:${text.slice(0, m.index).split("\n").length}: "${m[0]}" is ${what}`);
            }
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------
// skill: the Claude skill in skills/stitch/ names only what exists, and stays in step with the
// library: its error table is generated from docs/ERRORS.md, its grammar covers the whole public
// surface, and every error code a gotcha promises is proven by tests/skill-proofs.md.

const SKILL_DIR = "skills/stitch/";
const SKILL_FILE = `${SKILL_DIR}SKILL.md`;
const SKILL_GOTCHAS = `${SKILL_DIR}references/gotchas.md`;
const SKILL_GRAMMAR = `${SKILL_DIR}references/grammar.md`;
const SKILL_PROOFS = "tests/skill-proofs.md";
const SKILL_MAX_LINES = 200;
const SKILL_MAX_DESCRIPTION = 1024;
// The description must name these triggers, or the skill is not loaded when it should be.
const SKILL_TRIGGERS = ["Stitch.js", "data-text", "data-value", "data-foreach", "data-click", "Stitch.Observable.create", "[Stitch E"];
// Names the skill cites as NOT Stitch's (habits from other libraries, removed v2 APIs, other
// libraries' attributes). Each must really be absent: if one becomes real, the skill is wrong.
const SKILL_NOT_STITCH = ["data-if", "data-show", "data-html", "data-bind", "data-model", "data-for", "Stitch.debug.enable"];

function skillFiles(files) {
    return files.filter((rel) => rel.startsWith(SKILL_DIR) && rel.endsWith(".md")).sort();
}

function lineAt(text, index) {
    return text.slice(0, index).split("\n").length;
}

/** The Stitch names a skill text mentions, by kind, with line numbers. */
function skillMentions(text) {
    const found = [];
    const scan = (regex, kind, pick) => {
        regex.lastIndex = 0;
        let m;
        while ((m = regex.exec(text)) !== null) found.push({ kind, name: pick(m), line: lineAt(text, m.index) });
    };
    scan(/(?<![\w-])data-[a-z][a-z0-9-]*(?![\w-])/g, "attribute", (m) => m[0]);
    scan(/\bE\d{3}\b/g, "code", (m) => m[0]);
    scan(/\bStitch((?:\.[A-Za-z_$][\w$]*)+)/g, "api", (m) => "Stitch" + m[1]);
    scan(/\b(binder|bus|reactiveSystem)\.([A-Za-z_$][\w$]*)/g, "api", (m) => `${m[1]}.${m[2]}`);
    scan(/(?<![\w$])\$([A-Za-z_][\w$]*)/g, "dollar", (m) => "$" + m[1]);
    return found;
}

function checkSkill(root, files) {
    const problems = [];
    const skill = skillFiles(files);
    if (files.indexOf(SKILL_FILE) === -1) return [`${SKILL_FILE} does not exist`];
    let known;
    try {
        known = enumerateApi(root);
    } catch (error) {
        return [`skill: could not read the public surface from the code: ${error.message}`];
    }
    const codes = new Set(canonicalMessages(root).found.map((f) => f.code));

    // 1. SKILL.md: frontmatter, triggers, size, routing to every reference file.
    const main = read(root, SKILL_FILE).replace(/\r\n/g, "\n");
    const front = /^---\n([\s\S]*?)\n---\n/.exec(main);
    if (!front) {
        problems.push(`${SKILL_FILE}: must start with YAML frontmatter (--- name / description ---)`);
    } else {
        const fields = {};
        for (const line of front[1].split("\n")) {
            const m = /^([a-z-]+):\s?(.*)$/.exec(line);
            if (m) fields[m[1]] = m[2];
        }
        if (fields.name !== "stitch") problems.push(`${SKILL_FILE}: frontmatter name must be "stitch" (the folder name), got ${JSON.stringify(fields.name)}`);
        const description = fields.description || "";
        if (!description) problems.push(`${SKILL_FILE}: frontmatter needs a one-line description`);
        if (description.length > SKILL_MAX_DESCRIPTION) problems.push(`${SKILL_FILE}: the description has ${description.length} characters (at most ${SKILL_MAX_DESCRIPTION})`);
        if (/: |\s#|^[\s"'[{>|*&!%@`-]/.test(description)) problems.push(`${SKILL_FILE}: the description must be a plain YAML scalar (no ": ", no " #", no leading quote or bracket)`);
        for (const trigger of SKILL_TRIGGERS) {
            if (description.indexOf(trigger) === -1) problems.push(`${SKILL_FILE}: the description does not name the trigger ${JSON.stringify(trigger)}`);
        }
    }
    const lineCount = main.replace(/\n$/, "").split("\n").length;
    if (lineCount > SKILL_MAX_LINES) problems.push(`${SKILL_FILE}: ${lineCount} lines; the core must stay at most ${SKILL_MAX_LINES} (move depth to references/)`);
    for (const rel of skill) {
        if (!rel.startsWith(`${SKILL_DIR}references/`)) continue;
        const local = rel.slice(SKILL_DIR.length);
        if (main.indexOf(local) === -1) problems.push(`${SKILL_FILE}: does not route to ${local} (a reference file nothing points to is never read)`);
    }

    // 1b. The recipe index gives each recipe's line, so a model reads only that recipe.
    const recipesFile = `${SKILL_DIR}references/recipes.md`;
    if (files.indexOf(recipesFile) !== -1) {
        const lines = read(root, recipesFile).replace(/\r\n/g, "\n").split("\n");
        const headings = new Map();
        lines.forEach((line, i) => {
            const m = /^## (\d+)\. /.exec(line);
            if (m) headings.set(m[1], i + 1);
        });
        const indexed = new Set();
        lines.forEach((line, i) => {
            const m = /^\|.*\|\s*\[(\d+)\]\(#[^)]*\)\s*\|\s*(\d+)\s*\|\s*$/.exec(line);
            if (!m) return;
            indexed.add(m[1]);
            if (headings.get(m[1]) !== Number(m[2])) {
                problems.push(`${recipesFile}:${i + 1}: the index says recipe ${m[1]} starts at line ${m[2]}; it starts at line ${headings.get(m[1]) || "(no such recipe)"}`);
            }
        });
        for (const n of headings.keys()) {
            if (!indexed.has(n)) problems.push(`${recipesFile}:${headings.get(n)}: recipe ${n} has no row (with its line) in the index`);
        }
    }

    // 2. Every name the skill mentions exists; names it calls absent are absent.
    const notStitch = new Set(SKILL_NOT_STITCH);
    for (const name of notStitch) {
        if (known.has(name)) problems.push(`skill: ${name} is listed as not part of Stitch (SKILL_NOT_STITCH) but exists in the code; fix the skill`);
    }
    const registered = new Set();
    const texts = skill.map((rel) => ({ rel, text: read(root, rel).replace(/\r\n/g, "\n") }));
    for (const { text } of texts) {
        const re = /registerBinding\(\s*['"]([a-z0-9-]+)['"]/g;
        let m;
        while ((m = re.exec(text)) !== null) registered.add(`data-${m[1]}`);
    }
    for (const { rel, text } of texts) {
        for (const mention of skillMentions(text)) {
            const where = `${rel}:${mention.line}`;
            if (mention.kind === "code") {
                if (!codes.has(mention.name)) problems.push(`${where}: ${mention.name} is not an error code the library throws`);
            } else if (mention.kind === "attribute") {
                if (!known.has(mention.name) && !registered.has(mention.name) && !notStitch.has(mention.name)) {
                    problems.push(`${where}: ${mention.name} is not a Stitch attribute (nor a custom binding the skill registers, nor in SKILL_NOT_STITCH)`);
                }
            } else if (mention.kind === "api") {
                if (mention.name === "Stitch.js" || notStitch.has(mention.name)) continue;
                if (!known.has(mention.name)) problems.push(`${where}: ${mention.name} is not part of the API`);
            } else if (mention.kind === "dollar") {
                if (!known.has(mention.name) && !known.has(`model.${mention.name}`)) {
                    problems.push(`${where}: ${mention.name} is neither a model helper nor a row-context name`);
                }
            }
        }
    }

    // 3. The grammar names the whole public surface.
    if (files.indexOf(SKILL_GRAMMAR) === -1) {
        problems.push(`${SKILL_GRAMMAR} does not exist`);
    } else {
        const grammar = read(root, SKILL_GRAMMAR);
        for (const name of Array.from(known).sort()) {
            if (grammar.indexOf("`" + name) === -1) problems.push(`${SKILL_GRAMMAR}: ${name} exists in the code but the grammar does not name it`);
        }
    }

    // 4. The error table is generated from docs/ERRORS.md.
    const skillErrors = require("./skill-errors.js");
    if (files.indexOf(skillErrors.TARGET) === -1) {
        problems.push(`${skillErrors.TARGET} does not exist (npm run build:skill)`);
    } else if (files.indexOf(ERRORS_DOC) !== -1) {
        let expected = null;
        try {
            expected = skillErrors.generate(root);
        } catch (error) {
            problems.push(`${skillErrors.TARGET}: cannot generate it: ${error.message}`);
        }
        if (expected !== null && read(root, skillErrors.TARGET).replace(/\r\n/g, "\n") !== expected) {
            problems.push(`${skillErrors.TARGET} differs from what ${ERRORS_DOC} generates; run npm run build:skill`);
        }
    }

    // 5. Every gotcha's advice is executed: tests/skill-proofs.md has a WRONG half (the
    //    "About to write" code, failing as the row says) and a RIGHT half (the "Write
    //    instead" code, working) for every row, except the rows listed in
    //    SKILL_GUIDANCE_ONLY. See checkGotchaProofs.
    if (files.indexOf(SKILL_GOTCHAS) !== -1) {
        const proofsText = files.indexOf(SKILL_PROOFS) !== -1 ? read(root, SKILL_PROOFS) : "";
        problems.push(...checkGotchaProofs(read(root, SKILL_GOTCHAS), proofsText));
    }
    return problems;
}

// Gotcha rows whose advice cannot be executed in the test page (it needs a server header, or
// an engine without a date control). They are marked "Guidance only:" in tests/skill-proofs.md;
// this list is the count, so a new unexecuted row cannot slip in.
const SKILL_GUIDANCE_ONLY = ["G87", "G125"];

/** The code spans of a table cell, with escaped pipes restored. */
function cellSpans(cell) {
    const out = [];
    const re = /`([^`]+)`/g;
    let m;
    while ((m = re.exec(cell)) !== null) out.push(m[1].replace(/\\\|/g, "|"));
    return out;
}

const squash = (text) => text.replace(/\s+/g, " ").trim();

/** Code without its comments: <!-- ... -->, /* ... *\/ and // to the end of the line (not in "://"). */
function stripComments(code) {
    return code
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:\\'"])\/\/[^\n]*/g, "$1");
}

// A check must compare something or call a helper: `true` or `1` alone tests nothing.
const MEANINGFUL_CHECK = /[=!<>]=|[<>]|[A-Za-z_$][\w$]*\s*\(/;

/**
 * Both halves of every gotcha, structurally (test-skill-proofs.html then runs them):
 *   - a "## G#" section per row, with a "Wrong:" half and a "Right:" half (or, for a row in
 *     SKILL_GUIDANCE_ONLY only, a "Guidance only: <why>" line and no code);
 *   - every code span of the row's "About to write" cell occurs in the Wrong half's code, and
 *     every code span of its "Write instead" cell in the Right half's code, so the advice text
 *     is the code that is executed (inverting or editing a cell breaks the link);
 *   - the Wrong half asserts every error code the row names (a Throws: line with
 *     `[Stitch E###]`); a row without a code shows its misbehaviour (a throws block, or checks);
 *   - the Right half is run blocks only (it must not throw), with at least one check.
 * What it cannot see: the "Because" text, and the bind / row / later column.
 */
function checkGotchaProofs(gotchasText, proofsText) {
    const problems = [];
    const gotchas = gotchasText.replace(/\r\n/g, "\n");
    const proofsLines = proofsText.replace(/\r\n/g, "\n").split("\n");
    const parsed = snippets.parse(proofsText, SKILL_PROOFS);
    // Sections: id -> { start, end, lines: [{ kind, line }] }
    const sections = new Map();
    let current = null;
    proofsLines.forEach((line, i) => {
        const head = /^## (G\d+)\s*$/.exec(line);
        if (head) {
            current = { id: head[1], start: i + 1, end: proofsLines.length, markers: [], guidance: null };
            if (sections.has(head[1])) problems.push(`${SKILL_PROOFS}:${i + 1}: "## ${head[1]}" appears twice`);
            sections.set(head[1], current);
            return;
        }
        if (/^## /.test(line) && current) { current.end = i; current = null; return; }
        if (!current) return;
        if (/^Wrong:\s*$/.test(line)) current.markers.push({ half: "wrong", line: i + 1 });
        else if (/^Right:\s*$/.test(line)) current.markers.push({ half: "right", line: i + 1 });
        else if (/^Guidance only:/.test(line)) current.guidance = line.replace(/^Guidance only:\s*/, "");
    });
    let previous = null;
    for (const section of sections.values()) {
        if (previous && previous.end > section.start) previous.end = section.start - 1;
        previous = section;
    }
    const halfOf = (section, line) => {
        let half = null;
        for (const marker of section.markers) if (marker.line < line) half = marker.half;
        return half;
    };
    const ids = new Set();
    let guidanceRows = 0;
    gotchas.split("\n").forEach((line, i) => {
        const m = /^\|\s*(G\d+)\s*\|/.exec(line);
        if (!m) return;
        const id = m[1];
        const where = `${SKILL_GOTCHAS}:${i + 1}`;
        if (ids.has(id)) problems.push(`${where}: ${id} is used twice`);
        ids.add(id);
        const cells = line.replace(/\\\|/g, "\u0000").split("|").map((c) => c.replace(/\u0000/g, "\\|"));
        // | ID | About to write | Write instead | Because | Error |
        const wrongSpans = cellSpans(cells[2] || "");
        const rightSpans = cellSpans(cells[3] || "");
        const promised = (cells[5] || "").match(/\bE\d{3}\b/g) || [];
        const section = sections.get(id);
        if (!section) {
            problems.push(`${where}: ${id} has no "## ${id}" section in ${SKILL_PROOFS} (a Wrong: half and a Right: half)`);
            return;
        }
        if (section.guidance !== null) {
            guidanceRows++;
            if (SKILL_GUIDANCE_ONLY.indexOf(id) === -1) problems.push(`${SKILL_PROOFS}:${section.start}: ${id} is marked "Guidance only" but is not in SKILL_GUIDANCE_ONLY (_tools/doc-checks.js); prove it instead`);
            if (!section.guidance.trim()) problems.push(`${SKILL_PROOFS}:${section.start}: ${id}: "Guidance only:" needs the reason it cannot run`);
            if (promised.length) problems.push(`${where}: ${id} names ${promised.join(", ")}, so it cannot be guidance only`);
            return;
        }
        if (SKILL_GUIDANCE_ONLY.indexOf(id) !== -1) problems.push(`${SKILL_PROOFS}:${section.start}: ${id} is in SKILL_GUIDANCE_ONLY but its section has no "Guidance only:" line`);
        const own = parsed.snippets.filter((sn) => sn.line > section.start && sn.line <= section.end);
        const halves = { wrong: [], right: [] };
        for (const sn of own) {
            const half = halfOf(section, sn.line);
            if (!half) problems.push(`${SKILL_PROOFS}:${sn.line}: a ${id} block before any "Wrong:" / "Right:" line`);
            else halves[half].push(sn);
        }
        // Comments do not count: advice hidden in a comment is not executed.
        const codeOf = (list) => squash(stripComments(list.map((sn) => (sn.page || "") + "\n" + sn.code).join("\n")));
        if (!halves.wrong.length) problems.push(`${SKILL_PROOFS}:${section.start}: ${id} has no Wrong half (the "About to write" code, failing)`);
        if (!halves.right.length) problems.push(`${SKILL_PROOFS}:${section.start}: ${id} has no Right half (the "Write instead" code, working)`);
        if (halves.wrong.length) {
            const wrongCode = codeOf(halves.wrong);
            for (const span of wrongSpans) {
                if (wrongCode.indexOf(squash(span)) === -1) problems.push(`${SKILL_PROOFS}:${section.start}: ${id}: the Wrong half does not contain \`${span}\` (from "About to write")`);
            }
            for (const code of promised) {
                if (!halves.wrong.some((sn) => sn.mode === "throws" && sn.expect && sn.expect.indexOf(`[Stitch ${code}]`) !== -1)) {
                    problems.push(`${SKILL_PROOFS}:${section.start}: ${id}: the Wrong half does not assert ${code} (a throws block with "Throws: \`[Stitch ${code}]\`")`);
                }
            }
            if (!promised.length && !halves.wrong.some((sn) => sn.mode === "throws" || sn.checks.length)) {
                problems.push(`${SKILL_PROOFS}:${section.start}: ${id}: the Wrong half shows nothing (add checks for the misbehaviour, or a throws block)`);
            }
        }
        if (halves.right.length) {
            const rightCode = codeOf(halves.right);
            for (const span of rightSpans) {
                if (rightCode.indexOf(squash(span)) === -1) problems.push(`${SKILL_PROOFS}:${section.start}: ${id}: the Right half does not contain \`${span}\` (from "Write instead")`);
            }
            if (halves.right.some((sn) => sn.mode !== "run")) problems.push(`${SKILL_PROOFS}:${section.start}: ${id}: the Right half must only run (no throws blocks)`);
            if (!halves.right.some((sn) => sn.checks.length)) problems.push(`${SKILL_PROOFS}:${section.start}: ${id}: the Right half has no check showing that it works`);
            if (!halves.right.some((sn) => sn.checks.some((check) => MEANINGFUL_CHECK.test(check)))) {
                problems.push(`${SKILL_PROOFS}:${section.start}: ${id}: no Right half check tests anything (one must compare a value or call a helper)`);
            }
            // The fix must be told apart: at least one "Write instead" span (that the "About to
            // write" cell does not also name) must be absent from the Wrong half. A fix cell
            // reduced to a fragment both halves share (such as \`this.items\`) fails.
            const ownRight = rightSpans.filter((span) => wrongSpans.indexOf(span) === -1);
            if (halves.wrong.length && ownRight.length) {
                const wrongCode = codeOf(halves.wrong);
                if (ownRight.every((span) => wrongCode.indexOf(squash(span)) !== -1)) {
                    problems.push(`${SKILL_PROOFS}:${section.start}: ${id}: every "Write instead" span is in the Wrong half too, so none shows the fix`);
                }
            }
        }
    });
    for (const id of sections.keys()) {
        if (!ids.has(id)) problems.push(`${SKILL_PROOFS}: "## ${id}" proves a gotcha that ${SKILL_GOTCHAS} does not have`);
    }
    if (guidanceRows !== SKILL_GUIDANCE_ONLY.length) {
        problems.push(`${SKILL_PROOFS}: ${guidanceRows} rows are guidance only, SKILL_GUIDANCE_ONLY lists ${SKILL_GUIDANCE_ONLY.length}`);
    }
    return problems;
}

module.exports = {
    tokenize,
    checkDocSnippets,
    checkApiCoverage,
    checkErrorCoverage,
    checkDocHygiene,
    checkSkill,
    checkGotchaProofs,
    SKILL_GUIDANCE_ONLY,
    enumerateApi,
    canonicalMessages,
    documentedApi,
    internals: { tokenize, scopedConsts, patternOf }
};
