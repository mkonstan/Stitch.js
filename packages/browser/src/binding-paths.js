"use strict";

/**
 * The one grammar and the one lookup for the values of Stitch's own bindings.
 *
 * Value bindings (text, value, visible, enabled, class, attr, foreach, loading, event's
 * config, custom bindings) name a PROPERTY PATH: names of letters, digits, _ and $, joined
 * by dots (`name`, `user.name`, `items.0.title`, `$parent.total`, `$root.rate`). Anything
 * else is invalid syntax and throws, naming the element, the binding, the value and the fix.
 *
 * A path must exist on the model (D25): a name the model (or the object the path walks
 * through) does not have throws, listing what it does have. A null or undefined step on
 * the way is a value (the binding shows nothing), not a missing property.
 *
 * Handler bindings (click, and the handler names inside event's config) name a HANDLER
 * (D12): a bare name on the current row (the model, outside a list), `$parent.name` on the
 * row or model one level up, or `$root.name` on the root model. Nothing else. The handler
 * is called with `this` = the object it was found on, and (rowItem, event), where rowItem
 * is the current row's item (the model, outside a list). A miss throws, saying where the
 * name was looked up and where it does exist.
 */

const { isRowContext } = require("../../utils/src/foreach-row-context");

const NAME = /^[A-Za-z_$][\w$]*$/;
const INDEX = /^\d+$/;
const ROW_NAMES = ["$data", "$index", "$parent", "$root"];
const MAX_LISTED = 25;

function tagOf(element) {
    return element && element.tagName ? element.tagName.toLowerCase() : "element";
}

/** `<span id="x" data-text="name">`: the element and the one binding in question. */
function describeBinding(element, attribute, value) {
    const id = element && element.id ? ` id="${element.id}"` : "";
    return `<${tagOf(element)}${id} ${attribute}="${value}">`;
}

/** An error about one binding, with its stable code: `[Stitch E###] <span data-text="x">: message`. */
function bindingError(code, where, message) {
    return new Error(`[Stitch ${code}] ${where}: ${message}`);
}

/** Why a value is not what a binding needs: a stable code and the reason with its fix. */
function problem(code, text) {
    return { code, text };
}

// ---------------------------------------------------------------------------
// Syntax

/**
 * Why a value is not a property path ({ code, text }: the reason with the fix); null if it is one.
 * @param {string} value - already trimmed
 */
function pathSyntaxProblem(value) {
    if (value === "") {
        return problem("E101", "the value is empty. Give the name of a model property, e.g. data-text=\"name\".");
    }
    if (value[0] === "{") {
        return problem("E103", "an inline object is not supported; a binding names a property. Put the object on the model " +
            "(a computed if it changes), e.g. rowClasses: Stitch.computed(function () { return { active: this.on }; }), " +
            "and bind its name: data-class=\"rowClasses\".");
    }
    if (value.indexOf("(") !== -1) {
        return problem("E104", "a call is not supported; a binding names a property. Make the value a computed and bind its name.");
    }
    if (/[,:;]/.test(value)) {
        return problem("E105", "an attribute holds exactly one binding with no options. Split it into separate attributes, " +
            "e.g. data-value=\"city\" data-visible=\"hasCity\".");
    }
    if (/[\s!=<>+\-*/%&|?'"`[\]]/.test(value)) {
        return problem("E102", "an expression is not supported; a binding names a property. Put the expression in a computed, " +
            "e.g. isOpen: Stitch.computed(function () { return !this.closed; }), and bind data-visible=\"isOpen\".");
    }
    const segments = value.split(".");
    for (const segment of segments) {
        if (!NAME.test(segment) && !INDEX.test(segment)) {
            return problem("E106", "this is not a property path. Use names of letters, digits, _ and $ joined by dots, " +
                "e.g. user.name or items.0.title.");
        }
    }
    return null;
}

/**
 * Checks the syntax of a value binding; returns the trimmed path.
 * @throws {Error} invalid syntax: element, binding, value and the fix
 */
function checkPathSyntax(element, attribute, rawValue) {
    const value = String(rawValue).trim();
    const found = pathSyntaxProblem(value);
    if (found) {
        // Relays the code and text made by problem() above.
        throw bindingError(found.code, describeBinding(element, attribute, rawValue), found.text);
    }
    return value;
}

// ---------------------------------------------------------------------------
// Scopes: the model, or a foreach row context

function rowItemOf(scope) {
    return isRowContext(scope) ? scope.$data : scope;
}

function rootOf(scope) {
    return isRowContext(scope) ? scope.$root : scope;
}

/**
 * Whether `key` is something a binding can follow on `holder` (B5, S6):
 * - "bindable": a reactive property (own accessor) of a model object; an own property of a
 *   plain object (e.g. a computed's value); an index or length of an array; size of a Map /
 *   Set; an own property of a string; on a row context, $data / $index / $parent / $root
 *   or a bindable property of the row item;
 * - "not-reactive": an own enumerable data property of a model object: a name starting with
 *   _ (never made reactive) or a property added after Observable.create();
 * - "missing": anything else, including inherited names (toString, constructor) and
 *   Stitch's hidden helpers (on, toJSON, $watch, ...).
 */
function memberStatus(holder, key) {
    if (isRowContext(holder)) {
        if (ROW_NAMES.indexOf(key) !== -1) return "bindable";
        const item = holder.$data;
        return item !== null && typeof item === "object" ? memberStatus(item, key) : "missing";
    }
    if (holder === null || holder === undefined) {
        return "missing";
    }
    if (typeof holder !== "object" && typeof holder !== "function") {
        return Object.prototype.hasOwnProperty.call(Object(holder), key) ? "bindable" : "missing";
    }
    if (Array.isArray(holder)) {
        return key === "length" || (INDEX.test(key) && Object.prototype.hasOwnProperty.call(holder, key)) ? "bindable" : "missing";
    }
    if (holder instanceof Map || holder instanceof Set) {
        return key === "size" ? "bindable" : "missing";
    }
    const descriptor = Object.getOwnPropertyDescriptor(holder, key);
    if (!descriptor) {
        // A class instance: a getter its class defines (on the prototype chain, not
        // Object.prototype) was bindable in v2 and stays bindable, read-only.
        return inheritedGetter(holder, key) ? "bindable" : "missing";
    }
    if (holder.__isReactive === true) {
        if (descriptor.get) return descriptor.enumerable ? "bindable" : "missing";
        return descriptor.enumerable ? "not-reactive" : "missing";
    }
    return "bindable";
}

/** A getter defined by holder's class (anywhere on its prototype chain above Object.prototype). */
function inheritedGetter(holder, key) {
    let proto = Object.getPrototypeOf(holder);
    while (proto && proto !== Object.prototype && proto !== Array.prototype) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        if (descriptor) {
            return descriptor.get ? descriptor : null;
        }
        proto = Object.getPrototypeOf(proto);
    }
    return null;
}

/**
 * Throws when a two-way binding's path ends on something that cannot be written: a getter
 * without a setter (a class's computed-like property). A null step is checked on write.
 */
function checkWritable(scope, path, describe) {
    const segments = path.split(".");
    let holder = scope;
    for (let i = 0; i < segments.length - 1; i++) {
        if (holder === null || holder === undefined) return;
        holder = holder[segments[i]];
    }
    if (holder === null || holder === undefined || typeof holder !== "object") return;
    const key = segments[segments.length - 1];
    // A bare name in a row is the row item's property (the context inherits it).
    if (isRowContext(holder) && ROW_NAMES.indexOf(key) === -1) {
        holder = holder.$data;
        if (holder === null || typeof holder !== "object") return;
    }
    const own = Object.getOwnPropertyDescriptor(holder, key);
    if (own && own.set && own.set.stitchReadOnlyComputed) {
        throw bindingError("E311", describe(),
            `"${path}" is a computed (read-only), so a two-way binding cannot write it. ` +
            "Bind it one-way (data-text), or bind the plain property it is computed from.");
    }
    const descriptor = own || inheritedGetter(holder, key);
    if (descriptor && descriptor.get && !descriptor.set) {
        throw bindingError("E312", describe(),
            `"${path}" is read-only (a getter without a setter), so a two-way binding cannot write it. ` +
            "Bind it one-way (data-text) or bind a writable property.");
    }
}

/** The names a binding can follow on holder, and the declared names it cannot. */
function memberLists(holder, isRowScope) {
    const target = isRowScope ? holder.$data : holder;
    const bindable = [];
    const notBindable = [];
    if (target !== null && typeof target === "object" && !Array.isArray(target)
        && !(target instanceof Map) && !(target instanceof Set)) {
        for (const name of Object.keys(target)) {
            const status = memberStatus(target, name);
            if (status === "bindable") bindable.push(name);
            else if (status === "not-reactive") notBindable.push(name);
        }
    }
    if (isRowScope) bindable.push(...ROW_NAMES);
    return { bindable, notBindable };
}

function listNames(names) {
    if (names.length === 0) return "no properties";
    const shown = names.slice(0, MAX_LISTED).join(", ");
    return names.length > MAX_LISTED ? `${shown}, ... (${names.length - MAX_LISTED} more)` : shown;
}

function describeMembers(holder, isRowScope) {
    if (Array.isArray(holder)) return { text: "an array: an index (0, 1, ...) or length", bindable: [], notBindable: [] };
    if (holder instanceof Map || holder instanceof Set) return { text: "size (it is a Map / Set)", bindable: [], notBindable: [] };
    const lists = memberLists(holder, isRowScope);
    let text = listNames(lists.bindable);
    if (lists.notBindable.length) {
        text += `. Not bindable: ${listNames(lists.notBindable)} (not reactive: names starting with _ are never made ` +
            "reactive, and properties added after Observable.create() are not either)";
    }
    return Object.assign({ text }, lists);
}

function editDistance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let previous = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const current = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
            previous = current;
        }
    }
    return row[b.length];
}

/** A close bindable name (for the error message only), or null. */
function closeName(names, wanted) {
    const lower = wanted.toLowerCase();
    let best = null;
    let bestDistance = 3;
    for (const name of names) {
        const distance = name.toLowerCase() === lower ? 0 : editDistance(name.toLowerCase(), lower);
        if (distance < bestDistance) {
            best = name;
            bestDistance = distance;
        }
    }
    return best;
}

function describeHolder(segments, index, isRowScope) {
    if (index === 0) {
        return isRowScope ? "the current row" : "the model";
    }
    return `"${segments.slice(0, index).join(".")}"`;
}

function missingPropertyError(where, segments, index, holder) {
    const isRowScope = index === 0 && isRowContext(holder);
    const name = segments[index];
    const owner = describeHolder(segments, index, isRowScope);
    if (holder === null || typeof holder !== "object" && typeof holder !== "function") {
        return bindingError("E202", where,
            `"${name}" is not a property of ${owner}, which is ${typeof holder} ${JSON.stringify(holder)}. ` +
            "Fix the path, or make that value an object.");
    }
    const members = describeMembers(holder, isRowScope);
    const close = closeName(members.bindable, name);
    const suggestion = close ? `Did you mean "${segments.slice(0, index).concat(close).join(".")}"? ` : "";
    return bindingError("E201", where,
        `"${name}" is not a property of ${owner}. ${owner[0].toUpperCase() + owner.slice(1)} has: ` +
        `${members.text}. ${suggestion}` +
        "Declare every bound property in Observable.create() with a starting value (null is fine): a property " +
        "added later is not reactive. Or fix the binding.");
}

function notReactiveError(where, segments, index) {
    const name = segments[index];
    const why = name[0] === "_"
        ? "Stitch never makes properties whose names start with _ reactive, so a binding could not follow it. " +
          `Rename it without the _ (e.g. "${name.replace(/^_+/, "") || "value"}"), or keep it out of bindings.`
        : "it was added after Observable.create(), so it has no reactive accessor and a binding could not follow it. " +
          "Declare it in Observable.create() with a starting value (null is fine).";
    return bindingError("E203", where, `"${segments.slice(0, index + 1).join(".")}" is not reactive: ${why}`);
}

/**
 * Reads a property path strictly: a name that is not a bindable property throws (D25, B5);
 * a null or undefined step ends the read with undefined.
 * @param {Object} scope - the model or a row context
 * @param {string} path - a valid path (see checkPathSyntax)
 * @param {Function} describe - () => the element/binding description, used only on error
 */
function readPath(scope, path, describe) {
    const segments = path.split(".");
    let current = scope;
    for (let i = 0; i < segments.length; i++) {
        if (current === null || current === undefined) {
            return undefined;
        }
        const key = segments[i];
        const status = memberStatus(current, key);
        if (status === "missing") {
            throw missingPropertyError(describe(), segments, i, current);
        }
        if (status === "not-reactive") {
            throw notReactiveError(describe(), segments, i);
        }
        current = current[key];
    }
    return current;
}

/** A reader bound to one element and binding, for use inside that binding's effect. */
function pathReader(element, attribute, path) {
    const describe = () => describeBinding(element, attribute, path);
    return scope => readPath(scope, path, describe);
}

// ---------------------------------------------------------------------------
// Handlers (D12)

/**
 * Parses a handler reference: `name`, `$parent.name` or `$root.name`
 * (name may be dotted: `$root.actions.save`).
 * @returns {{level: "row"|"parent"|"root", segments: string[], text: string}}
 */
function parseHandlerRef(where, rawValue) {
    const text = String(rawValue).trim();
    const found = pathSyntaxProblem(text);
    const fix = "A handler is a bare name (on the current row; the model outside a list), $parent.name or $root.name; " +
        "it is called with the row item and the event.";
    if (found) {
        throw bindingError("E108", where, `${found.text.split(". ")[0]}. ${fix}`);
    }
    let segments = text.split(".");
    let level = "row";
    if (segments[0] === "$parent" || segments[0] === "$root") {
        level = segments[0] === "$parent" ? "parent" : "root";
        segments = segments.slice(1);
    }
    if (segments.length === 0) {
        throw bindingError("E109", where, `"${text}" names a scope but no handler. ${fix}`);
    }
    const scoped = segments.find(segment => segment[0] === "$");
    if (scoped) {
        throw bindingError("E110", where,
            `"${text}": only one scope prefix is allowed, and only $parent. or $root. ` +
            "For a handler more than one level up, put it on the root model and use $root.name. " + fix);
    }
    return { level, segments, text };
}

/** Finds a dotted name on an object: { found, value, owner } (owner holds the last name). */
function lookUp(data, segments) {
    let owner = data;
    for (let i = 0; i < segments.length; i++) {
        // Own model members only (no inherited or hidden names); a handler need not be
        // reactive, so a _name method or one added later still counts.
        if (owner === null || owner === undefined || memberStatus(owner, segments[i]) === "missing") {
            return { found: false };
        }
        if (i === segments.length - 1) {
            return { found: true, value: owner[segments[i]], owner };
        }
        owner = owner[segments[i]];
    }
    return { found: false };
}

/** The scopes a handler can name from here, nearest first. */
function handlerLevels(scope) {
    const levels = [];
    const inRow = isRowContext(scope);
    levels.push({ level: "row", prefix: "", data: rowItemOf(scope), label: inRow ? "the current row" : "the model" });
    if (inRow) {
        const parent = scope.$parent;
        levels.push({ level: "parent", prefix: "$parent.", data: rowItemOf(parent), label: isRowContext(parent) ? "the parent row" : "the model" });
        levels.push({ level: "root", prefix: "$root.", data: scope.$root, label: "the root model" });
    } else {
        levels.push({ level: "root", prefix: "$root.", data: scope, label: "the model" });
    }
    return levels;
}

/** Rows above the parent that are not the root: a handler cannot name them. */
function unreachableAncestors(scope) {
    const found = [];
    if (!isRowContext(scope)) return found;
    let current = scope.$parent;
    let depth = 1;
    while (isRowContext(current) && isRowContext(current.$parent)) {
        current = current.$parent;
        depth++;
        found.push({ depth, data: rowItemOf(current) });
    }
    return found;
}

/**
 * Resolves a handler reference in a scope.
 * @returns {{fn: Function, owner: Object, item: *}}
 * @throws {Error} the name is missing (with where it does exist), or not a function
 */
function resolveHandler(scope, ref, where) {
    const levels = handlerLevels(scope);
    const target = levels.find(level => level.level === ref.level);
    const name = ref.segments.join(".");
    if (ref.level === "parent" && !isRowContext(scope)) {
        throw bindingError("E403", where,
            `"$parent." is only available inside a foreach row; here the handler is on the model itself. ` +
            `Use data-${where.includes("data-event") ? "event" : "click"} with the bare name "${name}".`);
    }
    const hit = lookUp(target.data, ref.segments);
    if (!hit.found) {
        const elsewhere = levels
            .filter(level => level !== target && level.data !== target.data && lookUp(level.data, ref.segments).found)
            .map(level => `${level.prefix}${name} (on ${level.label})`);
        const unreachable = unreachableAncestors(scope)
            .filter(ancestor => lookUp(ancestor.data, ref.segments).found);
        let hint = "";
        if (elsewhere.length) {
            hint = ` It exists as ${elsewhere.join(" and as ")}: did you mean "${elsewhere[0].split(" ")[0]}"?`;
        } else if (unreachable.length) {
            hint = ` It exists on a row ${unreachable[0].depth} levels up, which a handler cannot name: ` +
                `move it to the root model and use "$root.${name}".`;
        } else {
            hint = " It exists nowhere a handler can reach (the current row, $parent., $root.). Add it to the model.";
        }
        throw bindingError("E401", where, `handler "${ref.text}" was not found on ${target.label}.${hint}`);
    }
    if (typeof hit.value !== "function") {
        throw bindingError("E402", where,
            `"${ref.text}" on ${target.label} is ${hit.value === null ? "null" : typeof hit.value}, not a function. ` +
            "A handler must be a method of the model or row.");
    }
    return { fn: hit.value, owner: hit.owner, item: rowItemOf(scope) };
}

module.exports = {
    memberStatus,
    checkWritable,
    lookUp,
    describeBinding,
    checkPathSyntax,
    pathSyntaxProblem,
    readPath,
    pathReader,
    parseHandlerRef,
    resolveHandler,
    rowItemOf,
    rootOf
};
