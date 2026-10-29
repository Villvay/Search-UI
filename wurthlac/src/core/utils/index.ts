export function trimQuery(value: string): string {
  return value.trim();
}

export function isNonEmptyQuery(value: string): boolean {
  return trimQuery(value).length > 0;
}

export function queriesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
