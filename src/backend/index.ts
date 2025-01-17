import { createTransactionsInExternalVendors } from '@/backend/export/exportTransactions';
import { scrapeFinancialAccountsAndFetchTransactions } from '@/backend/import/importTransactions';
import moment from 'moment';
import * as configManager from './configManager/configManager';
import { buildCompositeEventPublisher } from './eventEmitters/compositeEventPublisher';
import { buildConsoleEmitter } from './eventEmitters/consoleEmitter';
import outputVendors from './export/outputVendors';
import * as bankScraper from './import/bankScraper';
import * as Events from './eventEmitters/EventEmitter';

export { CompanyTypes } from 'israeli-bank-scrapers-core';
export { outputVendors };
export { configManager };
export { Events };

export const { inputVendors } = bankScraper;

export async function scrapeAndUpdateOutputVendors(config: configManager.Config, optionalEventPublisher?: Events.EventPublisher) {
  const eventPublisher = createEventPublisher(optionalEventPublisher);

  const startDate = moment()
    .subtract(config.scraping.numDaysBack, 'days')
    .startOf('day')
    .toDate();

  await eventPublisher.emit(Events.EventNames.IMPORT_PROCESS_START, { message: `Starting to scrape from ${startDate} to today` });

  const companyIdToTransactions = await scrapeFinancialAccountsAndFetchTransactions(config.scraping, startDate, eventPublisher);
  try {
    const executionResult = await createTransactionsInExternalVendors(config.outputVendors, companyIdToTransactions, startDate, eventPublisher);

    return executionResult;
  } catch (e) {
    await eventPublisher.emit(Events.EventNames.GENERAL_ERROR, new Events.BudgetTrackingEvent({ message: e.message, error: e }));
    throw e;
  }
}

function createEventPublisher<Name>(optionalEventPublisher: Events.EventPublisher | undefined): Events.EventPublisher {
  const eventPublishers = [buildConsoleEmitter()];
  if (optionalEventPublisher) {
    eventPublishers.push(optionalEventPublisher);
  }
  const compositeEventPublisher = buildCompositeEventPublisher(eventPublishers);
  return compositeEventPublisher;
}
