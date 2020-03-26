import {
  RequestParams,
  Response,
  HttpMethod,
  DataSourceRequestOptions,
  Items,
  DataResponse,
  CursorResponse,
  Limit,
} from './types';
import { getQueryString } from './utils';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import cache from './cache';
import { chunk } from 'lodash';

export class Connector {
  public constructor(
    private project: string,
    private apiUrl: string,
    private backendSrv: BackendSrv
  ) {}

  private fetchData<T>(request: RequestParams): Promise<T> {
    const { path, data, method, params, requestId, playground } = request;
    const paramsString = params ? `?${getQueryString(params)}` : '';
    const url = `${this.apiUrl}/${playground ? 'playground' : 'cogniteapi'}/${
      this.project
    }${path}${paramsString}`;
    const body: DataSourceRequestOptions = { url, data, method };
    if (requestId) {
      body.requestId = requestId;
    }
    return cache.getQuery(body, this.backendSrv);
  }

  public async chunkAndFetch<Req extends Items, Res extends Response>(
    request: RequestParams<Req>,
    chunkSize: number = 100
  ): Promise<Res> {
    const { data } = request;
    const chunkedItems = chunk(data.items, chunkSize);
    const chunkedRequests = chunkedItems.map(items => ({
      ...request,
      data: {
        ...data,
        items,
      },
    }));
    const promises = chunkedRequests.map(chunk => this.fetchData<Res>(chunk));
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
      url: `${this.apiUrl}/${path}`,
    });
  }
}
