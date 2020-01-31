import { RequestParams, Response, HttpMethod, DataSourceRequestOptions, Items } from './types';
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

  public async fetchItems<T>(params: RequestParams) {
    const { data } = await this.fetchData<Response<T>>(params);
    return data.items;
  }

  public request({ path, method = HttpMethod.GET }: { path: string; method?: HttpMethod }) {
    return this.backendSrv.datasourceRequest({
      method,
      url: `${this.apiUrl}/${path}`,
    });
  }
}
