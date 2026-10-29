import { type Page } from '@playwright/test';
import { SortingControl } from '../../../core/components/SortingControl';
import { SearchPage } from '../../../core/pages/SearchPage';

export class SortingPage {
  readonly searchPage: SearchPage;
  readonly sorting: SortingControl;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.sorting = new SortingControl(page);
  }

  async openSearchResults(query: string): Promise<void> {
    await this.searchPage.openSearchResults(query);
  }

  productTitleLinks() {
    return this.page.locator('a.product-title').locator('visible=true');
  }
}
