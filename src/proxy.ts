import httpProxy, { ProxyTargetUrl, ServerOptions } from "http-proxy";
import http, { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";
import { ExecutionStatus, Rule, TimeTraceStore, TransformerStatus } from "./models";
import { Transformer, TransformerExecution } from "./models";
import { logger } from "./logger";
import { EventEmitter } from "node:events";
import { buildServerOptions, findRule, getOrCreateTrace, isEmpty, replaceHeader, writeResponse } from "./utils";
import { HOST_HEADER_NAME } from "./constants";
import { SimpleStore } from "./trace.store";
import Server from "http-proxy";

const applyTransformersSerial = (
    req: IncomingMessage,
    res: ServerResponse,
    options: ServerOptions | undefined,
    transformers: Transformer[],
    onStatus: (status: ExecutionStatus, te?: TransformerExecution) => void
) => {
    let transformer = transformers.shift();

    if (!transformer) {
        onStatus(ExecutionStatus.ProcessDone);
        // end of recursion
        return;
    }

    const startExecution = new Date();

    transformer(req, res, options).then((status) => {
        const endExecution = new Date();
        onStatus(ExecutionStatus.TransformerDone, {
            start: startExecution,
            end: endExecution,
            duration: endExecution.getTime() - startExecution.getTime(),
            status: status ? TransformerStatus.Success : TransformerStatus.Fail,
        });
        applyTransformersSerial(req, res, options, transformers, onStatus);
    });
};

const applyTransformers = (
    req: IncomingMessage,
    res: ServerResponse,
    options?: ServerOptions,
    transformers?: Transformer[]
): Promise<TransformerExecution[]> => {
    let execution: TransformerExecution[] = [];

    return new Promise<TransformerExecution[]>((resolve, reject) => {
        if (!transformers || transformers.length == 0) {
            resolve(execution);
        } else {
            applyTransformersSerial(req, res, options, transformers, (status, te) => {
                switch (status) {
                    case ExecutionStatus.ProcessDone:
                        resolve(execution);
                        break;
                    case ExecutionStatus.TransformerDone:
                        execution.push(te!);
                        break;
                }
            });
        }
    });
};

export class ProxyEvent extends EventEmitter {
    public static EVENT_PROXY_STARTED = "proxy:started";
    public static EVENT_PROXY_REQUEST = "proxy:request";
    public static EVENT_PROXY_RESPONSE = "proxy:response";
    public static EVENT_PROXY_DATA = "proxy:data";
    public static EVENT_PROXY_TRANSFORMER = "proxy:transformer";
    public static EVENT_PROXY_ERROR = "proxy:error";
}

export class ProxyBuilder {
    private port: number;

    private ruleProvider?: () => Promise<Rule[]>;

    private store?: TimeTraceStore;

    constructor(port: number) {
        this.port = port;
    }

    useStore(store: TimeTraceStore): ProxyBuilder {
        this.store = store;
        return this;
    }

    useRuleProvider(rn: () => Promise<Rule[]>): ProxyBuilder {
        this.ruleProvider = rn;
        return this;
    }

    useRules(rules: Rule[]): ProxyBuilder {
        this.ruleProvider = () => Promise.resolve(rules);
        return this;
    }

    build(): Proxy {
        let proxy: Proxy = new Proxy(this.port);

        if (!this.ruleProvider) {
            throw new Error("Neither routes array nor routeProvider was defined");
        }

        proxy.setRuleProvider(this.ruleProvider);

        if (this.store) {
            proxy.setStore(this.store);
        } else {
            proxy.setStore(new SimpleStore());
        }

        return proxy;
    }
}

export class Proxy extends ProxyEvent {
    private port: number;
    private ruleProvider?: () => Promise<Rule[]>;

    private store?: TimeTraceStore;

    private checkTime = async (traceId: string): Promise<number | undefined> => {
        if (this.store) {
            const ts = await this.store.get(traceId);
            const now = new Date().getTime();
            if (ts) {
                return now - ts;
            } else {
                await this.store.save(traceId, now);
            }
        }
    };

    public setStore(store: TimeTraceStore) {
        this.store = store;
    }

    public setRuleProvider(fn: () => Promise<Rule[]>) {
        this.ruleProvider = fn;
    }

    public static create(port: number): ProxyBuilder {
        return new ProxyBuilder(port);
    }

    private sendEvent(eventName: string, payload: any) {
        this.emit(eventName, { event: eventName, data: payload });
    }

    constructor(port: number) {
        super();
        this.port = port;
    }

    private async requestHandler(
        proxyReq: http.ClientRequest,
        req: IncomingMessage,
        res: ServerResponse,
        options: ServerOptions
    ) {
        // Add request id - for trace purposes
        const traceId = getOrCreateTrace(req);

        await this.checkTime(traceId);

        const request = {
            action: "request",
            method: req.method,
            traceId: traceId,
            url: req.url,
            protocol: proxyReq.protocol,
            host: proxyReq.host,
            path: proxyReq.path,
            uri: `${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`,
            headers: proxyReq.getHeaders(),
        };
        logger.info(request);
        this.sendEvent(Proxy.EVENT_PROXY_REQUEST, request);
    }

    private async responseHandler(proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) {
        const traceId = getOrCreateTrace(req);
        const time = await this.checkTime(traceId);

        const response = {
            action: "response",
            method: req.method,
            traceId: traceId,
            url: req.url,
            time: time,
            status: {
                code: proxyRes.statusCode,
                message: proxyRes.statusMessage,
            },
            headers: proxyRes.headers,
        };

        logger.info(response);

        this.sendEvent(Proxy.EVENT_PROXY_RESPONSE, response);

        const sendEvent = this.sendEvent.bind(this);

        proxyRes.on("data", function (data) {
            sendEvent(Proxy.EVENT_PROXY_DATA, {
                traceId: traceId,
                data: Uint8Array.from(data),
                length: data?.length,
            });
        });
    }

    private async errorHandler(err: Error, req: IncomingMessage, res: ServerResponse | Socket, target?: ProxyTargetUrl) {
        const traceId = getOrCreateTrace(req);

        const payload = {
            action: "proxy:error",
            method: req.method,
            traceId: traceId,
            message: err.message,
            stack: err.stack,
            error: err,
            target: target,
            url: req.url,
            time: await this.checkTime(traceId?.toString()),
        };

        logger.error(payload);

        this.sendEvent(Proxy.EVENT_PROXY_ERROR, payload);

        if (res instanceof ServerResponse) {
            writeResponse(res, 502, payload);
        }

        if (!res.closed) {
            res.end();
        }
    }

    private buildMainHandler(proxy: Server) {
        return async (req: IncomingMessage, res: ServerResponse) => {
            if (!this.ruleProvider) {
                throw new Error("RuleProvider must be set");
            }

            const rules = await this.ruleProvider();

            let rule = findRule(req, rules);
            const url = req.url!;
            // Rule not found
            if (!rule) {
                const response = {
                    action: "proxy:rule_not_found",
                    resource: "routeProvider",
                    url: url,
                    method: req.method,
                    status: {
                        code: 502,
                        message: `No rule found for url ${url}`,
                    },
                    headers: req.headers,
                };

                writeResponse(res, 502, response);

                logger.info(response);
                this.sendEvent(Proxy.EVENT_PROXY_ERROR, response);

                return;
            }

            logger.info({ resource: "proxy.config", status: "found", rule: rule });

            let serverOptions = buildServerOptions(req, rule);

            // options = { ...options };

            if (rule?.replaceHostHeader) {
                const targetUrl: URL = new URL(`${serverOptions!.target}`);
                replaceHeader(req, HOST_HEADER_NAME, targetUrl.host);
            }

            const te: TransformerExecution[] =  await applyTransformers(req, res, serverOptions, rule.transformers);

            if (!isEmpty(te)) {
                const traceId = getOrCreateTrace(req);
                this.sendEvent(ProxyEvent.EVENT_PROXY_TRANSFORMER, {
                    traceId: traceId,
                    trace: te,
                });
            }

            proxy.web(req, res, { ...serverOptions }, this.errorHandler.bind(this));

            // applyTransformers(req, res, serverOptions, rule.transformers)
            //     .then((resp) => {
            //         if (!isEmpty(resp)) {
            //             const traceId = getOrCreateTrace(req);
            //             this.sendEvent(ProxyEvent.EVENT_PROXY_TRANSFORMER, {
            //                 traceId: traceId,
            //                 trace: resp,
            //             });
            //         }
            //         proxy.web(req, res, { ...serverOptions }, this.errorHandler.bind(this));
            //     })
            //     .catch((err) => {
            //         logger.error(err);
            //     });
        };
    }

    public start() {
        var proxy = httpProxy.createProxy();

        proxy.on("proxyReq", this.requestHandler.bind(this));
        proxy.on("proxyRes", this.responseHandler.bind(this));
        const mainHandler = this.buildMainHandler(proxy);

        http.createServer(mainHandler).listen(this.port);

        const startEvent = { resource: "proxy", status: "listening", port: this.port };
        this.sendEvent(Proxy.EVENT_PROXY_STARTED, startEvent);
        logger.info(startEvent);
    }
}
