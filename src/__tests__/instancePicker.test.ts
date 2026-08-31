import { DMSInstance } from '../types/dms';
import {
  buildInstanceSearchRequest,
  encodeInstanceRef,
  parseInstanceRef,
  toInstanceOptions,
  toPickedInstance,
  toStoredOptions,
} from '../components/common/InstancePicker';

const VIEW = { space: 'opcua_alarms', externalId: 'OpcUaAssetView', version: 'v1' };

const instance = (
  space: string,
  externalId: string,
  props?: Record<string, any>
): DMSInstance =>
  ({
    instanceType: 'node',
    space,
    externalId,
    version: 1,
    createdTime: 1,
    lastUpdatedTime: 1,
    ...(props ? { properties: { [VIEW.space]: { 'OpcUaAssetView/v1': props } } } : {}),
  } as DMSInstance);

describe('buildInstanceSearchRequest', () => {
  it('requires every term to match, rather than any one of them', () => {
    // The API defaults to OR, which widens the results with each word typed
    expect(buildInstanceSearchRequest(VIEW, 'paper machine').operator).toBe('AND');
  });

  it('searches the view, with the typed query trimmed', () => {
    expect(buildInstanceSearchRequest(VIEW, '  pump  ')).toEqual({
      view: { type: 'view', ...VIEW },
      query: 'pump',
      filter: undefined,
      limit: 1000,
      operator: 'AND',
    });
  });

  it('names no properties, so every text field in the view is searched', () => {
    expect(buildInstanceSearchRequest(VIEW, 'pump')).not.toHaveProperty('properties');
  });

  it('passes a space scope through', () => {
    const filter = { inSpace: 'paper_mill' };
    expect(buildInstanceSearchRequest(VIEW, '', filter, 100)).toMatchObject({
      filter,
      limit: 100,
    });
  });

  it('clamps to the 1000 the API allows', () => {
    expect(buildInstanceSearchRequest(VIEW, '', undefined, 5000).limit).toBe(1000);
  });
});

describe('encodeInstanceRef / parseInstanceRef', () => {
  it('emits only the two fields the API accepts', () => {
    expect(encodeInstanceRef({ space: 's', externalId: 'e' })).toBe(
      '{"space":"s","externalId":"e"}'
    );
  });

  it('round-trips an externalId containing colons', () => {
    // The reason the encoding is JSON rather than "space:externalId"
    const ref = { space: 'opcua_alarms', externalId: 'asset:equip:iaa_met_34es7512' };
    expect(parseInstanceRef(encodeInstanceRef(ref))).toEqual(ref);
  });

  it('drops extra keys, which the API would reject', () => {
    expect(parseInstanceRef('{"space":"s","externalId":"e","name":"Pump"}')).toEqual({
      space: 's',
      externalId: 'e',
    });
  });

  it('rejects anything that is not a usable reference', () => {
    expect(parseInstanceRef('')).toBeNull();
    expect(parseInstanceRef('not json')).toBeNull();
    expect(parseInstanceRef('my_space:pump-001')).toBeNull();
    expect(parseInstanceRef('[{"space":"s","externalId":"e"}]')).toBeNull();
    expect(parseInstanceRef('{"space":"s"}')).toBeNull();
    expect(parseInstanceRef('{"space":"","externalId":"e"}')).toBeNull();
    expect(parseInstanceRef('{"space":1,"externalId":"e"}')).toBeNull();
  });

  it('never throws', () => {
    expect(() => parseInstanceRef('{"space":')).not.toThrow();
  });
});

describe('toInstanceOptions', () => {
  it('labels with the name and encodes the reference as the value', () => {
    const [option] = toInstanceOptions(
      [instance('paper_mill', 'ASSET_PM_AREA', { name: '60-PM - Paper Machine Area' })],
      VIEW
    );
    expect(option.label).toBe('60-PM - Paper Machine Area');
    expect(option.value).toBe('{"space":"paper_mill","externalId":"ASSET_PM_AREA"}');
    expect(option.description).toBe('Space: paper_mill, External ID: ASSET_PM_AREA');
  });

  it('falls back to the externalId when the view exposes no name', () => {
    const [option] = toInstanceOptions([instance('s', 'NO_NAME', { other: 1 })], VIEW);
    expect(option.label).toBe('NO_NAME');
    expect(option.name).toBeUndefined();
  });

  it('falls back when the instance carries no properties at all', () => {
    const [option] = toInstanceOptions([instance('s', 'BARE')], VIEW);
    expect(option.label).toBe('BARE');
  });

  it('ignores an empty name rather than rendering a blank label', () => {
    const [option] = toInstanceOptions([instance('s', 'E', { name: '' })], VIEW);
    expect(option.label).toBe('E');
  });

  it('reads properties from the searched view, not another view on the instance', () => {
    const mixed = {
      ...instance('s', 'E'),
      properties: {
        other_space: { 'OtherView/v1': { name: 'wrong' } },
        [VIEW.space]: { 'OpcUaAssetView/v1': { name: 'right' } },
      },
    } as DMSInstance;
    expect(toInstanceOptions([mixed], VIEW)[0].label).toBe('right');
  });

  it('encodes externalIds containing colons without ambiguity', () => {
    const [option] = toInstanceOptions(
      [instance('opcua_alarms', 'asset:equip:iaa_met_34es7512')],
      VIEW
    );
    expect(option.value).toBe(
      '{"space":"opcua_alarms","externalId":"asset:equip:iaa_met_34es7512"}'
    );
  });

  it('copes with no results', () => {
    expect(toInstanceOptions([], VIEW)).toEqual([]);
    expect(toInstanceOptions(undefined as any, VIEW)).toEqual([]);
  });
});

describe('toPickedInstance', () => {
  it('keeps the parts a search option already carries', () => {
    expect(
      toPickedInstance({
        label: 'Pump',
        value: '{"space":"s","externalId":"e"}',
        space: 's',
        externalId: 'e',
        name: 'Pump',
      })
    ).toEqual({ value: '{"space":"s","externalId":"e"}', space: 's', externalId: 'e', name: 'Pump' });
  });

  it('derives the parts from a typed reference', () => {
    expect(toPickedInstance({ label: 'x', value: '{"space":"s","externalId":"e"}' })).toEqual({
      value: '{"space":"s","externalId":"e"}',
      space: 's',
      externalId: 'e',
      name: undefined,
    });
  });

  it('keeps an unreadable value verbatim rather than inventing parts', () => {
    expect(toPickedInstance({ label: 'legacy', value: 'legacy' })).toEqual({
      value: 'legacy',
      space: undefined,
      externalId: undefined,
      name: undefined,
    });
  });
});

describe('toStoredOptions', () => {
  it('rebuilds a display option from a saved reference', () => {
    const [option] = toStoredOptions([{ value: '{"space":"s","externalId":"e"}' }]);
    expect(option.label).toBe('e');
    expect(option.description).toBe('Space: s, External ID: e');
  });

  it('prefers a remembered name over the externalId', () => {
    const [option] = toStoredOptions([
      { value: '{"space":"s","externalId":"e"}', name: 'Pump 1' },
    ]);
    expect(option.label).toBe('Pump 1');
  });

  it('shows an unreadable value as itself, with no invented description', () => {
    const [option] = toStoredOptions([{ value: 'legacy' }]);
    expect(option.label).toBe('legacy');
    expect(option.description).toBeUndefined();
  });

  it('drops empty entries', () => {
    expect(toStoredOptions([{ value: '' }, null as any])).toEqual([]);
  });
});
