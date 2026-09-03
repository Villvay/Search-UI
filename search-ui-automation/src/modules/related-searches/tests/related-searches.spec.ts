import { test, expect } from '../../../core/fixtures';
import {
  expectEmptyRelatedSearchesState,
  expectRelatedSearchItemsHaveValidText,
  expectRelatedSearchesAbsentOnSerp,
  expectRelatedSearchesInteractable,
  expectRelatedSearchesVisible,
  expectSearchStateAfterRelatedClick,
} from '../assertions/relatedSearchesAssertions';
import { RELATED_SEARCHES_BEHAVIOR } from '../data/behavior';
import {
  expectedRelatedSearchesByQuery,
  relatedSearchesQueries,
} from '../data/queries';
import { RelatedSearchesPage } from '../pages/RelatedSearchesPage';

/**
 * RELATED SEARCHES — suggestions dropdown surface only.
 * Does not import on-type, suggestions, or on-enter modules.
 */
test.describe('Related Searches @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  test('REL-001 - Related Searches are displayed', async ({ page }) => {
    const related = new RelatedSearchesPage(page);
    await related.open();
    await related.openRelatedSearches(relatedSearchesQueries.withRelated.value);
    await expectRelatedSearchesVisible(related);
  });

  test('REL-002 - Related Search items contain valid text', async ({
    page,
  }) => {
    const related = new RelatedSearchesPage(page);
    await related.open();
    await related.openRelatedSearches(relatedSearchesQueries.withRelated.value);
    await expectRelatedSearchesVisible(related);
    await expectRelatedSearchItemsHaveValidText(related);
  });

  test('REL-003 - Related Search items are interactable', async ({ page }) => {
    const related = new RelatedSearchesPage(page);
    await related.open();
    await related.openRelatedSearches(relatedSearchesQueries.withRelated.value);
    await expectRelatedSearchesInteractable(related);
  });

  test('REL-004 - Related Search item count is valid', async ({ page }) => {
    const related = new RelatedSearchesPage(page);
    await related.open();
    await related.openRelatedSearches(relatedSearchesQueries.withRelated.value);
    await expectRelatedSearchesVisible(related);
    const count = await related.relatedSearches.getItemCount();
    expect(count).toBeGreaterThanOrEqual(
      RELATED_SEARCHES_BEHAVIOR.minItemCountWhenPresent,
    );
  });

  test('REL-005 - Expected Related Search is displayed', async ({ page }) => {
    const query = relatedSearchesQueries.withRelated.value;
    const expected = expectedRelatedSearchesByQuery[query] ?? [];
    expect(expected.length).toBeGreaterThan(0);

    const related = new RelatedSearchesPage(page);
    await related.open();
    await related.openRelatedSearches(query);

    const texts = await related.relatedSearches.getItemTexts();
    for (const label of expected) {
      expect(
        texts.some((t) => t.toLowerCase() === label.toLowerCase()),
        `Expected Related Search "${label}" in ${JSON.stringify(texts)}`,
      ).toBeTruthy();
    }

    if (relatedSearchesQueries.withRelated.expectedAttr) {
      await expect(
        related.relatedSearches.itemByAttribute(
          relatedSearchesQueries.withRelated.expectedAttr,
        ),
      ).toBeVisible();
    }
  });

  test('REL-006 - Clicking Related Search triggers search', async ({
    page,
  }) => {
    const related = new RelatedSearchesPage(page);
    await related.open();
    await related.openRelatedSearches(relatedSearchesQueries.withRelated.value);

    const targetText =
      relatedSearchesQueries.withRelated.expectedItemTexts?.[0] ?? 'hinge';
    const targetAttr = relatedSearchesQueries.withRelated.expectedAttr;

    await related.selectRelatedSearch(
      targetAttr ? { attr: targetAttr } : { text: targetText },
    );
    await related.waitForSearchLanding(targetText);
    await expect(
      page.getByRole('heading', {
        name: new RegExp(
          `Search Results for\\s+"${escapeRegExp(targetText)}"`,
          'i',
        ),
      }),
    ).toBeVisible({ timeout: RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs });
  });

  test('REL-007 - Related Search updates query', async ({ page }) => {
    const related = new RelatedSearchesPage(page);
    await related.open();
    await related.openRelatedSearches(
      relatedSearchesQueries.brandRelated.value,
    );

    const targetText =
      relatedSearchesQueries.brandRelated.expectedItemTexts?.[0] ?? 'blum';
    const targetAttr = relatedSearchesQueries.brandRelated.expectedAttr;

    await related.selectRelatedSearch(
      targetAttr ? { attr: targetAttr } : { text: targetText },
    );
    await related.waitForSearchLanding(targetText);
    await expect(related.input()).toHaveValue(new RegExp(targetText, 'i'));
  });

  test('REL-008 - Related Search navigation has expected URL/state', async ({
    page,
  }) => {
    const related = new RelatedSearchesPage(page);
    await related.open();
    await related.openRelatedSearches(relatedSearchesQueries.withRelated.value);

    const targetText =
      relatedSearchesQueries.withRelated.expectedItemTexts?.[0] ?? 'hinge';
    const targetAttr = relatedSearchesQueries.withRelated.expectedAttr;

    await related.selectRelatedSearch(
      targetAttr ? { attr: targetAttr } : { text: targetText },
    );
    await expectSearchStateAfterRelatedClick(page, related, targetText);

    // Dropdown Related Search click typically adds route (unlike normal Enter).
    if (RELATED_SEARCHES_BEHAVIOR.clickMayAddRouteParam) {
      const route = new URL(page.url()).searchParams.get('route');
      expect(
        route,
        'Expected route param after Related Search click',
      ).toBeTruthy();
    }
  });

  test('REL-009 - No Related Searches state is handled correctly', async ({
    page,
  }) => {
    const related = new RelatedSearchesPage(page);

    // Empty Related Searches in the dropdown for a no-match query.
    await related.open();
    await related.openEmptyRelatedSearches(
      relatedSearchesQueries.noRelated.value,
    );
    await expectEmptyRelatedSearchesState(related);

    // Related Searches are not a SERP section.
    await related.openSerp(relatedSearchesQueries.withRelated.value);
    await expectRelatedSearchesAbsentOnSerp(related);
  });

  test('REL-010 - Related Searches remain usable after dropdown load', async ({
    page,
  }) => {
    const related = new RelatedSearchesPage(page);
    await related.open();
    await related.openRelatedSearches(
      relatedSearchesQueries.withRelatedAlt.value,
    );
    await expectRelatedSearchesVisible(related);
    await expectRelatedSearchesInteractable(related);

    const texts = await related.relatedSearches.getItemTexts();
    expect(texts.length).toBeGreaterThan(0);
    await expect(related.relatedSearches.itemByText(texts[0])).toBeVisible();
    await expect(related.relatedSearches.itemByText(texts[0])).toBeEnabled();
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
