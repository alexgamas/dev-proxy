# Dev Proxy

[![Node.js build CI](https://github.com/alexgamas/dev-proxy/actions/workflows/node.build.yaml/badge.svg)](https://github.com/alexgamas/dev-proxy/actions/workflows/node.build.yaml) 


### Installation
```shell
$ npm install --save @gamas/dev-proxy
```

### Basic example
```js
import { Proxy } from "@gamas/dev-proxy";

const rules = [
    {
        label: "exemple",
        route: "/",
        target: "https://example.com",
        replaceHostHeader: true
    }
];

const proxy = Proxy
    .createProxy(8081)
    .useRules(rules)
    .build();

proxy.start();
```



### Rule properties


| Name               | Required | Type           | Description           |
|---                 | ---      |---             |---                    |
| label              | X        | string         |                       |
| route              | X        | Route          |                       |
| target             | X        | Target         |                       |
| transformers       |          | Transformer[]  |                       |
| replaceHostHeader  |          | boolean        |                       |
| priority           |          | number         |                       |
| serverOptions      |          | ServerOptions  | [See](#serveroptions) |


#### ServerOptions
This code is based on [node-http-proxy](https://github.com/http-party/node-http-proxy), a programmable proxying library.


ServerOptions
* [typescript](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/9e2e5af93f9cc2cf434a96e3249a573100e87351/types/http-proxy/index.d.ts#L137)
* [javascript](https://github.com/http-party/node-http-proxy/blob/9b96cd725127a024dabebec6c7ea8c807272223d/lib/http-proxy.js#L21)


### Build locally

```shell
$ npm install
$ npm run build
```

