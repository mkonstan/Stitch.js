"use strict";

/**
 * data-attr: how each { attributeName: value } entry is written, and which writes are
 * refused because the value (which comes from data) could make the page run script.
 *
 * The binding (binding-runtime.js) plans every entry first (planAttrWrite), asks
 * attrRefusal() about each plan, throws a coded error for the first refusal, and only then
 * writes (applyAttrWrite). So a refused object changes nothing, and the text that was
 * checked is exactly the text that is written.
 *
 * Refused:
 *   - any attribute name starting with "on" (an event handler: its value runs as script);
 *   - srcdoc (a whole HTML document, scripts included);
 *   - a javascript: or vbscript: URL in a URL-bearing attribute, after the URL parser's own
 *     normalisation (case, tabs and newlines anywhere, leading control characters and
 *     spaces) and, to be safe, after decoding character references and percent-escapes
 *     and removing every control, space and invisible character;
 *   - a data: URL in a URL-bearing attribute, except data:image/... in an <img> src;
 *   - style as a string (a strict Content-Security-Policy blocks style strings; an object
 *     is written through the CSSOM, property by property).
 */

// Attributes whose value the browser reads as a URL, on any element.
const URL_ATTRIBUTES = [
    "href", "src", "action", "formaction", "xlink:href", "xml:base", "poster", "cite", "background",
    "data", "codebase", "classid", "longdesc", "lowsrc", "dynsrc", "manifest", "icon", "profile",
    "usemap", "srcset", "imagesrcset", "ping", "archive"
];
// URL lists: srcset-style (comma-separated candidates, each "url descriptor"), or
// whitespace/comma separated URLs.
const SRCSET_ATTRIBUTES = ["srcset", "imagesrcset"];
const URL_LIST_ATTRIBUTES = ["ping", "archive"];
// SVG animation elements can set another attribute (href) to these values.
const SVG_ANIMATION_ELEMENTS = ["animate", "set", "animatemotion", "animatetransform", "animatecolor"];
const SVG_ANIMATION_VALUES = ["values", "from", "to", "by"];
const SCRIPT_SCHEMES = ["javascript", "vbscript"];

// Named character references that decode to characters a scheme or its separator can be
// made of (the rest cannot form "javascript:", "vbscript:" or "data:"). Looked up in lower case.
const NAMED_REFERENCES = {
    colon: ":", tab: "\t", newline: "\n", nbsp: "\u00a0", sol: "/", bsol: "\\", lpar: "(", rpar: ")",
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", period: ".", comma: ",", semi: ";", excl: "!",
    num: "#", percnt: "%", plus: "+", equals: "=", quest: "?", commat: "@", lowbar: "_", dollar: "$",
    ast: "*", hyphen: "-", dash: "-", grave: "`", zwsp: "\u200b", shy: "\u00ad"
};
// Every control, space, format and invisible character: removed in the deny-biased view.
const INVISIBLE = /[\u0000-\u0020\u007f-\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u17b4\u17b5\u180b-\u180e\u2000-\u200f\u2028-\u202f\u205f-\u206f\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufff8]/g;
const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/;

function decodeReferences(text) {
    let current = text;
    // Repeated, so "&amp;#106;" is seen as "j" too (stricter than one HTML parse).
    for (let round = 0; round < 4; round++) {
        const next = current.replace(/&(?:#(\d+)|#[xX]([0-9A-Fa-f]+)|([A-Za-z][A-Za-z0-9]*));?/g, (match, dec, hex, name) => {
            if (name !== undefined) {
                const key = name.toLowerCase();
                return Object.prototype.hasOwnProperty.call(NAMED_REFERENCES, key) ? NAMED_REFERENCES[key] : match;
            }
            const codePoint = dec !== undefined ? parseInt(dec, 10) : parseInt(hex, 16);
            return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "\ufffd";
        });
        if (next === current) break;
        current = next;
    }
    return current;
}

function decodePercent(text) {
    try {
        return decodeURIComponent(text);
    } catch (_error) {
        return text.replace(/%([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
}

/** The schemes (lower case) a URL text could be read as, by the browser or a laxer reader. */
function urlSchemes(text) {
    const schemes = new Set();
    const add = (form) => {
        const m = SCHEME.exec(form);
        if (m) schemes.add(m[1].toLowerCase());
    };
    const forms = [text, decodeReferences(text)];
    forms.push(decodePercent(forms[1]));
    for (const form of forms) {
        // The URL parser's view: tabs and newlines removed anywhere, C0 controls and spaces trimmed.
        add(form.replace(/[\t\n\r]/g, "").replace(/^[\u0000- ]+/, ""));
        // The deny-biased view: every control, space and invisible character removed.
        add(form.replace(INVISIBLE, ""));
    }
    // The browser's own parser, where there is one.
    if (typeof URL === "function") {
        try {
            const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "http://localhost/";
            add(new URL(text, base).protocol);
        } catch (_error) {
            // Not a URL the browser can parse: nothing to follow.
        }
    }
    return schemes;
}

/** The URL texts inside an attribute value: one, or each entry of a list. */
function urlParts(element, name, text) {
    const parts = [text];
    if (SRCSET_ATTRIBUTES.indexOf(name) !== -1) {
        text.split(",").forEach(candidate => parts.push(candidate.trim().split(/\s+/)[0] || ""));
    } else if (URL_LIST_ATTRIBUTES.indexOf(name) !== -1) {
        text.split(/[\s,]+/).forEach(part => parts.push(part));
    } else if (isSvgAnimationValue(element, name)) {
        text.split(";").forEach(part => parts.push(part.trim()));
    }
    return parts;
}

function localNameOf(element) {
    return String(element && (element.localName || element.tagName) || "").toLowerCase();
}

function isSvgAnimationValue(element, name) {
    return SVG_ANIMATION_ELEMENTS.indexOf(localNameOf(element)) !== -1 && SVG_ANIMATION_VALUES.indexOf(name) !== -1;
}

function isUrlAttribute(element, name) {
    return URL_ATTRIBUTES.indexOf(name) !== -1 || isSvgAnimationValue(element, name);
}

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * What writing { [name]: value } does: { name, remove: true }, { name, text } or, for a style
 * object, { name, style: { property: value } }. The text is computed once, here.
 */
function planAttrWrite(name, value) {
    const attrName = String(name);
    if (value === null || value === undefined || value === false) {
        return { name: attrName, remove: true };
    }
    if (value === true) {
        return { name: attrName, text: "" };
    }
    if (attrName.toLowerCase() === "style" && isPlainObject(value)) {
        return { name: attrName, style: Object.assign({}, value) };
    }
    if (Array.isArray(value)) {
        return { name: attrName, text: value.join(attrName === "class" ? " " : ",") };
    }
    if (typeof value === "object") {
        return { name: attrName, text: JSON.stringify(value) };
    }
    return { name: attrName, text: String(value) };
}

/**
 * Why a planned write is refused, or null. Kinds: "event-handler", "srcdoc", "style-string",
 * "script-url" (with scheme) and "data-url".
 */
function attrRefusal(element, write) {
    const name = write.name.toLowerCase();
    if (name.slice(0, 2) === "on") {
        return { kind: "event-handler" };
    }
    if (name === "srcdoc") {
        return { kind: "srcdoc" };
    }
    if (write.remove) {
        return null;
    }
    if (name === "style") {
        return write.style ? null : { kind: "style-string" };
    }
    if (!isUrlAttribute(element, name)) {
        return null;
    }
    const imageSource = localNameOf(element) === "img" && name === "src";
    for (const part of urlParts(element, name, write.text)) {
        const schemes = urlSchemes(part);
        const script = SCRIPT_SCHEMES.find(scheme => schemes.has(scheme));
        if (script) {
            return { kind: "script-url", scheme: script };
        }
        if (schemes.has("data")) {
            const image = /^data:image\//i.test(decodeReferences(part).replace(INVISIBLE, ""));
            if (!(imageSource && image)) {
                return { kind: "data-url" };
            }
        }
    }
    return null;
}

// Style properties each element got from data-attr, so a later value can remove the ones
// it no longer lists (and only those: data-visible's display, for one, is left alone).
const STYLE_PROPERTIES = new WeakMap();

function cssPropertyName(key) {
    return key.slice(0, 2) === "--" ? key : key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function applyStyle(element, style) {
    const previous = STYLE_PROPERTIES.get(element) || [];
    const next = [];
    Object.keys(style || {}).forEach(key => {
        const property = cssPropertyName(key);
        const value = style[key];
        if (value === null || value === undefined || value === false) {
            element.style.removeProperty(property);
            return;
        }
        const text = String(value);
        const important = /\s*!\s*important\s*$/i.exec(text);
        element.style.setProperty(property, important ? text.slice(0, important.index) : text, important ? "important" : "");
        next.push(property);
    });
    previous.forEach(property => {
        if (next.indexOf(property) === -1) {
            element.style.removeProperty(property);
        }
    });
    STYLE_PROPERTIES.set(element, next);
}

/** Writes a planned entry (never a style string: a style plan is an object). */
function applyAttrWrite(element, write) {
    if (write.name.toLowerCase() === "style") {
        // Through the CSSOM: removing means removing the properties data-attr wrote.
        applyStyle(element, write.remove ? null : write.style);
        return;
    }
    if (write.remove) {
        element.removeAttribute(write.name);
    } else {
        element.setAttribute(write.name, write.text);
    }
}

module.exports = {
    planAttrWrite,
    attrRefusal,
    applyAttrWrite
};
