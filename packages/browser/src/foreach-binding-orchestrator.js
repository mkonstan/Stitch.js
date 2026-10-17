"use strict";

/**
 * foreach: keyed list rendering. The ONE implementation used for every list element
 * (ul/ol/tbody/div/... and <select> options), whether the row template is inline or
 * comes from data-template.
 *
 * Rules:
 * - The row template has exactly one root element (whitespace and comments ignored).
 * - Every row has a unique key (resolveRowKeys: data-key field, default "id"; a plain
 *   value is its own key). A list that breaks the rule throws before the DOM changes.
 * - Same key + same object: the row is reused untouched (DOM state kept); only its
 *   $index is updated if it moved.
 * - Same key + a different object: the old row is released and a fresh row is bound
 *   to the new object.
 * - Every row that leaves the list is released (all bindings in its subtree disposed)
 *   before it is removed. Releasing the foreach binding releases all of its rows.
 */

function describeList(element, path) {
    const keyAttr = element.getAttribute("data-key");
    return `<${element.tagName.toLowerCase()} data-foreach="${path}"${keyAttr !== null ? ` data-key="${keyAttr}"` : ""}>`;
}

function describeNode(node) {
    if (node.nodeType === 1) return `<${node.tagName.toLowerCase()}>`;
    const text = node.textContent.trim();
    return `text "${text.length > 20 ? text.slice(0, 20) + "..." : text}"`;
}

/**
 * Reads the list's key field from data-key. Absent = null (the default, "id").
 */
function readKeyField(element, path, version) {
    if (!element.hasAttribute("data-key")) {
        return null;
    }
    const field = element.getAttribute("data-key").trim();
    if (!field) {
        throw new Error(
            `[Stitch.js ${version}] ${describeList(element, path)}: data-key is empty. ` +
            `Set it to the field that identifies a row (e.g. data-key="sku"), or remove it to use "id".`
        );
    }
    return field;
}

/**
 * Reads the row template from the list element (inline) or from the <template> named
 * by data-template, enforcing the one-root rule. Returns a detached copy that is
 * cloned for every row; it is never bound itself. Changes nothing in the DOM.
 */
function readRowTemplate(element, path, version, doc) {
    const templateId = element.getAttribute("data-template");
    const where = describeList(element, path);
    let nodes;
    let source;
    if (templateId) {
        const templateElement = doc.getElementById(templateId);
        if (!templateElement) {
            throw new Error(`[Stitch.js ${version}] ${where}: data-template="${templateId}" names no element. Add <template id="${templateId}"> with one row element inside.`);
        }
        if (templateElement.tagName !== "TEMPLATE") {
            throw new Error(`[Stitch.js ${version}] ${where}: data-template="${templateId}" must name a <template> element, got <${templateElement.tagName.toLowerCase()}>.`);
        }
        nodes = Array.from(templateElement.content.childNodes);
        source = `the row template <template id="${templateId}">`;
    } else {
        nodes = Array.from(element.childNodes);
        source = "the inline row template";
    }

    const roots = nodes.filter(node =>
        node.nodeType === 1 || (node.nodeType === 3 && node.textContent.trim() !== ""));

    if (roots.length === 0) {
        throw new Error(
            `[Stitch.js ${version}] ${where}: ${source} is empty. ` +
            (templateId
                ? `Put one row element inside <template id="${templateId}">.`
                : `Put one row element inside the list element, e.g. <li data-text="name"></li>, or point data-template at a <template>.`)
        );
    }
    if (roots.length > 1) {
        const kind = roots.every(node => node.nodeType === 1) ? "root elements" : "root nodes";
        throw new Error(
            `[Stitch.js ${version}] ${where}: ${source} has ${roots.length} ${kind} (${roots.map(describeNode).join(", ")}), ` +
            `but a row must be exactly one element. Wrap them in one element, e.g. <div>...</div>.`
        );
    }
    if (roots[0].nodeType !== 1) {
        throw new Error(
            `[Stitch.js ${version}] ${where}: ${source} is ${describeNode(roots[0])}, but a row must be one element. ` +
            `Wrap it in an element, e.g. <span data-text="$data"></span>.`
        );
    }

    // A detached copy: the list element's own children are left in place here (bindForeach
    // takes them out, and puts them back if the first render throws).
    return templateId ? doc.importNode(roots[0], true) : roots[0].cloneNode(true);
}

/**
 * Gives a row context a reactive $index, so bindings that show it follow moves.
 */
function defineRowIndex(itemContext, index, reactiveSystem) {
    const holder = { index };
    Object.defineProperty(itemContext, "$index", {
        configurable: true,
        enumerable: false,
        get() {
            reactiveSystem.track(holder, "index");
            return holder.index;
        }
    });
    return function setIndex(next) {
        if (holder.index !== next) {
            const previous = holder.index;
            holder.index = next;
            reactiveSystem.trigger(holder, "index", previous, next);
        }
    };
}

/**
 * Binds a foreach list.
 *
 * @param {HTMLElement} element - the list element (has data-foreach)
 * @param {Object} viewModel
 * @param {string} path - the data-foreach path
 * @param {{reactiveSystem: Object, binder: Object}} context
 * @param {Object} deps
 * @param {Function} deps.pathReader - (element, attribute, path) => strict reader (binding-paths.js)
 * @param {Function} deps.getValueValidator
 * @param {Function} deps.createItemContext
 * @param {Function} deps.resolveRowKeys
 * @param {Function} deps.runAllThenThrow
 * @param {Function} deps.reportError
 * @param {string} deps.version
 * @param {Document} [deps.doc]
 * @returns {Function} the list's effect
 */
function bindForeach(element, viewModel, path, context, deps) {
    const version = deps.version;
    const doc = deps.doc || element.ownerDocument;
    const binder = context.binder;
    const reactiveSystem = context.reactiveSystem;

    // Strict reads (D25): the binder checked the path at bind(); a later change that
    // makes it missing throws inside the re-render, so it goes to Stitch.onError.
    const readList = deps.pathReader(element, "data-foreach", path);

    const list = {
        name: path,
        keyField: readKeyField(element, path, version),
        tagName: element.tagName
    };
    const rowTemplate = readRowTemplate(element, path, version, doc);

    // B3: check the row template now, even if the list is empty: syntax, placement and
    // $root. names (binder._checkTemplate), and the one-root rule of every nested list
    // (data-template ones followed once each, so a recursive tree template terminates).
    // A row's own property names can only be checked when a row is rendered.
    const seenTemplates = new Set(element.getAttribute("data-template") ? [element.getAttribute("data-template")] : []);
    (function checkTemplate(template) {
        binder._checkTemplate(template, viewModel);
        const lists = (template.hasAttribute("data-foreach") ? [template] : [])
            .concat(Array.from(template.querySelectorAll("[data-foreach]")));
        for (const nested of lists) {
            const nestedTemplate = readRowTemplate(nested, nested.getAttribute("data-foreach"), version, doc);
            const nestedId = nested.getAttribute("data-template");
            if (nestedId && !seenTemplates.has(nestedId)) {
                seenTemplates.add(nestedId);
                checkTemplate(nestedTemplate);
            }
        }
    })(rowTemplate);

    // The list element's original children (inline template, whitespace). They were never
    // bound (foreach is a binding boundary), so they are simply taken out; if the first
    // render throws they are put back, so the element can be bound again once fixed.
    const originalChildren = Array.from(element.childNodes);
    originalChildren.forEach(node => element.removeChild(node));

    const isSelect = element.tagName === "SELECT";
    const valuePath = isSelect && element.hasAttribute("data-value") ? element.getAttribute("data-value").trim() : null;
    const readValue = valuePath ? deps.pathReader(element, "data-value", valuePath) : null;
    let placeholder = null;
    if (isSelect && element.getAttribute("data-default-text")) {
        placeholder = doc.createElement("option");
        placeholder.value = element.getAttribute("data-default-value") || "";
        placeholder.textContent = element.getAttribute("data-default-text");
        element.appendChild(placeholder);
    }

    /** @type {Map<*, {el: HTMLElement, item: *, setIndex: Function}>} key -> row */
    let rows = new Map();

    function createRow(item, index) {
        const el = rowTemplate.cloneNode(true);
        const itemContext = deps.createItemContext(item, index, viewModel);
        const setIndex = defineRowIndex(itemContext, index, reactiveSystem);
        const row = { el, item, setIndex };
        try {
            // Untracked: what the row's bindings read while they are set up belongs to
            // their own effects, not to the list (a row change must not re-render the list).
            reactiveSystem.untracked(() => binder._bindElement(el, itemContext, []));
        } catch (error) {
            releaseAfterFailure(el);
            throw error;
        }
        return row;
    }

    // Releases rows built by a render that is failing. The render's own error is the one
    // thrown; a cleanup error on the way is reported separately, not lost.
    function releaseAfterFailure(el) {
        try {
            binder._unbindTree(el);
        } catch (cleanupError) {
            deps.reportError(cleanupError, { source: "unbind", element: el });
        }
    }

    function releaseRow(row) {
        try {
            binder._unbindTree(row.el);
        } finally {
            // Even if a cleanup threw, the row leaves the list.
            if (row.el.parentNode === element) {
                element.removeChild(row.el);
            }
        }
    }

    function readItems() {
        const value = readList(viewModel);
        if (value === undefined || value === null) {
            return [];
        }
        if (!Array.isArray(value)) {
            throw new TypeError(
                `[Stitch.js ${version}] ${describeList(element, path)}: "${path}" must be an array (or null/undefined for no rows), ` +
                `got ${typeof value}. Bind data-foreach to an array.`
            );
        }
        return value;
    }

    function reconcile(items) {
        // 1. Keys first: a list that breaks the key rule throws before anything changes.
        const keys = deps.resolveRowKeys(items, list, version);

        // 2. Reuse a row only for the same key AND the same object; build the others.
        //    If building a row throws, release what was built and leave the DOM as it was.
        const next = new Map();
        const ordered = new Array(items.length);
        const created = [];
        try {
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                const existing = rows.get(keys[index]);
                let row;
                if (existing && Object.is(existing.item, item)) {
                    row = existing;
                } else {
                    row = createRow(item, index);
                    created.push(row);
                }
                ordered[index] = row;
                next.set(keys[index], row);
            }
        } catch (error) {
            created.forEach(row => releaseAfterFailure(row.el));
            throw error;
        }

        // 3. Release every old row that is not reused (key gone, or a new object). A cleanup
        //    that throws does not stop the render; its error is thrown once the list is done.
        const releases = [];
        rows.forEach((row, key) => {
            if (next.get(key) !== row) {
                releases.push(() => releaseRow(row));
            }
        });
        let releaseError = null;
        try {
            deps.runAllThenThrow(releases, { source: "binding", element, binding: `data-foreach="${path}"` });
        } catch (error) {
            releaseError = { error };
        }

        // 4. Put rows in order after the placeholder (if any).
        let cursor = placeholder ? placeholder.nextSibling : element.firstChild;
        for (const row of ordered) {
            if (row.el === cursor) {
                cursor = cursor.nextSibling;
            } else {
                element.insertBefore(row.el, cursor);
            }
        }

        // 5. Moved rows show their new position.
        for (let index = 0; index < ordered.length; index++) {
            ordered[index].setIndex(index);
        }
        rows = next;
        if (releaseError) {
            throw releaseError.error;
        }
    }

    function restoreSelectValue() {
        if (valuePath) {
            const currentValue = readValue(viewModel);
            if (currentValue !== undefined && currentValue !== null) {
                const validator = deps.getValueValidator(element);
                const validValue = validator.validate(element, currentValue, viewModel, valuePath, "render");
                if (validValue !== undefined) {
                    element.value = validValue;
                }
            } else if (placeholder) {
                element.value = placeholder.value;
            }
            return;
        }
        // No data-value: options are reused, so the user's choice stays selected unless
        // its option left the list.
        if (placeholder && element.selectedIndex < 0) {
            element.value = placeholder.value;
        }
    }

    let effect;
    try {
        effect = reactiveSystem.effect(() => {
            reconcile(readItems());
            if (isSelect) {
                restoreSelectValue();
            }
        }, { batch: true, errorContext: { source: "binding", element, binding: `data-foreach="${path}"` } });
    } catch (error) {
        // The first render threw (effect() has released the effect, and reconcile has
        // released any rows it built): restore the element as it was before bind().
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        originalChildren.forEach(node => element.appendChild(node));
        throw error;
    }

    binder._trackCleanup(element, () => {
        reactiveSystem.cleanup(effect);
        const released = rows;
        rows = new Map();
        deps.runAllThenThrow(Array.from(released.values(), row => () => binder._unbindTree(row.el)),
            { source: "unbind", element });
    });
    return effect;
}

/**
 * Builds a foreach binding handler compatible with the BINDING_HANDLERS contract.
 *
 * @param {Object} deps - see bindForeach
 * @returns {{bind: Function}}
 */
function createForeachBindingHandler(deps) {
    return {
        bind(element, viewModel, path, context) {
            return bindForeach(element, viewModel, path, context, deps);
        }
    };
}

module.exports = {
    bindForeach,
    createForeachBindingHandler,
    readRowTemplate,
    readKeyField
};
