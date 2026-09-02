import { chunk } from "lodash";
import { BackendSrvRequest, FetchResponse } from "@grafana/runtime";
import ms from "ms";
import {
  CursorResponse,
  DataResponse,
  DataSourceRequestOptions,
  FDMResponse,
  HttpMethod,
  isError,
  ItemsResponse,
  RequestParams,
} from "./types";
import { Items, Limit } from "./cdf/types";
import { getQueryString } from "./utils";
import { API_V1, AuthType, CacheTime } from "./constants";
import { FeatureFlags, FeatureKey } from "./featureDefaults";

export interface Fetcher {
  fetch: (options: BackendSrvRequest) => Promise<FetchResponse<any>>;
}

/**
 * Everything optional a connector is configured with.
 *
 * Named rather than positional: the flag list grows, and a list of interchangeable
 * booleans silently mis-wires itself the moment one is inserted in the middle.
 */
export type ConnectorOptions = {
  oauthPassThru?: boolean;
  oauthClientCredentials?: boolean;
} & Partial<FeatureFlags>;

export class Connector {
  private options: ConnectorOptions;

  constructor(
    private project: string,
    private apiUrl: string,
    private fetcher: Fetcher,
    options: ConnectorOptions = {},
  ) {
    this.options = options;
  }

  cachedRequests = new Map<string, Promise<any>>();

  fetchData<T>(request: RequestParams): Promise<T> {
    const { path, data, method, params, requestId, cacheTime, headers } =
      request;
    const queryString = params ? `?${getQueryString(params)}` : "";
    const url =
      `${this.apiUrlAuth}/${API_V1}/${this.project}${path}${queryString}`;
    const body: DataSourceRequestOptions = { url, data, method, headers };
    if (requestId) {
      body.requestId = requestId;
    }
    return this.cachedRequest(body, cacheTime);
  }

  async chunkAndFetch<Req extends Items, Res extends ItemsResponse>(
    request: RequestParams<Req>,
    chunkSize = 100,
  ): Promise<Res> {
    const { data, requestId } = request;
    const chunkedItems = chunk(data.items, chunkSize);
    const chunkedRequests = chunkedItems.map((items, i) => ({
      ...request,
      ...chunkedReqId(requestId, i),
      data: {
        ...data,
        items,
      },
    }));
    const promises = chunkedRequests.map((chunk) => this.fetchData<Res>(chunk));
    const results = await Promise.all(promises);
    const mergedItems = results.reduce((all, { data }) => {
      return [...all, ...data.items];
    }, []);
    return {
      ...results[0],
      data: {
        ...results[0].data,
        items: mergedItems,
      },
    };
  }

  async fetchItems<T>(params: RequestParams): Promise<T[]> {
    const { data } = await this.fetchData<ItemsResponse<T>>(params);
    return data.items;
  }

  async fetchQuery<T>(params: RequestParams): Promise<FDMResponse<T>> {
    const { data } = await this.fetchData<DataResponse<FDMResponse<T>>>(params);
    return data;
  }

  async fetchAndPaginate<T>(params: RequestParams<Limit>) {
    const maxLimit = 1000;
    const { data: queryData } = params;
    const fullLimit = queryData.limit || maxLimit;
    const { data } = await this.fetchData<CursorResponse<T>>({
      ...params,
      data: {
        ...queryData,
        limit: Math.min(maxLimit, fullLimit),
      },
    });
    let { nextCursor: cursor, items } = data;

    /* eslint no-await-in-loop: "off" */
    while (cursor && fullLimit > items.length) {
      const { data: current } = await this.fetchData<CursorResponse<T>>({
        ...params,
        data: {
          ...queryData,
          cursor,
          limit: maxLimit,
        },
      });
      cursor = current.nextCursor;
      items = [...items, ...current.items];
    }
    if (items.length > fullLimit) {
      items.length = fullLimit;
    }
    return items;
  }

  request(
    { path, method = HttpMethod.GET }: { path: string; method?: HttpMethod },
  ) {
    return this.fetcher.fetch({
      method,
      url: `${this.apiUrlAuth}/${path}`,
    });
  }

  private get apiUrlAuth() {
    let auth;
    switch (true) {
      case !this.options.oauthPassThru && this.options.oauthClientCredentials:
        auth = AuthType.OAuthClientCredentials;
        break;
      case this.options.oauthPassThru:
        auth = AuthType.OAuth;
        break;
      default:
        auth = AuthType.OAuth;
    }
    return `${this.apiUrl}/${auth}`;
  }

  /** An unset flag reads as off, so every accessor answers a definite boolean. */
  private flag(key: FeatureKey): boolean {
    return !!this.options[key];
  }

  // Core data model (CDM) features
  isCogniteTimeSeriesEnabled() {
    return this.flag("enableCoreDataModelFeatures") &&
      this.flag("enableCogniteTimeSeries");
  }

  isCogniteActivitiesEnabled() {
    return this.flag("enableCoreDataModelFeatures") &&
      this.flag("enableCogniteActivities");
  }

  isFlexibleDataModellingEnabled() {
    return this.flag("enableCoreDataModelFeatures") &&
      this.flag("enableFlexibleDataModelling");
  }

  // Legacy data model features
  /**
   * The master switch on its own. Asset-centric variable queries hit /assets/list,
   * which no sub-flag covers, so the master is the only meaningful gate for them.
   */
  isLegacyDataModelFeaturesEnabled() {
    return this.flag("enableLegacyDataModelFeatures");
  }

  isTimeseriesSearchEnabled() {
    return this.flag("enableLegacyDataModelFeatures") &&
      this.flag("enableTimeseriesSearch");
  }

  isTimeseriesFromAssetEnabled() {
    return this.flag("enableLegacyDataModelFeatures") &&
      this.flag("enableTimeseriesFromAsset");
  }

  isTimeseriesCustomQueryEnabled() {
    return this.flag("enableLegacyDataModelFeatures") &&
      this.flag("enableTimeseriesCustomQuery");
  }

  isEventsEnabled() {
    return this.flag("enableLegacyDataModelFeatures") &&
      this.flag("enableEvents");
  }

  isEventsAdvancedFilteringEnabled() {
    return this.flag("enableLegacyDataModelFeatures") &&
      this.flag("enableEventsAdvancedFiltering");
  }

  // Deprecated features
  isRelationshipsEnabled() {
    return this.flag("enableRelationships");
  }

  isTemplatesEnabled() {
    return this.flag("enableTemplates");
  }

  isExtractionPipelinesEnabled() {
    return this.flag("enableExtractionPipelines");
  }

  public cachedRequest = async (
    query: DataSourceRequestOptions,
    cacheTime: string = CacheTime.Default,
  ): Promise<any> => {
    const { requestId, ...queryWithoutId } = query;
    const hash = JSON.stringify(queryWithoutId);
    const timeout = ms(cacheTime);

    if (this.cachedRequests.has(hash)) {
      return this.cachedRequests.get(hash);
    }

    const request = (async () => {
      try {
        const res = await this.fetcher.fetch(query);
        if (isError(res)) {
          throw res;
        }
        setTimeout(() => this.cachedRequests.delete(hash), timeout);
        return res;
      } catch (e) {
        this.cachedRequests.delete(hash);
        throw e;
      }
    })();

    this.cachedRequests.set(hash, request);
    return request;
  };
}

const chunkedReqId = (requestId: string, chunk: number) => {
  return requestId
    ? {
      requestId: chunk ? `${requestId}${chunk}` : requestId,
    }
    : undefined;
};
