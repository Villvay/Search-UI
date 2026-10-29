import { test, expect } from '../../../core/fixtures';
import {
  loadAnalyticsQueries,
  truncateQueryForTitle,
} from '../../../core/utils/analyticsQueryLoader';
import { SUGGESTIONS_BEHAVIOR } from '../data/behavior';
import { SuggestionsPage } from '../pages/SuggestionsPage';

/**
 * Analytics-driven SUGGESTIONS coverage (@analytics).
 * Uses fill() for query entry (not keystroke/debounce coverage).
 */
const analyticsQueries = loadAnalyticsQueries();

test.describe('SUGGESTIONS analytics queries @analytics', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const item of analyticsQueries) {
    const titleQuery = truncateQueryForTitle(item.query);
    test(`${item.id} - SUGGESTIONS - "${titleQuery}" @analytics`, async ({
      page,
    }, testInfo) => {
      testInfo.annotations.push(
        { type: 'analyticsId', description: item.id },
        { type: 'analyticsModule', description: 'suggestions' },
        { type: 'analyticsQuery', description: item.query },
      );

      const suggestions = new SuggestionsPage(page);
      await suggestions.open();

      const trimmed = item.query.trim();
      if (trimmed.length < SUGGESTIONS_BEHAVIOR.minCharacters) {
        await suggestions.focusSearch();
        await suggestions.enterQuery(item.query);
        await expect(suggestions.input()).toHaveValue(item.query);
        testInfo.annotations.push(
          { type: 'suggestionCount', description: '0' },
          { type: 'suggestionsAvailable', description: 'false' },
        );
        expect(
          trimmed.length,
          `Query below min characters (${SUGGESTIONS_BEHAVIOR.minCharacters}) cannot produce suggestions`,
        ).toBeGreaterThanOrEqual(SUGGESTIONS_BEHAVIOR.minCharacters);
        return;
      }

      await suggestions.searchAndWaitForSuggestions(item.query, {
        inputMode: 'fill',
      });
      await expect(suggestions.input()).toHaveValue(item.query);

      const emptyVisible = await suggestions
        .noSuggestionsMessage()
        .isVisible()
        .catch(() => false);
      const suggestionCount = emptyVisible
        ? 0
        : await suggestions.dropdown.getSuggestionCount();
      const resultsCount = await suggestions.dropdown.getResultCount();

      testInfo.annotations.push(
        { type: 'suggestionCount', description: String(suggestionCount) },
        { type: 'resultCount', description: String(resultsCount) },
        {
          type: 'suggestionsAvailable',
          description: String(suggestionCount > 0),
        },
      );

      expect(
        emptyVisible,
        `Expected suggestions for analytics query ${item.id}, but empty-state was shown`,
      ).toBeFalsy();
      expect(
        suggestionCount,
        `Expected suggestion count > 0 for analytics query ${item.id} ("${item.query}")`,
      ).toBeGreaterThan(0);
    });
  }
});
