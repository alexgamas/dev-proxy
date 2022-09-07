import { ServerOptions } from "http-proxy";
import { IncomingMessage, ServerResponse } from "http";


export type Transformer = (req: IncomingMessage, res: ServerResponse, options?: ServerOptions) => Promise<boolean>;
export type Route = string | RegExp

export interface Target {
    label: string
    route: Route
    serverOptions?: ServerOptions,
    transformers?: Transformer[]
    replaceHostHeader?: boolean,
    priority: number
}
