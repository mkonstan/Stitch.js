"use strict";

/**
 * Creates the binding context of one foreach row: the row's own fields (through the
 * prototype chain, so two-way bindings write to the row object), plus $data (the row
 * itself), $index and $parent (the list's view model).
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
    return context;
}

module.exports = {
    createItemContext
};
