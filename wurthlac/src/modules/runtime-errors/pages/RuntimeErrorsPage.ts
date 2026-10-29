import { type Page } from '@playwright/test';
import { SearchDropdown } from '../../../core/components/SearchDropdown';
import { FiltersPanel } from '../../../core/components/FiltersPanel';
import { SearchPage } from '../../../core/pages/SearchPage';
import { getEnvironmentConfig } from '../../../../config/environments';
import { RuntimeErrorCollector } from '../utils/runtimeErrorCollector';

export class RuntimeErrorsPage {
  readonly searchPage: SearchPage;
  readonly dropdown: SearchDropdown;
  readonly filters: FiltersPanel;
  collector: RuntimeErrorCollector;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.dropdown = new SearchDropdown(page);
    this.filters = new FiltersPanel(page);
    this.collector = new RuntimeErrorCollector(page, {
      baseURL: getEnvironmentConfig().baseURL,
    });
  }

  attachCollector(): void {
    this.collector.attach();
  }

  detachCollector(): void {
    this.collector.detach();
  }

  async openHome(): Promise<void> {
    await this.searchPage.open();
  }

  async typeQuery(query: string): Promise<void> {
    this.collector.setContext({ query });
    await this.searchPage.searchBox.focus();
    await this.searchPage.searchBox.typeSequentially(query);
  }
}
