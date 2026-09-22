import { defaults } from 'lodash';
import { getMockedDataSource } from '../test_utils';
import { CogniteQuery, defaultQuery, Tab } from '../types';

/**
 * Every panel query is merged with `defaultQuery` by the query editor, so each target
 * carries a `flexibleDataModellingQuery` whatever tab it is on. Interpolation has to
 * survive that, on every tab.
 */
const asPanelTarget = (partial: Partial<CogniteQuery>): CogniteQuery =>
  defaults({ refId: 'A', ...partial }, defaultQuery) as CogniteQuery;

describe('interpolating a panel query built from the defaults', () => {
  const fetcher = { fetch: jest.fn().mockResolvedValue({ data: { items: [] } }) };

  it.each([
    ['Time series', Tab.Timeseries],
    ['GraphQL', Tab.FlexibleDataModelling],
  ])('does not throw on the %s tab when no label is set', (_name, tab) => {
    // Regression: the default FDM query has no `label`, and interpolating it
    // unguarded threw "Cannot read properties of undefined (reading 'trim')" for
    // every panel query, whichever tab was active.
    const ds = getMockedDataSource(fetcher);
    const target = asPanelTarget({ tab });
    expect(target.flexibleDataModellingQuery.label).toBeUndefined();

    expect(() => (ds as any).replaceVariablesInTarget(target, {})).not.toThrow();
  });

  it('still interpolates a label that is set', () => {
    const ds = getMockedDataSource(fetcher);
    const target = asPanelTarget({
      tab: Tab.FlexibleDataModelling,
      flexibleDataModellingQuery: {
        ...defaultQuery.flexibleDataModellingQuery!,
        label: '{{name}}',
      },
    });

    const result = (ds as any).replaceVariablesInTarget(target, {});
    expect(result.flexibleDataModellingQuery.label).toBe('{{name}}');
  });
});
