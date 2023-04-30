import { v4 as uuidv4 } from "uuid";
import { Rule, StringRoute, Route, Header, Target } from "./models";
import { IncomingMessage, ServerResponse } from "http";
import { APPLICATION_JSON, DEFAULT_SERVER_OPTIONS, PROXY_REQUEST_ID_HEADER } from "./constants";
import { ProxyTarget, ServerOptions } from "http-proxy";
import { logger } from "./logger";

export const uuid = () => uuidv4();

export const decodeB64 = (str: string): string => Buffer.from(str, 'base64').toString('binary');
export const encodeB64 = (str: string): string => Buffer.from(str, 'binary').toString('base64');

export const tryBuildURL = (url: string): URL | undefined => {
    try {
        return new URL(url);
    } catch(e) {
        logger.error(e);
        return undefined;        
    }
}


export const writeResponse = (res: ServerResponse, statsCode: number, payload: any) => {
    res.writeHead(statsCode, APPLICATION_JSON);
    res.write(JSON.stringify(payload));
    res.end();
};

export const getOrCreateTrace = (req: IncomingMessage): string => {
    let traceId = req.headers[PROXY_REQUEST_ID_HEADER];
    
    if (traceId) {
        return traceId.toString();
    }

    // Add request id - for trace purposes
    traceId = uuid();
    req.headers[PROXY_REQUEST_ID_HEADER] = traceId;
    return traceId;
}

export const firstDefined = (...values: any): any => values.find((v: any) => v !== undefined);

export const equalsIgnoreCase = (str1?: string, str2?: string): boolean => str1?.toLowerCase() === str2?.toLowerCase();

export const isEmpty = (arr: any[]): boolean => Array.isArray(arr) && arr.length == 0;

export const isNullOrWhiteSpace = (str?: string): boolean => str?.trim().length === 0;

export const headerExistsWithValue = (req: IncomingMessage, headerName: string, headerValue: Header): boolean =>
    equalsIgnoreCase(getHeader(req, headerName), headerValue);

export const headerExists = (req: IncomingMessage, headerName: string): boolean =>
    Object.keys(req.headers).some((h) => equalsIgnoreCase(h, headerName));

export const getHeader = (req: IncomingMessage, headerName: string): Header => {
    const found = Object.keys(req.headers).find((h) => equalsIgnoreCase(h, headerName));
    if (found) {
        return req.headers[found]?.toString();
    }
    return undefined;
};

export const removeHeader = (req: IncomingMessage, headerName: string) => {
    req.headers = Object.keys(req.headers).reduce((prev, curr) => {
        if (equalsIgnoreCase(curr, headerName)) {
            return { ...prev };
        } else {
            return { ...prev, [curr]: req.headers[curr] };
        }
    }, {});
};

export const replaceHeader = (req: IncomingMessage, headerName: string, headerValue: Header) => {
    let initialvalue: any = {};

    if (!isNullOrWhiteSpace(headerValue)) {
        initialvalue[headerName] = headerValue;
    }

    req.headers = Object.keys(req.headers).reduce((prev, curr) => {
        if (equalsIgnoreCase(curr, headerName)) {
            return { ...prev };
        } else {
            return { ...prev, [curr]: req.headers[curr] };
        }
    }, initialvalue);
};

export const findRule = (req: IncomingMessage, rules: Rule[]): Rule | undefined => {
    let ordered_rules = rules.sort(
        (a, b) => firstDefined(a.priority, Number.MAX_SAFE_INTEGER) - firstDefined(b.priority, Number.MAX_SAFE_INTEGER)
    );

    const url = req.url!;

    for (let rule of ordered_rules) {
        const route: Route = rule.route;

        if (
            (typeof route === "string" && url.startsWith(route)) ||
            (route instanceof RegExp && route.test(url)) ||
            (route instanceof Function && route(req))
        ) {
            return rule;
        } else if (typeof route === "object") {
            const stringRoute = route as StringRoute;
            if (
                (stringRoute.exact && equalsIgnoreCase(url, stringRoute.path)) ||
                (!stringRoute.exact && url.startsWith(stringRoute.path))
            ) {
                return rule;
            }
        }
    }

    return undefined;

};

export const buildServerOptions = (req: IncomingMessage, rule: Rule): ServerOptions => {
    const target: Target = rule.target;

    let proxyTarget: ProxyTarget = '';

    if (typeof target === "string") {
        proxyTarget = target;
    } else if (target instanceof Function) {
        const matcher = rule.route instanceof RegExp ? rule.route.exec(req.url!) : null;
        proxyTarget = target(req, matcher);
    }

    return { ...DEFAULT_SERVER_OPTIONS, ...rule.serverOptions, target: proxyTarget };

    // if (options.target instanceof Function) {
    //     const matcher = rule.route instanceof RegExp ? rule.route.exec(url) : null;

    //     logger.info({
    //         resource: "proxy.target",
    //         type: "function",
    //         status: "executing",
    //         parameters: { matcher: matcher, route: rule.route, url: url },
    //     });
    //     const target = options.target(rule.route, url, matcher);
    //     options = { ...options, target };
    // }
};
