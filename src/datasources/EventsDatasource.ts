import { DataFrame, DataQueryRequest, DataQueryResponse, Field, FieldType, MutableDataFrame, arrayToDataFrame, guessFieldTypeFromNameAndValue } from '@grafana/data';
import jsonlint from 'jsonlint-mod';
import { CogniteQuery, EventQuery, EventQueryAggregate, EventQuerySortProp, HttpMethod, Tuple } from '../types';
import { Connector } from '../connector';
import { applyFilters, getRange } from '../utils';
import { parse as parseQuery } from '../parser/events-assets';
import {
  AggregateRequest,
  CogniteEvent,
  EventSortRequestParam,
  EventsFilterRequestParams,
  EventsFilterTimeParams,
  FilterRequest,
} from '../cdf/types';
import { convertItemsToTable } from '../cdf/client';
import { EVENTS_LIMIT_WARNING, EVENTS_PAGE_LIMIT, responseWarningEvent } from '../constants';
import { emitEvent, handleError } from '../appEventHandler';

export class EventsDatasource {
  constructor(private connector: Connector) { }
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

      // TODO: this should only happen for the annotation query
      let itemsRes =  items.map(({ description, startTime, endTime, type, id }) => ({
        // annotation,
        id,
        isRegion: true,
        text: description,
        time: startTime,
        timeEnd: endTime,
        title: type,
      }));

      const fields: Field[] = Object.entries(itemsRes[0]).map(([key, _value]) => ({ 
        name: key,
        type: guessFieldTypeFromNameAndValue(key, _value),
        values: itemsRes.map((item) => item[key]),
        config: {  }
      }))

      var df:DataFrame = {
        // convert attay of itemsRes into a dataframe
        refId: refId,
        name: "Events",
        fields: fields,
        length: itemsRes.length,
      }

      return df;
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
        // TODO: allow column subselection
        // return convertItemsToTable(events, target.eventQuery.columns, "events");
        return events
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
