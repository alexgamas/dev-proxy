import { ServerOptions } from "http-proxy";
import { IncomingMessage, ServerResponse } from "http";
import { replaceHeader, uuid } from "./utils";
import { HOST_HEADER_NAME, REQUEST_ID_HEADER } from "./constants";

export const createHostTransformerTo =
    (host: string) =>
    (req: IncomingMessage, res: ServerResponse, options?: ServerOptions): Promise<boolean> =>
        new Promise((resolve, reject) => {
            replaceHeader(req, HOST_HEADER_NAME, host);
            resolve(true);
        });

export const requestIdTransformer = (
    req: IncomingMessage,
    res: ServerResponse,
    options?: ServerOptions
): Promise<boolean> =>
    new Promise((resolve, reject) => {
        replaceHeader(req, REQUEST_ID_HEADER, uuid());
        resolve(true);
    });
