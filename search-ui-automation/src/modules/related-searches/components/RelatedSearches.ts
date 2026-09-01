/**
 * Related Searches UI — suggestions-dropdown surface only.
 * Reuses core SearchDropdown; does not import the suggestions feature module.
 */
import { type Locator, type Page } from '@playwright/test';
import { SearchDropdown } from '../../../core/components/SearchDropdown';
import {
  RELATED_SEARCHES_BEHAVIOR,
  RELATED_SEARCHES_COPY,
} from '../data/behavior';

export class RelatedSearches {
  readonly dropdown: SearchDropdown;

  constructor(private readonly page: Page) {
    this.dropdown = new SearchDropdown(page);
  }

  /** Suggestions column that hosts Related Search items. */
  section(): Locator {
    return this.dropdown.suggestionsColumn();
  }

  items(): Locator {
    return this.dropdown.suggestionItems();
  }

  itemByText(text: string): Locator {
    return this.dropdown.suggestionByText(text);
  }

  itemByAttribute(attr: string): Locator {
    return this.dropdown.suggestionByAttribute(attr);
  }

  /** SERP-only locator — expected absent on this application. */
  serpHeading(): Locator {
    return this.page.getByRole('main').getByRole('heading', {
      name: RELATED_SEARCHES_COPY.serpRelatedHeadingPattern,
    });
  }

  noSuggestionsMessage(): Locator {
    return this.page.getByText(RELATED_SEARCHES_COPY.noSuggestions, {
      exact: true,
    });
  }

  async isVisible(): Promise<boolean> {
    return this.dropdown.isSuggestionsColumnVisible();
  }

  async waitForRelatedSearches(
    timeoutMs = RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
  ): Promise<void> {
    await this.dropdown.waitForSuggestionItems(timeoutMs);
  }

  async getItemCount(): Promise<number> {
    return this.dropdown.getSuggestionCount();
  }

  async getItemTexts(): Promise<string[]> {
    return this.dropdown.getSuggestionTexts();
  }

  async clickItem(target: { text?: string; attr?: string }): Promise<void> {
    await this.dropdown.clickSuggestion(target);
  }
}
