"use strict";

/**
 * THE key rule for list rows. Every foreach path (inline template, data-template,
 * <select> options, lists that come and go) resolves row keys here and nowhere else.
 *
 * - A row that is an object: its key is row[keyField]. keyField is the list's data-key
 *   attribute, or "id" when the list has none.
 * - A row that is a plain value (string, number, boolean, ...): the value is its own key.
 * - No fallback to the row index and none to row.key: a missing key throws.
 * - Two rows with the same key throw.
 *
 * Keys are compared as JavaScript values (Map semantics): 1 and "1" are different keys.
 */

// Field names worth suggesting when a row lacks its key field.
const LIKELY_KEY_FIELD = /^(key|uuid|guid|code|sku|ticker|slug|symbol)$|[a-z0-9](Id|ID|Key|Code)$|_(id|key|code)$/;

function describeList(list) {
    const tag = list.tagName ? list.tagName.toLowerCase() : "element";
    const keyAttr = list.keyField ? ` data-key="${list.keyField}"` : "";
    return `<${tag} data-foreach="${list.name}"${keyAttr}>`;
}

function formatKey(value) {
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "symbol") return value.toString();
    return String(value);
}

function suggestKeyField(row, missingField) {
    let names;
    try {
        names = Object.keys(row);
    } catch (error) {
        return null;
    }
    for (const name of names) {
        if (name === missingField || !LIKELY_KEY_FIELD.test(name)) continue;
        const value = row[name];
        if (value !== undefined && value !== null && typeof value !== "object" && typeof value !== "function") {
            return name;
        }
    }
    return null;
}

function missingKeyError(version, list, index, field, row) {
    const where = describeList(list);
    const which = list.keyField ? "the key field set by data-key" : "the default key field";
    const suggestion = list.keyField ? null : suggestKeyField(row, field);
    let fix;
    if (suggestion) {
        fix = `This row has "${suggestion}": if that identifies a row, add data-key="${suggestion}" to ${where}.`;
    } else if (list.keyField) {
        fix = `Give every row a "${field}", or set data-key to a field that every row has.`;
    } else {
        fix = `Give every row an "id", or name the key field with data-key, e.g. <${(list.tagName || "ul").toLowerCase()} data-foreach="${list.name}" data-key="sku">.`;
    }
    return new Error(
        `[Stitch E501] ${where}: row ${index} has no "${field}" (${which}). ` +
        `Every row of a list needs a unique key. ${fix}`
    );
}

/**
 * Resolves the key of every row, in order. Throws (and changes nothing) if any row has
 * no key or two rows share one.
 *
 * @param {Array} items - the list's rows
 * @param {{name: string, keyField: (string|null), tagName: string}} list
 *        name = the data-foreach path; keyField = the data-key value (null = "id");
 *        tagName = the list element's tag, for the message
 * @param {string} version - for the error prefix
 * @returns {Array} keys, one per row
 */
function resolveRowKeys(items, list, version) {
    const keys = new Array(items.length);
    const seen = new Map();
    const field = list.keyField || "id";

    for (let index = 0; index < items.length; index++) {
        const row = items[index];
        let key;
        if (row !== null && typeof row === "object") {
            key = row[field];
            if (key === undefined || key === null) {
                throw missingKeyError(version, list, index, field, row);
            }
        } else if (row === undefined || row === null) {
            throw new Error(
                `[Stitch E503] ${describeList(list)}: row ${index} is ${row}. ` +
                `A list row must be an object with a key, or a plain value (string, number, boolean). ` +
                `Remove the empty row from the list.`
            );
        } else if (list.keyField) {
            throw new Error(
                `[Stitch E504] ${describeList(list)}: row ${index} is a plain ${typeof row} (${formatKey(row)}), ` +
                `so it has no "${list.keyField}" field. data-key is for lists of objects; ` +
                `remove data-key and each plain value is its own key.`
            );
        } else {
            key = row;
        }

        if (seen.has(key)) {
            const first = seen.get(key);
            const what = (row !== null && typeof row === "object")
                ? `the same key ${formatKey(key)} (field "${field}")`
                : `the same value ${formatKey(key)} (in a list of plain values each value is its own key)`;
            throw new Error(
                `[Stitch E502] ${describeList(list)}: rows ${first} and ${index} have ${what}. ` +
                `Keys must be unique within a list: remove the duplicate, or key the rows by a field that is unique.`
            );
        }
        seen.set(key, index);
        keys[index] = key;
    }
    return keys;
}

module.exports = {
    resolveRowKeys
};
