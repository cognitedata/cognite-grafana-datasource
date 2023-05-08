import { Connector } from '../connector';
import { defaultQuery, CogniteQuery, Tab } from '../types';
import { EventsDatasource } from 'datasources';

const defaultCogniteQuery = defaultQuery as CogniteQuery;

describe('events datasource test', () => {
  let connector: Connector;
  let eventsDatasource: EventsDatasource;
  const startTime = 1549336675000;
  const endTime = 1549338475000;
  const fetchItemsMock = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks();
    connector = {
      fetchData: jest.fn(),
      fetchItems: fetchItemsMock,
      fetchAndPaginate: jest.fn(),

      isTemplatesEnabled: () => true,
      isEventsAdvancedFilteringEnabled: () => true,
      isFlexibleDataModellingEnabled: () => true,
      isExtractionPipelinesEnabled: () => true,
    } as unknown as Connector;
    eventsDatasource = new EventsDatasource(connector);
  });


  it('simple event query', async () => {

    fetchItemsMock.mockResolvedValueOnce([])

    const query: CogniteQuery = {
      ...defaultCogniteQuery,
      tab: Tab.Event,
      eventQuery: {
        expr: "events{}",
        columns: ['externalId'],
        activeAtTimeRange: true,
        sort: []
      },
    }
    const res = await eventsDatasource.fetchEventTargets(
      [query],
      [startTime, endTime]
    );

    expect(fetchItemsMock).toHaveBeenCalledTimes(1)
    expect(connector.fetchItems).toHaveBeenCalledWith({
      data: {
        filter: {
          activeAtTime: {
            max: endTime,
            min: startTime,
          },
        },
        limit: 1000,
      },
      headers: undefined,
      method: "POST",
      path: "/events/list"
    })

    expect(res).toEqual([
      {
        columns: [
          {
            text: "externalId",
          },
        ],
        name: "events",
        rows: [],
        type: "table",
      },
    ]);
  });
});
