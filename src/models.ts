import { ServerOptions } from "http-proxy";
import { IncomingMessage, ServerResponse } from "http";

export type Transformer = (req: IncomingMessage, res: ServerResponse, options?: ServerOptions) => Promise<boolean>;

export type Header = string | undefined;

// ---------------------------
// Route
// ---------------------------
export type CustomRoute = (req: IncomingMessage) => boolean;
export type StringRoute = {
    path: string;
    exact?: boolean;
};
export type Route = string | StringRoute | RegExp | CustomRoute;
// ---------------------------
// Target
// ---------------------------
export type RegExpTarget = (req: IncomingMessage, matcher?: RegExpExecArray | null) => string;
// export type CustomTarget = (req: IncomingMessage) => string;
export type Target = string | RegExpTarget /* | CustomTarget */;
// ---------------------------

export interface Rule {
    label: string;
    route: Route;
    target: Target;
    serverOptions?: ServerOptions;
    transformers?: Transformer[];
    replaceHostHeader?: boolean;
    priority?: number;
}

export enum TransformerStatus {
    Fail = 0,
    Success = 1,
}

export type TransformerExecutionTrace = {
    order: number,
    start: Date;
    end: Date;
    duration: number;
    status: TransformerStatus;
};

export interface TimeTraceStore {
    save: (id: string, timestamp: number) => Promise<void>;
    get: (id: string) => Promise<number>;
}

// export enum ExecutionStatus {
//     TransformerDone,
//     ProcessDone,
// }