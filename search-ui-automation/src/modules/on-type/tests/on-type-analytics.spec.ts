import { test, expect } from '../../../core/fixtures';
import {
  loadAnalyticsQueries,
  truncateQueryForTitle,
} from '../../../core/utils/analyticsQueryLoader';
import { ON_TYPE_BEHAVIOR, ON_TYPE_COPY } from '../data/behavior';
import { OnTypeSearchPage } from '../pages/OnTypeSearchPage';

/**
 * Analytics-driven ON-TYPE coverage (@analytics).
 * Uses fill() (not keystroke typing). Functional ON-TYPE specs keep sequential typing.
 */
const analyticsQueries = loadAnalyticsQueries();

test.describe('ON-TYPE analytics queries @analytics', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const item of analyticsQueries) {
    const titleQuery = truncateQueryForTitle(item.query);
    test(`${item.id} - ON-TYPE - "${titleQuery}" @analytics`, async ({
      page,
    }, testInfo) => {
      testInfo.annotations.push(
        { type: 'analyticsId', description: item.id },
        { type: 'analyticsModule', description: 'on-type' },
        { type: 'analyticsQuery', description: item.query },
      );

      const onType = new OnTypeSearchPage(page);
      await onType.open();
      await onType.focusSearch();
      await onType.typeQuery(item.query);

      await expect(onType.input()).toHaveValue(item.query);

      const trimmed = item.query.trim();
      if (trimmed.length < ON_TYPE_BEHAVIOR.minCharacters) {
        await expect(onType.trendingHeading()).toBeVisible({
          timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
        });
        return;
      }

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
