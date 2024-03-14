import { CogniteEvent } from 'cdf/types';
import { convertEventsDateFields } from './EventsDatasource';

describe('convertEventsDateFields', () => {
  it('should convert date fields to Date objects when start time is available', () => {
    const events: CogniteEvent[] = [
      {
        id: 1,
        createdTime: 1708415906649,
        lastUpdatedTime: 1708415906786,
        startTime: 1708415893288,
      },
    ];
    const result = convertEventsDateFields(events as CogniteEvent[]);
    expect(result[0].createdTime).toBeInstanceOf(Date);
    expect(result[0].lastUpdatedTime).toBeInstanceOf(Date);
    expect(result[0].startTime).toBeInstanceOf(Date);
  });

  it('should convert date fields to Date objects when end time is available', () => {
    const events: CogniteEvent[] = [
      {
        id: 1,
        createdTime: 1708415906649,
        lastUpdatedTime: 1708415906786,
        endTime: 1708415893288,
      },
    ];
    const result = convertEventsDateFields(events as CogniteEvent[]);
    expect(result[0].createdTime).toBeInstanceOf(Date);
    expect(result[0].lastUpdatedTime).toBeInstanceOf(Date);
    expect(result[0].endTime).toBeInstanceOf(Date);
  });

  it('should convert date fields to Date objects when both start and end time are available', () => {
    const events: CogniteEvent[] = [
      {
        id: 1,
        createdTime: 1708415906649,
        lastUpdatedTime: 1708415906786,
        startTime: 1708415893288,
        endTime: 1708415893288,
      },
    ];
    const result = convertEventsDateFields(events as CogniteEvent[]);
    expect(result[0].createdTime).toBeInstanceOf(Date);
    expect(result[0].lastUpdatedTime).toBeInstanceOf(Date);
    expect(result[0].startTime).toBeInstanceOf(Date);
    expect(result[0].endTime).toBeInstanceOf(Date);
  });

  it('should not convert date fields to Date objects when they are not available', () => {
    const events: CogniteEvent[] = [
      {
        id: 1,
        createdTime: 1708415906649,
        lastUpdatedTime: 1708415906786,
      },
    ];
    const result = convertEventsDateFields(events as CogniteEvent[]);
    expect(result[0].createdTime).toBeInstanceOf(Date);
    expect(result[0].lastUpdatedTime).toBeInstanceOf(Date);
    expect(result[0].startTime).toBeUndefined();
    expect(result[0].endTime).toBeUndefined();
  });
});
