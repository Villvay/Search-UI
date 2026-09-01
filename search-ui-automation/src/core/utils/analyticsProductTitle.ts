/**
 * Analytics SERP relevance — product title must reflect the searched query.
 */

/** Normalize for case-insensitive comparison. */
export function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns true when the product title contains the searched query.
 * Multi-word queries: every whitespace-separated word (length >= 2) must appear.
 * Single-token queries: case-insensitive substring match.
 */
export function productTitleMatchesQuery(
  title: string,
  query: string,
): boolean {
  const normalizedTitle = normalizeForMatch(title);
  const normalizedQuery = normalizeForMatch(query);
  if (!normalizedQuery) return false;

  if (normalizedTitle.includes(normalizedQuery)) {
    return true;
  }

  const words = normalizedQuery
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  if (words.length <= 1) {
    return normalizedTitle.includes(normalizedQuery);
  }

  return words.every((word) => normalizedTitle.includes(word));
}
