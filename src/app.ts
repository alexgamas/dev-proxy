import { Route, Target } from "./models";
import { runProxy } from "./proxy";
import { createServer } from "./server";
import { createHostHeaderTo, createRequestIdHeader } from "./transformers";
import { logger } from './logger';

const PROXY_PORT = 8082;

const TARGETS: Target[] = [
    {
        label: "Authentication",
        route: "/api/v1/login",
        serverOptions: {
            target: "http://localhost:9999",
        },
        priority: 0,
        transformers: [createRequestIdHeader],
    },
    {
        label: "Api",
        route: new RegExp("^/api(.?)+", "i"),
        serverOptions: {
            target: (route: Route, url: string, matches?: RegExp) => {
                return "http://localhost:9008";
            },
        },
        priority: 1,
        transformers: [createRequestIdHeader, createHostHeaderTo("google.com")],
    },
    {
        label: "Frontend",
        route: new RegExp("^/(.?)+", "i"),
        serverOptions: {
            target: "http://localhost:4200",
        },
        priority: 2,
        transformers: [createRequestIdHeader],
    },
];

runProxy(PROXY_PORT, TARGETS);

// createServer(9999).on("POST", "").handle(() => {});
// createServer(9008);
