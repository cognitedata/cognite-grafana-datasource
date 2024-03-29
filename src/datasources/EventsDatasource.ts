import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import jsonlint from 'jsonlint-mod';
import { CogniteQuery, EventQuery, EventQueryAggregate, EventQuerySortProp, HttpMethod, Tuple } from '../types';
import { Connector } from '../connector';
import { applyFilters, getRange, isAnnotationTarget } from '../utils';
import { parse as parseQuery } from '../parser/events-assets';
import {
  AggregateRequest,
  CogniteEvent,
  EventSortRequestParam,
  EventsFilterRequestParams,
  EventsFilterTimeParams,
  FilterRequest,
} from '../cdf/types';
import { convertItemsToDataFrame } from '../cdf/client';
import { EVENTS_LIMIT_WARNING, EVENTS_PAGE_LIMIT, responseWarningEvent } from '../constants';
import { emitEvent, handleError } from '../appEventHandler';

const convertEventsToAnnotations = (events: CogniteEvent[], timeRangeEnd: number) => {
  return events.map(({ description, startTime, endTime, type, id }) => ({
    id,
    isRegion: true,
    text: description,
    time: new Date(startTime),
    timeEnd: new Date(endTime || timeRangeEnd),
    title: type,
  }))
}

export const convertEventsDateFields = (events: CogniteEvent[]) => {
  return events.map(({ createdTime, lastUpdatedTime, startTime, endTime, ...rest }) => {
    return {
      ...rest,
      createdTime: new Date(createdTime),
      lastUpdatedTime: new Date(lastUpdatedTime),
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime && { endTime: new Date(endTime) }),
    }
  });
}

export class EventsDatasource {
  constructor(private connector: Connector) { }
  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const timeRange = getRange(options.range);
    const eventResults = await this.fetchEventTargets(options.targets, timeRange);
    return { data: eventResults };
  }

  async fetchEventsForTarget(
    target: CogniteQuery,
    [rangeStart, rangeEnd]: Tuple<number>
  ) {
    const { refId, eventQuery, query } = target;
    const isAnnotation = isAnnotationTarget(target);
    const activeAtTimeRange = isAnnotation || target.eventQuery?.activeAtTimeRange;
    const timeFrame = activeAtTimeRange ? {
      activeAtTime: { min: rangeStart, max: rangeEnd },
    } : {};
    const finalEventQuery = isAnnotation ? {
      expr: query,
    } : eventQuery

    try {
      const { items, hasMore } = await this.fetchEvents(finalEventQuery, timeFrame);
      if (hasMore) {
        emitEvent(responseWarningEvent, { refId, warning: EVENTS_LIMIT_WARNING });
      }
      return items;
    } catch (e) {
      handleError(e, refId);
    }
    return [];
  }


  async fetchEventTargets(targets: CogniteQuery[], timeRange: Tuple<number>) {
    return Promise.all(
      targets.map(async (target) => {
        const resEvents = await this.fetchEventsForTarget(target, timeRange);
        const items = isAnnotationTarget(target) ? convertEventsToAnnotations(resEvents, timeRange[1]) : convertEventsDateFields(resEvents);
        const df = convertItemsToDataFrame(items, target.eventQuery?.columns ?? [], "Events", target.refId);
        return df
      })
    );
  }
  getEventFilterRequestBody = (
    {
      aggregate, advancedFilterQuery, timeRange, sort, params
    }: {
      sort?: EventQuerySortProp[],
      aggregate: EventQueryAggregate,
      advancedFilterQuery: any,
      timeRange: EventsFilterTimeParams,
      params: any
    }): FilterRequest<EventsFilterRequestParams, EventSortRequestParam[]> | AggregateRequest<EventsFilterRequestParams> => {
    const filter = { ...timeRange, ...params };
    const sortParams = sort?.length ? {
      sort: sort.map(item => ({
        property: item.property.split("."),
        order: item.order,
      }))
    } : {};
    const withAggregate = aggregate?.withAggregate;
    let body: FilterRequest<EventsFilterRequestParams, EventSortRequestParam[]> | AggregateRequest<EventsFilterRequestParams> = {
      filter,
    }
    if (advancedFilterQuery && Object.keys(advancedFilterQuery).length) {
      body = {
        ...body,
        advancedFilter: advancedFilterQuery,
      }
      if (withAggregate) {
        const { name, properties } = aggregate;
        if (properties?.length && properties.some(p => p.property)) {
          return {
            ...body,
            aggregate: name,
            properties: properties.map(({ property: value }) => ({ property: [value] }))
          }
        }
        return body;
      }
    }
    return withAggregate ? body : {
      ...body,
      ...sortParams,
      limit: EVENTS_PAGE_LIMIT,
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
