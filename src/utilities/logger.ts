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

export declare namespace Logger {
  export type Level = keyof typeof LEVEL;
}

export class Logger {
  #level: number;

  constructor(options?: Logger.Options) {
    this.#level = LEVEL[options?.level ?? "info"];
  }

  debug(...data: any[]) {
    if (this.#level <= LEVEL.debug) {
      console.debug(...data);
    }
  }

  info(...data: any[]) {
    if (this.#level <= LEVEL.info) {
      console.log(...data);
    }
  }

  warn(...data: any[]) {
    if (this.#level <= LEVEL.warn) {
      console.warn(...data);
    }
  }

  error(...data: any[]) {
    if (this.#level <= LEVEL.error) {
      console.error(...data);
    }
  }
}
