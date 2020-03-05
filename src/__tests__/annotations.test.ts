import * as _ from 'lodash';
import { getMockedDataSource } from './utils';

jest.mock('../cache');

const { ds, backendSrvMock } = getMockedDataSource();

describe('Annotations Query', () => {
  const annotationResponse = {
    data: {
      items: [
        {
          assetIds: [123, 456, 789],
          description: 'event 1',
          startTime: '1549336675000',
          endTime: '1549336775000',
          type: 'type 1',
          subtype: 'subtype 1',
        },
        {
          assetIds: [123],
          description: 'event 2',
          startTime: '1549336775000',
          endTime: '1549336875000',
          type: 'type 2',
          subtype: 'subtype 2',
        },
        {
          assetIds: [456],
          description: 'event 3',
          startTime: '1549336875000',
          endTime: '1549336975000',
          type: 'type 3',
          subtype: 'subtype 3',
        },
        {
          assetIds: [789],
          description: 'event 4',
          startTime: '1549336975000',
          endTime: '1549337075000',
          type: 'type 4',
          subtype: 'subtype 4',
        },
        {
          assetIds: [123, 456, 789],
          description: 'time out of bounds',
          startTime: '1549336600000',
          endTime: '1549338500000',
          type: 'type 1',
          subtype: 'subtype 2',
          metadata: { key1: 'value1', key2: 'value2' },
        },
      ],
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Given an empty annotation query', () => {
    let result;
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: '',
      },
    };

    beforeAll(async () => {
      result = await ds.annotationQuery(annotationOption);
    });

    it('should return nothing', () => {
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
      expect(result).toEqual([]);
    });
  });

  describe('Given an annotation query without any filters', () => {
    let result;
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: 'events{}',
      },
    };

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(annotationResponse));
      result = await ds.annotationQuery(annotationOption);
    });

    it('should return all events', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(result.length).toEqual(annotationResponse.data.items.length);
    });
  });

  describe('Given an annotation query where no events are returned', () => {
    let result;
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: 'events{}',
      },
    };

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve({ data: { data: { items: [] } } }));
      result = await ds.annotationQuery(annotationOption);
    });

    it('should return all events', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(result).toEqual([]);
    });
  });

  describe('Given an annotation query', () => {
    let result;
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: "events{assetIds=[123], type='type 1'}",
      },
    };
    const response = _.cloneDeep(annotationResponse);
    response.data.items = annotationResponse.data.items.filter(
      item => item.assetIds.some(id => id === 123) && item.type === 'type 1'
    );

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(response));
      result = await ds.annotationQuery(annotationOption);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct events', () => {
      expect(result.length).toEqual(2);
    });
  });

  describe('Given an annotation query with a metadata request', () => {
    let result;
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: "events{metadata={key1='value1', key2='value2'}}",
      },
    };
    const response = _.cloneDeep(annotationResponse);
    response.data.items = annotationResponse.data.items.filter(item => item.metadata);

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(response));
      result = await ds.annotationQuery(annotationOption);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct event', () => {
      expect(result.length).toEqual(1);
    });
  });

  describe('Given an annotation query where nothing is returned', () => {
    let result;
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: "events{type='non-existant type'}",
      },
    };
    const response = _.cloneDeep(annotationResponse);
    response.data.items = [];

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(response));
      result = await ds.annotationQuery(annotationOption);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct events', () => {
      expect(result).toEqual([]);
    });
  });

  describe('Given an annotation query with filters', () => {
    let result;
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: "events{description=~'event.*', type!='type 1'}",
      },
    };

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(annotationResponse));
      result = await ds.annotationQuery(annotationOption);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct events', () => {
      expect(result.length).toEqual(3);
    });
  });

  describe('Given an annotation query with variables', () => {
    let result;
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: "events{assetIds=[$AssetVariable], description!~'event.*', metadata={key1=~''}}",
      },
    };
    const response = _.cloneDeep(annotationResponse);
    response.data.items = annotationResponse.data.items.filter(item =>
      item.assetIds.some(id => id === 123)
    );

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(annotationResponse));
      result = await ds.annotationQuery(annotationOption);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct events', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given an annotation query with an incomplete event expression', () => {
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: 'events{ ',
      },
    };
    beforeAll(async () => {
      backendSrvMock.datasourceRequest.mockReset();
    });
    it('should throw a parse error', () => {
      expect(ds.annotationQuery(annotationOption)).toThrowErrorMatchingSnapshot();
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
  });

  describe('Given an annotation query with an incorrect event expression', () => {
    const annotationOption: any = {
      range: {
        from: '1549336675000',
        to: '1549338475000',
      },
      annotation: {
        query: 'events{ name=~event, foo}',
      },
    };
    it('should throw a parse error', () => {
      expect(ds.annotationQuery(annotationOption)).toThrowErrorMatchingSnapshot();
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
  });
});
