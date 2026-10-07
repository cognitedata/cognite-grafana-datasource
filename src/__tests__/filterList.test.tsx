import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FilterList } from '../components/records/FilterList';
import { RecordViewDefinition } from '../types/records';
import { RecordsFilterRow } from '../types';
import { Connector } from '../connector';

const connector = {
  fetchItems: jest.fn().mockResolvedValue([]),
  fetchData: jest.fn().mockResolvedValue({ data: {} }),
} as unknown as Connector;

const viewDef = {
  space: 'opcua_alarms',
  externalId: 'OpcUaArchivedAlarmConditionView',
  version: 'v1',
  streamId: ['historic_alarms'],
  properties: {
    // Annotated: the editor can search the view it points at
    assetRef: {
      type: {
        type: 'direct',
        source: {
          type: 'view',
          space: 'opcua_alarms',
          externalId: 'OpcUaAssetView',
          version: 'v1',
        },
      },
    },
    // Unannotated: no target view, so no searchable list is possible
    looseRef: { type: { type: 'direct' } },
    Severity: { type: { type: 'int64' } },
  },
} as unknown as RecordViewDefinition;

const render = (filters: RecordsFilterRow[]) =>
  renderToStaticMarkup(
    <FilterList
      filters={filters}
      viewDef={viewDef}
      connector={connector}
      onChange={jest.fn()}
    />
  );

describe('direct relation filters', () => {
  it('offers a searchable picker for an annotated relation', () => {
    const html = render([
      { property: 'assetRef', propertyType: 'direct', operator: 'equals', value: '' },
    ]);
    expect(html).toContain('search, reference or $variable');
    // No raw-reference placeholder: the picker is the primary affordance
    expect(html).not.toContain('externalId&quot;:&quot;…');
  });

  it('offers a multi picker for "is any of"', () => {
    const html = render([
      { property: 'assetRef', propertyType: 'direct', operator: 'in', values: [] },
    ]);
    expect(html).toContain('search or $variable');
  });

  it('falls back to free text when the relation names no target view', () => {
    const html = render([
      { property: 'looseRef', propertyType: 'direct', operator: 'equals', value: '' },
    ]);
    // The search endpoint requires a view, so there is nothing to list
    expect(html).toContain('externalId');
    expect(html).toContain('$variable');
  });

  it('flags a value that is neither a reference nor a variable', () => {
    const html = render([
      {
        property: 'looseRef',
        propertyType: 'direct',
        operator: 'equals',
        // The legacy shorthand, which used to match nothing without saying why
        value: 'my_space:pump-001',
      },
    ]);
    expect(html).toContain('Needs an instance reference');
  });

  it('accepts a well-formed reference without complaint', () => {
    const html = render([
      {
        property: 'looseRef',
        propertyType: 'direct',
        operator: 'equals',
        value: '{"space":"s","externalId":"e"}',
      },
    ]);
    expect(html).not.toContain('Needs an instance reference');
  });

  it('accepts a variable without complaint', () => {
    const html = render([
      { property: 'looseRef', propertyType: 'direct', operator: 'equals', value: '$asset' },
    ]);
    expect(html).not.toContain('Needs an instance reference');
  });

  it('leaves other property types alone', () => {
    const html = render([
      { property: 'Severity', propertyType: 'int64', operator: 'equals', value: '5' },
    ]);
    expect(html).not.toContain('Needs an instance reference');
    expect(html).toContain('value or $variable');
  });

  it('renders every row shape without crashing', () => {
    expect(() =>
      render([
        { property: 'assetRef', propertyType: 'direct', operator: 'exists' },
        { property: 'assetRef', propertyType: 'direct', operator: 'equals', value: '' },
        { property: 'assetRef', propertyType: 'direct', operator: 'in', values: ['$a'] },
        { property: 'looseRef', propertyType: 'direct', operator: 'in', values: [] },
        { property: 'Severity', propertyType: 'int64', operator: 'range', gte: '1', lte: '9' },
      ])
    ).not.toThrow();
  });
});

describe('per-row negation', () => {
  const render = (rows: RecordsFilterRow[]) =>
    renderToStaticMarkup(
      <FilterList filters={rows} viewDef={viewDef as unknown as RecordViewDefinition} connector={connector} onChange={jest.fn()} />
    );

  it('offers a NOT toggle on every row, off by default', () => {
    const html = render([
      { property: 'assetRef', propertyType: 'direct', operator: 'equals', value: '' },
      { property: 'other', propertyType: 'text', operator: 'prefix', value: 'x' },
    ]);
    expect(html).toContain('records-negate-filter-0');
    expect(html).toContain('records-negate-filter-1');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('aria-pressed="true"');
  });

  it('marks a negated row as pressed', () => {
    const html = render([
      { property: 'other', propertyType: 'text', operator: 'prefix', value: 'x', negate: true },
    ]);
    expect(html).toContain('aria-pressed="true"');
  });
});
