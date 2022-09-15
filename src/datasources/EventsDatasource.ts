import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import jsonlint from 'jsonlint-mod';
import { CogniteQuery, HttpMethod, Tuple } from '../types';
import { Connector } from '../connector';
import { applyFilters, emitEvent, getRange, handleError } from '../utils';
import { parse as parseQuery } from '../parser/events-assets';
import {
  CogniteEvent,
  EventsFilterRequestParams,
  EventsFilterTimeParams,
  FilterRequest,
} from '../cdf/types';
import { convertItemsToTable } from '../cdf/client';
import { EVENTS_LIMIT_WARNING, EVENTS_PAGE_LIMIT, responseWarningEvent } from '../constants';

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

  async fetchEvents({ expr, advancedFilter, ...rest }, timeRange: EventsFilterTimeParams) {
    let filter = [];
    let params = {};
    let path = 'list';
    if (expr) {
      const parsedQuery = parseQuery(expr);
      filter = parsedQuery.filters;
      params = parsedQuery.params;
    }
    const advancedFilterQuery =
      this.connector.isEventsAdvancedFilteringEnabled() && advancedFilter
        ? jsonlint.parse(advancedFilter)
        : undefined;
    const getRequestBody = () => {
      const filter = { ...timeRange, ...params };
      if (advancedFilterQuery) {
        if (rest.aggregate) {
          const {
            aggregate: { name, properties, withAggregate },
          } = rest;
          if (withAggregate) {
            path = 'aggregate';
            if (properties.property?.length) {
              return {
                advancedFilter: advancedFilterQuery,
                filter,
                aggregate: name,
                properties,
              };
            }
            return {
              advancedFilter: advancedFilterQuery,
              filter,
            };
          }
        }
        return {
          advancedFilter: advancedFilterQuery,
          filter,
          limit: EVENTS_PAGE_LIMIT,
        };
      }
      return {
        filter,
        limit: EVENTS_PAGE_LIMIT,
      };
    };
    const data: FilterRequest<EventsFilterRequestParams> = getRequestBody();
    const items = await this.connector.fetchItems<CogniteEvent>({
      data,
      path: `/events/${path}`,
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
