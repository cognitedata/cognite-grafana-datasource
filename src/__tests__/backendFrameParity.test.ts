import fs from 'fs';
import path from 'path';
import { DataFrame, DataFrameJSON, FieldType, dataFrameFromJSON, dataFrameToJSON } from '@grafana/data';

function expectBackendFrames(fixture: string, frontend: DataFrame[]) {
  const dir = process.env.CDF_PARITY_EXPORT_DIR ?? path.resolve(__dirname, '../../testdata/backend-parity');
  const wire: DataFrameJSON[] = JSON.parse(fs.readFileSync(path.join(dir, fixture + '.json'), 'utf8'));
  const backendFrames = wire.map(dataFrameFromJSON).map(dataFrameToJSON);

  // The Go SDK adds its storage type (for example float64) to the wire schema.
  // Grafana's field type, labels, config, metadata and ordered values are compared in full.
  for (const frame of backendFrames) {
    for (const field of frame.schema?.fields ?? []) {
      if ('typeInfo' in field) {
        delete field.typeInfo;
      }
    }
  }
  expect(backendFrames).toEqual(frontend.map(dataFrameToJSON));
}

it('compares Go SDK frames as Grafana delivers them to the frontend', () => {
  expectBackendFrames('runtime-frame', [{
    name: 'pressure',
    refId: 'B',
    length: 1,
    fields: [
      { name: 'Time', type: FieldType.time, config: {}, values: [1000] },
      { name: 'pressure', type: FieldType.number, labels: { asset: 'pump' }, config: { unit: 'bar' }, values: [2.5] },
    ],
  }]);
});
