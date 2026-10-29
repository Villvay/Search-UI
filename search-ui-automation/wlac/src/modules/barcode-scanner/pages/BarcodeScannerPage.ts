import { type Locator, type Page } from '@playwright/test';
import { SEARCH_SELECTORS } from '../../../../config/selectors';
import { SearchPage } from '../../../core/pages/SearchPage';

export class BarcodeScannerPage {
  readonly searchPage: SearchPage;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
  }

  scannerButton(): Locator {
    return this.page.getByRole('button', {
      name: SEARCH_SELECTORS.barcodeScannerButtonName,
    });
  }

  async openHome(): Promise<void> {
    await this.searchPage.open();
  }
}
