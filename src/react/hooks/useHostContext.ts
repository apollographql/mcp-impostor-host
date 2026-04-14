import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useCallback, useState } from "react";

import type { RemoveIndexSignature } from "../../utilities/index.js";

/**
 * The subset of {@link McpUiHostContext} that can be configured by the user.
 * `platform`, `userAgent`, and `toolInfo` are controlled by the host and
 * cannot be overridden.
 */
export type SandboxHostContext = Omit<
  RemoveIndexSignature<McpUiHostContext>,
  "userAgent" | "toolInfo"
> & { [key: string]: unknown };

function getDefaults(): SandboxHostContext {
  return {
    theme:
      window.matchMedia("(prefers-color-scheme: dark)").matches ?
        "dark"
      : "light",
    locale: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: "web",
  };
}

/**
 * Convenience hook that provides a host context value with sensible browser
 * defaults and a shallow-merge setter.
 *
 * @param hostContext - Optional partial context merged on top of defaults
 * @returns A `[hostContext, setHostContext]` tuple where `setHostContext`
 *   shallow-merges the provided values into the current state.
 *
 * @example
 * ```tsx
 * const [hostContext, setHostContext] = useHostContext({ theme: "dark" });
 *
 * // Later — shallow-merges, only updates theme
 * setHostContext({ theme: "light" });
 * ```
 *
 * @defaultValue
 * - `theme` - `prefers-color-scheme` media query
 * - `locale` - `navigator.language`
 * - `timeZone` - `Intl.DateTimeFormat`
 * - `platform` - "web"
 */
export function useHostContext(
  hostContext?: Partial<SandboxHostContext>,
): [
  hostContext: SandboxHostContext,
  setHostContext: (update: Partial<SandboxHostContext>) => void,
] {
  const [sandboxHostContext, setSandboxHostContextState] =
    useState<SandboxHostContext>(() => ({
      ...getDefaults(),
      ...hostContext,
    }));

  const setHostContext = useCallback((update: Partial<SandboxHostContext>) => {
    setSandboxHostContextState((prev) => ({ ...prev, ...update }));
  }, []);

  return [sandboxHostContext, setHostContext];
}
