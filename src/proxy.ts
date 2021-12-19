import httpProxy, { ProxyTargetUrl, ServerOptions } from "http-proxy";
import http, {IncomingMessage, ServerResponse} from "http";
import { Target } from "./models";
import { Transformer } from "./models";

let scores: { [name: string]: number } = {};

const checkTime = (req: IncomingMessage) => {
    const rId = req.headers['x-request-id'];
    if (rId) {
        const id = rId.toString();
        const t = scores[id];
        // const now = Date.now();
        const now = new Date().getTime();
        if(t) {
            return now - t;
        } else {
            scores[id] = now;
        }
    }
}

const errorHandler = (err: Error, req: IncomingMessage, res: ServerResponse, target?: ProxyTargetUrl) => {
    console.log(`<<< ERROR: [${req.method}] ${req.url} - ${err.message}`);
    // 502 - Bad Gateway
    res.writeHead(502, { "Content-Type": "application/json" });
    res.write(
        JSON.stringify({
            message: err.message,
            stack: err.stack,
            error: err,
            target: target,
            method: req.method,
            url: req.url,
        })
    );
    res.end();
};

const handleReq = (
    proxyReq: http.ClientRequest,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    options: ServerOptions
) => {
    checkTime(req);
    console.log(`>>> [${req.method}] ${req.url}`);
};

const handleRes = (pRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
    console.log(`<<< [${req.method}] ${req.url} - ${pRes.statusCode} ${pRes.statusMessage} -- ${checkTime(req)} ms`);
};

const applyTransformers = (req: IncomingMessage, res: ServerResponse, options?: ServerOptions, transformers?: Transformer[]): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
        if (!transformers || transformers.length == 0) {
            resolve(true);
        } else {
            const transformersExecution = transformers.map((t) => t(req, res, options));
            Promise.allSettled<boolean>(transformersExecution).then((tx) => resolve(tx.every((t) => t)));
        }
    });
};

export const runProxy = (port: number, targets: Target[]) => {

    console.table(
        targets.sort((t) => t.priority).map((t) => {
            return {
                label: t.label,
                route: t.route,
                terget: t.serverOptions.target,
                priority: t.priority,
                transformers: t.transformers?.length,
            };
        })
    );

    var proxy = httpProxy.createProxyServer();

    proxy.on("proxyReq", handleReq);
    proxy.on("proxyRes", handleRes);

    const DEFAULT_OPTIONS = {
        ws: true,
        secure: false,
    };

    const sortedTargets = targets.sort((t) => t.priority);

    http.createServer((req, res) => {
        const url = req.url!;

        let config = sortedTargets.find((t) => {
            if (t.route instanceof RegExp) {
                return t.route.test(url);
            }
            return url?.toLowerCase()?.startsWith(t.route);
        });

        // let options: ServerOptions = {};

        if (!config) {
            res.writeHead(502, { "Content-Type": "application/json" });

            let response = JSON.stringify({
                code: 502,
                url: url,
                message: `No rule found for url ${url}`,
            });

            res.write(response);
            res.end();

            console.log(`Config not found: ${response}`);

            return;
        }

        console.log(`Config found: ${config.label}`);

        let options = config.serverOptions;

        if (options.target instanceof Function) {
            const matcher = config.route instanceof RegExp ? config.route.exec(url) : null;

            console.log(`Target is a function, executing with values [ route: "${config.route}", url: "${url}", matcher: "${matcher}" ]`);

            const target = options.target(config.route, url, matcher);
            options = { ...options, target };
        }

        applyTransformers(req, res, options, config.transformers).then((resp) => {
            proxy.web(req, res, { ...DEFAULT_OPTIONS, ...options }, errorHandler);
        }).catch((err) => {
            console.log(err);
        });
    }).listen(port);

    console.log(`Uepa!! Proxy listening on port ${port}`);
};
