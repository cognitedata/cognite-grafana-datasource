import React from 'react';
import { act, render } from '@testing-library/react';
import { InstancePicker } from '../components/common/InstancePicker';

const VIEW_A = { space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' };
const VIEW_B = { space: 'cdf_cdm', externalId: 'CogniteEquipment', version: 'v1' };

describe('InstancePicker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('ignores a failure from a search for the view it showed before', async () => {
    let failSearchA: (error: unknown) => void = () => {};
    const fetchItems = jest
      .fn()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (failSearchA = reject)))
      .mockImplementation(() => new Promise(() => {}));
    const connector = { fetchItems } as any;
    const onError = jest.fn();
    const picker = (view: typeof VIEW_A) => (
      <InstancePicker
        connector={connector}
        view={view}
        value={[]}
        onChange={jest.fn()}
        onError={onError}
      />
    );

    const { rerender } = render(picker(VIEW_A));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(fetchItems).toHaveBeenCalledTimes(1);

    rerender(picker(VIEW_B));
    await act(async () => {
      failSearchA({ status: 400, data: { error: { message: 'view A failed' } } });
      await Promise.resolve();
    });

    expect(onError).not.toHaveBeenCalledWith(expect.stringContaining('Search failed'));
  });
});
