import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import jsonlint from 'jsonlint-mod';
import { CogniteQuery, HttpMethod, Tuple } from '../types';
import { Connector } from '../connector';
import { applyFilters } from '../utils';
import { parse as parseQuery } from '../parser/events-assets';
import {
  CogniteEvent,
  EventsFilterRequestParams,
  EventsFilterTimeParams,
  FilterRequest,
} from '../cdf/types';
import { convertItemsToTable } from '../cdf/client';
import { EVENTS_LIMIT_WARNING, EVENTS_PAGE_LIMIT, responseWarningEvent } from '../constants';
import { emitEvent, getRange, handleError } from '../datasource';

export class EventsDatasource {
  public constructor(private connector: Connector) {}
  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const timeRange = getRange(options.range);
    const eventResults = await this.fetchEventTargets(options.targets, timeRange);
    return { data: eventResults };
  }
  async fetchEventsForTarget(
    { eventQuery, refId }: CogniteQuery,
    timeFrame: EventsFilterTimeParams
  ) {
    const timeRange = eventQuery.activeAtTimeRange ? timeFrame : {};
    try {
      const { items, hasMore } = await this.fetchEvents(eventQuery, timeRange);
      if (hasMore) {
        emitEvent(responseWarningEvent, { refId, warning: EVENTS_LIMIT_WARNING });
      }
      return items;
    } catch (e) {
      handleError(e, refId);
    }
    return [];
  }

  async fetchEventTargets(targets: CogniteQuery[], [start, end]: Tuple<number>) {
    const timeFrame = {
      activeAtTime: { min: start, max: end },
    };
    return Promise.all(
      targets.map(async (target) => {
        const events = await this.fetchEventsForTarget(target, timeFrame);
        return convertItemsToTable(events, target.eventQuery.columns);
      })
    );
  }

  async fetchEvents(
    { expr, advancedFilter, withAggregate, property },
    timeRange: EventsFilterTimeParams
  ) {
    let filter = [];
    let params = {};
    if (expr) {
      const parsedQuery = parseQuery(expr);
      filter = parsedQuery.filters;
      params = parsedQuery.params;
    }
    const advancedFilterQuery =
      this.connector.isEventsAdvancedFilteringEnabled() && advancedFilter
        ? jsonlint.parse(advancedFilter)
        : undefined;
    const getData = () => {
      if (advancedFilterQuery) {
        if (withAggregate && property?.length) {
          return {
            advancedFilter: advancedFilterQuery,
            filter: { ...timeRange, ...params },
            aggregate: 'uniqueValues',
            properties: [{ property }],
          };
        }
        if (withAggregate) {
          return {
            advancedFilter: advancedFilterQuery,
            filter: { ...timeRange, ...params },
          };
        }
        return {
          advancedFilter: advancedFilterQuery,
          filter: { ...timeRange, ...params },
          limit: EVENTS_PAGE_LIMIT,
        };
      }
      return {
        filter: { ...timeRange, ...params },
        limit: EVENTS_PAGE_LIMIT,
      };
    };
    const data: FilterRequest<EventsFilterRequestParams> = getData();
    const items = await this.connector.fetchItems<CogniteEvent>({
      data,
      path: `/events/${withAggregate && advancedFilterQuery ? 'aggregate' : 'list'}`,
      method: HttpMethod.POST,
      headers: advancedFilterQuery && {
        'cdf-version': 'alpha',
      },
    });
    return {
      items: applyFilters(items, filter),
      hasMore: items.length >= EVENTS_PAGE_LIMIT,
    };
  }
}
