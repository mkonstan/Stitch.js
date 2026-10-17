"use strict";

// Every row context created by createItemContext (so a scope can be told from a model).
const ROW_CONTEXTS = new WeakSet();

/** True when scope is a foreach row context (not a model). */
function isRowContext(scope) {
    return scope !== null && typeof scope === "object" && ROW_CONTEXTS.has(scope);
}

/**
 * Creates the binding context of one foreach row: the row's own fields (through the
 * prototype chain, so two-way bindings write to the row object), plus $data (the row
 * itself), $index, $parent (the list's view model: the model, or the enclosing row's
 * context) and $root (the model the outermost list belongs to).
 * The foreach binding replaces $index with a reactive accessor.
 *
 * @param {*} item
 * @param {number} index
 * @param {Object} viewModel
 * @returns {Object}
 */
function createItemContext(item, index, viewModel) {
    let context;
    if (typeof item === "object" && item !== null) {
        context = Object.create(item);
        Object.defineProperty(context, "$data", {
            value: item,
            writable: true,
            enumerable: false
        });
    } else {
        context = Object.create(null);
        context.$data = item;
    }
    context.$index = index;
    context.$parent = viewModel;
    Object.defineProperty(context, "$root", {
        value: isRowContext(viewModel) ? viewModel.$root : viewModel,
        writable: false,
        enumerable: false
    });
    ROW_CONTEXTS.add(context);
    return context;
}

module.exports = {
    createItemContext,
    isRowContext
};
