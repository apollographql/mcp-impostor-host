export function invariant(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[@apollo/mcp-impostor-host] ${message}`);
  }
}
