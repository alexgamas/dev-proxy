import { ServerOptions } from "http-proxy";
import { IncomingMessage, ServerResponse } from "http";
import { v4 as uuidv4 } from 'uuid';

export const createHostHeaderTo = (host: string) =>
    (
        req: IncomingMessage,
        res: ServerResponse,
        options?: ServerOptions
    ): Promise<boolean> =>
        new Promise((resolve, reject) => {
            req.headers["host"] = host;
            resolve(true);
        });

export const bindAuthorizationHeader = (
    req: IncomingMessage,
    res: ServerResponse,
    options?: ServerOptions
): Promise<boolean> =>
    new Promise((resolve, reject) => {
        resolve(true);
    });

export const createRequestIdHeader = (
    req: IncomingMessage,
    res: ServerResponse,
    options?: ServerOptions
): Promise<boolean> =>
    new Promise((resolve, reject) => {
        req.headers["x-request-id"] = uuidv4();
        resolve(true);
    });
