import { Proxy, ProxyEvent } from "./proxy";
import {
    Route,
    CustomRoute,
    StringRoute,
    Rule,
    Transformer,
    Header,
    RegExpTarget,
    Target,
    TransformerStatus,
    TransformerExecution,
    TimeTraceStore,
} from "./models";
import { createHostTransformerTo, requestIdTransformer } from "./transformers";

import {
    uuid,
    writeResponse,
    getOrCreateTrace,
    firstDefined,
    equalsIgnoreCase,
    isEmpty,
    isNullOrWhiteSpace,
    headerExistsWithValue,
    headerExists,
    getHeader,
    removeHeader,
    replaceHeader,
    findRule,
    buildServerOptions,
} from "./utils";

export {
    Proxy,
    ProxyEvent,
    // Models
    Route,
    CustomRoute,
    StringRoute,
    RegExpTarget,
    Target,
    Rule,
    TransformerStatus,
    TransformerExecution,
    Transformer,
    TimeTraceStore,
    Header,
    // Transformer
    requestIdTransformer,
    createHostTransformerTo,
    // Utils
    uuid,
    writeResponse,
    getOrCreateTrace,
    firstDefined,
    equalsIgnoreCase,
    isEmpty,
    isNullOrWhiteSpace,
    headerExistsWithValue,
    headerExists,
    getHeader,
    removeHeader,
    replaceHeader,
};
