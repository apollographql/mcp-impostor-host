export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`[@apollo/mcp-impostor-host] ${message}`);
  }
}
