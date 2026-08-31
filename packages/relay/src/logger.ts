export type LogEvent = {
  level: "info" | "error";
  event: string;
  correlationId: string;
  code?: string;
  elapsedMs?: number;
};

export interface RelayLogger {
  write(event: LogEvent): void;
}

export const jsonLogger: RelayLogger = {
  write(event) {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  },
};
