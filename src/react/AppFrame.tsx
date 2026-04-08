import { use, useImperativeHandle, useState, type RefObject } from "react";
import type { Host } from "../core/index.js";

export declare namespace AppFrame {
  export interface Props {
    autoConnect?: Host.ConnectOptions;
    host: Host;
    ref?: RefObject<AppFrame.RefBehavior>;
  }

  export interface RefBehavior {
    connect: (options: Host.ConnectOptions) => Promise<void>;
  }
}

export function AppFrame({ autoConnect, host, ref }: AppFrame.Props) {
  const [connectPromise, setConnectPromise] = useState(() => {
    if (autoConnect) {
      return host.connect(autoConnect);
    }

    return null;
  });

  const connection = connectPromise ? use(connectPromise) : null;

  useImperativeHandle(
    ref,
    () => ({
      connect: async (options) => {
        setConnectPromise(host.connect(options));
      },
    }),
    [host],
  );

  return null;
}
