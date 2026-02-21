"use strict";

/**
 * Orchestrates foreach binding lifecycle:
 * - validate binding path
 * - resolve template + rendering delegate
 * - install reactive effect
 * - track cleanup
 *
 * @param {HTMLElement} element
 * @param {Object} viewModel
 * @param {string} path
 * @param {Object} context
 * @param {Object} deps
 * @param {Function} deps.validateBinding
 * @param {Function} deps.getProperty
 * @param {Function} deps.getRenderingDelegate
 * @param {Object} deps.foreachRenderingDelegates
 * @returns {*}
 */
function bindForeach(element, viewModel, path, context, deps) {
    deps.validateBinding(viewModel, path, "foreach", element);

    const templateSource = context.binder._getTemplateSource(element);
    const delegate = deps.getRenderingDelegate(element, deps.foreachRenderingDelegates);
    const config = delegate.prepareConfig(element, templateSource);

    element.innerHTML = "";

    const eff = context.reactiveSystem.effect(() => {
        const items = deps.getProperty(viewModel, path);
        delegate.render(element, items, config, context.binder, viewModel, path);
    }, { batch: true });

    context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
    return eff;
}

/**
 * Builds a foreach binding handler compatible with BINDING_HANDLERS contract.
 *
 * @param {Object} deps
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
    createForeachBindingHandler
};
