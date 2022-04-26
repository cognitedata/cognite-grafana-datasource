import { createRelationshipsNode } from '../datasources/RelationshipsDatasource';

describe('Relationships createRelationshipsNode', () => {
  const refId = 'A';
  describe('with empty relationships list', () => {
    const relationshipsList = [];

    it('return nodes', () => {
      expect(createRelationshipsNode(relationshipsList, refId)).toHaveProperty('nodes');
    });

    it('return edges', () => {
      expect(createRelationshipsNode(relationshipsList, refId)).toHaveProperty('edges');
    });
    it('match snapshot', () => {
      expect(createRelationshipsNode(relationshipsList, refId)).toMatchSnapshot();
    });
  });
  describe('adds value when relationshipsList is present', () => {
    const relationshipsList = [
      {
        externalId: 'test',
        sourceExternalId: 'test-source',
        source: {
          externalId: 'test-source',
          name: 'Test Source',
          description: 'test source description',
          metadata: {},
        },
        targetExternalId: 'test-target',
        target: {
          name: 'Test  Target',
          metadata: {},
          description: 'Test Target descriptipn',
          externalId: 'test-target',
        },
        labels: [{ externalId: 'Test Label ExternalId' }],
      },
    ];
    it('match snapshot', () => {
      expect(createRelationshipsNode(relationshipsList, refId)).toMatchSnapshot();
    });
  });
});
