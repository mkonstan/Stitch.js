"use strict";

const { VERSION } = require("../utils/src/version");
const foreachBindingOrchestrator = require("./src/foreach-binding-orchestrator");
const bindingScanHelpers = require("./src/binding-scan-helpers");
const bindingRuntime = require("./src/binding-runtime");
const dataBinderFactory = require("./src/data-binder");
const runtimeHelpers = require("../utils/src/runtime-helpers");
const debugConfig = require("../utils/src/debug-config");
const attrValueHandlers = require("../utils/src/attr-value-handlers");
const valueBindingHelpers = require("../utils/src/value-binding-helpers");
const typeConverters = require("../utils/src/type-converters");
const foreachKeys = require("../utils/src/foreach-keys");
const foreachRowContext = require("../utils/src/foreach-row-context");
const errorHook = require("../utils/src/error-hook");

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

const runtimeBinding = bindingRuntime.createBindingRuntime({
    version: VERSION,
    debug: stitchDebug,
    getProperty: runtimeHelpers.getProperty,
    setProperty: runtimeHelpers.setProperty,
    getValueHandler,
    getValueValidator,
    getTypeConverter,
    getAttrHandler: attrValueHandlers.getAttrHandler,
    propertyExists: runtimeHelpers.propertyExists,
    findSimilarProperty: runtimeHelpers.findSimilarProperty,
    bindForeach(element, viewModel, path, context, validateBinding) {
        return foreachBindingOrchestrator.bindForeach(element, viewModel, path, context, {
            validateBinding,
            getProperty: runtimeHelpers.getProperty,
            getValueValidator,
            createItemContext: foreachRowContext.createItemContext,
            resolveRowKeys: foreachKeys.resolveRowKeys,
            runAllThenThrow: errorHook.runAllThenThrow,
            reportError: errorHook.reportError,
            version: `v${VERSION}`,
            doc: typeof document !== "undefined" ? document : null
        });
    }
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
    ...foreachBindingOrchestrator,
    ...bindingScanHelpers,
    ...bindingRuntime,
    ...dataBinderFactory
};
