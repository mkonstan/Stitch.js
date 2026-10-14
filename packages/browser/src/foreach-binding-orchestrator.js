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
 * Takes the row template out of the list element (inline) or out of the <template>
 * named by data-template, enforcing the one-root rule. Returns a detached element
 * that is cloned for every row; it is never bound itself.
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

    // Inline template nodes were never bound (foreach is a binding boundary), so they can
    // simply be taken out of the list element.
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
    return templateId ? doc.importNode(roots[0], true) : roots[0];
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
 * @param {Function} deps.validateBinding
 * @param {Function} deps.getProperty
 * @param {Function} deps.getValueValidator
 * @param {Function} deps.createItemContext
 * @param {Function} deps.resolveRowKeys
 * @param {string} deps.version
 * @param {Document} [deps.doc]
 * @returns {Function} the list's effect
 */
function bindForeach(element, viewModel, path, context, deps) {
    const version = deps.version;
    const doc = deps.doc || element.ownerDocument;
    const binder = context.binder;
    const reactiveSystem = context.reactiveSystem;

    deps.validateBinding(viewModel, path, "foreach", element);

    const list = {
        name: path,
        keyField: readKeyField(element, path, version),
        tagName: element.tagName
    };
    const rowTemplate = readRowTemplate(element, path, version, doc);

    const isSelect = element.tagName === "SELECT";
    const valuePath = isSelect ? element.getAttribute("data-value") : null;
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
            binder._unbindTree(el);
            throw error;
        }
        return row;
    }

    function releaseRow(row) {
        binder._unbindTree(row.el);
        if (row.el.parentNode === element) {
            element.removeChild(row.el);
        }
    }

    function readItems() {
        const value = deps.getProperty(viewModel, path);
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
            created.forEach(row => binder._unbindTree(row.el));
            throw error;
        }

        // 3. Release every old row that is not reused (key gone, or a new object).
        rows.forEach((row, key) => {
            if (next.get(key) !== row) {
                releaseRow(row);
            }
        });

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
    }

    function restoreSelectValue() {
        if (valuePath) {
            const currentValue = deps.getProperty(viewModel, valuePath);
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

    const effect = reactiveSystem.effect(() => {
        reconcile(readItems());
        if (isSelect) {
            restoreSelectValue();
        }
    }, { batch: true });

    binder._trackCleanup(element, () => {
        reactiveSystem.cleanup(effect);
        rows.forEach(row => binder._unbindTree(row.el));
        rows = new Map();
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
