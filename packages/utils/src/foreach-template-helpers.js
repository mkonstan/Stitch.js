"use strict";

/**
 * Configuration registry for HTML container-specific template parsing.
 */
const FOREACH_CONTAINER_HANDLERS = {
    tbody: {
        wrapperTag: "table",
        innerTag: "tbody",
        needsWrapper: true
    },
    thead: {
        wrapperTag: "table",
        innerTag: "thead",
        needsWrapper: true
    },
    tfoot: {
        wrapperTag: "table",
        innerTag: "tfoot",
        needsWrapper: true
    },
    ul: {
        containerTag: "ul",
        needsWrapper: false
    },
    ol: {
        containerTag: "ol",
        needsWrapper: false
    },
    select: {
        containerTag: "select",
        needsWrapper: false
    },
    default: {
        containerTag: "div",
        needsWrapper: false
    }
};

/**
 * Creates temporary DOM container for parsing template HTML strings.
 *
 * @param {string} template
 * @param {Object} handler
 * @param {Document} [doc]
 * @returns {{container: HTMLElement, inner: HTMLElement|null}}
 */
function createTempContainer(template, handler, doc = (typeof document !== "undefined" ? document : null)) {
    if (!doc) {
        throw new Error("createTempContainer requires a document instance.");
    }
    if (handler.needsWrapper) {
        const wrapper = doc.createElement(handler.wrapperTag);
        const inner = doc.createElement(handler.innerTag);
        inner.innerHTML = template;
        wrapper.appendChild(inner);
        return {
            container: wrapper,
            inner
        };
    }
    const container = doc.createElement(handler.containerTag);
    container.innerHTML = template;
    return {
        container,
        inner: null
    };
}

/**
 * Extracts template elements from a temporary container result.
 *
 * @param {{container: HTMLElement, inner: HTMLElement|null}} tempContainerResult
 * @returns {HTMLElement[]}
 */
function extractElements(tempContainerResult) {
    const source = tempContainerResult.inner || tempContainerResult.container;
    return Array.from(source.children);
}

/**
 * Creates template DOM element from HTML string.
 *
 * @param {string} templateSource
 * @param {string} containerTag
 * @param {Object} [options]
 * @param {Object} [options.handlers]
 * @param {Document} [options.doc]
 * @returns {HTMLElement|undefined}
 */
function createTemplateElement(templateSource, containerTag, options = {}) {
    const handlers = options.handlers || FOREACH_CONTAINER_HANDLERS;
    const handler = handlers[containerTag] || handlers.default;
    const tempResult = createTempContainer(templateSource, handler, options.doc);
    const templateElements = extractElements(tempResult);
    return templateElements[0];
}

module.exports = {
    FOREACH_CONTAINER_HANDLERS,
    createTempContainer,
    extractElements,
    createTemplateElement
};
