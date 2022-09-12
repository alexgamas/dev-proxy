import { TimeTraceStore } from "./models";

export class SimpleStore implements TimeTraceStore {
    private traceMap: { [name: string]: number } = {};

    save(id: string, timestamp: number) {
        this.traceMap[id] = timestamp;
    }

    get(id: string) {
        return this.traceMap[id];
    }
}
