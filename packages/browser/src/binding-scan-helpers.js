"use strict";

/**
 * Binding discovery (D24). Stitch looks only for its OWN attributes, by selector:
 *   - the registered binding names (built-ins + DataBinder.registerBinding names): data-<name>;
 *   - the internal attributes that configure a list: data-key, data-template,
 *     data-default-text, data-default-value.
 * No other data-* attribute is ever read in the default path; there is no fuzzy matching
 * (data-txt is not "almost data-text": it is simply not Stitch's). Only when a report
 * function is installed with Stitch.onBindReport(fn) does bind() also look at the other
 * data-* attributes, to list them as ignored.
 */

// Attributes Stitch reads that are not bindings. Each one belongs on a data-foreach element.
const INTERNAL_ATTRIBUTES = ["data-key", "data-template", "data-default-text", "data-default-value"];
// Attributes a binding reads on its own element (data-value reads data-type). They are
// Stitch's (the bind report lists them as bound) but they do not make an element a target.
const READ_ATTRIBUTES = ["data-type"];

// A binding name becomes the attribute data-<name>; HTML lowercases attribute names, so
// a name must be lowercase to ever match.
const BINDING_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** The selector that finds every element carrying one of our attributes. */
function bindingSelector(names) {
    return names.map(name => `[data-${name}]`)
        .concat(INTERNAL_ATTRIBUTES.map(attribute => `[${attribute}]`))
        .join(",");
}

/**
 * The bindings on one element, by asking for each registered name (the element's other
 * attributes are not looked at). foreach comes first: on a <select>, the options exist
 * before data-value is applied.
 * @returns {Array<{type: string, path: string, attributeName: string}>}
 */
function readElementBindings(element, names) {
    const bindings = [];
    for (const name of names) {
        const attributeName = `data-${name}`;
        const value = element.getAttribute(attributeName);
        if (value !== null) {
            const binding = { type: name, path: value, attributeName };
            if (name === "foreach") bindings.unshift(binding); else bindings.push(binding);
        }
    }
    return bindings;
}

/** True for an attribute Stitch acts on: a registered binding or an internal attribute. */
function isOurAttribute(attributeName, names) {
    if (INTERNAL_ATTRIBUTES.indexOf(attributeName) !== -1 || READ_ATTRIBUTES.indexOf(attributeName) !== -1) return true;
    return attributeName.startsWith("data-") && names.indexOf(attributeName.slice(5)) !== -1;
}

/**
 * The opt-in report (Stitch.onBindReport): every data-* attribute in root, split into
 * bound (ours: a binding or an internal attribute) and ignored (not ours).
 * @returns {{bound: Array<{element, attribute, value}>, ignored: Array<{element, attribute, value}>}}
 */
function collectBindReport(root, names) {
    const bound = [];
    const ignored = [];
    const elements = [root].concat(Array.from(root.querySelectorAll("*")));
    for (const element of elements) {
        for (const attribute of Array.from(element.attributes)) {
            if (!attribute.name.startsWith("data-")) continue;
            const entry = { element, attribute: attribute.name, value: attribute.value };
            (isOurAttribute(attribute.name, names) ? bound : ignored).push(entry);
        }
    }
    return { bound, ignored };
}

module.exports = {
    INTERNAL_ATTRIBUTES,
    READ_ATTRIBUTES,
    BINDING_NAME,
    bindingSelector,
    readElementBindings,
    isOurAttribute,
    collectBindReport
};
