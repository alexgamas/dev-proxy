import { TimeTraceStore } from "./models";

export class SimpleStore implements TimeTraceStore {

    private traceMap: { [name: string]: number } = {};

    async save(id: string, timestamp: number): Promise<void>{
        this.traceMap[id] = timestamp;
        return Promise.resolve();
    }

    async get(id: string):Promise<number> {
        return Promise.resolve(this.traceMap[id]);
    }
}
