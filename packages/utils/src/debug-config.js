"use strict";

/**
 * Canonical debug category toggles extracted from Stitch runtime defaults.
 */
const DEFAULT_DEBUG_CATEGORIES = Object.freeze({
    reactivity: true,
    computed: true,
    effects: true,
    bindings: true,
    messageBus: true,
    warnings: true
});

/**
 * Canonical debug colors extracted from Stitch runtime defaults.
 */
const DEFAULT_DEBUG_COLORS = Object.freeze({
    reactivity: "#2196F3",
    computed: "#4CAF50",
    effects: "#FF9800",
    bindings: "#9C27B0",
    messageBus: "#F44336",
    warnings: "#FF5722"
});

/**
 * Creates a mutable debug state object seeded from extracted defaults.
 *
 * @param {string} version
 * @returns {{version: string, enabled: boolean, categories: Object, colors: Object}}
 */
function createDebugState(version) {
    return {
        version,
        enabled: false,
        categories: { ...DEFAULT_DEBUG_CATEGORIES },
        colors: { ...DEFAULT_DEBUG_COLORS }
    };
}

/**
 * Lists available debug categories from a category map.
 *
 * @param {Object} [categories]
 * @returns {string[]}
 */
function listDebugCategories(categories = DEFAULT_DEBUG_CATEGORIES) {
    return Object.keys(categories);
}

/**
 * Checks whether a category key exists in a category map.
 *
 * @param {Object} categories
 * @param {string} category
 * @returns {boolean}
 */
function isKnownDebugCategory(categories, category) {
    return !!categories && Object.prototype.hasOwnProperty.call(categories, category);
}

/**
 * Formats the standard unknown-category warning with current category list.
 *
 * @param {string} category
 * @param {Object} [categories]
 * @returns {string}
 */
function formatUnknownCategoryWarning(category, categories = DEFAULT_DEBUG_CATEGORIES) {
    return `[Stitch.js Debug] Unknown category: ${category}. Valid categories: ${listDebugCategories(categories).join(", ")}`;
}

/**
 * No-op debug object used as a default when debugging is disabled.
 * Provides the same interface as the real debug object so callers
 * don't need to check for null.
 */
const NOOP_DEBUG = {
    enabled: false,
    categories: Object.create(null),
    log() {},
    group() {},
    groupEnd() {}
};

module.exports = {
    DEFAULT_DEBUG_CATEGORIES,
    DEFAULT_DEBUG_COLORS,
    NOOP_DEBUG,
    createDebugState,
    listDebugCategories,
    isKnownDebugCategory,
    formatUnknownCategoryWarning
};
