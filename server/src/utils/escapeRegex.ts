/** Neutralises regex metacharacters so a search box cannot break, or slow down, the query it feeds. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
