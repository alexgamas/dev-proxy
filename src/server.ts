import http, { IncomingMessage, ServerResponse, RequestListener } from "http";

interface ServerConfig {
    label?: string;
    route: string | RegExp;
    method: string;
    priority?: number;
    handle?: (req: IncomingMessage, res: ServerResponse) => void;
}

export class _H {
    private configs: ServerConfig[] = [];
    private method: string = "";
    private route: string | RegExp = "";

    public on(method: string, route: string | RegExp): _H {
        this.method = method;
        this.route = route;
        return this;
    }

    public handle(hndl?: (req: IncomingMessage, res: ServerResponse) => void) {
        this.configs.push({
            method: this.method,
            route: this.route,
            priority: this.configs.length,
            handle: hndl,
        });
    }
}

const resolveRequest = (): Promise<string> => {
    return Promise.resolve("");
};

export const createServer = (port: number) => {
    // let configs: ServerConfig[] = [];

    let hndl = new _H();

    http.createServer((req: IncomingMessage, res: ServerResponse) => {
        const origin = req.headers["origin"];
        const requestMethod = req.headers["access-control-request-method"];
        const requestHeaders = req.headers["access-control-request-headers"];

        res.setHeader("Access-Control-Allow-Origin", origin || "*");
        res.setHeader("Access-Control-Allow-Methods", requestMethod || "*");
        res.setHeader("Access-Control-Allow-Headers", requestHeaders || "*");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        // res.setHeader('Content-Type', 'application/json');

        res.writeHead(200, { "Content-Type": "text/plain" });

        // if (req.method != "OPTIONS") {
        //     res.statusCode = 404;
        // } else {
        //     res.statusCode = 200;
        // }

        // let response = {
        //     method: req.method,
        //     url: req.url,
        //     headers: req.headers,
        // };

        let response = {
            id: "user_id",
            nome: "user",
            login: "user_login",
            email: "user@mail.com",
            autenticado: true,
            token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
            permissoes: [""],
        };

        res.write(JSON.stringify(response));

        res.end();
    }).listen(port);
    console.log(`Uepa!! Server listening on port ${port}`);
    return hndl;
};
