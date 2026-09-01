import { test, expect } from '../../../core/fixtures';
import {
  loadAnalyticsQueries,
  truncateQueryForTitle,
} from '../../../core/utils/analyticsQueryLoader';
import { ON_TYPE_BEHAVIOR, ON_TYPE_COPY } from '../data/behavior';
import { OnTypeSearchPage } from '../pages/OnTypeSearchPage';

/**
 * Analytics-driven ON-TYPE coverage.
 * Uses shared src/test-data/analytics — does not import other feature modules.
 */
const analyticsQueries = loadAnalyticsQueries();

test.describe('ON-TYPE analytics queries', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const item of analyticsQueries) {
    const titleQuery = truncateQueryForTitle(item.query);
    test(`${item.id} - ON-TYPE - "${titleQuery}"`, async ({ page }, testInfo) => {
      testInfo.annotations.push(
        { type: 'analyticsId', description: item.id },
        { type: 'analyticsModule', description: 'on-type' },
        { type: 'analyticsQuery', description: item.query },
      );

      const onType = new OnTypeSearchPage(page);
      await onType.open();
      await onType.focusSearch();
      await onType.typeQuerySequentially(item.query);

      await expect(onType.input()).toHaveValue(item.query);

      const trimmed = item.query.trim();
      if (trimmed.length < ON_TYPE_BEHAVIOR.minCharacters) {
        await expect(onType.trendingHeading()).toBeVisible({
          timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
        });
        return;
      }

      // Handled = active columns OR empty-suggestion messaging (no crash / stuck idle).
      await expect
        .poll(
          async () => {
            const suggestionsVisible = await onType
              .suggestionsColumn()
              .isVisible()
              .catch(() => false);
            const resultsVisible = await onType
              .resultsColumn()
              .isVisible()
              .catch(() => false);
            const emptyMsg = await onType.page
              .getByText(ON_TYPE_COPY.noSuggestions, { exact: true })
              .isVisible()
              .catch(() => false);
            return suggestionsVisible || resultsVisible || emptyMsg;
          },
          { timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs },
        )
        .toBeTruthy();
    });
  }
});
