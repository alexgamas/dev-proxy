# Dev Proxy


| Property      | Type |
|---            |---|
| label         | string
| route         | string, RegExp
| serverOptions | Linked to [node-http-proxy](https://github.com/http-party/node-http-proxy) server options ([ts](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/9e2e5af93f9cc2cf434a96e3249a573100e87351/types/http-proxy/index.d.ts#L137), [js](https://github.com/http-party/node-http-proxy/blob/9b96cd725127a024dabebec6c7ea8c807272223d/lib/http-proxy.js#L21))
| transformers  | export type Transformer = (req: IncomingMessage, res: ServerResponse, options?: ServerOptions) => Promise<boolean>;
| priority      | number

### Installing lib
```js
import * from '@gamas@dev-proxy';
```

### Define a target list

```js

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
```
#### Run

```shell
$ yarn install
$ yarn dev
```

