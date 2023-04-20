import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import jsonlint from 'jsonlint-mod';
import { CogniteQuery, EventQuery, EventQueryAggregate, EventQuerySortProp, HttpMethod, Tuple } from '../types';
import { Connector } from '../connector';
import { applyFilters, getRange } from '../utils';
import { parse as parseQuery } from '../parser/events-assets';
import {
  AggregateRequest,
  CogniteEvent,
  EventsFilterRequestParams,
  EventsFilterTimeParams,
  FilterRequest,
} from '../cdf/types';
import { convertItemsToTable } from '../cdf/client';
import { EVENTS_LIMIT_WARNING, EVENTS_PAGE_LIMIT, responseWarningEvent } from '../constants';
import { emitEvent, handleError } from '../appEventHandler';

export class EventsDatasource {
  constructor(private connector: Connector) {}
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
  getEventFilterRequestBody = ({ aggregate, advancedFilterQuery, timeRange, sort, params }: { sort?: EventQuerySortProp[], aggregate: EventQueryAggregate, advancedFilterQuery: any, timeRange: EventsFilterTimeParams, params: any }): FilterRequest<EventsFilterRequestParams> | AggregateRequest<EventsFilterRequestParams> => {
    const filter = { ...timeRange, ...params };
    const sortParams = sort?.length ? { sort } : {};
    let body: FilterRequest<EventsFilterRequestParams> | AggregateRequest<EventsFilterRequestParams> = {
      limit: EVENTS_PAGE_LIMIT,
      filter,
    }
    if (advancedFilterQuery) {
      body = {
        ...body,
        advancedFilter: advancedFilterQuery,
      }
      if (aggregate) {
        const { name, properties, withAggregate } = aggregate;
        if (withAggregate) {
          if (properties.length) {
            body = {
              ...body,
              aggregate: name,
              properties
            }
          } else {
            body = {
              ...body,
              ...sortParams
            }
          }
        }
      }
      return body;
    }
    return {
      ...body,
      ...sortParams, 
    };
  };

  async fetchEvents({ expr, advancedFilter, sort, aggregate }: EventQuery, timeRange: EventsFilterTimeParams) {
    let filter = [];
    let params = {};
    let path = aggregate?.withAggregate ? 'aggregate' : 'list';
    if (expr) {
      const parsedQuery = parseQuery(expr);
      filter = parsedQuery.filters;
      params = parsedQuery.params;
    }
    const advancedFilterQuery =
      this.connector.isEventsAdvancedFilteringEnabled() && advancedFilter
        ? jsonlint.parse(advancedFilter)
        : undefined;
    const data = this.getEventFilterRequestBody({ advancedFilterQuery, aggregate, timeRange, sort, params });
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
