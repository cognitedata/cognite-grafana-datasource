import {
  encodeInstanceRef,
  isVariableToken,
  parseInstanceRef,
  readInstanceRef,
  splitTopLevel,
} from '../cdf/instanceRef';

describe('encodeInstanceRef', () => {
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
});

describe('parseInstanceRef', () => {
  it('reads a well-formed reference', () => {
    expect(parseInstanceRef('{"space":"s","externalId":"e"}')).toEqual({
      space: 's',
      externalId: 'e',
    });
  });

  it('drops extra keys, which the API would reject', () => {
    expect(parseInstanceRef('{"space":"s","externalId":"e","name":"Pump"}')).toEqual({
      space: 's',
      externalId: 'e',
    });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseInstanceRef('  {"space":"s","externalId":"e"}  ')).toEqual({
      space: 's',
      externalId: 'e',
    });
  });

  it('rejects the legacy colon shorthand rather than mis-parsing it', () => {
    // Previously this produced {space:'a', externalId:'b'} and silently matched nothing
    expect(parseInstanceRef('a:b:c:d')).toBeNull();
    expect(parseInstanceRef('my_space:pump-001')).toBeNull();
  });

  it('rejects anything that is not a usable reference', () => {
    expect(parseInstanceRef('')).toBeNull();
    expect(parseInstanceRef('   ')).toBeNull();
    expect(parseInstanceRef('not json')).toBeNull();
    expect(parseInstanceRef('{')).toBeNull();
    expect(parseInstanceRef('[{"space":"s","externalId":"e"}]')).toBeNull();
    expect(parseInstanceRef('{"space":"s"}')).toBeNull();
    expect(parseInstanceRef('{"externalId":"e"}')).toBeNull();
    expect(parseInstanceRef('{"space":"","externalId":"e"}')).toBeNull();
    expect(parseInstanceRef('{"space":"s","externalId":"  "}')).toBeNull();
    expect(parseInstanceRef('{"space":1,"externalId":"e"}')).toBeNull();
  });

  it('never throws', () => {
    expect(() => parseInstanceRef('{"space":')).not.toThrow();
  });
});

describe('readInstanceRef', () => {
  it('reads top-level identifiers first', () => {
    expect(
      readInstanceRef({ space: 's', externalId: 'e', asset: { space: 'x', externalId: 'y' } })
    ).toEqual({ space: 's', externalId: 'e' });
  });

  it('reads the one nested object carrying a reference', () => {
    expect(readInstanceRef({ name: 'Pump', instanceId: { space: 's', externalId: 'e' } })).toEqual(
      { space: 's', externalId: 'e' }
    );
  });

  it('refuses to guess between two nested references', () => {
    expect(
      readInstanceRef({
        asset: { space: 's', externalId: 'ASSET' },
        unit: { space: 's', externalId: 'UNIT' },
      })
    ).toBeNull();
  });

  it('never takes one element of a list for the whole', () => {
    expect(readInstanceRef({ assets: [{ space: 's', externalId: 'a' }] })).toBeNull();
    expect(readInstanceRef([{ space: 's', externalId: 'a' }] as any)).toBeNull();
  });
});

describe('isVariableToken', () => {
  it('recognises every syntax Grafana accepts', () => {
    expect(isVariableToken('$asset')).toBe(true);
    expect(isVariableToken('${asset}')).toBe(true);
    expect(isVariableToken('[[asset]]')).toBe(true);
    expect(isVariableToken('  $asset  ')).toBe(true);
  });

  it('does not mistake a reference or plain text for a variable', () => {
    expect(isVariableToken('{"space":"s","externalId":"e"}')).toBe(false);
    expect(isVariableToken('asset')).toBe(false);
    expect(isVariableToken('')).toBe(false);
  });
});

describe('splitTopLevel', () => {
  it('behaves like split(",") when there is no structure', () => {
    expect(splitTopLevel('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(splitTopLevel('a')).toEqual(['a']);
    expect(splitTopLevel('')).toEqual([]);
  });

  it('trims and drops empties, as the old splitter did', () => {
    expect(splitTopLevel(' a , b ,, c ')).toEqual(['a', 'b', 'c']);
  });

  it('keeps each instance reference whole', () => {
    // A plain split(',') tears these in half
    expect(
      splitTopLevel('{"space":"s","externalId":"a"},{"space":"s","externalId":"b"}')
    ).toEqual(['{"space":"s","externalId":"a"}', '{"space":"s","externalId":"b"}']);
  });

  it('ignores commas inside quoted strings', () => {
    expect(splitTopLevel('{"space":"s","externalId":"a,b"}')).toEqual([
      '{"space":"s","externalId":"a,b"}',
    ]);
  });

  it('handles escaped quotes and nested arrays', () => {
    expect(splitTopLevel('{"a":"x\\",y"},{"b":[1,2]}')).toEqual([
      '{"a":"x\\",y"}',
      '{"b":[1,2]}',
    ]);
  });

  it('does not run away on unbalanced input', () => {
    expect(splitTopLevel('},a')).toEqual(['}', 'a']);
  });
});
