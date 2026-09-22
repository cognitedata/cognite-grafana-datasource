import { defaults } from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { interpolateInstanceRefs, toGraphqlInstanceLiteral } from '../cdf/graphqlInstanceRefs';
import { runGraphqlQuery } from '../cdf/graphqlVariables';
import { getMockedDataSource } from '../test_utils';
import { CogniteQuery, defaultQuery, Tab } from '../types';

// The mock's AssetRef / AssetRefs variables hold instance references; the others
// hold plain values.
const PM = '{space: "paper_mill", externalId: "ASSET_PM_AREA"}';
const BL = '{space: "paper_mill", externalId: "ASSET_BL_AREA"}';

const interpolate = (query: string, scopedVars?: any) =>
  interpolateInstanceRefs(query, getTemplateSrv(), scopedVars);

describe('interpolateInstanceRefs', () => {
  it('renders a whole reference as a GraphQL input object, not JSON', () => {
    expect(interpolate('instance: ${AssetRef}')).toBe(`instance: ${PM}`);
    expect(interpolate('instance: $AssetRef')).toBe(`instance: ${PM}`);
    expect(toGraphqlInstanceLiteral({ space: 's', externalId: 'e' })).toBe(
      '{space: "s", externalId: "e"}'
    );
  });

  it('renders a multi-value variable as a list of input objects', () => {
    expect(interpolate('instances: $AssetRefs')).toBe(`instances: [${PM}, ${BL}]`);
  });

  it('expands "All" from the variable options rather than pasting the sentinel', () => {
    expect(interpolate('instances: $AssetRefsAll')).toBe(`instances: [${PM}, ${BL}]`);
    expect(interpolate('in: ["${AssetRefsAll.externalId}"]')).toBe(
      'in: ["ASSET_PM_AREA","ASSET_BL_AREA"]'
    );
  });

  it('leaves "All" for Grafana when the variable has a custom all value', () => {
    expect(interpolate('$AssetRefsCustomAll')).toBe('$AssetRefsCustomAll');
  });

  it('accepts the bracket syntax', () => {
    expect(interpolate('instance: [[AssetRef]]')).toBe(`instance: ${PM}`);
    expect(interpolate('space: "[[AssetRef.space]]"')).toBe('space: "paper_mill"');
    expect(interpolate('[[TimeseriesVariable]]')).toBe('[[TimeseriesVariable]]');
  });

  it('picks one part of a reference with the field-path syntax', () => {
    // The syntax Grafana itself offers; on a JSON string it would yield "".
    expect(interpolate('space: "${AssetRef.space}"')).toBe('space: "paper_mill"');
    expect(interpolate('externalId: "${AssetRef.externalId}"')).toBe(
      'externalId: "ASSET_PM_AREA"'
    );
    expect(interpolate('"$AssetRef.space"')).toBe('"paper_mill"');
  });

  it('joins the parts of a multi-value variable so a quoted use forms a list', () => {
    expect(interpolate('in: ["${AssetRefs.externalId}"]')).toBe(
      'in: ["ASSET_PM_AREA","ASSET_BL_AREA"]'
    );
  });

  it('escapes quotes inside identifiers', () => {
    const scopedVars = { Ref: { value: '{"space":"s","externalId":"say \\"hi\\""}' } };
    expect(interpolate('$Ref', scopedVars)).toBe('{space: "s", externalId: "say \\"hi\\""}');
  });

  it('escapes a part so it stays inside the string it is quoted in', () => {
    const scopedVars = { Ref: { value: '{"space":"s","externalId":"a\\"b\\\\c"}' } };
    expect(interpolate('"${Ref.externalId}"', scopedVars)).toBe('"a\\"b\\\\c"');
  });

  it('prefers a scoped value, as a repeated panel supplies', () => {
    const scopedVars = { AssetRef: { value: '{"space":"x","externalId":"y"}' } };
    expect(interpolate('$AssetRef', scopedVars)).toBe('{space: "x", externalId: "y"}');
  });

  it('leaves every other variable and syntax for Grafana', () => {
    const untouched = [
      '$TimeseriesVariable',
      '${MultiValue}',
      '$NoSuchVariable',
      '${AssetRef:json}',
      '${AssetRef.name}',
      '$__interval',
      'query($id: String)',
    ];
    untouched.forEach((query) => expect(interpolate(query)).toBe(query));
  });

  it('does not swallow the trailing text of a longer name', () => {
    expect(interpolate('$AssetRefX')).toBe('$AssetRefX');
    expect(interpolate('$AssetRef.spaceship')).toBe(`${PM}.spaceship`);
  });
});

describe('instance references reach the GraphQL request', () => {
  const query = `query MyQuery {
  getCogniteAssetById(instance: { space: "\${asset.space}", externalId: "\${asset.externalId}" }) {
    items { name }
  }
}`;
  const scopedVars = { asset: { value: '{"space":"paper_mill","externalId":"ASSET_PM_AREA"}' } };

  it('through a variable query and the preview panes', async () => {
    const connector = { fetchQuery: jest.fn().mockResolvedValue({ data: {} }) } as any;
    await runGraphqlQuery(connector, getTemplateSrv(), {
      graphqlQuery: 'instance: $AssetRef',
      dataModel: { space: 'cdf_cdm', externalId: 'CogniteCore', version: 'v1' },
    });
    expect(JSON.parse(connector.fetchQuery.mock.calls[0][0].data).query).toBe(`instance: ${PM}`);
  });

  it('through a panel query, honouring its scoped variables', () => {
    const ds = getMockedDataSource({ fetch: jest.fn() });
    const target = defaults(
      {
        refId: 'A',
        tab: Tab.FlexibleDataModelling,
        flexibleDataModellingQuery: {
          ...defaultQuery.flexibleDataModellingQuery!,
          graphQlQuery: query,
        },
      },
      defaultQuery
    ) as CogniteQuery;

    const result = (ds as any).replaceVariablesInTarget(target, scopedVars);
    expect(result.flexibleDataModellingQuery.graphQlQuery).toContain(
      'instance: { space: "paper_mill", externalId: "ASSET_PM_AREA" }'
    );
  });
});
