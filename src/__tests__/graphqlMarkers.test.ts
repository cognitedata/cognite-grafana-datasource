import { buildSchema } from 'graphql';
import { getGraphqlMarkers } from '../components/graphqlAutocomplete';

const schema = buildSchema(`
  type Pump { name: String, pressure: Float }
  input NameFilter { eq: String }
  input PumpFilter { name: NameFilter }
  type Query { listPump(filter: PumpFilter): [Pump] }
`);

describe('getGraphqlMarkers', () => {
  it('marks a syntax error where it is', () => {
    const text = '{ listPump { name ';
    const [marker] = getGraphqlMarkers(text);
    expect(marker.severity).toBe('error');
    expect(marker.startOffset).toBeLessThanOrEqual(text.length);
  });

  it('marks a field the data model does not have, once the schema is known', () => {
    const text = '{\n  listPump {\n    flow\n  }\n}';
    expect(getGraphqlMarkers(text)).toEqual([]);
    const markers = getGraphqlMarkers(text, schema);
    expect(markers).toHaveLength(1);
    expect(markers[0].message).toMatch(/flow/);
    expect(text.slice(markers[0].startOffset, markers[0].endOffset)).toBe('flow');
  });

  it('leaves dashboard variables alone, in every syntax Grafana accepts', () => {
    for (const value of ['$tag', '${tag}', '${tag:csv}', '[[tag]]']) {
      const text = `{ listPump(filter: {name: {eq: ${value}}}) { name } }`;
      expect(getGraphqlMarkers(text, schema)).toEqual([]);
    }
  });

  it('still marks a mistake after a dashboard variable, at its own text', () => {
    const text = '{ listPump(filter: {name: {eq: ${tag}}}) { flow } }';
    const [marker] = getGraphqlMarkers(text, schema);
    expect(text.slice(marker.startOffset, marker.endOffset)).toBe('flow');
  });

  it('has nothing to say about an empty editor', () => {
    expect(getGraphqlMarkers('  ', schema)).toEqual([]);
  });
});
