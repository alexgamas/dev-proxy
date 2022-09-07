import { ServerOptions } from "http-proxy";
import { IncomingMessage, ServerResponse } from "http";
import { uuid } from "./utils";


export const createHostTransformerTo = (host: string) => 
    (req: IncomingMessage, res: ServerResponse, options?: ServerOptions): Promise<boolean> => 
        new Promise((resolve, reject) => {
            req.headers["host"] = host;
            resolve(true);
        });

export const requuestIdTransformer = (req: IncomingMessage, res: ServerResponse, options?: ServerOptions): Promise<boolean> => 
    new Promise((resolve, reject) => {
        req.headers["x-request-id"] = uuid();
        resolve(true);
    });
