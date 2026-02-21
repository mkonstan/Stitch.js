"use strict";

const VERSION = "2.1.0";
const foreachRenderingDelegates = require("./src/foreach-rendering-delegates");
const foreachBindingOrchestrator = require("./src/foreach-binding-orchestrator");
const bindingScanHelpers = require("./src/binding-scan-helpers");
const bindingRuntime = require("./src/binding-runtime");
const dataBinderFactory = require("./src/data-binder");
const runtimeHelpers = require("../utils/src/runtime-helpers");
const debugConfig = require("../utils/src/debug-config");
const attrValueHandlers = require("../utils/src/attr-value-handlers");
const valueBindingHelpers = require("../utils/src/value-binding-helpers");
const typeConverters = require("../utils/src/type-converters");
const foreachTemplateHelpers = require("../utils/src/foreach-template-helpers");
const foreachReconcileHelpers = require("../utils/src/foreach-reconcile-helpers");

const stitchDebugState = debugConfig.createDebugState(`v${VERSION}`);
const stitchDebug = {
    ...stitchDebugState,
    log() {},
    group() {},
    groupEnd() {}
};

const typeConverterRegistry = typeConverters.createTypeConverters({ version: VERSION });
function getTypeConverter(element, value) {
    return typeConverters.getTypeConverter(element, value, typeConverterRegistry);
}

const valueValidatorRegistry = valueBindingHelpers.createValueValidators({
    getTypeConverter,
    setProperty: runtimeHelpers.setProperty,
    doc: typeof document !== "undefined" ? document : null
});
function getValueValidator(element) {
    return valueBindingHelpers.getValueValidator(element, valueValidatorRegistry);
}

const valueHandlerRegistry = valueBindingHelpers.createValueHandlers({
    getTypeConverter,
    resolveValueValidator: getValueValidator
});
function getValueHandler(element) {
    return valueBindingHelpers.getValueHandler(element, valueHandlerRegistry);
}

const renderingDelegateBundle = foreachRenderingDelegates.createRenderingDelegates({
    stitchDebug,
    getProperty: runtimeHelpers.getProperty,
    getValueValidator,
    createItemContext: foreachReconcileHelpers.createItemContext,
    createTemplateElement: foreachTemplateHelpers.createTemplateElement,
    reconcileRows: foreachReconcileHelpers.reconcileRows,
    doc: typeof document !== "undefined" ? document : null
});
const foreachDelegates = renderingDelegateBundle.FOREACH_RENDERING_DELEGATES;

function resolveExternalForeachIntegration() {
    return {
        bindForeach: foreachBindingOrchestrator.bindForeach,
        getRenderingDelegate: foreachRenderingDelegates.getRenderingDelegate,
        delegates: foreachDelegates
    };
}

const runtimeBinding = bindingRuntime.createBindingRuntime({
    version: VERSION,
    debug: stitchDebug,
    getProperty: runtimeHelpers.getProperty,
    setProperty: runtimeHelpers.setProperty,
    getValueHandler,
    getValueValidator,
    getTypeConverter,
    getAttrHandler: attrValueHandlers.getAttrHandler,
    getRenderingDelegate(element) {
        return foreachRenderingDelegates.getRenderingDelegate(element, foreachDelegates);
    },
    propertyExists: runtimeHelpers.propertyExists,
    findSimilarProperty: runtimeHelpers.findSimilarProperty,
    resolveExternalForeachIntegration
});

const DataBinder = dataBinderFactory.createDataBinderClass({
    version: VERSION,
    debug: stitchDebug,
    getProperty: runtimeHelpers.getProperty,
    getBindingHandler: runtimeBinding.getBindingHandler,
    scanCustomAttributes: runtimeBinding.scanCustomAttributes,
    bindingHandlers: runtimeBinding.BINDING_HANDLERS
});

module.exports = {
    DataBinder,
    version: VERSION,
    ...foreachRenderingDelegates,
    ...foreachBindingOrchestrator,
    ...bindingScanHelpers,
    ...bindingRuntime,
    ...dataBinderFactory
};
