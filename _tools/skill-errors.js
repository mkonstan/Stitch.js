"use strict";

/*
 * Generates skills/stitch/references/errors.md (the skill's error table) from docs/ERRORS.md:
 * one row per code, with the entry's title as the cause and its Fix paragraph as the fix.
 * The `skill` static check (_tools/doc-checks.js) regenerates it in memory and fails when the
 * committed file differs, so the two cannot drift.
 *
 * Usage: node _tools/skill-errors.js   (npm run build:skill; part of npm run build)
 */

const fs = require("fs");
const path = require("path");

const SOURCE = "docs/ERRORS.md";
const TARGET = "skills/stitch/references/errors.md";

const HEADER = [
    "# Stitch.js v3 error codes",
    "",
    "Generated from the library's error reference; do not edit by hand. Every Stitch error message",
    "starts with its code, then the element and binding: `[Stitch E201] <span data-text=\"nmae\">: ...`.",
    "Find the code below, apply the fix, and read the rest of the message for the names involved.",
    "",
    "- Errors found by a call you make (`bind()`, `Observable.create()`, `$on()`, ...) are thrown to",
    "  your code; a `bind()` that throws leaves nothing bound.",
    "- Errors found later, inside an update (a list re-render, a computed, a handler, a change",
    "  handler), go to `Stitch.onError(fn)`; with none installed they are uncaught. The page keeps its",
    "  last good state.",
    "- Match errors by code (`error.message.startsWith('[Stitch E201]')`), never by wording.",
    ""
];

function cell(text) {
    return text.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
}

/** The markdown of the skill's error table for the text of docs/ERRORS.md. */
function render(errorsText) {
    const lines = String(errorsText).replace(/\r\n/g, "\n").split("\n");
    const out = HEADER.slice();
    let inFence = false;
    let area = null;
    let entry = null;
    const entries = [];
    const finish = () => { if (entry) entries.push(entry); entry = null; };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^(`{3,}|~{3,})/.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        const areaHead = /^##\s+(E\dxx:.*)$/.exec(line);
        if (areaHead) { finish(); area = areaHead[1].trim(); continue; }
        if (/^##\s/.test(line)) { finish(); area = null; continue; }
        const codeHead = /^###\s+(E\d{3}):\s*(.*)$/.exec(line);
        if (codeHead) {
            finish();
            entry = { area, code: codeHead[1], title: codeHead[2].trim(), fix: null };
            continue;
        }
        if (entry && /^\*\*Fix:\*\*/.test(line)) {
            const paragraph = [line.replace(/^\*\*Fix:\*\*\s*/, "")];
            while (i + 1 < lines.length && lines[i + 1].trim() !== "" && !/^(#|\*\*|```)/.test(lines[i + 1])) {
                paragraph.push(lines[++i]);
            }
            entry.fix = paragraph.join(" ");
        }
    }
    finish();
    let current;
    for (const e of entries) {
        if (!e.area) throw new Error(`${SOURCE}: ${e.code} is not under an "## E#xx: ..." area heading`);
        if (!e.fix) throw new Error(`${SOURCE}: ${e.code} has no **Fix:** line`);
        if (e.area !== current) {
            current = e.area;
            out.push(`## ${current}`, "", "| Code | Cause | Fix |", "|---|---|---|");
        }
        out.push(`| ${e.code} | ${cell(e.title)} | ${cell(e.fix)} |`);
        const next = entries[entries.indexOf(e) + 1];
        if (!next || next.area !== current) out.push("");
    }
    return out.join("\n");
}

function generate(root) {
    return render(fs.readFileSync(path.join(root, SOURCE), "utf8"));
}

module.exports = { render, generate, SOURCE, TARGET };

if (require.main === module) {
    const root = path.resolve(__dirname, "..");
    const target = path.join(root, TARGET);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, generate(root));
    console.log(`wrote ${TARGET}`);
}
