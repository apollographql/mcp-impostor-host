export declare namespace Logger {
  export interface Options {
    level?: keyof typeof LEVEL | undefined;
  }
}

const LEVEL = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

const PREFIX = "[@apollo/mcp-impostor-host]";

export declare namespace Logger {
  export type Level = keyof typeof LEVEL;
}

export class Logger {
  #level: number;

  constructor(options?: Logger.Options) {
    this.#level = LEVEL[options?.level ?? "info"];
  }

  debug(...data: unknown[]) {
    if (this.#level <= LEVEL.debug) {
      console.debug(PREFIX, ...data);
    }
  }

  info(...data: unknown[]) {
    if (this.#level <= LEVEL.info) {
      console.log(PREFIX, ...data);
    }
  }

  warn(...data: unknown[]) {
    if (this.#level <= LEVEL.warn) {
      console.warn(PREFIX, ...data);
    }
  }

  error(...data: unknown[]) {
    if (this.#level <= LEVEL.error) {
      console.error(PREFIX, ...data);
    }
  }
}
