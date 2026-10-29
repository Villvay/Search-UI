import { test, expect } from '../../../core/fixtures';
import {
  loadAnalyticsQueries,
  truncateQueryForTitle,
} from '../../../core/utils/analyticsQueryLoader';
import { expectSerpProductsMatchAnalyticsQuery } from '../assertions/onEnterAnalyticsAssertions';
import { ON_ENTER_BEHAVIOR } from '../data/behavior';
import {
  OnEnterSearchPage,
  queriesMatch,
} from '../pages/OnEnterSearchPage';

/**
 * Analytics-driven ON-ENTER coverage (@analytics).
 * Uses fill() for query entry (not keystroke coverage).
 */
const analyticsQueries = loadAnalyticsQueries();

test.describe('ON-ENTER analytics queries @analytics', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const item of analyticsQueries) {
    const titleQuery = truncateQueryForTitle(item.query);
    test(`${item.id} - ON-ENTER - "${titleQuery}" @analytics`, async ({
      page,
    }, testInfo) => {
      testInfo.annotations.push(
        { type: 'analyticsId', description: item.id },
        { type: 'analyticsModule', description: 'on-enter' },
        { type: 'analyticsQuery', description: item.query },
      );

      const onEnter = new OnEnterSearchPage(page);
      await onEnter.open();
      await onEnter.searchWithEnter(item.query, { inputMode: 'fill' });
      await onEnter.waitForSearchNavigation(item.query);

      const landedUrl = page.url();
      testInfo.annotations.push({ type: 'landedUrl', description: landedUrl });

      const url = new URL(landedUrl);
      expect(
        url.pathname.startsWith('/product/'),
        'Analytics ON-ENTER expects SERP with products, not PDP redirect',
      ).toBeFalsy();

      expect(url.pathname).toBe(ON_ENTER_BEHAVIOR.searchPath);
      const q = url.searchParams.get(ON_ENTER_BEHAVIOR.queryParam) ?? '';
      expect(
        queriesMatch(q, item.query),
        `Expected URL q to match analytics query (got "${q}")`,
      ).toBeTruthy();

      await expect(onEnter.input()).toHaveValue(item.query);

      const { productCount, titles } =
        await expectSerpProductsMatchAnalyticsQuery(onEnter, item.query);

      testInfo.annotations.push(
        { type: 'productCount', description: String(productCount) },
        {
          type: 'productTitlesSample',
          description: titles.slice(0, 3).join(' | '),
        },
      );
    });
  }
});
