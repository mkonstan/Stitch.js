"use strict";

const { createTemplateElement: defaultCreateTemplateElement } = require("./foreach-template-helpers");

/**
 * Creates item context object with $data, $index, $parent for foreach templates.
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

/**
 * Generates a stable key for array reconciliation.
 *
 * @param {*} item
 * @param {number} index
 * @returns {string}
 */
function getItemKey(item, index) {
    if (typeof item === "object" && item !== null) {
        if (item.id !== undefined) return `item-${item.id}`;
        if (item.key !== undefined) return `item-${item.key}`;
    }
    return `item-${index}`;
}

/**
 * Reconciles container rows by keyed reuse and creation.
 *
 * @param {HTMLElement} container
 * @param {Array} newItems
 * @param {string} templateSource
 * @param {string} containerTag
 * @param {Object} [deps]
 * @param {Function} [deps.createTemplateElement]
 * @returns {HTMLElement[]}
 */
function reconcileRows(container, newItems, templateSource, containerTag, deps = {}) {
    const createTemplate = deps.createTemplateElement || defaultCreateTemplateElement;

    const existingRows = Array.from(container.children);
    const newRowElements = [];
    const existingRowsByKey = new Map();

    existingRows.forEach((row, index) => {
        const key = row.dataset.stitchKey || `item-${index}`;
        existingRowsByKey.set(key, row);
    });

    newItems.forEach((item, index) => {
        const key = getItemKey(item, index);
        if (existingRowsByKey.has(key)) {
            const existingRow = existingRowsByKey.get(key);
            newRowElements.push(existingRow);
            existingRowsByKey.delete(key);
        } else {
            const templateEl = createTemplate(templateSource, containerTag);
            templateEl.dataset.stitchKey = key;
            newRowElements.push(templateEl);
        }
    });

    existingRowsByKey.forEach(row => {
        row.remove();
    });

    newRowElements.forEach((row, index) => {
        if (container.children[index] !== row) {
            container.insertBefore(row, container.children[index] || null);
        }
    });

    return newRowElements;
}

module.exports = {
    createItemContext,
    getItemKey,
    reconcileRows
};
