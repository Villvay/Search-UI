import { type Locator, type Page } from '@playwright/test';
import { SearchDropdown } from '../../../core/components/SearchDropdown';
import { SearchPage } from '../../../core/pages/SearchPage';
import { SUGGESTIONS_BEHAVIOR } from '../data/behavior';

export class SuggestionsPage {
  readonly searchPage: SearchPage;
  readonly dropdown: SearchDropdown;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.dropdown = new SearchDropdown(page);
  }

  async open(): Promise<void> {
    await this.searchPage.open();
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async typeQuerySequentially(query: string): Promise<void> {
    await this.searchPage.searchBox.typeSequentially(query);
  }

  async clearQuery(): Promise<void> {
    await this.searchPage.searchBox.clear();
  }

  async readQuery(): Promise<string> {
    return this.searchPage.searchBox.getValue();
  }

  async searchAndWaitForResults(query: string): Promise<void> {
    await this.focusSearch();
    await this.typeQuerySequentially(query);
    await this.dropdown.waitForResults(SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs);
  }

  async selectFirstProduct(): Promise<void> {
    await this.dropdown.clickFirstProduct();
  }

  async selectFirstCategory(): Promise<void> {
    await this.dropdown.clickFirstCategory();
  }
}
