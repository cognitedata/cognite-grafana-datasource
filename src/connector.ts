import { chunk } from 'lodash';
import { getBackendSrv, BackendSrv } from '@grafana/runtime';
import ms from 'ms';
import {
  RequestParams,
  Response,
  HttpMethod,
  DataSourceRequestOptions,
  CursorResponse,
  isError,
} from './types';
import { Items, Limit } from './cdf/types';
import { getQueryString } from './utils';
import { API_V1, AuthType, CacheTime } from './constants';

export class Connector {
  public constructor(
    private project: string,
    private apiUrl: string,
    private backendSrv: BackendSrv,
    private oauthPassThru?: boolean,
    private oauthClientCredentials?: boolean,
    private enableTemplates?: boolean,
    private enableEventsAdvancedFiltering?: boolean
  ) {}

  cachedRequests = new Map<string, Promise<any>>();

  public fetchData<T>(request: RequestParams): Promise<T> {
    const { path, data, method, params, requestId, cacheTime, headers } = request;
    const queryString = params ? `?${getQueryString(params)}` : '';
    const url = `${this.apiUrlAuth}/${API_V1}/${this.project}${path}${queryString}`;
    const body: DataSourceRequestOptions = { url, data, method, headers };
    if (requestId) {
      body.requestId = requestId;
    }
    return this.cachedRequest(body, cacheTime);
  }

  public async chunkAndFetch<Req extends Items, Res extends Response>(
    request: RequestParams<Req>,
    chunkSize: number = 100
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

  public async fetchItems<T>(params: RequestParams): Promise<T[]> {
    const { data } = await this.fetchData<Response<T>>(params);
    return data.items;
  }

  public async fetchAndPaginate<T>(params: RequestParams<Limit>) {
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

  public request({ path, method = HttpMethod.GET }: { path: string; method?: HttpMethod }) {
    return this.backendSrv.datasourceRequest({
      method,
      url: `${this.apiUrlAuth}/${path}`,
    });
  }

  private get apiUrlAuth() {
    let auth;
    switch (true) {
      case !this.oauthPassThru && this.oauthClientCredentials:
        auth = AuthType.OAuthClientCredentials;
        break;
      case this.oauthPassThru:
        auth = AuthType.OAuth;
        break;
      default:
        auth = AuthType.ApiKey;
    }
    return `${this.apiUrl}/${auth}`;
  }

  public isUsingOAuth() {
    return this.oauthPassThru || this.oauthClientCredentials;
  }

  public isTemplatesEnabled() {
    return this.enableTemplates;
  }

  public isEventsAdvancedFilteringEnabled() {
    return this.enableEventsAdvancedFiltering;
  }

  public cachedRequest = async (
    query: DataSourceRequestOptions,
    cacheTime: string = CacheTime.Default
  ): Promise<any> => {
    const { requestId, ...queryWithoutId } = query;
    const hash = JSON.stringify(queryWithoutId);
    const timeout = ms(cacheTime);

    if (this.cachedRequests.has(hash)) {
      return this.cachedRequests.get(hash);
    }

    const request = (async () => {
      try {
        const res = await this.backendSrv.datasourceRequest(query);
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
