import { format, createLogger, transports } from "winston";

const LOG_LABEL = 'dev-proxy';
const LOG_LEVEL = 'info';

export const logger = createLogger({
    level: LOG_LEVEL,
    format: format.combine(
        format.label({ label: LOG_LABEL }),
        format.timestamp(),
        format.json()
    ),
    transports: [new transports.Console()],
});
