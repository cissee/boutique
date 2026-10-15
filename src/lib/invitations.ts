/** "K7MP2XQ9" -> "K7MP-2XQ9" (plus facile à dicter ou recopier). */
export function displayCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
