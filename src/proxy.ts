import httpProxy, { ProxyTargetUrl, ServerOptions } from "http-proxy";
import http, { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";
import { Target } from "./models";
import { Transformer } from "./models";
import { logger } from "./logger";
import { EventEmitter } from "node:events";
import { uuid } from "./utils";
import { PROXY_REQUEST_ID_HEADER } from "./constants";

let traceMap: { [name: string]: number } = {};

const checkTime = (traceId: string | undefined) => {
    if (traceId) {
        const t = traceMap[traceId];
        const now = new Date().getTime();
        if (t) {
            return now - t;
        } else {
            traceMap[traceId] = now;
        }
    }
};

const applyTransformers = (
    req: IncomingMessage, res: ServerResponse,
    options?: ServerOptions, transformers?: Transformer[]
): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
        if (!transformers || transformers.length == 0) {
            resolve(true);
        } else {
            const transformersExecution = transformers.map((t) => t(req, res, options));
            Promise.allSettled<boolean>(transformersExecution).then((tx) => resolve(tx.every((t) => t)));
        }
    });
};


export type Event = {
    name: string;
}

export class ProxyEvent extends EventEmitter {
    public static EVENT_PROXY_STARTED = "proxy:started";
    public static EVENT_PROXY_REQUEST = "proxy:request";
    public static EVENT_PROXY_RESPONSE = "proxy:response";
    public static EVENT_PROXY_DATA = "proxy:data";
    public static EVENT_PROXY_ERROR = "proxy:error";
}

export class ProxyBuilder {
    private port: number;

    private routeProvider?: () => Target[];

    constructor(port: number) {
        this.port = port;
    }

    useRouteProvider(routeFn: () => Target[]): ProxyBuilder {
        this.routeProvider = routeFn;
        return this;
    }

    useRoutes(routes: Target[]): ProxyBuilder {
        this.routeProvider = () => routes;
        return this;
    }

    build(): Proxy {
        let proxy: Proxy = new Proxy(this.port);

        if (!this.routeProvider) {
            throw new Error("Neither routes array nor routeProvider was defined");
        }

        proxy.setRouteProvider(this.routeProvider);

        return proxy;
    }
}

export class Proxy extends ProxyEvent {

    private port: number;
    private routeProvider?: () => Target[];

    private DEFAULT_OPTIONS = {
        ws: true,
        secure: false,
    };

    public setRouteProvider(routeFn: () => Target[]) {
        this.routeProvider = routeFn;
    }

    public static createProxy(port: number): ProxyBuilder {
        return new ProxyBuilder(port);
    }

    private sendEvent(eventName: string, payload: any) {
        this.emit(eventName, payload);
    }

    constructor(port: number) {
        super();
        this.port = port;
    }

    private hndlRequest(
        proxyReq: http.ClientRequest, req: http.IncomingMessage, 
        res: http.ServerResponse, options: ServerOptions) 
    {
        // Add request id - for trace purposes
        const traceId = uuid();
        req.headers[PROXY_REQUEST_ID_HEADER] = traceId;

        checkTime(traceId);

        const request = {
            action: 'request',
            method: req.method,
            traceId: traceId,
            url: req.url,
            protocol: proxyReq.protocol,
            host: proxyReq.host,
            path: proxyReq.path,
            uri: `${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`,
            headers: proxyReq.getHeaders()
        };
        logger.info(request);
        this.sendEvent(Proxy.EVENT_PROXY_REQUEST, request);
    }

    private hndlResponse(proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) {

        const traceId = req.headers[PROXY_REQUEST_ID_HEADER];

        const response = {
            action: 'response',
            method: req.method,
            traceId: traceId,
            url: req.url,
            time: checkTime(traceId?.toString()),
            status: {
                code: proxyRes.statusCode,
                message: proxyRes.statusMessage
            },
            headers: proxyRes.headers
        };

        logger.info(response);

        this.sendEvent(Proxy.EVENT_PROXY_RESPONSE, response);

        const sendEvent = this.sendEvent.bind(this);

        proxyRes.on('data', function (dataBuffer) {
            sendEvent(Proxy.EVENT_PROXY_DATA, {
                traceId: traceId,
                data: Uint8Array.from(dataBuffer),
                length: dataBuffer?.length
            });
        });
    }


    private hndlError(err: Error, req: IncomingMessage, res: ServerResponse | Socket, target?: ProxyTargetUrl) {

        const traceId = req.headers[PROXY_REQUEST_ID_HEADER];

        const payload = {
            action: 'proxy:error',
            method: req.method,
            traceId: traceId,
            message: err.message,
            stack: err.stack,
            error: err,
            target: target,
            url: req.url,
            time: checkTime(traceId?.toString())
        };

        logger.error(payload);

        this.sendEvent(Proxy.EVENT_PROXY_ERROR, payload);

        if (res instanceof ServerResponse) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.write(JSON.stringify(payload));
        }

        res.end();
    };

    public start() {
        var proxy = httpProxy.createProxy();

        proxy.on("proxyReq", this.hndlRequest.bind(this));
        proxy.on("proxyRes", this.hndlResponse.bind(this));

        http.createServer((req, res) => {
            const url = req.url!;

            const targets = this.routeProvider!().sort((t) => t.priority);

            let config = targets.find((t) => {
                if (t.route instanceof RegExp) {
                    return t.route.test(url);
                }
                return url?.toLowerCase()?.startsWith(t.route);
            });

            if (!config) {
                res.writeHead(502, { "Content-Type": "application/json" });

                const response = {
                    action: 'proxy:rule_not_found',
                    resource: "routeProvider",
                    url: url,
                    method: req.method,
                    status: {
                        code: 502,
                        message: `No rule found for url ${url}`,
                    },
                    headers: req.headers
                };

                res.write(JSON.stringify(response));
                res.end();

                logger.info(response);
                this.sendEvent(Proxy.EVENT_PROXY_ERROR, response);

                return;
            }

            logger.info({ resource: "proxy.config", status: "found", config: config });

            let options = config.serverOptions;

            if (options.target instanceof Function) {
                const matcher = config.route instanceof RegExp ? config.route.exec(url) : null;

                logger.info({
                    resource: "proxy.target",
                    type: "function",
                    status: "executing",
                    parameters: { matcher: matcher, route: config.route, url: url },
                });

                const target = options.target(config.route, url, matcher);
                options = { ...options, target };
            }

            options = { ...options };

            if (config?.replaceHostHeader) {
                const targetUrl: URL = new URL(options.target);
                // TODO: move to utils:replaceHeader
                req.headers = Object.keys(req.headers).reduce((prev, curr) => {

                    if ('host' === curr?.toLowerCase()) {
                        return { ...prev };
                    } else {
                        return { ...prev, [curr]: req.headers[curr] };
                    }

                }, { ['host']: targetUrl.host });
                //
            }

            applyTransformers(req, res, options, config.transformers).then((resp) => {
                proxy.web(req, res, { ...this.DEFAULT_OPTIONS, ...options }, this.hndlError.bind(this));
            }).catch((err) => {
                logger.error(err);
            });
        }).listen(this.port);

        const startEvent = { resource: "proxy", status: "listening", port: this.port };
        this.sendEvent(Proxy.EVENT_PROXY_STARTED, startEvent);
        logger.info(startEvent);
    }
}
